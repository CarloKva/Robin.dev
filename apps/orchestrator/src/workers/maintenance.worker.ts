import { Worker } from "bullmq";
import type { Job } from "bullmq";
import type { MaintenanceJobPayload } from "@robin/shared-types";
import { getRedisConnection } from "../db/redis.client";
import { MAINTENANCE_QUEUE_NAME } from "../queues/maintenance.queue";
import { log } from "../utils/logger";
import { runMaintenanceAgent, type MaintenanceRunOutcome } from "./maintenance-agent.runner";

const AGENT_ID = process.env["AGENT_ID"] ?? "b0000000-0000-0000-0000-000000000001";

async function processMaintenanceJob(
  job: Job<MaintenanceJobPayload>
): Promise<MaintenanceRunOutcome> {
  const payload = job.data;

  log.info(
    {
      jobId: job.id,
      agentRunId: payload.agentRunId,
      capabilityDefinitionId: payload.capabilityDefinitionId,
    },
    "Maintenance worker received job"
  );

  if (payload.runnerAgentId !== AGENT_ID) {
    log.warn(
      { jobId: job.id, runnerAgentId: payload.runnerAgentId, AGENT_ID },
      "Maintenance job routed to wrong agent; skipping"
    );
    return {
      status: "skipped",
      findingsCreated: 0,
      tokensUsed: 0,
      costUsd: 0,
      errorMessage: "runner_mismatch",
    };
  }

  return runMaintenanceAgent(payload);
}

export function createMaintenanceWorker(): Worker<MaintenanceJobPayload, MaintenanceRunOutcome> {
  // Concurrency=1: same-repo discovery runs must serialize on the working tree.
  // Cross-repo parallelism is achieved by selecting different runner_agent_id
  // values upstream in the scheduler.
  const worker = new Worker<MaintenanceJobPayload, MaintenanceRunOutcome>(
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

  worker.on("completed", (job, result) => {
    log.info(
      {
        jobId: job.id,
        agentRunId: job.data.agentRunId,
        status: result.status,
        findingsCreated: result.findingsCreated,
        tokensUsed: result.tokensUsed,
      },
      "Maintenance job completed"
    );
  });

  worker.on("failed", (job, err) => {
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
