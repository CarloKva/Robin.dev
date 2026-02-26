import { Worker, QueueEvents } from "bullmq";
import type { Job } from "bullmq";
import type { JobPayload, JobResult } from "@robin/shared-types";
import { QUEUE_NAME, workerOptions } from "../config/bullmq.config";
import { getRedisConnection } from "../db/redis.client";
import { taskRepository } from "../repositories/task.repository";
import { agentRepository } from "../repositories/agent.repository";
import { ClaudeRunner } from "../agent/claude.runner";
import { notificationService } from "../services/notification.service";
import { JobError, AgentBlockedError } from "../errors/job.errors";
import { log } from "../utils/logger";

const AGENT_ID = process.env["AGENT_ID"] ?? "robin-alpha";

async function processJob(job: Job<JobPayload>): Promise<JobResult> {
  const { taskId, workspaceId, taskTitle } = job.data;

  log.info({ jobId: job.id, taskId, phase: "start" }, "Processing job");

  // 1. Mark task in_progress + agent busy
  await taskRepository.updateStatus(taskId, "in_progress", { actorId: AGENT_ID });
  await agentRepository.setStatus(AGENT_ID, "busy", taskId);
  await taskRepository.appendEvent(taskId, workspaceId, "agent.phase.started", AGENT_ID, {
    phase: "execution",
  });

  // 2. Run Claude Code
  const runner = new ClaudeRunner();
  const result = await runner.run(job.data);

  log.info({ jobId: job.id, taskId, status: result.status }, "Claude runner finished");

  // 3. Persist result
  if (result.status === "in_review" && result.prUrl) {
    await taskRepository.addArtifact(taskId, workspaceId, {
      type: "pr",
      url: result.prUrl,
      title: `PR for ${taskTitle}`,
    });
    await taskRepository.appendEvent(taskId, workspaceId, "agent.pr.opened", AGENT_ID, {
      pr_url: result.prUrl,
      pr_number: result.prNumber,
      commit_sha: result.commitSha,
    });
    await taskRepository.updateStatus(taskId, "review_pending", { actorId: AGENT_ID });

    await notificationService.notifyTaskReady({
      id: taskId,
      title: taskTitle,
      workspaceId,
      prUrl: result.prUrl,
    });
  } else if (result.status === "completed") {
    if (result.commitSha) {
      await taskRepository.addArtifact(taskId, workspaceId, {
        type: "commit",
        url: result.commitSha,
        title: `Commit ${result.commitSha.slice(0, 7)}`,
      });
    }
    await taskRepository.updateStatus(taskId, "completed", { actorId: AGENT_ID });
    await taskRepository.appendEvent(taskId, workspaceId, "task.completed", AGENT_ID, {
      duration_seconds: result.durationSeconds,
    });
  }

  // 4. Mark agent idle
  await agentRepository.setStatus(AGENT_ID, "idle", null);

  return result;
}

export function createWorker(): Worker<JobPayload, JobResult> {
  const worker = new Worker<JobPayload, JobResult>(QUEUE_NAME, processJob, {
    connection: getRedisConnection(),
    ...workerOptions,
  });

  worker.on("completed", (job) => {
    log.info({ jobId: job.id, taskId: job.data.taskId }, "Job completed");
  });

  worker.on("failed", async (job, err) => {
    if (!job) return;

    const { taskId, workspaceId, taskTitle } = job.data;
    const isJobError = err instanceof JobError;
    const errorCode = isJobError ? err.code : "UNKNOWN";

    log.error(
      { jobId: job.id, taskId, errorCode, attempt: job.attemptsMade, message: err.message },
      "Job failed"
    );

    // On final attempt: update task status and notify
    const isFinalAttempt = job.attemptsMade >= (job.opts.attempts ?? 1);
    if (isFinalAttempt) {
      try {
        if (err instanceof AgentBlockedError) {
          await taskRepository.appendEvent(taskId, workspaceId, "agent.blocked", AGENT_ID, {
            question: err.question,
          });
          await notificationService.notifyTaskBlocked(
            { id: taskId, title: taskTitle, workspaceId },
            err.question
          );
        } else {
          await taskRepository.updateStatus(taskId, "failed", {
            actorId: AGENT_ID,
            note: `${errorCode}: ${err.message}`,
          });
          await taskRepository.appendEvent(taskId, workspaceId, "task.failed", AGENT_ID, {
            error_code: errorCode,
            message: err.message,
          });
          await notificationService.notifyTaskFailed(
            { id: taskId, title: taskTitle, workspaceId },
            errorCode,
            err.message
          );
        }
      } catch (persistErr) {
        log.error(
          { taskId, error: String(persistErr) },
          "Failed to persist job failure to Supabase"
        );
      }

      await agentRepository.setStatus(AGENT_ID, "error", null);
    }
  });

  worker.on("stalled", (jobId) => {
    log.warn({ jobId }, "Job stalled — will be retried");
  });

  worker.on("error", (err) => {
    log.error({ error: err.message }, "Worker error");
  });

  return worker;
}

/** Monitor QueueEvents and fire DLQ alert if failed jobs exceed threshold. */
export function createQueueEventMonitor(taskQueueInstance: { getFailedCount: () => Promise<number> }) {
  const queueEvents = new QueueEvents(QUEUE_NAME, {
    connection: getRedisConnection(),
  });

  queueEvents.on("failed", async () => {
    const failedCount = await taskQueueInstance.getFailedCount();
    if (failedCount > 3) {
      await notificationService.notifyDLQAlert(failedCount);
    }
  });

  return queueEvents;
}
