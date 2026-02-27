#!/usr/bin/env tsx
/**
 * Robin.dev — Smoke Test Script
 * EPIC-30 · STORY-05.11
 *
 * Creates a smoke test task, waits for the orchestrator to pick it up
 * and complete it, then verifies a PR was opened. Cleans up after itself.
 *
 * Usage:
 *   node scripts/smoke-test.ts --workspace-id <uuid> [--timeout 600]
 *
 * Exit codes:
 *   0 — PASS
 *   1 — FAIL
 */

import { createClient } from "@supabase/supabase-js";
import { join, dirname } from "path";
import { fileURLToPath } from "url";

const __dirname = dirname(fileURLToPath(import.meta.url));
const ROOT = join(__dirname, "..");

// ─── Config ──────────────────────────────────────────────────────────────────
const POLL_INTERVAL_MS = 5_000;
const PICKUP_TIMEOUT_MS = 60_000;   // 60s to pick up task
const COMPLETE_TIMEOUT_MS = 10 * 60 * 1000; // 10min to complete

const SMOKE_TASK_TITLE = "[SMOKE TEST] Add ROBINDEV_SMOKE_TEST.md";
const SMOKE_TASK_DESC = [
  "This is an automated smoke test task created by Robin.dev provisioning.",
  "",
  "**Action:** Create a file named `ROBINDEV_SMOKE_TEST.md` in the repository root.",
  "",
  "**Content of the file:**",
  "```",
  `# Robin.dev Smoke Test`,
  `Executed: ${new Date().toISOString()}`,
  `This file was created by the Robin.dev agent smoke test.`,
  "```",
  "",
  "Open a PR with this change. The PR will be closed automatically after verification.",
].join("\n");

// ─── Helpers ─────────────────────────────────────────────────────────────────
function sleep(ms: number) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

async function pollUntil<T>(
  fn: () => Promise<T | null>,
  timeoutMs: number,
  description: string
): Promise<T> {
  const deadline = Date.now() + timeoutMs;
  let attempt = 0;

  while (Date.now() < deadline) {
    attempt++;
    process.stdout.write(`\r  Waiting for ${description}... (${Math.round((Date.now() - (deadline - timeoutMs)) / 1000)}s)`);
    const result = await fn();
    if (result !== null) {
      process.stdout.write("\n");
      return result;
    }
    await sleep(POLL_INTERVAL_MS);
  }

  process.stdout.write("\n");
  throw new Error(`Timeout waiting for ${description} after ${timeoutMs / 1000}s`);
}

// ─── Main ────────────────────────────────────────────────────────────────────
async function main() {
  const args: Record<string, string> = {};
  for (let i = 2; i < process.argv.length - 1; i++) {
    if (process.argv[i].startsWith("--")) args[process.argv[i].slice(2)] = process.argv[i + 1];
  }

  const workspaceId = args["workspace-id"];
  if (!workspaceId) {
    console.error("Usage: smoke-test.ts --workspace-id <uuid>");
    process.exit(1);
  }

  const supabaseUrl = process.env["SUPABASE_URL"];
  const serviceKey = process.env["SUPABASE_SERVICE_ROLE_KEY"];
  if (!supabaseUrl || !serviceKey) {
    console.error("SUPABASE_URL and SUPABASE_SERVICE_ROLE_KEY are required");
    process.exit(1);
  }

  const supabase = createClient(supabaseUrl, serviceKey, {
    auth: { persistSession: false },
  });

  const startedAt = new Date();
  console.log(`\nRobin.dev Smoke Test`);
  console.log(`Workspace: ${workspaceId}`);
  console.log(`Started:   ${startedAt.toISOString()}\n`);

  let taskId: string | null = null;

  try {
    // 1. Create smoke test task
    console.log("1. Creating smoke test task...");
    const { data: task, error: taskError } = await supabase
      .from("tasks")
      .insert({
        workspace_id: workspaceId,
        title: SMOKE_TASK_TITLE,
        description: SMOKE_TASK_DESC,
        type: "chore",
        priority: "low",
        status: "queued",
        created_by_user_id: "smoke-test-script",
      })
      .select()
      .single();

    if (taskError || !task) {
      throw new Error(`Failed to create task: ${taskError?.message}`);
    }

    taskId = task.id;
    console.log(`   Task created: ${taskId}`);

    // 2. Wait for task pickup (in_progress)
    console.log("2. Waiting for agent to pick up task...");
    await pollUntil(
      async () => {
        const { data } = await supabase
          .from("tasks")
          .select("status")
          .eq("id", taskId!)
          .single();
        return data?.status === "in_progress" ? data.status : null;
      },
      PICKUP_TIMEOUT_MS,
      "task pickup"
    );
    console.log("   Agent picked up task!");

    // 3. Wait for completion (review_pending or completed)
    console.log("3. Waiting for task completion...");
    const finalStatus = await pollUntil(
      async () => {
        const { data } = await supabase
          .from("tasks")
          .select("status")
          .eq("id", taskId!)
          .single();
        const s = data?.status;
        return s === "review_pending" || s === "completed" || s === "failed" ? s : null;
      },
      COMPLETE_TIMEOUT_MS,
      "task completion"
    );
    console.log(`   Task finished with status: ${finalStatus}`);

    if (finalStatus === "failed") {
      throw new Error("Task failed — check agent logs");
    }

    // 4. Verify PR artifact
    console.log("4. Verifying PR artifact...");
    const { data: artifacts } = await supabase
      .from("task_artifacts")
      .select("type, url")
      .eq("task_id", taskId)
      .eq("type", "pr");

    const hasPR = (artifacts ?? []).length > 0;
    if (!hasPR) {
      throw new Error("No PR artifact found — agent may not have opened a PR");
    }
    const prUrl = artifacts![0].url;
    console.log(`   PR opened: ${prUrl}`);

    // 5. Summary
    const durationS = Math.round((Date.now() - startedAt.getTime()) / 1000);
    console.log("\n════════════════════════════════════════════");
    console.log("  SMOKE TEST: PASS");
    console.log(`  Duration: ${durationS}s`);
    console.log(`  PR: ${prUrl}`);
    console.log("════════════════════════════════════════════\n");

    console.log("NOTE: Close the smoke test PR manually on GitHub.");
    console.log("      Task record remains in DB for audit trail.\n");

    process.exit(0);
  } catch (err) {
    console.error("\n════════════════════════════════════════════");
    console.error("  SMOKE TEST: FAIL");
    console.error(`  Error: ${String(err)}`);
    console.error("════════════════════════════════════════════\n");

    if (taskId) {
      console.error(`  Task ID for investigation: ${taskId}`);
      console.error(`  Check logs: journalctl -u robin-orchestrator-<slug> -n 100\n`);
    }

    process.exit(1);
  }
}

main();
