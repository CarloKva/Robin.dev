import type { JobPayload, TaskType, TaskPriority } from "@robin/shared-types";
import { pollingConfig, defaultTimeoutByType } from "../config/bullmq.config";
import { taskRepository } from "../repositories/task.repository";
import { taskQueue } from "../queues/task.queue";
import { log } from "../utils/logger";

/**
 * Adaptive poller: scans for pending unqueued tasks and enqueues them.
 * Interval starts at 5s, backs off to 30s when idle, resets on activity.
 */
export class TaskPoller {
  private timer: ReturnType<typeof setTimeout> | null = null;
  private currentInterval = pollingConfig.minIntervalMs;
  private running = false;

  start(): void {
    if (this.running) return;
    this.running = true;
    log.info({ intervalMs: this.currentInterval }, "TaskPoller started");
    this.schedule();
  }

  stop(): void {
    this.running = false;
    if (this.timer) {
      clearTimeout(this.timer);
      this.timer = null;
    }
    log.info({}, "TaskPoller stopped");
  }

  private schedule(): void {
    this.timer = setTimeout(() => {
      this.poll().catch((err) => {
        log.error({ error: String(err) }, "TaskPoller poll threw");
      });
    }, this.currentInterval);
  }

  private async poll(): Promise<void> {
    if (!this.running) return;

    try {
      const tasks = await taskRepository.getPendingUnqueued();

      if (tasks.length > 0) {
        log.info({ count: tasks.length }, "Poller found pending tasks");
        this.currentInterval = pollingConfig.minIntervalMs; // reset to fast

        for (const task of tasks) {
          try {
            const payload = this.buildPayload(task);
            const jobId = await taskQueue.addJob(payload);
            await taskRepository.markQueued(task.id, jobId);
          } catch (err) {
            // Log per-task errors but continue processing others
            log.error({ taskId: task.id, error: String(err) }, "Failed to enqueue task");
          }
        }
      } else {
        // Back off when idle
        this.currentInterval = Math.min(
          this.currentInterval * pollingConfig.backoffFactor,
          pollingConfig.maxIntervalMs
        );
      }
    } catch (err) {
      log.error({ error: String(err) }, "TaskPoller.getPendingUnqueued failed");
    }

    if (this.running) {
      this.schedule();
    }
  }

  private buildPayload(task: Record<string, unknown>): JobPayload {
    const taskType = (task["task_type"] as TaskType | undefined) ?? "feature";
    return {
      taskId: task["id"] as string,
      workspaceId: task["workspace_id"] as string,
      repositoryUrl: (task["repository_url"] as string | undefined) ?? "",
      branch: `feat/${task["id"] as string}`,
      repositoryPath: this.resolveRepoPath(task),
      taskTitle: task["title"] as string,
      taskDescription: (task["description"] as string | undefined) ?? "",
      taskType,
      priority: (task["priority"] as TaskPriority | undefined) ?? "medium",
      timeoutMinutes: defaultTimeoutByType[taskType] ?? 30,
      claudeMdPath: "CLAUDE.md",
    };
  }

  private resolveRepoPath(task: Record<string, unknown>): string {
    // Default: /home/agent/repos/<workspace-id>/<task-id>
    // In Sprint 3+ this will be read from a workspace config table
    const agentHome = process.env["AGENT_HOME"] ?? "/home/agent";
    return `${agentHome}/repos/${task["workspace_id"] as string}`;
  }
}

export const taskPoller = new TaskPoller();
