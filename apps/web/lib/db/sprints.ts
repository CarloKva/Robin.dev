import { createSupabaseServerClient } from "@/lib/supabase/server";
import type { Sprint, SprintWithTasks, Task } from "@robin/shared-types";

export async function getSprintsWithTasksForBacklog(workspaceId: string): Promise<SprintWithTasks[]> {
  const supabase = await createSupabaseServerClient();

  const { data: sprints, error: sprintsError } = await supabase
    .from("sprints")
    .select("*")
    .eq("workspace_id", workspaceId)
    .in("status", ["active", "planning"])
    .order("created_at", { ascending: false });

  if (sprintsError || !sprints?.length) return [];

  const sprintIds = sprints.map((s) => s.id);
  const { data: tasks } = await supabase
    .from("tasks")
    .select("*")
    .in("sprint_id", sprintIds)
    .eq("workspace_id", workspaceId)
    .order("sprint_order", { ascending: true });

  const tasksBySprint = (tasks ?? []).reduce<Record<string, Task[]>>((acc, task) => {
    const key = task.sprint_id as string;
    if (!acc[key]) acc[key] = [];
    acc[key]!.push(task as Task);
    return acc;
  }, {});

  return sprints.map((s) => ({
    ...(s as Sprint),
    tasks: tasksBySprint[s.id] ?? [],
  }));
}

export async function getSprintsForWorkspace(workspaceId: string): Promise<Sprint[]> {
  const supabase = await createSupabaseServerClient();
  const { data, error } = await supabase
    .from("sprints")
    .select("*")
    .eq("workspace_id", workspaceId)
    .order("created_at", { ascending: false });

  if (error) {
    console.error("[getSprintsForWorkspace]", error.message);
    return [];
  }
  return (data ?? []) as Sprint[];
}

export async function getActiveSprint(workspaceId: string): Promise<Sprint | null> {
  const supabase = await createSupabaseServerClient();
  const { data, error } = await supabase
    .from("sprints")
    .select("*")
    .eq("workspace_id", workspaceId)
    .eq("status", "active")
    .maybeSingle();

  if (error) {
    console.error("[getActiveSprint]", error.message);
    return null;
  }
  return data as Sprint | null;
}

export async function getSprintById(sprintId: string, workspaceId: string): Promise<Sprint | null> {
  const supabase = await createSupabaseServerClient();
  const { data, error } = await supabase
    .from("sprints")
    .select("*")
    .eq("id", sprintId)
    .eq("workspace_id", workspaceId)
    .maybeSingle();

  if (error) {
    console.error("[getSprintById]", error.message);
    return null;
  }
  return data as Sprint | null;
}

export type SprintWithTaskCount = Sprint & { task_count: number };

export async function getSprintsWithTaskCounts(workspaceId: string): Promise<SprintWithTaskCount[]> {
  const supabase = await createSupabaseServerClient();

  const [sprintsResult, tasksResult] = await Promise.all([
    supabase
      .from("sprints")
      .select("*")
      .eq("workspace_id", workspaceId)
      .order("created_at", { ascending: false }),
    supabase
      .from("tasks")
      .select("sprint_id")
      .eq("workspace_id", workspaceId)
      .not("sprint_id", "is", null),
  ]);

  if (sprintsResult.error) {
    console.error("[getSprintsWithTaskCounts]", sprintsResult.error.message);
    return [];
  }

  const sprints = (sprintsResult.data ?? []) as Sprint[];
  const tasks = tasksResult.data ?? [];

  const countBySprint = tasks.reduce<Record<string, number>>((acc, task) => {
    const key = task.sprint_id as string;
    acc[key] = (acc[key] ?? 0) + 1;
    return acc;
  }, {});

  return sprints.map((sprint) => ({
    ...sprint,
    task_count: countBySprint[sprint.id] ?? 0,
  }));
}

export async function getSprintWithTasks(
  sprintId: string,
  workspaceId: string
): Promise<SprintWithTasks | null> {
  const supabase = await createSupabaseServerClient();

  const [sprintResult, tasksResult] = await Promise.all([
    supabase
      .from("sprints")
      .select("*")
      .eq("id", sprintId)
      .eq("workspace_id", workspaceId)
      .maybeSingle(),
    supabase
      .from("tasks")
      .select("*")
      .eq("sprint_id", sprintId)
      .eq("workspace_id", workspaceId)
      .order("sprint_order", { ascending: true }),
  ]);

  if (sprintResult.error || !sprintResult.data) return null;

  return {
    ...(sprintResult.data as Sprint),
    tasks: (tasksResult.data ?? []) as Task[],
  };
}
