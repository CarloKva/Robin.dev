import { Queue } from "bullmq";
import type { JobPayload } from "@robin/shared-types";
import { QUEUE_NAME, defaultJobOptions, priorityToNumber } from "../config/bullmq.config";
import { getRedisConnection } from "../db/redis.client";
import { log } from "../utils/logger";

/**
 * Typed BullMQ Queue wrapper.
 * The orchestrator enqueues jobs here; the TaskWorker processes them.
 */
export class TaskQueue {
  private queue: Queue<JobPayload>;

  constructor() {
    this.queue = new Queue<JobPayload>(QUEUE_NAME, {
      connection: getRedisConnection(),
      defaultJobOptions,
    });

    this.queue.on("error", (err) => {
      log.error({ error: err.message }, "TaskQueue error");
    });
  }

  /** Add a job. Job ID is the task UUID for traceability and idempotency. */
  async addJob(payload: JobPayload): Promise<string> {
    const job = await this.queue.add(QUEUE_NAME, payload, {
      jobId: payload.taskId, // deduplicate by task ID
      priority: priorityToNumber(payload.priority),
    });

    log.info({ jobId: job.id, taskId: payload.taskId }, "Job added to queue");
    return job.id!;
  }

  async getJobCounts() {
    return this.queue.getJobCounts(
      "waiting",
      "active",
      "completed",
      "failed",
      "delayed"
    );
  }

  async getFailedCount(): Promise<number> {
    const counts = await this.getJobCounts();
    return counts["failed"] ?? 0;
  }

  /** Requeue all failed jobs (manual DLQ drain). */
  async requeueFailed(): Promise<void> {
    await this.queue.retryJobs({ state: "failed" });
    log.info({}, "Requeued all failed jobs");
  }

  getBullMQQueue(): Queue<JobPayload> {
    return this.queue;
  }

  async close(): Promise<void> {
    await this.queue.close();
  }
}

export const taskQueue = new TaskQueue();
