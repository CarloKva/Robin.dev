import { createSupabaseServerClient } from "@/lib/supabase/server";
import { narrativize } from "@/lib/events/narrativize";
import { projectTaskState } from "@/lib/db/projectTaskState";
import type { TaskEventType, TaskEvent, TaskProjectedState } from "@robin/shared-types";

export type DashboardMetrics = {
  completedThisWeek: number;
  inQueue: number;
  /** Tasks in `blocked` or `failed` status that need user attention. */
  needsAttention: number;
  /** Total task count across all statuses — used to show onboarding state. */
  total: number;
};

export type FeedEntry = {
  id: string;
  task_id: string;
  task_title: string | null;
  event_type: TaskEventType;
  narrative: string;
  created_at: string;
};

export type ActiveTaskData = {
  id: string;
  title: string;
  status: string;
  created_at: string;
  projectedState: TaskProjectedState;
};

/**
 * Fetches task count metrics for the dashboard tiles.
 * All three queries run in parallel for performance.
 */
export async function getDashboardMetrics(
  workspaceId: string
): Promise<DashboardMetrics> {
  const supabase = await createSupabaseServerClient();

  const weekAgo = new Date();
  weekAgo.setDate(weekAgo.getDate() - 7);

  const [completedResult, queueResult, attentionResult, totalResult] =
    await Promise.all([
      supabase
        .from("tasks")
        .select("id", { count: "exact", head: true })
        .eq("workspace_id", workspaceId)
        .eq("status", "completed")
        .gte("updated_at", weekAgo.toISOString()),

      supabase
        .from("tasks")
        .select("id", { count: "exact", head: true })
        .eq("workspace_id", workspaceId)
        .in("status", ["queued", "in_progress"]),

      supabase
        .from("tasks")
        .select("id", { count: "exact", head: true })
        .eq("workspace_id", workspaceId)
        .in("status", ["blocked", "failed"]),

      supabase
        .from("tasks")
        .select("id", { count: "exact", head: true })
        .eq("workspace_id", workspaceId),
    ]);

  return {
    completedThisWeek: completedResult.count ?? 0,
    inQueue: queueResult.count ?? 0,
    needsAttention: attentionResult.count ?? 0,
    total: totalResult.count ?? 0,
  };
}

/**
 * Fetches the latest N events across the entire workspace, with task titles.
 * Used for the dashboard "recent activity" feed.
 */
export async function getWorkspaceFeed(
  workspaceId: string,
  limit = 10
): Promise<FeedEntry[]> {
  const supabase = await createSupabaseServerClient();

  const { data, error } = await supabase
    .from("task_events")
    .select(
      "id, task_id, event_type, payload, actor_type, actor_id, created_at, tasks(title)"
    )
    .eq("workspace_id", workspaceId)
    .order("created_at", { ascending: false })
    .limit(limit);

  if (error) {
    console.error("[getWorkspaceFeed] error:", error.message);
    return [];
  }

  return (data ?? []).map((row) => ({
    id: row.id as string,
    task_id: row.task_id as string,
    task_title:
      (row.tasks as unknown as { title: string } | null)?.title ?? null,
    event_type: row.event_type as TaskEventType,
    narrative: narrativize({
      event_type: row.event_type as TaskEventType,
      payload: row.payload as Record<string, unknown>,
      actor_type: row.actor_type as "agent" | "human",
      actor_id: row.actor_id as string,
    }),
    created_at: row.created_at as string,
  }));
}

/**
 * Fetches the currently active task (in_progress or queued) for the workspace,
 * including its projected state computed from events.
 */
export async function getActiveTaskData(
  workspaceId: string
): Promise<ActiveTaskData | null> {
  const supabase = await createSupabaseServerClient();

  const { data: task, error } = await supabase
    .from("tasks")
    .select("id, title, status, created_at")
    .eq("workspace_id", workspaceId)
    .in("status", ["in_progress", "queued"])
    .order("created_at", { ascending: false })
    .limit(1)
    .single();

  if (error || !task) return null;

  const { data: events } = await supabase
    .from("task_events")
    .select("*")
    .eq("task_id", task.id)
    .order("created_at", { ascending: true });

  const projectedState = projectTaskState((events ?? []) as TaskEvent[]);

  return {
    id: task.id as string,
    title: task.title as string,
    status: task.status as string,
    created_at: task.created_at as string,
    projectedState,
  };
}
