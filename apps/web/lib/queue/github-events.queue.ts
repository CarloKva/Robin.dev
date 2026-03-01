import { Queue } from "bullmq";
import { createRedisConnection } from "./redis.connection";

export const GITHUB_WEBHOOK_QUEUE_NAME = "github-webhook-processor";

export type GitHubWebhookJobPayload = {
  /** GitHub event name (X-GitHub-Event header), e.g. "pull_request" */
  event: string;
  /** GitHub delivery ID (X-GitHub-Delivery header) for deduplication and tracing */
  deliveryId: string;
  /** Workspace ID resolved from repository.full_name */
  workspaceId: string;
  /** repository.full_name from the GitHub payload */
  repositoryFullName: string;
  /** Full raw webhook payload from GitHub */
  payload: Record<string, unknown>;
};

let _queue: Queue<GitHubWebhookJobPayload> | null = null;

/**
 * Singleton BullMQ Queue for GitHub webhook events.
 * The control-plane orchestrator worker consumes jobs from this queue.
 */
export function getGitHubWebhookQueue(): Queue<GitHubWebhookJobPayload> {
  if (_queue) return _queue;

  _queue = new Queue<GitHubWebhookJobPayload>(GITHUB_WEBHOOK_QUEUE_NAME, {
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
