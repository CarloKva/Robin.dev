#!/usr/bin/env tsx
/**
 * Robin.dev — Full Reset Script
 *
 * Wipes ALL data from:
 *   1. Supabase PostgreSQL (all tables, FK-safe order)
 *   2. Upstash Redis (flush all queues)
 *   3. Clerk (delete all test users)
 *
 * Optionally re-seeds the database with supabase/seed.sql data.
 *
 * Usage:
 *   npx tsx scripts/reset-all.ts               # wipe everything
 *   npx tsx scripts/reset-all.ts --seed         # wipe + re-seed
 *   npx tsx scripts/reset-all.ts --skip-clerk   # skip Clerk user deletion
 */

import { createClient } from "@supabase/supabase-js";
import { createInterface } from "readline";
import { join, dirname } from "path";
import { fileURLToPath } from "url";

const __dirname = dirname(fileURLToPath(import.meta.url));
const ROOT = join(__dirname, "..");

// ─── Load env ────────────────────────────────────────────────────────────────

async function loadEnv() {
  try {
    const { config } = await import("dotenv");
    config({ path: join(ROOT, ".env.local") });
    config({ path: join(ROOT, ".env") });
  } catch {
    // rely on process.env
  }
}

// ─── Helpers ─────────────────────────────────────────────────────────────────

function ask(question: string): Promise<string> {
  const rl = createInterface({ input: process.stdin, output: process.stdout });
  return new Promise((resolve) => {
    rl.question(question, (answer) => {
      rl.close();
      resolve(answer.trim());
    });
  });
}

function hasFlag(flag: string): boolean {
  return process.argv.includes(`--${flag}`);
}

// ─── 1. Supabase: delete all data ───────────────────────────────────────────

const TABLES_IN_FK_ORDER = [
  "task_events",
  "task_artifacts",
  "agent_repositories",
  "agent_status",
  "tasks",
  "task_templates",
  "workspace_settings",
  "sprints",
  "repositories",
  "github_connections",
  "agents",
  "workspace_members",
  "workspaces",
];

async function resetSupabase(supabase: ReturnType<typeof createClient>) {
  console.log("\n── Supabase: deleting all rows ──────────────────────");

  for (const table of TABLES_IN_FK_ORDER) {
    const { count, error } = await supabase
      .from(table)
      .delete({ count: "exact" })
      .neq("id", "00000000-0000-0000-0000-000000000000"); // match all rows

    if (error) {
      // Some tables use agent_id as PK instead of id
      const { count: count2, error: error2 } = await supabase
        .from(table)
        .delete({ count: "exact" })
        .neq("agent_id", "00000000-0000-0000-0000-000000000000");

      if (error2) {
        // workspace_settings uses workspace_id as PK
        const { count: count3, error: error3 } = await supabase
          .from(table)
          .delete({ count: "exact" })
          .neq("workspace_id", "00000000-0000-0000-0000-000000000000");

        if (error3) {
          console.log(`  ✗ ${table}: ${error3.message}`);
        } else {
          console.log(`  ✓ ${table}: ${count3 ?? 0} rows deleted`);
        }
      } else {
        console.log(`  ✓ ${table}: ${count2 ?? 0} rows deleted`);
      }
    } else {
      console.log(`  ✓ ${table}: ${count ?? 0} rows deleted`);
    }
  }
}

// ─── 2. Redis: flush all queues ─────────────────────────────────────────────

async function resetRedis() {
  console.log("\n── Redis: flushing all data ─────────────────────────");

  const redisUrl = process.env["REDIS_URL"];
  if (!redisUrl) {
    console.log("  ⚠ REDIS_URL not set — skipping Redis flush");
    return;
  }

  try {
    // Use ioredis if available, otherwise fallback to fetch for Upstash
    if (redisUrl.startsWith("rediss://") && redisUrl.includes("upstash")) {
      // Upstash REST API approach
      const url = new URL(redisUrl);
      const password = url.password || url.username;
      const restUrl = `https://${url.hostname}`;

      const resp = await fetch(`${restUrl}/flushall`, {
        headers: { Authorization: `Bearer ${password}` },
      });
      const data = await resp.json();
      console.log(`  ✓ Upstash FLUSHALL: ${JSON.stringify(data)}`);
    } else {
      // Standard Redis via ioredis
      const { default: Redis } = await import("ioredis");
      const redis = new Redis(redisUrl);
      await redis.flushall();
      console.log("  ✓ Redis FLUSHALL: OK");
      await redis.quit();
    }
  } catch (err: any) {
    console.log(`  ✗ Redis flush failed: ${err.message}`);
  }
}

// ─── 3. Clerk: delete all users ─────────────────────────────────────────────

async function resetClerk() {
  console.log("\n── Clerk: deleting all test users ───────────────────");

  const secretKey = process.env["CLERK_SECRET_KEY"];
  if (!secretKey) {
    console.log("  ⚠ CLERK_SECRET_KEY not set — skipping");
    return;
  }

  const headers = {
    Authorization: `Bearer ${secretKey}`,
    "Content-Type": "application/json",
  };

  // Paginate through all users
  let deleted = 0;
  let offset = 0;
  const limit = 100;

  while (true) {
    const resp = await fetch(
      `https://api.clerk.com/v1/users?limit=${limit}&offset=${offset}`,
      { headers }
    );

    if (!resp.ok) {
      console.log(`  ✗ Failed to list users: ${resp.status} ${resp.statusText}`);
      break;
    }

    const users: any[] = await resp.json();
    if (users.length === 0) break;

    for (const user of users) {
      const email =
        user.email_addresses?.[0]?.email_address ?? user.id;
      const delResp = await fetch(
        `https://api.clerk.com/v1/users/${user.id}`,
        { method: "DELETE", headers }
      );

      if (delResp.ok) {
        console.log(`  ✓ Deleted user: ${email} (${user.id})`);
        deleted++;
      } else {
        console.log(`  ✗ Failed to delete ${email}: ${delResp.status}`);
      }
    }

    if (users.length < limit) break;
    offset += limit;
  }

  console.log(`  Total Clerk users deleted: ${deleted}`);
}

// ─── 4. Re-seed (optional) ─────────────────────────────────────────────────

async function reseed(supabase: ReturnType<typeof createClient>) {
  console.log("\n── Re-seeding database ─────────────────────────────");

  // Insert the same data as supabase/seed.sql using the Supabase client
  const wsId = "a0000000-0000-0000-0000-000000000001";
  const seedUserId = "user_seed_dev_01";
  const agentId = "b0000000-0000-0000-0000-000000000001";

  // Workspace
  const { error: wsErr } = await supabase
    .from("workspaces")
    .insert({ id: wsId, name: "Dev Workspace", slug: "dev-workspace" });
  if (wsErr) console.log(`  ✗ workspaces: ${wsErr.message}`);
  else console.log("  ✓ workspace: Dev Workspace");

  // Member
  const { error: memErr } = await supabase
    .from("workspace_members")
    .insert({ workspace_id: wsId, user_id: seedUserId, role: "owner" });
  if (memErr) console.log(`  ✗ workspace_members: ${memErr.message}`);
  else console.log("  ✓ member: user_seed_dev_01 (owner)");

  // Agent
  const { error: agErr } = await supabase
    .from("agents")
    .insert({ id: agentId, workspace_id: wsId, name: "Robin Alpha", type: "code-agent" });
  if (agErr) console.log(`  ✗ agents: ${agErr.message}`);
  else console.log("  ✓ agent: Robin Alpha");

  // Agent status
  const { error: asErr } = await supabase
    .from("agent_status")
    .insert({ agent_id: agentId, status: "busy", last_heartbeat: new Date().toISOString() });
  if (asErr) console.log(`  ✗ agent_status: ${asErr.message}`);
  else console.log("  ✓ agent_status: busy");

  // Tasks
  const tasks = [
    { id: "c0000000-0000-0000-0000-000000000001", title: "Setup project repository", description: "Initialise monorepo with workspaces, CI, and base config.", status: "completed", priority: "high", assigned_agent_id: agentId },
    { id: "c0000000-0000-0000-0000-000000000002", title: "Design database schema", description: "Define all tables, enums, and RLS policies for Sprint 1.", status: "completed", priority: "high", assigned_agent_id: agentId },
    { id: "c0000000-0000-0000-0000-000000000003", title: "Implement authentication flow", description: "Integrate Clerk with Next.js App Router. Add sign-in, sign-up, and onboarding.", status: "in_progress", priority: "high", assigned_agent_id: agentId },
    { id: "c0000000-0000-0000-0000-000000000004", title: "Build task management UI", description: "List, create, and filter tasks. Connect to Supabase RLS.", status: "pending", priority: "medium", assigned_agent_id: null },
    { id: "c0000000-0000-0000-0000-000000000005", title: "Deploy to Vercel", description: "Connect GitHub repo to Vercel. Set environment variables. Verify build.", status: "pending", priority: "low", assigned_agent_id: null },
  ];

  const { error: taskErr } = await supabase
    .from("tasks")
    .insert(tasks.map((t) => ({ ...t, workspace_id: wsId, created_by_user_id: seedUserId })));
  if (taskErr) console.log(`  ✗ tasks: ${taskErr.message}`);
  else console.log(`  ✓ tasks: ${tasks.length} seeded`);

  console.log("  (Note: task_events not seeded via client — use `supabase db reset` for full seed)");
}

// ─── Main ────────────────────────────────────────────────────────────────────

async function main() {
  await loadEnv();

  const shouldSeed = hasFlag("seed");
  const skipClerk = hasFlag("skip-clerk");

  const supabaseUrl =
    process.env["NEXT_PUBLIC_SUPABASE_URL"] ?? process.env["SUPABASE_URL"];
  const serviceKey = process.env["SUPABASE_SERVICE_ROLE_KEY"];

  if (!supabaseUrl || !serviceKey) {
    console.error(
      "Missing NEXT_PUBLIC_SUPABASE_URL (or SUPABASE_URL) and SUPABASE_SERVICE_ROLE_KEY"
    );
    process.exit(1);
  }

  console.log("\n════════════════════════════════════════════════════════");
  console.log("  Robin.dev — Full Reset");
  console.log("════════════════════════════════════════════════════════");
  console.log(`\n  Target Supabase:  ${supabaseUrl}`);
  console.log(`  Redis:            ${process.env["REDIS_URL"] ? "configured" : "not set"}`);
  console.log(`  Clerk:            ${skipClerk ? "SKIPPED" : "will delete all users"}`);
  console.log(`  Re-seed:          ${shouldSeed ? "YES" : "no"}`);
  console.log("\n  ⚠️  This will DELETE ALL DATA. This is IRREVERSIBLE.\n");

  const answer = await ask('Type "RESET" to confirm: ');
  if (answer !== "RESET") {
    console.log("\nAborted.\n");
    process.exit(0);
  }

  const supabase = createClient(supabaseUrl, serviceKey, {
    auth: { persistSession: false },
  });

  // 1. Supabase
  await resetSupabase(supabase);

  // 2. Redis
  await resetRedis();

  // 3. Clerk
  if (!skipClerk) {
    await resetClerk();
  }

  // 4. Re-seed
  if (shouldSeed) {
    await reseed(supabase);
  }

  console.log("\n════════════════════════════════════════════════════════");
  console.log("  Reset complete!");
  console.log("════════════════════════════════════════════════════════\n");

  if (!shouldSeed) {
    console.log("  To re-seed with dev data, run again with --seed flag.\n");
  }
}

main().catch((err) => {
  console.error("Fatal error:", err);
  process.exit(1);
});
