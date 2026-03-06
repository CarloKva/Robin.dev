import type { JobPayload, TaskType, TaskPriority } from "@robin/shared-types";
import { pollingConfig, defaultTimeoutByType } from "../config/bullmq.config";
import { taskRepository } from "../repositories/task.repository";
import { agentRepository } from "../repositories/agent.repository";
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
  // undefined = not yet resolved; null = resolved but unknown
  private workspaceId: string | null | undefined = undefined;

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

  private async resolveWorkspaceId(): Promise<void> {
    if (this.workspaceId !== undefined) return;
    const agentId = process.env["AGENT_ID"] ?? "";
    this.workspaceId = await agentRepository.getWorkspaceId(agentId);
    if (!this.workspaceId) {
      log.warn({ agentId }, "TaskPoller: could not resolve workspace — will poll ALL workspaces");
    } else {
      log.info({ workspaceId: this.workspaceId }, "TaskPoller: workspace resolved");
    }
  }

  private async poll(): Promise<void> {
    if (!this.running) return;

    await this.resolveWorkspaceId();

    try {
      const tasks = await taskRepository.getPendingUnqueued(this.workspaceId ?? undefined);

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
    const taskType = (task["type"] as TaskType | undefined) ?? "feature";
    const agentId =
      (task["assigned_agent_id"] as string | undefined) ??
      (process.env["AGENT_ID"] ?? "");

    // Repository info is embedded via Supabase join (see getPendingUnqueued)
    const repo = task["repositories"] as
      | { id: string; full_name: string; default_branch: string }
      | null
      | undefined;

    const repositoryUrl = repo ? `https://github.com/${repo.full_name}.git` : "";

    return {
      taskId: task["id"] as string,
      workspaceId: task["workspace_id"] as string,
      agentId,
      repositoryUrl,
      branch: `feat/${task["id"] as string}`,
      repositoryPath: this.resolveRepoPath(task, repo ?? null),
      taskTitle: task["title"] as string,
      taskDescription: (task["description"] as string | undefined) ?? "",
      taskType,
      priority: (task["priority"] as TaskPriority | undefined) ?? "medium",
      timeoutMinutes: defaultTimeoutByType[taskType] ?? 30,
      claudeMdPath: "CLAUDE.md",
    };
  }

  private resolveRepoPath(
    task: Record<string, unknown>,
    repo: { id: string } | null
  ): string {
    const agentHome = process.env["AGENT_HOME"] ?? "/home/agent";
    // Use the repository's own UUID as directory name to match the web API convention
    if (repo?.id) {
      return `${agentHome}/repos/${repo.id}`;
    }
    // Fallback: workspace-scoped path when no repo is linked
    return `${agentHome}/repos/${task["workspace_id"] as string}`;
  }
}

export const taskPoller = new TaskPoller();
