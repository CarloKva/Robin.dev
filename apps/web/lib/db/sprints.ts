import { createSupabaseServerClient } from "@/lib/supabase/server";
import type { Sprint, SprintWithTasks, Task } from "@robin/shared-types";

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
