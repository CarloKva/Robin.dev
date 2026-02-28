import { createSupabaseServerClient } from "@/lib/supabase/server";
import { narrativize } from "@/lib/events/narrativize";
import { projectTaskState } from "@/lib/db/projectTaskState";
import type { TaskEventType, TaskEvent, TaskProjectedState, AgentProvisioningStatus } from "@robin/shared-types";

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

// ─── Multi-agent dashboard ────────────────────────────────────────────────────

export type DashboardAgent = {
  id: string;
  name: string;
  slug: string | null;
  effective_status: string;          // "idle" | "busy" | "error" | "offline"
  provisioning_status: AgentProvisioningStatus;
  vps_ip: string | null;
  current_task_id: string | null;
  current_task_title: string | null;
  repository_names: string[];        // full_names of assigned repos
};

/**
 * Fetches all agents for the workspace with their current status,
 * active task title, and assigned repository names.
 * Used for the dashboard AgentStatusGrid.
 */
export async function getDashboardAgents(workspaceId: string): Promise<DashboardAgent[]> {
  const supabase = await createSupabaseServerClient();

  // 1. All agents (non-deprovisioned) with status
  const { data: agents, error } = await supabase
    .from("agents_with_status")
    .select("id, name, slug, effective_status, provisioning_status, vps_ip")
    .eq("workspace_id", workspaceId)
    .neq("provisioning_status", "deprovisioned")
    .order("created_at", { ascending: true });

  if (error || !agents || agents.length === 0) return [];

  const agentIds = agents.map((a) => a.id as string);

  // 2. Fetch current_task_id from agent_status for each agent
  const [statusRows, repoRows] = await Promise.all([
    supabase
      .from("agent_status")
      .select("agent_id, current_task_id")
      .in("agent_id", agentIds)
      .then(({ data }) => data ?? []),

    // 3. Fetch repository names via agent_repositories join
    supabase
      .from("agent_repositories")
      .select("agent_id, repositories(full_name)")
      .in("agent_id", agentIds)
      .then(({ data }) => data ?? []),
  ]);

  // Build task_id lookup
  const taskIdByAgent: Record<string, string | null> = {};
  for (const row of statusRows) {
    taskIdByAgent[row.agent_id as string] = (row.current_task_id as string | null) ?? null;
  }

  // 4. Fetch task titles for non-null task IDs
  const taskIds = [...new Set(Object.values(taskIdByAgent).filter((id): id is string => Boolean(id)))];
  const taskTitleById: Record<string, string> = {};
  if (taskIds.length > 0) {
    const { data: tasks } = await supabase
      .from("tasks")
      .select("id, title")
      .in("id", taskIds);
    for (const t of tasks ?? []) {
      taskTitleById[t.id as string] = t.title as string;
    }
  }

  // Build repo names lookup
  const repoNamesByAgent: Record<string, string[]> = {};
  for (const row of repoRows) {
    const agentId = row.agent_id as string;
    const fullName = (row.repositories as unknown as { full_name: string } | null)?.full_name;
    if (fullName) {
      (repoNamesByAgent[agentId] ??= []).push(fullName);
    }
  }

  return agents.map((a) => {
    const taskId = taskIdByAgent[a.id as string] ?? null;
    return {
      id: a.id as string,
      name: a.name as string,
      slug: (a.slug as string | null) ?? null,
      effective_status: (a.effective_status as string) ?? "offline",
      provisioning_status: (a.provisioning_status as AgentProvisioningStatus) ?? "online",
      vps_ip: (a.vps_ip as string | null) ?? null,
      current_task_id: taskId,
      current_task_title: taskId ? (taskTitleById[taskId] ?? null) : null,
      repository_names: repoNamesByAgent[a.id as string] ?? [],
    };
  });
}

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
