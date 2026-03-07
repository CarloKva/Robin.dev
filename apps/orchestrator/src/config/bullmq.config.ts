import type { DefaultJobOptions, WorkerOptions } from "bullmq";
import type { TaskPriority } from "@robin/shared-types";

export const QUEUE_NAME = "tasks";

export const BULL_BOARD_PORT = 3001;

/** Default options applied to every job added to the queue. */
export const defaultJobOptions: DefaultJobOptions = {
  attempts: 3,
  backoff: {
    type: "exponential",
    delay: 5_000, // 5s → 25s → 125s
  },
  removeOnComplete: { count: 0 },
  removeOnFail: { count: 100 },
};

/** Worker concurrency: 2 concurrent Claude Code executions on a 4GB VPS. */
export const workerConcurrency = 2;

export const workerOptions: Omit<WorkerOptions, "connection"> = {
  concurrency: workerConcurrency,
  stalledInterval: 30_000,
  maxStalledCount: 1,
  removeOnComplete: { count: 0 },
  removeOnFail: { count: 100 },
};

/** Maps task priority to BullMQ priority number (lower = higher priority). */
export function priorityToNumber(p: TaskPriority): number {
  const map: Record<TaskPriority, number> = {
    critical: 1,
    urgent: 1,
    high: 2,
    medium: 5,
    low: 10,
  };
  return map[p];
}

/** Default timeout in minutes by task type. */
export const defaultTimeoutByType: Record<string, number> = {
  chore: 15,
  docs: 20,
  bug: 30,
  accessibility: 30,
  security: 45,
  refactor: 45,
  feature: 60,
};

/** Adaptive polling: start fast, back off when idle. */
export const pollingConfig = {
  minIntervalMs: 5_000,
  maxIntervalMs: 30_000,
  backoffFactor: 1.5,
};
