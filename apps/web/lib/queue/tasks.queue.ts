import { Queue } from "bullmq";
import type { JobPayload } from "@robin/shared-types";
import { createRedisConnection } from "./redis.connection";

const QUEUE_NAME = "tasks";

let _queue: Queue<JobPayload> | null = null;

/**
 * Singleton BullMQ Queue used by the web app to enqueue new tasks.
 * The orchestrator worker listens to the same queue (same Redis, same queue name).
 */
export function getTaskQueue(): Queue<JobPayload> {
  if (_queue) return _queue;

  _queue = new Queue<JobPayload>(QUEUE_NAME, {
    connection: createRedisConnection(),
    defaultJobOptions: {
      attempts: 3,
      backoff: { type: "exponential", delay: 5_000 },
      removeOnComplete: { count: 200, age: 7 * 24 * 3600 },
      removeOnFail: { count: 100 },
    },
  });

  return _queue;
}

/** Maps task priority to BullMQ priority number (lower = higher priority). */
export function priorityToNumber(
  p: "low" | "medium" | "high" | "urgent"
): number {
  const map = { urgent: 1, high: 2, medium: 5, low: 10 };
  return map[p];
}

/** Default timeout in minutes by task type. */
export const defaultTimeoutByType: Record<string, number> = {
  chore: 15,
  docs: 20,
  bug: 30,
  refactor: 45,
  feature: 60,
};
