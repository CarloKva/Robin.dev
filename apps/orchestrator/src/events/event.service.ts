import type {
  TaskEventType,
  EventPayloadMap,
  ADWPPhase,
} from "@robin/shared-types";
import { getSupabaseClient } from "../db/supabase.client";
import { log } from "../utils/logger";

/**
 * EventService — centralised event emission for the orchestrator.
 *
 * All task_events INSERTs from the orchestrator flow through here so that:
 * - Payloads are type-safe via EventPayloadMap
 * - Logging is consistent
 * - A single place to add future cross-cutting concerns (e.g. metrics)
 *
 * Errors are logged but never thrown — a failed event write should never
 * abort the main orchestration flow.
 */
export class EventService {
  private get db() {
    return getSupabaseClient();
  }

  private async emit<T extends TaskEventType>(
    taskId: string,
    workspaceId: string,
    actorId: string,
    eventType: T,
    payload: EventPayloadMap[T]
  ): Promise<void> {
    const { error } = await this.db.from("task_events").insert({
      task_id: taskId,
      workspace_id: workspaceId,
      event_type: eventType,
      actor_type: "agent",
      actor_id: actorId,
      payload: payload as Record<string, unknown>,
    });

    if (error) {
      log.warn(
        { taskId, eventType, error: error.message },
        "EventService: failed to write event"
      );
    } else {
      log.info({ taskId, eventType }, "EventService: event emitted");
    }
  }

  async phaseStarted(
    taskId: string,
    workspaceId: string,
    actorId: string,
    phase: ADWPPhase | string
  ): Promise<void> {
    await this.emit(taskId, workspaceId, actorId, "agent.phase.started", {
      phase,
    });
  }

  async phaseCompleted(
    taskId: string,
    workspaceId: string,
    actorId: string,
    phase: ADWPPhase | string,
    durationSeconds?: number
  ): Promise<void> {
    await this.emit(taskId, workspaceId, actorId, "agent.phase.completed", {
      phase,
      ...(durationSeconds != null && { duration_seconds: durationSeconds }),
    });
  }

  async commitPushed(
    taskId: string,
    workspaceId: string,
    actorId: string,
    commitSha: string,
    branch: string,
    message?: string
  ): Promise<void> {
    await this.emit(taskId, workspaceId, actorId, "agent.commit.pushed", {
      commit_sha: commitSha,
      branch,
      ...(message && { message }),
    });
  }

  async prOpened(
    taskId: string,
    workspaceId: string,
    actorId: string,
    prUrl: string,
    prNumber?: number,
    commitSha?: string
  ): Promise<void> {
    await this.emit(taskId, workspaceId, actorId, "agent.pr.opened", {
      pr_url: prUrl,
      ...(prNumber != null && { pr_number: prNumber }),
      ...(commitSha && { commit_sha: commitSha }),
    });
  }

  async agentBlocked(
    taskId: string,
    workspaceId: string,
    actorId: string,
    question: string
  ): Promise<void> {
    await this.emit(taskId, workspaceId, actorId, "agent.blocked", {
      question,
    });
  }

  async taskCompleted(
    taskId: string,
    workspaceId: string,
    actorId: string,
    durationSeconds?: number
  ): Promise<void> {
    await this.emit(taskId, workspaceId, actorId, "task.completed", {
      ...(durationSeconds != null && { duration_seconds: durationSeconds }),
    });
  }

  async taskFailed(
    taskId: string,
    workspaceId: string,
    actorId: string,
    errorCode: string,
    message: string
  ): Promise<void> {
    await this.emit(taskId, workspaceId, actorId, "task.failed", {
      error_code: errorCode,
      message,
    });
  }
}

export const eventService = new EventService();
