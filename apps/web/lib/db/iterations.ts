import type { TaskIteration } from "@robin/shared-types";
import { createSupabaseServerClient } from "@/lib/supabase/server";

/**
 * Fetch all iterations for a task, ordered by iteration_number ascending.
 * Returns an empty array if the task has never been executed.
 */
export async function getTaskIterations(taskId: string): Promise<TaskIteration[]> {
  const supabase = await createSupabaseServerClient();

  const { data, error } = await supabase
    .from("task_iterations")
    .select("*")
    .eq("task_id", taskId)
    .order("iteration_number", { ascending: true });

  if (error) {
    throw new Error(`getTaskIterations failed: ${error.message}`);
  }

  return (data ?? []) as TaskIteration[];
}
