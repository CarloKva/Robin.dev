import { Queue } from "bullmq";
import type { SprintControlJobPayload } from "@robin/shared-types";
import { createRedisConnection } from "./redis.connection";

let queue: Queue<SprintControlJobPayload> | null = null;

/**
 * Returns (or creates) the sprint-control BullMQ queue (singleton).
 *
 * Jobs in this queue are produced by `POST /api/sprints/{id}/start` and
 * consumed by the control-plane's SprintControlWorker, which ensures that
 * a per-repo BullMQ worker is active for each repository in the sprint.
 *
 * This is the Fix 1 "happy path" signal: the control-plane reacts within
 * milliseconds of a sprint being started, without needing a restart.
 */
export function getSprintControlQueue(): Queue<SprintControlJobPayload> {
  if (queue) return queue;

  queue = new Queue<SprintControlJobPayload>("sprint-control", {
    connection: createRedisConnection(),
    defaultJobOptions: {
      attempts: 3,
      backoff: { type: "exponential", delay: 1000 },
      removeOnComplete: { count: 50 },
      removeOnFail: { count: 50 },
    },
  });

  return queue;
}

export async function closeSprintControlQueue(): Promise<void> {
  if (queue) {
    await queue.close();
    queue = null;
  }
}
