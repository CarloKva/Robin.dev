/**
 * POST /api/maintenance/configs/[configId]/run-now
 *
 * Workspace-owner-only manual trigger. Pre-flight checks per the spec:
 *
 *   - caller must be workspace owner
 *   - config must exist for this workspace
 *   - repository must be enabled
 *   - daily token budget must have remaining capacity
 *   - an online runner agent must be available for the repository
 *
 * On success: inserts agent_runs (status=queued, trigger=manual,
 * triggered_by=userId), enqueues the BullMQ maintenance job, emits
 * agent.run.scheduled.
 */

import { NextResponse } from "next/server";
import { requireWorkspace } from "@/lib/api/requireWorkspace";
import { getWorkspaceMemberRole } from "@/lib/db/workspace";
import { createSupabaseServerClient } from "@/lib/supabase/server";
import {
  createQueuedAgentRun,
  getCapabilityConfig,
  getDailyTokensUsed,
  insertMaintenanceEvent,
  selectRunnerAgentForRepository,
} from "@/lib/db/maintenance";
import { getMaintenanceQueue } from "@/lib/queue/maintenance.queue";
import type { MaintenanceCapabilityId, MaintenanceJobPayload } from "@robin/shared-types";

export async function POST(
  request: Request,
  { params }: { params: Promise<{ configId: string }> }
) {
  const result = await requireWorkspace();
  if (result instanceof NextResponse) return result;
  const { userId, workspace } = result;

  const role = await getWorkspaceMemberRole(userId);
  if (role !== "owner") {
    return NextResponse.json(
      { error: "Solo il proprietario può lanciare una maintenance run." },
      { status: 403 }
    );
  }

  const { configId } = await params;
  const config = await getCapabilityConfig(workspace.id, configId);
  if (!config) {
    return NextResponse.json({ error: "Config non trovata" }, { status: 404 });
  }
  if (!config.repository || !config.repository.is_enabled) {
    return NextResponse.json(
      { error: "Repository non abilitato", code: "REPOSITORY_DISABLED" },
      { status: 409 }
    );
  }
  if (!config.capability_definition) {
    return NextResponse.json(
      { error: "Capability definition non trovata", code: "CAPABILITY_MISSING" },
      { status: 500 }
    );
  }

  // Load workspace timezone for the daily-budget window.
  const supabase = await createSupabaseServerClient();
  const { data: wsRow } = await supabase
    .from("workspaces")
    .select("timezone")
    .eq("id", workspace.id)
    .single();
  const timezone = (wsRow as { timezone?: string } | null)?.timezone ?? "UTC";

  const tokensUsedToday = await getDailyTokensUsed({
    workspaceId: workspace.id,
    repositoryId: config.repository_id,
    capabilityDefinitionId: config.capability_definition_id,
    timezone,
  });
  if (tokensUsedToday >= config.daily_token_budget) {
    return NextResponse.json(
      {
        error: "Budget giornaliero esaurito",
        code: "BUDGET_EXCEEDED",
        details: { budget: config.daily_token_budget, used: tokensUsedToday },
      },
      { status: 429 }
    );
  }

  const runner = await selectRunnerAgentForRepository(workspace.id, config.repository_id);
  if (!runner) {
    return NextResponse.json(
      {
        error: "Nessun agente online assegnato a questo repository",
        code: "NO_RUNNER",
      },
      { status: 503 }
    );
  }

  // Persist queued run + enqueue job + emit event.
  let agentRunId: string;
  try {
    agentRunId = await createQueuedAgentRun({
      workspaceId: workspace.id,
      repositoryId: config.repository_id,
      workspaceCapabilityConfigId: config.id,
      capabilityDefinitionId: config.capability_definition_id,
      runnerAgentId: runner.agentId,
      trigger: "manual",
      triggeredBy: userId,
    });
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err);
    console.error("[run-now createQueuedAgentRun]", message);
    return NextResponse.json({ error: message }, { status: 500 });
  }

  const payload: MaintenanceJobPayload = {
    agentRunId,
    workspaceId: workspace.id,
    repositoryId: config.repository_id,
    runnerAgentId: runner.agentId,
    capabilityDefinitionId: config.capability_definition_id as MaintenanceCapabilityId,
    workspaceCapabilityConfigId: config.id,
    trigger: "manual",
  };

  try {
    const queue = getMaintenanceQueue();
    await queue.add("maintenance-agents", payload, { jobId: agentRunId });
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err);
    console.error("[run-now enqueue]", message);
    // Best-effort: mark the run as failed so it doesn't stay queued forever.
    await insertMaintenanceEvent({
      workspaceId: workspace.id,
      repositoryId: config.repository_id,
      agentRunId,
      eventType: "agent.run.failed",
      actorType: "system",
      actorId: "web/run-now",
      payload: { reason: "enqueue_failed", error: message },
    });
    return NextResponse.json({ error: "Impossibile mettere in coda" }, { status: 500 });
  }

  await insertMaintenanceEvent({
    workspaceId: workspace.id,
    repositoryId: config.repository_id,
    agentRunId,
    eventType: "agent.run.scheduled",
    actorType: "human",
    actorId: userId,
    payload: {
      trigger: "manual",
      runner_agent_id: runner.agentId,
      capability_definition_id: config.capability_definition_id,
    },
  });

  return NextResponse.json(
    {
      agent_run_id: agentRunId,
      runner_agent_id: runner.agentId,
      runner_agent_name: runner.agentName,
    },
    { status: 202 }
  );
}
