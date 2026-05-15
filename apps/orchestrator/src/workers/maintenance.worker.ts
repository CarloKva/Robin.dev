import { Worker } from "bullmq";
import type { Job } from "bullmq";
import type { MaintenanceJobPayload } from "@robin/shared-types";
import { getRedisConnection } from "../db/redis.client";
import { getSupabaseClient } from "../db/supabase.client";
import { MAINTENANCE_QUEUE_NAME } from "../queues/maintenance.queue";
import { log } from "../utils/logger";

const AGENT_ID = process.env["AGENT_ID"] ?? "b0000000-0000-0000-0000-000000000001";

/**
 * Phase 0 worker stub.
 *
 * The queue and routing contract are active, but capability execution is
 * intentionally not implemented until Phase 1. Any accidentally enqueued job
 * is marked as skipped instead of invoking Claude.
 */
async function processMaintenanceJob(job: Job<MaintenanceJobPayload>): Promise<{ status: "skipped" }> {
  const payload = job.data;

  log.info(
    {
      jobId: job.id,
      agentRunId: payload.agentRunId,
      capabilityDefinitionId: payload.capabilityDefinitionId,
    },
    "Maintenance Phase 0 worker received job"
  );

  if (payload.runnerAgentId !== AGENT_ID) {
    log.warn(
      { jobId: job.id, runnerAgentId: payload.runnerAgentId, AGENT_ID },
      "Maintenance job routed to wrong agent; leaving run queued for recovery"
    );
    return { status: "skipped" };
  }

  const completedAt = new Date().toISOString();
  const supabase = getSupabaseClient();

  const { error: runError } = await supabase
    .from("agent_runs")
    .update({
      status: "skipped",
      started_at: completedAt,
      completed_at: completedAt,
      error_message: "Phase 0 dry-run worker: capability execution is not enabled yet.",
    })
    .eq("id", payload.agentRunId);

  if (runError) {
    log.warn(
      { agentRunId: payload.agentRunId, error: runError.message },
      "Maintenance worker could not mark run skipped"
    );
  }

  const { error: eventError } = await supabase.from("maintenance_events").insert({
    workspace_id: payload.workspaceId,
    repository_id: payload.repositoryId,
    agent_run_id: payload.agentRunId,
    event_type: "agent.run.completed",
    actor_type: "agent",
    actor_id: AGENT_ID,
    payload: {
      status: "skipped",
      capability_definition_id: payload.capabilityDefinitionId,
      reason: "phase_0_dry_run",
    },
  });

  if (eventError) {
    log.warn(
      { agentRunId: payload.agentRunId, error: eventError.message },
      "Maintenance worker could not insert completion event"
    );
  }

  return { status: "skipped" };
}

export function createMaintenanceWorker(): Worker<MaintenanceJobPayload, { status: "skipped" }> {
  const worker = new Worker<MaintenanceJobPayload, { status: "skipped" }>(
    MAINTENANCE_QUEUE_NAME,
    processMaintenanceJob,
    {
      connection: getRedisConnection(),
      concurrency: 1,
      stalledInterval: 60_000,
      maxStalledCount: 1,
      removeOnComplete: { count: 0 },
      removeOnFail: { count: 100 },
    }
  );

  worker.on("completed", (job) => {
    log.info({ jobId: job.id, agentRunId: job.data.agentRunId }, "Maintenance job completed");
  });

  worker.on("failed", async (job, err) => {
    if (!job) return;
    log.error(
      { jobId: job.id, agentRunId: job.data.agentRunId, error: err.message },
      "Maintenance job failed"
    );
  });

  worker.on("error", (err) => {
    log.error({ error: err.message }, "Maintenance worker error");
  });

  return worker;
}
