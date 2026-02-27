#!/usr/bin/env tsx
/**
 * Robin.dev — Offboard Workspace Script
 * EPIC-32 · STORY-05.14
 *
 * Permanently deletes all data for a workspace from Supabase.
 * Requires explicit confirmation by typing the workspace slug.
 *
 * Deletion order (respects FK constraints):
 *   task_events → task_artifacts → tasks → agent_status → agents
 *   → workspace_members → workspaces
 *
 * Usage:
 *   node scripts/offboard-workspace.ts --workspace-id <uuid> --slug <slug>
 *
 * CAUTION: This is irreversible. Run only after confirming with the client.
 */

import { createClient } from "@supabase/supabase-js";
import { createInterface } from "readline";
import { writeFileSync, mkdirSync } from "fs";
import { join, dirname } from "path";
import { fileURLToPath } from "url";

const __dirname = dirname(fileURLToPath(import.meta.url));
const ROOT = join(__dirname, "..");

// ─── Helpers ────────────────────────────────────────────────────────────────
function ask(question: string): Promise<string> {
  const rl = createInterface({ input: process.stdin, output: process.stdout });
  return new Promise((resolve) => {
    rl.question(question, (answer) => {
      rl.close();
      resolve(answer.trim());
    });
  });
}

async function countTable(
  supabase: ReturnType<typeof createClient>,
  table: string,
  workspaceId: string,
  column = "workspace_id"
): Promise<number> {
  const { count } = await supabase
    .from(table)
    .select("*", { count: "exact", head: true })
    .eq(column, workspaceId);
  return count ?? 0;
}

// ─── Main ────────────────────────────────────────────────────────────────────
async function main() {
  const args: Record<string, string> = {};
  for (let i = 2; i < process.argv.length - 1; i++) {
    if (process.argv[i].startsWith("--")) args[process.argv[i].slice(2)] = process.argv[i + 1];
  }

  const workspaceId = args["workspace-id"];
  const slug = args["slug"];

  if (!workspaceId || !slug) {
    console.error("Usage: offboard-workspace.ts --workspace-id <uuid> --slug <slug>");
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

  // 1. Verify workspace exists
  const { data: ws } = await supabase
    .from("workspaces")
    .select("id, name, slug")
    .eq("id", workspaceId)
    .single();

  if (!ws) {
    console.error(`Workspace not found: ${workspaceId}`);
    process.exit(1);
  }

  if (ws.slug !== slug) {
    console.error(`Slug mismatch: expected ${ws.slug}, got ${slug}`);
    process.exit(1);
  }

  // 2. Show data summary
  const [taskCount, eventCount, artifactCount, agentCount, memberCount] = await Promise.all([
    countTable(supabase, "tasks", workspaceId),
    countTable(supabase, "task_events", workspaceId),
    countTable(supabase, "task_artifacts", workspaceId),
    countTable(supabase, "agents", workspaceId),
    countTable(supabase, "workspace_members", workspaceId),
  ]);

  console.log("\n════════════════════════════════════════════════════");
  console.log("  Robin.dev — Workspace Offboarding");
  console.log("════════════════════════════════════════════════════");
  console.log(`\n  Workspace: ${ws.name} (${ws.slug})`);
  console.log(`  ID:        ${workspaceId}`);
  console.log("\n  Data to be PERMANENTLY deleted:");
  console.log(`    Tasks:       ${taskCount}`);
  console.log(`    Events:      ${eventCount}`);
  console.log(`    Artifacts:   ${artifactCount}`);
  console.log(`    Agents:      ${agentCount}`);
  console.log(`    Members:     ${memberCount}`);
  console.log("\n  ⚠️  This action is IRREVERSIBLE.\n");

  // 3. Require explicit confirmation
  const answer = await ask(`Type the workspace slug to confirm deletion: `);
  if (answer !== slug) {
    console.log("\nConfirmation failed — offboarding aborted.");
    process.exit(0);
  }

  const startedAt = new Date();
  const deletionLog: string[] = [
    `# Offboarding Report — ${ws.name}`,
    `Date: ${startedAt.toISOString()}`,
    `Workspace ID: ${workspaceId}`,
    `Slug: ${slug}`,
    ``,
    `## Data deleted`,
  ];

  console.log("\nDeleting data...\n");

  // 4. Delete in FK-safe order
  // task_events
  const { count: evDeleted } = await supabase
    .from("task_events")
    .delete({ count: "exact" })
    .eq("workspace_id", workspaceId);
  console.log(`  ✓ task_events:      ${evDeleted ?? 0} rows deleted`);
  deletionLog.push(`task_events: ${evDeleted ?? 0}`);

  // task_artifacts
  const { count: artDeleted } = await supabase
    .from("task_artifacts")
    .delete({ count: "exact" })
    .eq("workspace_id", workspaceId);
  console.log(`  ✓ task_artifacts:   ${artDeleted ?? 0} rows deleted`);
  deletionLog.push(`task_artifacts: ${artDeleted ?? 0}`);

  // tasks
  const { count: taskDeleted } = await supabase
    .from("tasks")
    .delete({ count: "exact" })
    .eq("workspace_id", workspaceId);
  console.log(`  ✓ tasks:            ${taskDeleted ?? 0} rows deleted`);
  deletionLog.push(`tasks: ${taskDeleted ?? 0}`);

  // agent_status (via agent IDs)
  const { data: agentIds } = await supabase
    .from("agents")
    .select("id")
    .eq("workspace_id", workspaceId);

  const ids = (agentIds ?? []).map((a: { id: string }) => a.id);
  if (ids.length > 0) {
    const { count: asDeleted } = await supabase
      .from("agent_status")
      .delete({ count: "exact" })
      .in("agent_id", ids);
    console.log(`  ✓ agent_status:     ${asDeleted ?? 0} rows deleted`);
    deletionLog.push(`agent_status: ${asDeleted ?? 0}`);
  }

  // agents
  const { count: agDeleted } = await supabase
    .from("agents")
    .delete({ count: "exact" })
    .eq("workspace_id", workspaceId);
  console.log(`  ✓ agents:           ${agDeleted ?? 0} rows deleted`);
  deletionLog.push(`agents: ${agDeleted ?? 0}`);

  // workspace_members
  const { count: memDeleted } = await supabase
    .from("workspace_members")
    .delete({ count: "exact" })
    .eq("workspace_id", workspaceId);
  console.log(`  ✓ workspace_members: ${memDeleted ?? 0} rows deleted`);
  deletionLog.push(`workspace_members: ${memDeleted ?? 0}`);

  // workspaces
  const { count: wsDeleted } = await supabase
    .from("workspaces")
    .delete({ count: "exact" })
    .eq("id", workspaceId);
  console.log(`  ✓ workspaces:       ${wsDeleted ?? 0} rows deleted`);
  deletionLog.push(`workspaces: ${wsDeleted ?? 0}`);

  // 5. Save report
  const completedAt = new Date();
  deletionLog.push(``, `## Timing`);
  deletionLog.push(`Started:   ${startedAt.toISOString()}`);
  deletionLog.push(`Completed: ${completedAt.toISOString()}`);
  deletionLog.push(`Duration:  ${Math.round((completedAt.getTime() - startedAt.getTime()) / 1000)}s`);
  deletionLog.push(``, `## Manual steps remaining`);
  deletionLog.push(`- [ ] Stop VPS systemd service: systemctl stop robin-orchestrator-${slug}`);
  deletionLog.push(`- [ ] Revoke GitHub deploy key from client repository`);
  deletionLog.push(`- [ ] Delete or archive VPS: Hetzner console → Delete server`);
  deletionLog.push(`- [ ] Remove workspace from Clerk Dashboard if user was client-only`);

  const logDir = join(ROOT, "logs");
  mkdirSync(logDir, { recursive: true });
  const timestamp = completedAt.toISOString().replace(/[:.]/g, "-");
  const logPath = join(logDir, `offboarding-${slug}-${timestamp}.log`);
  writeFileSync(logPath, deletionLog.join("\n"), "utf-8");

  console.log("\n════════════════════════════════════════════════════");
  console.log("  Offboarding complete");
  console.log("════════════════════════════════════════════════════");
  console.log(`\n  Report saved: ${logPath}`);
  console.log("\n  Remaining manual steps:");
  console.log(`  - Stop VPS service: systemctl stop robin-orchestrator-${slug}`);
  console.log(`  - Revoke GitHub deploy key from client repository`);
  console.log(`  - Delete VPS on Hetzner console\n`);
}

main().catch((err) => {
  console.error("Fatal error:", err);
  process.exit(1);
});
