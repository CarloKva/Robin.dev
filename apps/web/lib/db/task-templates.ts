import { createSupabaseServerClient } from "@/lib/supabase/server";
import type { TaskTemplate, TaskType, DEFAULT_TASK_TEMPLATES } from "@robin/shared-types";

// Re-export for convenience
export { DEFAULT_TASK_TEMPLATES } from "@robin/shared-types";

export async function getTemplatesForWorkspace(workspaceId: string): Promise<TaskTemplate[]> {
  const supabase = await createSupabaseServerClient();
  const { data, error } = await supabase
    .from("task_templates")
    .select("*")
    .eq("workspace_id", workspaceId)
    .order("task_type", { ascending: true });

  if (error) {
    console.error("[getTemplatesForWorkspace]", error.message);
    return [];
  }
  return (data ?? []) as TaskTemplate[];
}

export async function upsertTemplate(
  workspaceId: string,
  taskType: TaskType,
  templateBody: string
): Promise<TaskTemplate | null> {
  const supabase = await createSupabaseServerClient();
  const { data, error } = await supabase
    .from("task_templates")
    .upsert(
      {
        workspace_id: workspaceId,
        task_type: taskType,
        template_body: templateBody,
        is_default: false,
        updated_at: new Date().toISOString(),
      },
      { onConflict: "workspace_id,task_type,is_default" }
    )
    .select()
    .single();

  if (error) {
    console.error("[upsertTemplate]", error.message);
    return null;
  }
  return data as TaskTemplate;
}

export async function deleteTemplate(workspaceId: string, templateId: string): Promise<void> {
  const supabase = await createSupabaseServerClient();
  await supabase
    .from("task_templates")
    .delete()
    .eq("id", templateId)
    .eq("workspace_id", workspaceId);
}
