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
  sprint_id: string | null;
  type: string | null;
  status: string;
  repository_id: string | null;
}

export interface ReportRepository {
  id: string;
  name: string;
}

export interface SprintReportData {
  sprints: SprintSummary[];
  tasks: ReportTask[];
  repositories: ReportRepository[];
}

export async function getSprintReportData(workspaceId: string): Promise<SprintReportData> {
  const supabase = await createSupabaseServerClient();

  const [sprintsResult, tasksResult, reposResult] = await Promise.all([
    supabase
      .from("sprints")
      .select("id, name, status, started_at, completed_at, tasks_completed, tasks_failed, tasks_moved_back, avg_cycle_time_minutes")
      .eq("workspace_id", workspaceId)
      .order("started_at", { ascending: true }),
    supabase
      .from("tasks")
      .select("id, sprint_id, type, status, repository_id")
      .eq("workspace_id", workspaceId),
    supabase
      .from("repositories")
      .select("id, name")
      .eq("workspace_id", workspaceId)
      .eq("is_enabled", true),
  ]);

  return {
    sprints: (sprintsResult.data ?? []) as SprintSummary[],
    tasks: (tasksResult.data ?? []) as ReportTask[],
    repositories: (reposResult.data ?? []) as ReportRepository[],
  };
}
