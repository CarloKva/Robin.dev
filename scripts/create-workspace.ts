#!/usr/bin/env tsx
/**
 * Robin.dev — Create Workspace Script
 * EPIC-30 · STORY-05.10
 *
 * Creates a workspace + agent record in Supabase and prints a summary
 * with all IDs needed to configure the VPS .env file.
 *
 * Usage:
 *   node scripts/create-workspace.ts \
 *     --slug acme \
 *     --name "Acme Corp" \
 *     --clerk-user-id user_xxx \
 *     --vps-ip 1.2.3.4 \
 *     --github-account acme-org
 *
 * Requires:
 *   SUPABASE_URL and SUPABASE_SERVICE_ROLE_KEY in environment
 *   (or .env file in project root)
 */

import { createClient } from "@supabase/supabase-js";
import { writeFileSync, mkdirSync } from "fs";
import { join, dirname } from "path";
import { fileURLToPath } from "url";

const __dirname = dirname(fileURLToPath(import.meta.url));
const ROOT = join(__dirname, "..");

// ─── Load env ────────────────────────────────────────────────────────────────
function loadEnv() {
  try {
    const { config } = await import("dotenv");
    config({ path: join(ROOT, ".env.local") });
    config({ path: join(ROOT, ".env") });
  } catch {
    // dotenv not available — rely on process.env
  }
}

// ─── Arg parsing ────────────────────────────────────────────────────────────
function parseArgs(argv: string[]): Record<string, string> {
  const args: Record<string, string> = {};
  for (let i = 0; i < argv.length - 1; i++) {
    if (argv[i].startsWith("--")) {
      args[argv[i].slice(2)] = argv[i + 1];
    }
  }
  return args;
}

// ─── Main ────────────────────────────────────────────────────────────────────
async function main() {
  await loadEnv();

  const args = parseArgs(process.argv.slice(2));

  const slug = args["slug"];
  const name = args["name"];
  const clerkUserId = args["clerk-user-id"];
  const vpsIp = args["vps-ip"] ?? null;
  const vpsRegion = args["vps-region"] ?? "fsn1";
  const githubAccount = args["github-account"] ?? null;

  if (!slug || !name || !clerkUserId) {
    console.error("Usage: create-workspace.ts --slug <slug> --name <name> --clerk-user-id <id>");
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

  console.log(`\nCreating workspace for: ${name} (${slug})\n`);

  // 1. Create workspace
  const { data: workspace, error: wsError } = await supabase
    .from("workspaces")
    .insert({ name, slug })
    .select()
    .single();

  if (wsError) {
    console.error("Failed to create workspace:", wsError.message);
    process.exit(1);
  }
  console.log(`✓ Workspace created: ${workspace.id}`);

  // 2. Add workspace member
  const { error: memberError } = await supabase.from("workspace_members").insert({
    workspace_id: workspace.id,
    user_id: clerkUserId,
    role: "owner",
  });
  if (memberError) {
    console.error("Failed to create workspace member:", memberError.message);
    process.exit(1);
  }
  console.log(`✓ Member added: ${clerkUserId} (owner)`);

  // 3. Create agent record
  const agentSlug = `robin-${slug}`;
  const { data: agent, error: agentError } = await supabase
    .from("agents")
    .insert({
      workspace_id: workspace.id,
      name: "Robin Agent",
      type: "claude",
      slug: agentSlug,
      ...(githubAccount !== null && { github_account: githubAccount }),
      ...(vpsIp !== null && { vps_ip: vpsIp }),
      vps_region: vpsRegion,
    })
    .select()
    .single();

  if (agentError) {
    console.error("Failed to create agent:", agentError.message);
    process.exit(1);
  }
  console.log(`✓ Agent created: ${agent.id}`);

  // 4. Initialize agent_status
  const { error: statusError } = await supabase.from("agent_status").insert({
    agent_id: agent.id,
    status: "offline",
    current_task_id: null,
  });
  if (statusError) {
    // Non-fatal if already exists
    console.warn("Note: agent_status init:", statusError.message);
  }
  console.log(`✓ Agent status initialized`);

  // 5. Save provisioning log
  const timestamp = new Date().toISOString().replace(/[:.]/g, "-");
  const logDir = join(ROOT, "logs");
  mkdirSync(logDir, { recursive: true });

  const logContent = [
    `# Provisioning Log — ${name}`,
    `Date: ${new Date().toISOString()}`,
    ``,
    `## Identifiers`,
    `Workspace ID:   ${workspace.id}`,
    `Workspace Slug: ${slug}`,
    `Agent ID:       ${agent.id}`,
    `Agent Slug:     ${agentSlug}`,
    `Clerk User ID:  ${clerkUserId}`,
    `VPS IP:         ${vpsIp ?? "— not set"}`,
    `VPS Region:     ${vpsRegion}`,
    `GitHub Account: ${githubAccount ?? "— not set"}`,
    ``,
    `## Next steps`,
    `1. SSH into the VPS and update .env with:`,
    `   WORKSPACE_ID=${workspace.id}`,
    `   AGENT_ID=${agent.id}`,
    ``,
    `2. Start the service:`,
    `   systemctl start robin-orchestrator-${slug}`,
    ``,
    `3. Run smoke test:`,
    `   node scripts/smoke-test.ts --workspace-id ${workspace.id}`,
  ].join("\n");

  const logPath = join(logDir, `provisioning-${slug}-${timestamp}.log`);
  writeFileSync(logPath, logContent, "utf-8");

  // ─── Summary ───────────────────────────────────────────────────────────────
  console.log("\n════════════════════════════════════════════════");
  console.log("  Workspace created successfully!");
  console.log("════════════════════════════════════════════════");
  console.log("");
  console.log("  Add to VPS .env file:");
  console.log(`  WORKSPACE_ID=${workspace.id}`);
  console.log(`  AGENT_ID=${agent.id}`);
  console.log("");
  console.log(`  Log saved: ${logPath}`);
  console.log("");
}

main().catch((err) => {
  console.error("Fatal error:", err);
  process.exit(1);
});
