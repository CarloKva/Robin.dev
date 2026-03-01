import type { SupabaseClient } from "@supabase/supabase-js";
import type { TaskEventType } from "@robin/shared-types";

export type UserEventType = Extract<
  TaskEventType,
  "user.task.created" | "user.task.updated" | "user.task.deleted" | "user.rework.initiated"
>;

/**
 * Writes a user.* audit event to task_events.
 * Never throws — errors are logged but the calling operation is not blocked.
 */
export async function trackUserAction(
  supabase: SupabaseClient,
  workspaceId: string,
  userId: string,
  taskId: string,
  action: UserEventType,
  payload: Record<string, unknown>
): Promise<void> {
  try {
    const { error } = await supabase.from("task_events").insert({
      task_id: taskId,
      workspace_id: workspaceId,
      event_type: action,
      actor_type: "human",
      actor_id: userId,
      payload,
    });

    if (error) {
      console.error(`[trackUserAction] Failed to write ${action} event:`, error.message);
    }
  } catch (err) {
    console.error(`[trackUserAction] Unexpected error writing ${action} event:`, err);
  }
}
