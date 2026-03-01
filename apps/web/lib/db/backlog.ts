import { createSupabaseServerClient } from "@/lib/supabase/server";
import type { Task, TaskStatus, TaskType, TaskPriority, EstimatedEffort } from "@robin/shared-types";

export type BacklogFilters = {
  status?: TaskStatus[] | undefined;
  type?: TaskType | undefined;
  priority?: TaskPriority | undefined;
  repositoryId?: string | undefined;
  estimatedEffort?: EstimatedEffort | undefined;
  search?: string | undefined;
  page?: number | undefined;
  pageSize?: number | undefined;
};

const BACKLOG_STATUSES: TaskStatus[] = ["backlog", "sprint_ready"];

export async function getBacklogTasks(
  workspaceId: string,
  filters: BacklogFilters = {}
): Promise<{ tasks: Task[]; total: number }> {
  const supabase = await createSupabaseServerClient();
  const {
    status,
    type,
    priority,
    repositoryId,
    estimatedEffort,
    search,
    page = 1,
    pageSize = 30,
  } = filters;

  const statuses = status?.length ? status : BACKLOG_STATUSES;
  const offset = (page - 1) * pageSize;

  let query = supabase
    .from("tasks")
    .select("*", { count: "exact" })
    .eq("workspace_id", workspaceId)
    .in("status", statuses)
    .order("created_at", { ascending: false })
    .range(offset, offset + pageSize - 1);

  if (type) query = query.eq("type", type);
  if (priority) query = query.eq("priority", priority);
  if (repositoryId) query = query.eq("repository_id", repositoryId);
  if (estimatedEffort) query = query.eq("estimated_effort", estimatedEffort);
  if (search) query = query.ilike("title", `%${search}%`);

  const { data, error, count } = await query;

  if (error) {
    console.error("[getBacklogTasks]", error.message);
    return { tasks: [], total: 0 };
  }

  return { tasks: (data ?? []) as Task[], total: count ?? 0 };
}

/** Returns tasks currently in sprint_ready status for a given sprint */
export async function getSprintReadyTasks(
  workspaceId: string,
  sprintId: string
): Promise<Task[]> {
  const supabase = await createSupabaseServerClient();
  const { data, error } = await supabase
    .from("tasks")
    .select("*")
    .eq("workspace_id", workspaceId)
    .eq("sprint_id", sprintId)
    .eq("status", "sprint_ready")
    .order("sprint_order", { ascending: true });

  if (error) {
    console.error("[getSprintReadyTasks]", error.message);
    return [];
  }
  return (data ?? []) as Task[];
}
