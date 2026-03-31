import { Queue } from "bullmq";
import type { BugfixJobData } from "@robin/shared-types";
import { getRedisConnection } from "../db/redis.client";
import { log } from "../utils/logger";

const BUGFIX_QUEUE_NAME = "bugfix-pipeline";

/**
 * Typed BullMQ Queue for bugfix pipeline jobs.
 * The web app enqueues jobs here; the BugfixWorker on agent VPS processes them.
 *
 * Follows the same singleton pattern as TaskQueue.
 */
export class BugfixQueue {
  private queue: Queue<BugfixJobData>;

  constructor() {
    this.queue = new Queue<BugfixJobData>(BUGFIX_QUEUE_NAME, {
      connection: getRedisConnection(),
      defaultJobOptions: {
        attempts: 1, // Don't retry bugfix jobs — they're non-idempotent (git state)
        removeOnComplete: { age: 7 * 24 * 3600 },
        removeOnFail: { age: 30 * 24 * 3600 },
      },
    });

    this.queue.on("error", (err) => {
      log.error({ error: err.message }, "BugfixQueue error");
    });
  }

  /** Add a bugfix job. Job ID is the task UUID for traceability. */
  async addJob(payload: BugfixJobData): Promise<string> {
    const job = await this.queue.add(BUGFIX_QUEUE_NAME, payload, {
      jobId: payload.taskId,
    });

    log.info({ jobId: job.id, taskId: payload.taskId }, "Bugfix job added to queue");
    return job.id!;
  }

  async getJobCounts() {
    return this.queue.getJobCounts("waiting", "active", "completed", "failed", "delayed");
  }

  getBullMQQueue(): Queue<BugfixJobData> {
    return this.queue;
  }

  async close(): Promise<void> {
    await this.queue.close();
  }
}

export const bugfixQueue = new BugfixQueue();
