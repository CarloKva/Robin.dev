import { createSupabaseServerClient } from "@/lib/supabase/server";
import type { WorkspaceSettings } from "@robin/shared-types";

export async function getWorkspaceSettings(workspaceId: string): Promise<WorkspaceSettings | null> {
  const supabase = await createSupabaseServerClient();
  const { data, error } = await supabase
    .from("workspace_settings")
    .select("*")
    .eq("workspace_id", workspaceId)
    .maybeSingle();

  if (error) {
    console.error("[getWorkspaceSettings]", error.message);
    return null;
  }
  return data as WorkspaceSettings | null;
}

export async function upsertWorkspaceSettings(
  workspaceId: string,
  settings: Partial<Pick<WorkspaceSettings, "notify_email" | "notify_slack_webhook">>
): Promise<WorkspaceSettings | null> {
  const supabase = await createSupabaseServerClient();
  const { data, error } = await supabase
    .from("workspace_settings")
    .upsert(
      {
        workspace_id: workspaceId,
        ...settings,
        updated_at: new Date().toISOString(),
      },
      { onConflict: "workspace_id" }
    )
    .select()
    .single();

  if (error) {
    console.error("[upsertWorkspaceSettings]", error.message);
    return null;
  }
  return data as WorkspaceSettings;
}
