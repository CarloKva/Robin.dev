import { Queue } from "bullmq";
import { createRedisConnection } from "./redis.connection";

export const GITHUB_EVENTS_QUEUE_NAME = "github-events";

export type GitHubEventJobPayload = {
  /** GitHub event name (X-GitHub-Event header), e.g. "pull_request" */
  event: string;
  /** GitHub delivery ID (X-GitHub-Delivery header) */
  deliveryId: string;
  /** Full webhook payload from GitHub */
  payload: Record<string, unknown>;
};

let _queue: Queue<GitHubEventJobPayload> | null = null;

/**
 * Singleton BullMQ Queue for GitHub webhook events.
 * The control-plane orchestrator worker consumes jobs from this queue.
 */
export function getGitHubEventsQueue(): Queue<GitHubEventJobPayload> {
  if (_queue) return _queue;

  _queue = new Queue<GitHubEventJobPayload>(GITHUB_EVENTS_QUEUE_NAME, {
    connection: createRedisConnection(),
    defaultJobOptions: {
      attempts: 3,
      backoff: { type: "exponential", delay: 2_000 },
      removeOnComplete: { count: 500, age: 7 * 24 * 3600 },
      removeOnFail: { count: 200 },
    },
  });

  return _queue;
}
