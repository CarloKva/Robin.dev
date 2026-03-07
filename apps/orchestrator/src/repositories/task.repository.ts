import type { TaskStatus, ArtifactType, IterationTrigger, IterationStatus } from "@robin/shared-types";
import { getSupabaseClient } from "../db/supabase.client";
import { log } from "../utils/logger";

/** Valid task status transitions. Prevents inconsistent state updates. */
const VALID_TRANSITIONS: Record<TaskStatus, TaskStatus[]> = {
  pending: ["queued", "cancelled"],
  queued: ["in_progress", "cancelled"],
  in_progress: ["in_progress", "review_pending", "completed", "failed", "cancelled", "in_review"],
  review_pending: ["approved", "completed", "rejected", "in_progress"],
  approved: ["completed"],
  rejected: ["in_progress"],
  completed: [],
  failed: ["pending"],
  cancelled: [],
  backlog: ["queued", "cancelled", "sprint_ready"],
  sprint_ready: ["queued", "cancelled"],
  in_review: ["rework", "done", "in_progress"],
  rework: ["in_progress", "cancelled"],
  done: [],
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
    } else {
      log.debug({ taskId, jobId }, "Task already queued (queued_at already set), skipping markQueued");
    }
    return wasUpdated;
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

  /**
   * Create a new iteration row for a task.
   * Automatically increments iteration_number based on existing rows.
   * Returns the iteration_number assigned.
   */
  async createIteration(params: {
    taskId: string;
    workspaceId: string;
    trigger: IterationTrigger;
  }): Promise<number> {
    const { count } = await this.db
      .from("task_iterations")
      .select("id", { count: "exact", head: true })
      .eq("task_id", params.taskId);

    const iterationNumber = (count ?? 0) + 1;

    const { error } = await this.db.from("task_iterations").insert({
      task_id: params.taskId,
      workspace_id: params.workspaceId,
      iteration_number: iterationNumber,
      trigger: params.trigger,
      status: "running" as IterationStatus,
      started_at: new Date().toISOString(),
    });

    if (error) {
      throw new Error(`TaskRepository.createIteration failed: ${error.message}`);
    }

    log.info({ taskId: params.taskId, iterationNumber }, "TaskRepository.createIteration: iteration created");
    return iterationNumber;
  }

  /** Update an existing iteration row (status, completed_at, pr_url). */
  async updateIteration(
    taskId: string,
    iterationNumber: number,
    updates: { status: IterationStatus; prUrl?: string | null }
  ): Promise<void> {
    const { error } = await this.db
      .from("task_iterations")
      .update({
        status: updates.status,
        completed_at: new Date().toISOString(),
        ...(updates.prUrl !== undefined && { pr_url: updates.prUrl }),
        updated_at: new Date().toISOString(),
      })
      .eq("task_id", taskId)
      .eq("iteration_number", iterationNumber);

    if (error) {
      throw new Error(`TaskRepository.updateIteration failed: ${error.message}`);
    }
  }

  /** Mark any "running" iteration for a task as failed (used on job failure). */
  async markRunningIterationFailed(taskId: string): Promise<void> {
    const { error } = await this.db
      .from("task_iterations")
      .update({
        status: "failed" as IterationStatus,
        completed_at: new Date().toISOString(),
        updated_at: new Date().toISOString(),
      })
      .eq("task_id", taskId)
      .eq("status", "running");

    if (error) {
      // Log but don't throw — this is best-effort, failure handling already done
      log.warn({ taskId, error: error.message }, "TaskRepository.markRunningIterationFailed: update failed");
    }
  }

  /** Fetch tasks eligible for queueing: pending or queued (not yet picked up by worker). */
  async getPendingUnqueued(workspaceId?: string) {
    let query = this.db
      .from("tasks")
      .select("*, attachments, repositories(id, full_name, default_branch)")
      .in("status", ["pending", "queued"])
      .is("queued_at", null)
      .order("created_at", { ascending: true });

    if (workspaceId) {
      query = query.eq("workspace_id", workspaceId);
    }

    const { data, error } = await query;
    if (error) throw new Error(`TaskRepository.getPendingUnqueued failed: ${error.message}`);
    return data ?? [];
  }

  /**
   * Reset a task back to unqueued state — used as a recovery path when a job
   * is picked up by the wrong agent worker (routing mismatch).
   * Bypasses the state machine intentionally: queued → pending is not a normal
   * transition but is safe here since no work has been done on the task.
   */
  async resetToUnqueued(taskId: string): Promise<void> {
    const { error } = await this.db
      .from("tasks")
      .update({ queued_at: null, status: "pending", updated_at: new Date().toISOString() })
      .eq("id", taskId)
      .in("status", ["queued"]);

    if (error) {
      log.warn({ taskId, error: error.message }, "TaskRepository.resetToUnqueued failed");
    }
  }
}

export const taskRepository = new TaskRepository();
