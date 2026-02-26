import type { TaskStatus, ArtifactType } from "@robin/shared-types";
import { getSupabaseClient } from "../db/supabase.client";
import { log } from "../utils/logger";

/** Valid task status transitions. Prevents inconsistent state updates. */
const VALID_TRANSITIONS: Record<TaskStatus, TaskStatus[]> = {
  pending: ["queued", "cancelled"],
  queued: ["in_progress", "cancelled"],
  in_progress: ["review_pending", "completed", "failed", "cancelled"],
  review_pending: ["approved", "completed", "rejected", "in_progress"],
  approved: ["completed"],
  rejected: ["in_progress"],
  completed: [],
  failed: ["pending"],
  cancelled: [],
};

export class TaskRepository {
  private get db() {
    return getSupabaseClient();
  }

  async getById(taskId: string) {
    const { data, error } = await this.db
      .from("tasks")
      .select("*")
      .eq("id", taskId)
      .single();

    if (error) throw new Error(`TaskRepository.getById failed: ${error.message}`);
    return data;
  }

  /**
   * Atomically update task status and append a task_state.changed event.
   * Validates the transition is allowed before writing.
   */
  async updateStatus(
    taskId: string,
    newStatus: TaskStatus,
    meta?: { actorId?: string; note?: string }
  ): Promise<void> {
    const task = await this.getById(taskId);
    const currentStatus = task.status as TaskStatus;

    const allowed = VALID_TRANSITIONS[currentStatus] ?? [];
    if (!allowed.includes(newStatus)) {
      throw new Error(
        `Invalid task transition: ${currentStatus} → ${newStatus} (task ${taskId})`
      );
    }

    const { error: updateError } = await this.db
      .from("tasks")
      .update({ status: newStatus, updated_at: new Date().toISOString() })
      .eq("id", taskId);

    if (updateError) {
      throw new Error(`TaskRepository.updateStatus failed: ${updateError.message}`);
    }

    // Append to audit log
    const { error: eventError } = await this.db.from("task_events").insert({
      task_id: taskId,
      workspace_id: task.workspace_id,
      event_type: "task.state.changed",
      actor_type: "agent",
      actor_id: meta?.actorId ?? "orchestrator",
      payload: {
        from: currentStatus,
        to: newStatus,
        note: meta?.note,
      },
    });

    if (eventError) {
      // Log but don't throw — status update already succeeded
      log.warn({ taskId, error: eventError.message }, "Failed to write task_event after status update");
    }
  }

  /** Mark a task as queued in BullMQ (sets queued_at). Idempotent. */
  async markQueued(taskId: string, jobId: string): Promise<boolean> {
    const { data, error } = await this.db
      .from("tasks")
      .update({ queued_at: new Date().toISOString(), status: "queued" })
      .eq("id", taskId)
      .is("queued_at", null) // idempotency guard
      .select("id")
      .single();

    if (error && error.code !== "PGRST116") {
      throw new Error(`TaskRepository.markQueued failed: ${error.message}`);
    }

    const wasUpdated = data !== null;
    if (wasUpdated) {
      log.info({ taskId, jobId }, "Task marked as queued");
    }
    return wasUpdated;
  }

  /** Append a task_event (used for agent phase events, PR opened, blocked, etc.) */
  async appendEvent(
    taskId: string,
    workspaceId: string,
    eventType: string,
    actorId: string,
    payload: Record<string, unknown>
  ): Promise<void> {
    const { error } = await this.db.from("task_events").insert({
      task_id: taskId,
      workspace_id: workspaceId,
      event_type: eventType,
      actor_type: "agent",
      actor_id: actorId,
      payload,
    });

    if (error) {
      throw new Error(`TaskRepository.appendEvent failed: ${error.message}`);
    }
  }

  /** Add an artifact (PR, commit, deploy preview) to a task. */
  async addArtifact(
    taskId: string,
    workspaceId: string,
    artifact: { type: ArtifactType; url: string; title: string }
  ): Promise<void> {
    const { error } = await this.db.from("task_artifacts").insert({
      task_id: taskId,
      workspace_id: workspaceId,
      type: artifact.type,
      url: artifact.url,
      title: artifact.title,
    });

    if (error) {
      throw new Error(`TaskRepository.addArtifact failed: ${error.message}`);
    }
  }

  /** Fetch tasks eligible for queueing: pending and not yet queued. */
  async getPendingUnqueued() {
    const { data, error } = await this.db
      .from("tasks")
      .select("*")
      .eq("status", "pending")
      .is("queued_at", null)
      .order("created_at", { ascending: true });

    if (error) throw new Error(`TaskRepository.getPendingUnqueued failed: ${error.message}`);
    return data ?? [];
  }
}

export const taskRepository = new TaskRepository();
