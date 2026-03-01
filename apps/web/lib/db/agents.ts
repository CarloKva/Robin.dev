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
  const twoMinutesAgo = new Date(Date.now() - 2 * 60 * 1000).toISOString();

  // Query agents table directly by last_seen_at to avoid effective_status
  // being polluted by agent_status.status (e.g. 'error' from a failed task).
  const { data, error } = await supabase
    .from("agents")
    .select("id, name")
    .eq("workspace_id", workspaceId)
    .gt("last_seen_at", twoMinutesAgo)
    .order("last_seen_at", { ascending: false })
    .limit(1)
    .maybeSingle();

  if (error) {
    console.error("[getOnlineAgentForWorkspace]", error.message);
    return null;
  }

  return data ?? null;
}

/**
 * Returns all online agents assigned to a specific repository.
 * Used by the routing algorithm in sprint execution.
 * Priority order: idle agents first, then by last_seen_at descending.
 */
export async function getOnlineAgentsForRepository(
  repositoryId: string,
  workspaceId: string
): Promise<{ id: string; name: string }[]> {
  const supabase = await createSupabaseServerClient();
  const twoMinutesAgo = new Date(Date.now() - 2 * 60 * 1000).toISOString();

  // Query agents table directly by last_seen_at (same reason as getOnlineAgentForWorkspace)
  const { data, error } = await supabase
    .from("agents")
    .select("id, name")
    .eq("workspace_id", workspaceId)
    .gt("last_seen_at", twoMinutesAgo)
    .order("last_seen_at", { ascending: false });

  if (error) {
    console.error("[getOnlineAgentsForRepository]", error.message);
    return [];
  }

  if (!data?.length) return [];

  // Filter to only agents assigned to this repository
  const { data: agentRepos } = await supabase
    .from("agent_repositories")
    .select("agent_id")
    .eq("repository_id", repositoryId);

  const assignedIds = new Set((agentRepos ?? []).map((r: { agent_id: string }) => r.agent_id));
  return data.filter((a: { id: string }) => assignedIds.has(a.id)) as { id: string; name: string }[];
}
