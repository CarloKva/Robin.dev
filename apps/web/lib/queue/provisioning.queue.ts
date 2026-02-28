/**
 * BullMQ queue for agent provisioning/deprovisioning jobs.
 * Enqueued by the web app; processed by the control-plane orchestrator.
 */

import { Queue } from "bullmq";
import IORedis from "ioredis";
import type { AgentProvisioningJobPayload, AgentDeprovisioningJobPayload } from "@robin/shared-types";

export const PROVISIONING_QUEUE_NAME = "agent-provisioning";
export const DEPROVISIONING_QUEUE_NAME = "agent-deprovisioning";

let provisioningQueue: Queue<AgentProvisioningJobPayload> | null = null;
let deprovisioningQueue: Queue<AgentDeprovisioningJobPayload> | null = null;

function getRedisConnection() {
  return new IORedis(process.env["REDIS_URL"] ?? "redis://localhost:6379", {
    maxRetriesPerRequest: null,
    enableReadyCheck: false,
  });
}

export function getProvisioningQueue(): Queue<AgentProvisioningJobPayload> {
  if (!provisioningQueue) {
    provisioningQueue = new Queue<AgentProvisioningJobPayload>(
      PROVISIONING_QUEUE_NAME,
      {
        connection: getRedisConnection(),
        defaultJobOptions: {
          attempts: 1,         // Provisioning is idempotent — manual retry via UI
          removeOnComplete: { count: 50 },
          removeOnFail: { count: 50 },
        },
      }
    );
  }
  return provisioningQueue;
}

export function getDeprovisioningQueue(): Queue<AgentDeprovisioningJobPayload> {
  if (!deprovisioningQueue) {
    deprovisioningQueue = new Queue<AgentDeprovisioningJobPayload>(
      DEPROVISIONING_QUEUE_NAME,
      {
        connection: getRedisConnection(),
        defaultJobOptions: {
          attempts: 2,
          removeOnComplete: { count: 50 },
          removeOnFail: { count: 50 },
        },
      }
    );
  }
  return deprovisioningQueue;
}
