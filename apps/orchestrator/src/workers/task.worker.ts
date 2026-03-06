import { Worker, QueueEvents } from "bullmq";
import type { Job } from "bullmq";
import type { JobPayload, JobResult } from "@robin/shared-types";
import { QUEUE_NAME, workerOptions } from "../config/bullmq.config";
import { getRedisConnection } from "../db/redis.client";
import { taskRepository } from "../repositories/task.repository";
import { agentRepository } from "../repositories/agent.repository";
import { ClaudeRunner } from "../agent/claude.runner";
import { notificationService } from "../services/notification.service";
import { eventService } from "../events/event.service";
import { JobError, AgentBlockedError } from "../errors/job.errors";
import { log } from "../utils/logger";

// AGENT_ID must be a UUID that exists in the agents table.
// For local dev with seed data use: b0000000-0000-0000-0000-000000000001
const AGENT_ID = process.env["AGENT_ID"] ?? "b0000000-0000-0000-0000-000000000001";
const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
if (!UUID_RE.test(AGENT_ID)) {
  throw new Error(
    `AGENT_ID env var must be a valid UUID (got "${AGENT_ID}"). ` +
    "Set it to the agent's UUID from the agents table."
  );
}

async function processJob(job: Job<JobPayload>): Promise<JobResult> {
  const { taskId, workspaceId, taskTitle, agentId: jobAgentId } = job.data;

  log.info({ jobId: job.id, taskId, phase: "start" }, "Processing job");

  // Verify this job is intended for this agent (routing safety check)
  if (jobAgentId && jobAgentId !== AGENT_ID) {
    log.warn(
      { jobId: job.id, taskId, jobAgentId, AGENT_ID },
      "Job agent mismatch — resetting task to pending for correct agent to pick up"
    );
    // Reset task so the TaskPoller re-enqueues it for the correct agent.
    // Do NOT call moveToDelayed — it conflicts with the BullMQ active→completed
    // transition and causes "not in active state" errors that land the job in failed.
    await taskRepository.resetToUnqueued(taskId);
    return { status: "completed", startedAt: new Date().toISOString(), completedAt: new Date().toISOString(), durationSeconds: 0, stdoutTail: "" };
  }

  // 1. Mark task in_progress + agent busy + create iteration record
  await taskRepository.updateStatus(taskId, "in_progress", { actorId: AGENT_ID });
  await agentRepository.setStatus(AGENT_ID, "busy", taskId);
  const iterationNumber = await taskRepository.createIteration({
    taskId,
    workspaceId,
    trigger: "initial",
  });
  await eventService.phaseStarted(taskId, workspaceId, AGENT_ID, "analysis");

  // 2. Run Claude Code
  const runner = new ClaudeRunner();
  const result = await runner.run(job.data, {
    onCommitPushed: (commitSha, branch) =>
      eventService.commitPushed(taskId, workspaceId, AGENT_ID, commitSha, branch),
    onPhaseStarted: (phase) =>
      eventService.phaseStarted(taskId, workspaceId, AGENT_ID, phase),
    onPhaseCompleted: (phase, durationSeconds) =>
      eventService.phaseCompleted(taskId, workspaceId, AGENT_ID, phase, durationSeconds),
  });

  log.info({ jobId: job.id, taskId, status: result.status }, "Claude runner finished");

  // 3. Persist result
  if (result.status === "in_review" && result.prUrl) {
    await taskRepository.addArtifact(taskId, workspaceId, {
      type: "pr",
      url: result.prUrl,
      title: `PR for ${taskTitle}`,
    });
    await eventService.prOpened(
      taskId,
      workspaceId,
      AGENT_ID,
      result.prUrl,
      result.prNumber,
      result.commitSha
    );
    await taskRepository.updateStatus(taskId, "in_review", { actorId: AGENT_ID });
    await taskRepository.updateIteration(taskId, iterationNumber, {
      status: "completed",
      prUrl: result.prUrl,
    });

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
    await taskRepository.updateIteration(taskId, iterationNumber, { status: "completed" });
    await eventService.taskCompleted(taskId, workspaceId, AGENT_ID, result.durationSeconds);
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
          await eventService.agentBlocked(taskId, workspaceId, AGENT_ID, err.question);
          await notificationService.notifyTaskBlocked(
            { id: taskId, title: taskTitle, workspaceId },
            err.question
          );
        } else {
          await taskRepository.updateStatus(taskId, "failed", {
            actorId: AGENT_ID,
            note: `${errorCode}: ${err.message}`,
          });
          await eventService.taskFailed(taskId, workspaceId, AGENT_ID, errorCode, err.message);
          await notificationService.notifyTaskFailed(
            { id: taskId, title: taskTitle, workspaceId },
            errorCode,
            err.message
          );
        }
        // Mark the running iteration as failed
        await taskRepository.markRunningIterationFailed(taskId);
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
