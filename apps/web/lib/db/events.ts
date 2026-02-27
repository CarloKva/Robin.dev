import type { TaskEvent, TaskEventType, TimelineEntry, TaskProjectedState } from "@robin/shared-types";
import { createSupabaseServerClient } from "@/lib/supabase/server";
import { narrativize } from "@/lib/events/narrativize";
import { projectTaskState } from "@/lib/db/projectTaskState";

export { projectTaskState };

/**
 * Fetch all events for a task, ordered chronologically.
 * Uses the user-scoped server client — RLS enforced.
 */
export async function getTaskTimeline(taskId: string): Promise<TimelineEntry[]> {
  const supabase = await createSupabaseServerClient();

  const { data, error } = await supabase
    .from("task_events")
    .select("*")
    .eq("task_id", taskId)
    .order("created_at", { ascending: true });

  if (error) {
    throw new Error(`getTaskTimeline failed: ${error.message}`);
  }

  return (data ?? []).map((row) => ({
    id: row.id as string,
    event_type: row.event_type as TaskEventType,
    actor_type: row.actor_type as "agent" | "human",
    actor_id: row.actor_id as string,
    payload: row.payload as Record<string, unknown>,
    created_at: row.created_at as string,
    narrative: narrativize({
      event_type: row.event_type as TaskEventType,
      payload: row.payload as Record<string, unknown>,
      actor_type: row.actor_type as "agent" | "human",
      actor_id: row.actor_id as string,
    }),
  }));
}

/**
 * Convenience: fetch timeline and compute projected state in one call.
 */
export async function getTaskProjectedState(
  taskId: string
): Promise<TaskProjectedState> {
  const supabase = await createSupabaseServerClient();

  const { data, error } = await supabase
    .from("task_events")
    .select("*")
    .eq("task_id", taskId)
    .order("created_at", { ascending: true });

  if (error) {
    throw new Error(`getTaskProjectedState failed: ${error.message}`);
  }

  return projectTaskState((data ?? []) as TaskEvent[]);
}
