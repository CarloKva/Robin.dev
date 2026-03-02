import { Worker } from "bullmq";
import type { Job } from "bullmq";
import type { SprintControlJobPayload } from "@robin/shared-types";
import { getRedisConnection } from "../db/redis.client";
import { createRepoQueueWorker } from "./repo-queue.worker";
import { log } from "../utils/logger";

/**
 * SprintControlWorker — Fix 1: reactive per-repo worker activation.
 *
 * Listens on the `sprint-control` BullMQ queue. When a sprint is started via
 * `POST /api/sprints/{id}/start`, the web app enqueues a SprintControlJobPayload
 * listing all repository IDs involved. This worker ensures that a per-repo
 * BullMQ worker is running for each repository before the sprint jobs land.
 *
 * Latency: sub-second — no restart needed, no polling delay.
 */
export function createSprintControlWorker(): Worker<SprintControlJobPayload> {
  const worker = new Worker<SprintControlJobPayload>(
    "sprint-control",
    async (job: Job<SprintControlJobPayload>) => {
      const { repositoryIds, sprintId } = job.data;

      log.info(
        { sprintId, repoCount: repositoryIds.length, repositoryIds },
        "SprintControlWorker: activating per-repo workers"
      );

      for (const repositoryId of repositoryIds) {
        createRepoQueueWorker(repositoryId);
      }

      log.info(
        { sprintId, repoCount: repositoryIds.length },
        "SprintControlWorker: all repo workers active"
      );
    },
    {
      connection: getRedisConnection(),
      concurrency: 5,
      autorun: true,
    }
  );

  worker.on("error", (err) => {
    log.error({ error: err.message }, "SprintControlWorker error");
  });

  log.info({}, "SprintControlWorker started");
  return worker;
}
