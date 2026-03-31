import { Queue } from "bullmq";
import type { BugfixJobData } from "@robin/shared-types";
import { createRedisConnection } from "./redis.connection";

const QUEUE_NAME = "bugfix-pipeline";

let _queue: Queue<BugfixJobData> | null = null;

/**
 * Singleton BullMQ Queue used by the web app to enqueue bugfix tasks.
 * The bugfix worker on the agent VPS listens to the same queue (same Redis, same queue name).
 */
export function getBugfixQueue(): Queue<BugfixJobData> {
  if (_queue) return _queue;

  _queue = new Queue<BugfixJobData>(QUEUE_NAME, {
    connection: createRedisConnection(),
    defaultJobOptions: {
      attempts: 1, // Don't retry — bugfix jobs are non-idempotent (git state)
      removeOnComplete: { age: 7 * 24 * 3600 },
      removeOnFail: { age: 30 * 24 * 3600 },
    },
  });

  return _queue;
}
