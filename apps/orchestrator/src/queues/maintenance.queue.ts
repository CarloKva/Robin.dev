import { Queue } from "bullmq";
import type { MaintenanceJobPayload } from "@robin/shared-types";
import { getRedisConnection } from "../db/redis.client";
import { log } from "../utils/logger";

export const MAINTENANCE_QUEUE_NAME = "maintenance-agents";

export class MaintenanceQueue {
  private queue: Queue<MaintenanceJobPayload>;

  constructor() {
    this.queue = new Queue<MaintenanceJobPayload>(MAINTENANCE_QUEUE_NAME, {
      connection: getRedisConnection(),
      defaultJobOptions: {
        attempts: 1,
        removeOnComplete: { count: 0 },
        removeOnFail: { count: 100 },
      },
    });

    this.queue.on("error", (err) => {
      log.error({ error: err.message }, "MaintenanceQueue error");
    });
  }

  async addJob(payload: MaintenanceJobPayload): Promise<string> {
    const job = await this.queue.add(MAINTENANCE_QUEUE_NAME, payload, {
      jobId: payload.agentRunId,
    });

    log.info(
      {
        jobId: job.id,
        agentRunId: payload.agentRunId,
        capabilityDefinitionId: payload.capabilityDefinitionId,
      },
      "Maintenance job added to queue"
    );
    return job.id!;
  }

  async getJobCounts() {
    return this.queue.getJobCounts("waiting", "active", "completed", "failed", "delayed");
  }

  getBullMQQueue(): Queue<MaintenanceJobPayload> {
    return this.queue;
  }

  async close(): Promise<void> {
    await this.queue.close();
  }
}

export const maintenanceQueue = new MaintenanceQueue();
