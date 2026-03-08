import type { JobPayload, TaskType, TaskPriority, MCPServerConfig } from "@robin/shared-types";
import { pollingConfig, defaultTimeoutByType } from "../config/bullmq.config";
import { taskRepository } from "../repositories/task.repository";
import { agentRepository } from "../repositories/agent.repository";
import { getSupabaseClient } from "../db/supabase.client";
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
  // undefined = not yet resolved; null = resolved but unknown/not set
  private workspaceId: string | null | undefined = undefined;
  private mcpConfig: { mcpServers: Record<string, MCPServerConfig> } | null | undefined = undefined;

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
    const envWorkspaceId = process.env["WORKSPACE_ID"];
    if (envWorkspaceId) {
      this.workspaceId = envWorkspaceId;
      log.info({ workspaceId: this.workspaceId }, "TaskPoller: workspace resolved from env");
      return;
    }
    const agentId = process.env["AGENT_ID"] ?? "";
    this.workspaceId = await agentRepository.getWorkspaceId(agentId);
    if (!this.workspaceId) {
      log.warn({ agentId }, "TaskPoller: could not resolve workspace — will poll ALL workspaces");
    } else {
      log.info({ workspaceId: this.workspaceId }, "TaskPoller: workspace resolved");
    }
  }

  private async resolveMcpConfig(): Promise<void> {
    if (this.mcpConfig !== undefined) return;
    if (!this.workspaceId) {
      this.mcpConfig = null;
      return;
    }
    try {
      const { data, error } = await getSupabaseClient()
        .from("workspaces")
        .select("mcp_config")
        .eq("id", this.workspaceId)
        .single();
      if (error) throw error;
      this.mcpConfig = (data?.mcp_config as typeof this.mcpConfig) ?? null;
      if (this.mcpConfig) {
        log.info({ workspaceId: this.workspaceId }, "TaskPoller: MCP config loaded");
      }
    } catch (err) {
      log.warn({ workspaceId: this.workspaceId, error: String(err) }, "TaskPoller: could not load MCP config — proceeding without it");
      this.mcpConfig = null;
    }
  }

  private async recoverStuckQueued(): Promise<void> {
    const STUCK_TIMEOUT_MS = 5 * 60 * 1000; // 5 minutes
    const stuckTasks = await taskRepository.getStuckQueued(STUCK_TIMEOUT_MS, this.workspaceId ?? undefined);
    for (const task of stuckTasks) {
      log.warn({ taskId: task.id }, "TaskPoller: resetting stuck queued task (BullMQ job lost)");
      await taskRepository.resetToUnqueued(task.id);
    }
  }

  private async poll(): Promise<void> {
    if (!this.running) return;

    await this.resolveWorkspaceId();
    await this.resolveMcpConfig();

    // Recovery: reset tasks stuck in 'queued' with no BullMQ job
    try {
      await this.recoverStuckQueued();
    } catch (err) {
      log.error({ error: String(err) }, "TaskPoller.recoverStuckQueued failed");
    }

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
      attachments: (task["attachments"] as JobPayload["attachments"]) ?? [],
      mcpConfig: this.mcpConfig ?? null,
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
