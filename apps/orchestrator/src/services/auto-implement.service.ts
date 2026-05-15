import type {
  MaintenanceCapabilityId,
  MaintenanceJobPayload,
} from "@robin/shared-types";
import { getSupabaseClient } from "../db/supabase.client";
import { log } from "../utils/logger";

// Lazy import so test files that import sibling modules from this directory
// don't trigger the maintenance queue's module-level Redis connection. The
// production path always reaches the queue eventually, the test path doesn't.
async function enqueueMaintenanceJob(payload: MaintenanceJobPayload): Promise<void> {
  const { maintenanceQueue } = await import("../queues/maintenance.queue");
  await maintenanceQueue.addJob(payload);
}

/**
 * Auto-implementation trigger. The discovery runners call this after inserting
 * a new finding; if the workspace has opted into auto-implementation for that
 * capability and the finding satisfies the spec's auto-trigger rules
 * (sec 4.2 for spec, sec 4.4 for bug), the finding is auto-approved, a task
 * is created, an impl agent_run is queued, and a finding.auto_implemented
 * event is emitted.
 *
 * Returns the number of findings that were promoted. Caller can include this
 * in the run's completion event for observability.
 *
 * The function is intentionally defensive: any failure on a single finding is
 * logged and skipped so a misconfigured row never poisons an entire discovery
 * run.
 */
export async function maybeAutoImplement(args: {
  workspaceId: string;
  repositoryId: string;
  agentRunId: string;
  type: "spec" | "bug";
  findings: Array<{
    id: string;
    confidence: number;
    /** spec_findings.status or bug_findings.severity */
    status: string;
  }>;
}): Promise<number> {
  if (args.findings.length === 0) return 0;

  const implCapability: MaintenanceCapabilityId =
    args.type === "spec" ? "spec_impl" : "bug_impl";

  const supabase = getSupabaseClient();
  const { data: configRow } = await supabase
    .from("workspace_capability_configs")
    .select(
      "id, auto_implement, auto_implement_min_confidence, daily_token_budget"
    )
    .eq("workspace_id", args.workspaceId)
    .eq("repository_id", args.repositoryId)
    .eq("capability_definition_id", implCapability)
    .maybeSingle();
  if (!configRow) return 0;

  const config = configRow as {
    id: string;
    auto_implement: boolean;
    auto_implement_min_confidence: number | null;
    daily_token_budget: number;
  };
  if (!config.auto_implement) return 0;
  const minConfidence = config.auto_implement_min_confidence ?? 0.9;

  // Pick one online runner up-front; auto-implement bails if none is around
  // rather than queuing runs that will all 'no_agent'.
  const runnerAgentId = await selectRunnerAgent(args.workspaceId, args.repositoryId);
  if (!runnerAgentId) {
    log.info(
      { workspaceId: args.workspaceId, repositoryId: args.repositoryId },
      "auto-implement: no online runner — skipping"
    );
    return 0;
  }

  let promoted = 0;
  for (const finding of args.findings) {
    if (finding.confidence < minConfidence) continue;
    if (!isEligibleForAutoImplement(args.type, finding.status)) continue;

    try {
      const result = await promoteOne({
        workspaceId: args.workspaceId,
        repositoryId: args.repositoryId,
        agentRunId: args.agentRunId,
        type: args.type,
        findingId: finding.id,
        implCapability,
        implConfigId: config.id,
        runnerAgentId,
      });
      if (result) promoted += 1;
    } catch (err) {
      log.warn(
        {
          findingId: finding.id,
          error: err instanceof Error ? err.message : String(err),
        },
        "auto-implement: promote failed"
      );
    }
  }
  return promoted;
}

export function isEligibleForAutoImplement(type: "spec" | "bug", status: string): boolean {
  if (type === "spec") {
    // spec sec 4.2: only `missing` may auto-implement. drifted is too ambiguous.
    return status === "missing";
  }
  // bug sec 4.4: P0/P1 are manual-approval only. P2/P3 can auto-implement.
  return status === "P2" || status === "P3";
}

async function selectRunnerAgent(
  workspaceId: string,
  repositoryId: string
): Promise<string | null> {
  const supabase = getSupabaseClient();
  const { data: repoAgents } = await supabase
    .from("agent_repositories")
    .select("agent_id")
    .eq("repository_id", repositoryId);
  if (!repoAgents?.length) return null;
  const ids = (repoAgents as Array<{ agent_id: string }>).map((r) => r.agent_id);

  const { data: agents } = await supabase
    .from("agents_with_status")
    .select("id, last_seen_at, effective_status")
    .eq("workspace_id", workspaceId)
    .in("id", ids)
    .eq("effective_status", "idle")
    .order("last_seen_at", { ascending: false })
    .limit(1);
  if (!agents?.length) return null;
  return (agents[0] as { id: string }).id;
}

async function promoteOne(args: {
  workspaceId: string;
  repositoryId: string;
  agentRunId: string;
  type: "spec" | "bug";
  findingId: string;
  implCapability: MaintenanceCapabilityId;
  implConfigId: string;
  runnerAgentId: string;
}): Promise<boolean> {
  const supabase = getSupabaseClient();
  const findingTable = args.type === "spec" ? "spec_findings" : "bug_findings";

  // 1. Auto-approve the finding. Idempotent: if some human got there first
  // and set rejected, this row update is a no-op since the WHERE clause
  // restricts to triage_state = 'pending'.
  const { data: approved, error: approveError } = await supabase
    .from(findingTable)
    .update({
      triage_state: "approved",
      triaged_by: "system/auto",
      triaged_at: new Date().toISOString(),
      updated_at: new Date().toISOString(),
    })
    .eq("id", args.findingId)
    .eq("workspace_id", args.workspaceId)
    .eq("triage_state", "pending")
    .select("id")
    .maybeSingle();
  if (approveError || !approved) return false;

  // 2. Create the linked task. Two separate inserts so supabase-js type
  // parsing can infer the row.
  let taskId: string | null = null;
  if (args.type === "spec") {
    const { data: spec } = await supabase
      .from("spec_findings")
      .select("requirement_text, requirement_source_path, requirement_source_line, suggested_action")
      .eq("id", args.findingId)
      .maybeSingle();
    if (!spec) return false;
    const specRow = spec as Record<string, unknown>;
    const { data: task, error: taskErr } = await supabase
      .from("tasks")
      .insert({
        workspace_id: args.workspaceId,
        repository_id: args.repositoryId,
        title: `[spec] ${(specRow["requirement_text"] as string).slice(0, 200)}`,
        description:
          ((specRow["suggested_action"] as string | null) ?? "") +
          `\n\nSource: ${specRow["requirement_source_path"]}${
            specRow["requirement_source_line"] ? `:${specRow["requirement_source_line"]}` : ""
          }`,
        type: "feature",
        priority: "medium",
        status: "in_progress",
        source_finding_type: "spec",
        source_finding_id: args.findingId,
      })
      .select("id")
      .single();
    if (taskErr || !task) return false;
    taskId = (task as { id: string }).id;
    await supabase.from("spec_findings").update({ task_id: taskId }).eq("id", args.findingId);
  } else {
    const { data: bug } = await supabase
      .from("bug_findings")
      .select("title, description, severity")
      .eq("id", args.findingId)
      .maybeSingle();
    if (!bug) return false;
    const bugRow = bug as Record<string, unknown>;
    const { data: task, error: taskErr } = await supabase
      .from("tasks")
      .insert({
        workspace_id: args.workspaceId,
        repository_id: args.repositoryId,
        title: `[bug] ${(bugRow["title"] as string).slice(0, 200)}`,
        description: (bugRow["description"] as string) ?? "",
        type: "bug",
        priority: severityToPriority((bugRow["severity"] as string) ?? "P3"),
        status: "in_progress",
        source_finding_type: "bug",
        source_finding_id: args.findingId,
      })
      .select("id")
      .single();
    if (taskErr || !task) return false;
    taskId = (task as { id: string }).id;
    await supabase.from("bug_findings").update({ task_id: taskId }).eq("id", args.findingId);
  }

  // 3. Insert queued agent_run + enqueue maintenance job.
  const { data: implRun, error: implRunError } = await supabase
    .from("agent_runs")
    .insert({
      workspace_id: args.workspaceId,
      repository_id: args.repositoryId,
      workspace_capability_config_id: args.implConfigId,
      capability_definition_id: args.implCapability,
      runner_agent_id: args.runnerAgentId,
      status: "queued",
      trigger: "auto",
      triggered_by: "system/auto",
    })
    .select("id")
    .single();
  if (implRunError || !implRun) return false;
  const implRunId = (implRun as { id: string }).id;

  const payload: MaintenanceJobPayload = {
    agentRunId: implRunId,
    workspaceId: args.workspaceId,
    repositoryId: args.repositoryId,
    runnerAgentId: args.runnerAgentId,
    capabilityDefinitionId: args.implCapability,
    workspaceCapabilityConfigId: args.implConfigId,
    trigger: "auto",
    findingId: args.findingId,
  };
  await enqueueMaintenanceJob(payload);

  // 4. Emit the event so the UI can show "auto-implemented" badges.
  await supabase.from("maintenance_events").insert({
    workspace_id: args.workspaceId,
    repository_id: args.repositoryId,
    agent_run_id: implRunId,
    event_type: "finding.auto_implemented",
    actor_type: "system",
    actor_id: "auto-implement",
    payload: {
      finding_id: args.findingId,
      type: args.type,
      task_id: taskId,
      discovery_run_id: args.agentRunId,
    },
  });

  return true;
}

function severityToPriority(severity: string): string {
  switch (severity) {
    case "P0":
      return "critical";
    case "P1":
      return "high";
    case "P2":
      return "medium";
    case "P3":
    default:
      return "low";
  }
}
