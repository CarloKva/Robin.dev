import { Queue } from "bullmq";
import type { RepoQueueJobPayload } from "@robin/shared-types";
import { createRedisConnection } from "./redis.connection";

const queues = new Map<string, Queue<RepoQueueJobPayload>>();

/**
 * Returns (or creates) a per-repository BullMQ queue.
 * Queue name: `repo-queue:{repositoryId}`
 * concurrency=1 is enforced at the worker level, ensuring sequential execution per repo.
 */
export function getRepoQueue(repositoryId: string): Queue<RepoQueueJobPayload> {
  const existing = queues.get(repositoryId);
  if (existing) return existing;

  const queue = new Queue<RepoQueueJobPayload>(`repo-queue:${repositoryId}`, {
    connection: createRedisConnection(),
    defaultJobOptions: {
      attempts: 1,
      removeOnComplete: { count: 100 },
      removeOnFail: { count: 50 },
    },
  });

  queues.set(repositoryId, queue);
  return queue;
}

export async function closeAllRepoQueues(): Promise<void> {
  await Promise.all([...queues.values()].map((q) => q.close()));
  queues.clear();
}
