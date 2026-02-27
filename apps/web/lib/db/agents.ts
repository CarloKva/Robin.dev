import { createSupabaseServerClient } from "@/lib/supabase/server";
import type { AgentWithStatus } from "@robin/shared-types";

/**
 * Returns all agents for a workspace, enriched with live status from
 * the `agents_with_status` view (effective_status, current_task_id, last_heartbeat).
 */
export async function getAgentsForWorkspace(workspaceId: string): Promise<AgentWithStatus[]> {
  const supabase = await createSupabaseServerClient();

  const { data, error } = await supabase
    .from("agents_with_status")
    .select("*")
    .eq("workspace_id", workspaceId)
    .order("created_at", { ascending: true });

  if (error) {
    console.error("[getAgentsForWorkspace]", error.message);
    return [];
  }

  return (data ?? []) as AgentWithStatus[];
}

/**
 * Returns the first online agent for a workspace, using the agents_with_status
 * view so that explicit offline markers (set on graceful shutdown) are respected.
 * Used by POST /api/tasks for auto-routing.
 * Returns null if no agent is online.
 */
export async function getOnlineAgentForWorkspace(workspaceId: string): Promise<{ id: string; name: string } | null> {
  const supabase = await createSupabaseServerClient();

  const { data, error } = await supabase
    .from("agents_with_status")
    .select("id, name")
    .eq("workspace_id", workspaceId)
    .in("effective_status", ["idle", "busy"])
    .order("last_seen_at", { ascending: false })
    .limit(1)
    .maybeSingle();

  if (error) {
    console.error("[getOnlineAgentForWorkspace]", error.message);
    return null;
  }

  return data ?? null;
}
