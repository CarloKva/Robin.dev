import { createSupabaseServerClient } from "@/lib/supabase/server";

export interface SprintSummary {
  id: string;
  name: string;
  status: string;
  started_at: string | null;
  completed_at: string | null;
  tasks_completed: number;
  tasks_failed: number;
  tasks_moved_back: number;
  avg_cycle_time_minutes: number | null;
}

export interface ReportTask {
  id: string;
  title: string;
  sprint_id: string | null;
  type: string | null;
  status: string;
  priority: string | null;
  repository_id: string | null;
  assigned_agent_id: string | null;
  rework_count: number;
  current_iteration: number;
  created_at: string;
  updated_at: string;
}

export interface ReportRepository {
  id: string;
  full_name: string;
}

export interface ReportAgent {
  id: string;
  name: string;
}

export interface AgentStats {
  agent_id: string;
  total: number;
  completed: number;
  failed: number;
  reworked: number;
  avg_rework: number;
  success_rate: number | null;
  failure_rate: number | null;
  rework_rate: number | null;
}

export interface WeeklyDataPoint {
  label: string;
  completed: number;
  failed: number;
}

export interface SprintReportData {
  sprints: SprintSummary[];
  tasks: ReportTask[];
  repositories: ReportRepository[];
  agents: ReportAgent[];
  agentStats: AgentStats[];
  weeklyThroughput: WeeklyDataPoint[];
}

// ── Internal helpers ──────────────────────────────────────────────────────────

const COMPLETED_STATUSES = new Set(["done", "completed", "approved"]);
const FAILED_STATUSES = new Set(["failed", "cancelled"]);

function getWeekMonday(date: Date): Date {
  const d = new Date(date);
  const day = d.getDay();
  const diff = d.getDate() - day + (day === 0 ? -6 : 1); // ISO Monday
  d.setDate(diff);
  d.setHours(0, 0, 0, 0);
  return d;
}

function computeAgentStats(tasks: ReportTask[]): AgentStats[] {
  const map: Record<
    string,
    { total: number; completed: number; failed: number; reworked: number; reworkTotal: number }
  > = {};

  for (const task of tasks) {
    if (!task.assigned_agent_id) continue;
    const id = task.assigned_agent_id;
    if (!map[id]) map[id] = { total: 0, completed: 0, failed: 0, reworked: 0, reworkTotal: 0 };
    const s = map[id]!;
    s.total++;
    if (COMPLETED_STATUSES.has(task.status)) {
      s.completed++;
      s.reworkTotal += task.rework_count;
      if (task.rework_count > 0) s.reworked++;
    }
    if (FAILED_STATUSES.has(task.status)) s.failed++;
  }

  return Object.entries(map).map(([agent_id, s]) => {
    const terminal = s.completed + s.failed;
    return {
      agent_id,
      total: s.total,
      completed: s.completed,
      failed: s.failed,
      reworked: s.reworked,
      avg_rework:
        s.completed > 0 ? Math.round((s.reworkTotal / s.completed) * 10) / 10 : 0,
      success_rate: terminal > 0 ? Math.round((s.completed / terminal) * 100) : null,
      failure_rate: terminal > 0 ? Math.round((s.failed / terminal) * 100) : null,
      rework_rate:
        s.completed > 0 ? Math.round((s.reworked / s.completed) * 100) : null,
    };
  });
}

function computeWeeklyThroughput(tasks: ReportTask[]): WeeklyDataPoint[] {
  const now = new Date();
  const result: WeeklyDataPoint[] = [];

  for (let i = 11; i >= 0; i--) {
    const anchor = new Date(now);
    anchor.setDate(anchor.getDate() - i * 7);
    const weekStart = getWeekMonday(anchor);
    const weekEnd = new Date(weekStart.getTime() + 7 * 24 * 60 * 60 * 1000);
    const label = weekStart.toLocaleDateString("en-US", { month: "short", day: "numeric" });

    let completed = 0;
    let failed = 0;
    for (const task of tasks) {
      const updatedAt = new Date(task.updated_at);
      if (updatedAt >= weekStart && updatedAt < weekEnd) {
        if (COMPLETED_STATUSES.has(task.status)) completed++;
        else if (FAILED_STATUSES.has(task.status)) failed++;
      }
    }
    result.push({ label, completed, failed });
  }

  return result;
}

// ── Public API ────────────────────────────────────────────────────────────────

export async function getSprintReportData(workspaceId: string): Promise<SprintReportData> {
  const supabase = await createSupabaseServerClient();

  const [sprintsResult, tasksResult, reposResult, agentsResult] = await Promise.all([
    supabase
      .from("sprints")
      .select(
        "id, name, status, started_at, completed_at, tasks_completed, tasks_failed, tasks_moved_back, avg_cycle_time_minutes"
      )
      .eq("workspace_id", workspaceId)
      .order("started_at", { ascending: true }),

    supabase
      .from("tasks")
      .select(
        "id, title, sprint_id, type, status, priority, repository_id, assigned_agent_id, rework_count, current_iteration, created_at, updated_at"
      )
      .eq("workspace_id", workspaceId)
      .order("created_at", { ascending: false }),

    supabase
      .from("repositories")
      .select("id, full_name")
      .eq("workspace_id", workspaceId)
      .eq("is_enabled", true),

    supabase
      .from("agents")
      .select("id, name")
      .eq("workspace_id", workspaceId)
      .order("name", { ascending: true }),
  ]);

  const tasks = (tasksResult.data ?? []) as ReportTask[];

  return {
    sprints: (sprintsResult.data ?? []) as SprintSummary[],
    tasks,
    repositories: (reposResult.data ?? []) as ReportRepository[],
    agents: (agentsResult.data ?? []) as ReportAgent[],
    agentStats: computeAgentStats(tasks),
    weeklyThroughput: computeWeeklyThroughput(tasks),
  };
}
