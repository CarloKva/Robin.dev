import { createSupabaseServerClient } from "@/lib/supabase/server";
import { narrativize } from "@/lib/events/narrativize";
import { projectTaskState } from "@/lib/db/projectTaskState";
import type { TaskEventType, TaskEvent, TaskProjectedState, AgentProvisioningStatus } from "@robin/shared-types";

export type DashboardMetrics = {
  completedThisWeek: number;
  inQueue: number;
  /** Tasks in `blocked` or `failed` status that need user attention. */
  needsAttention: number;
  /** Tasks currently in `in_review` or `review_pending` status. */
  inReview: number;
  /** Count of active sprints (status = 'active'). */
  activeSprint: number;
  /** Total task count across all statuses — used to show onboarding state. */
  total: number;
  /** Per-day counts for the last 7 days (index 0 = 6 days ago, index 6 = today). */
  completedSparkline: number[];
  inQueueSparkline: number[];
  needsAttentionSparkline: number[];
};

export type RecentTask = {
  id: string;
  title: string;
  status: string;
  agent_name: string | null;
  sprint_name: string | null;
  updated_at: string;
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

/** Builds a 7-element sparkline (oldest → today) from a list of ISO timestamps. */
function buildSparkline(timestamps: string[]): number[] {
  const days = Array.from({ length: 7 }, (_, i) => {
    const d = new Date();
    d.setDate(d.getDate() - (6 - i));
    return d.toISOString().slice(0, 10);
  });
  const counts: Record<string, number> = {};
  for (const ts of timestamps) {
    const day = ts.slice(0, 10);
    counts[day] = (counts[day] ?? 0) + 1;
  }
  return days.map((day) => counts[day] ?? 0);
}

/**
 * Fetches task count metrics for the dashboard tiles.
 * All queries run in parallel for performance.
 */
export async function getDashboardMetrics(
  workspaceId: string
): Promise<DashboardMetrics> {
  const supabase = await createSupabaseServerClient();

  const weekAgo = new Date();
  weekAgo.setDate(weekAgo.getDate() - 7);
  const weekAgoIso = weekAgo.toISOString();

  const [
    completedResult,
    queueResult,
    attentionResult,
    inReviewResult,
    activeSprintResult,
    totalResult,
    completedDailyResult,
    queueDailyResult,
    attentionDailyResult,
  ] = await Promise.all([
    supabase
      .from("tasks")
      .select("id", { count: "exact", head: true })
      .eq("workspace_id", workspaceId)
      .eq("status", "completed")
      .gte("updated_at", weekAgoIso),

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
      .eq("workspace_id", workspaceId)
      .in("status", ["in_review", "review_pending"]),

    supabase
      .from("sprints")
      .select("id", { count: "exact", head: true })
      .eq("workspace_id", workspaceId)
      .eq("status", "active"),

    supabase
      .from("tasks")
      .select("id", { count: "exact", head: true })
      .eq("workspace_id", workspaceId),

    // Sparkline: completed per day (last 7 days)
    supabase
      .from("tasks")
      .select("updated_at")
      .eq("workspace_id", workspaceId)
      .eq("status", "completed")
      .gte("updated_at", weekAgoIso),

    // Sparkline: queued/in_progress entries per day (last 7 days)
    supabase
      .from("tasks")
      .select("updated_at")
      .eq("workspace_id", workspaceId)
      .in("status", ["queued", "in_progress"])
      .gte("updated_at", weekAgoIso),

    // Sparkline: blocked/failed entries per day (last 7 days)
    supabase
      .from("tasks")
      .select("updated_at")
      .eq("workspace_id", workspaceId)
      .in("status", ["blocked", "failed"])
      .gte("updated_at", weekAgoIso),
  ]);

  return {
    completedThisWeek: completedResult.count ?? 0,
    inQueue: queueResult.count ?? 0,
    needsAttention: attentionResult.count ?? 0,
    inReview: inReviewResult.count ?? 0,
    activeSprint: activeSprintResult.count ?? 0,
    total: totalResult.count ?? 0,
    completedSparkline: buildSparkline(
      (completedDailyResult.data ?? []).map((r) => r.updated_at as string)
    ),
    inQueueSparkline: buildSparkline(
      (queueDailyResult.data ?? []).map((r) => r.updated_at as string)
    ),
    needsAttentionSparkline: buildSparkline(
      (attentionDailyResult.data ?? []).map((r) => r.updated_at as string)
    ),
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

/**
 * Fetches the N most recently updated tasks with agent name and sprint name.
 * Used for the dashboard "recent tasks" table.
 */
export async function getRecentTasksForDashboard(
  workspaceId: string,
  limit = 10
): Promise<RecentTask[]> {
  const supabase = await createSupabaseServerClient();

  const { data: tasks, error } = await supabase
    .from("tasks")
    .select("id, title, status, updated_at, assigned_agent_id, sprint_id")
    .eq("workspace_id", workspaceId)
    .order("updated_at", { ascending: false })
    .limit(limit);

  if (error || !tasks || tasks.length === 0) return [];

  // Fetch agent names
  const agentIds = [...new Set(
    tasks.map((t) => t.assigned_agent_id as string | null).filter((id): id is string => Boolean(id))
  )];
  const sprintIds = [...new Set(
    tasks.map((t) => t.sprint_id as string | null).filter((id): id is string => Boolean(id))
  )];

  const [agentRows, sprintRows] = await Promise.all([
    agentIds.length > 0
      ? supabase.from("agents").select("id, name").in("id", agentIds).then(({ data }) => data ?? [])
      : Promise.resolve([]),
    sprintIds.length > 0
      ? supabase.from("sprints").select("id, name").in("id", sprintIds).then(({ data }) => data ?? [])
      : Promise.resolve([]),
  ]);

  const agentNameById: Record<string, string> = {};
  for (const a of agentRows) {
    agentNameById[a.id as string] = a.name as string;
  }
  const sprintNameById: Record<string, string> = {};
  for (const s of sprintRows) {
    sprintNameById[s.id as string] = s.name as string;
  }

  return tasks.map((t) => ({
    id: t.id as string,
    title: t.title as string,
    status: t.status as string,
    agent_name: (t.assigned_agent_id as string | null)
      ? (agentNameById[t.assigned_agent_id as string] ?? null)
      : null,
    sprint_name: (t.sprint_id as string | null)
      ? (sprintNameById[t.sprint_id as string] ?? null)
      : null,
    updated_at: t.updated_at as string,
  }));
}
