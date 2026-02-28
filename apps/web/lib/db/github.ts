/**
 * DB queries for GitHub integration tables.
 * All queries use the user-scoped Supabase client — RLS enforced.
 */

import { createSupabaseServerClient } from "@/lib/supabase/server";
import type { GitHubConnection, Repository } from "@robin/shared-types";

// ─── GitHub connection ───────────────────────────────────────────────────────

/** Returns the GitHub App connection for a workspace, or null if not connected. */
export async function getGitHubConnection(
  workspaceId: string
): Promise<GitHubConnection | null> {
  const supabase = await createSupabaseServerClient();

  const { data, error } = await supabase
    .from("github_connections")
    .select("*")
    .eq("workspace_id", workspaceId)
    .eq("status", "connected")
    .maybeSingle();

  if (error) {
    console.error("[getGitHubConnection]", error.message);
    return null;
  }

  return data as GitHubConnection | null;
}

/** Creates or replaces the GitHub connection for a workspace. */
export async function upsertGitHubConnection(params: {
  workspaceId: string;
  installationId: number;
  githubAccountId: number;
  githubAccountLogin: string;
  githubAccountType: "User" | "Organization";
}): Promise<GitHubConnection> {
  const supabase = await createSupabaseServerClient();

  const { data, error } = await supabase
    .from("github_connections")
    .upsert(
      {
        workspace_id: params.workspaceId,
        installation_id: params.installationId,
        github_account_id: params.githubAccountId,
        github_account_login: params.githubAccountLogin,
        github_account_type: params.githubAccountType,
        status: "connected",
        connected_at: new Date().toISOString(),
        last_validated_at: new Date().toISOString(),
      },
      { onConflict: "workspace_id" }
    )
    .select()
    .single();

  if (error || !data) {
    throw new Error(`Failed to upsert GitHub connection: ${error?.message}`);
  }

  return data as GitHubConnection;
}

/** Marks the GitHub connection as revoked (soft delete). */
export async function revokeGitHubConnection(workspaceId: string): Promise<void> {
  const supabase = await createSupabaseServerClient();

  const { error } = await supabase
    .from("github_connections")
    .update({ status: "revoked" })
    .eq("workspace_id", workspaceId);

  if (error) {
    throw new Error(`Failed to revoke GitHub connection: ${error.message}`);
  }
}

// ─── Repositories ────────────────────────────────────────────────────────────

/** Returns all repositories enabled for a workspace. */
export async function getRepositoriesForWorkspace(
  workspaceId: string
): Promise<Repository[]> {
  const supabase = await createSupabaseServerClient();

  const { data, error } = await supabase
    .from("repositories")
    .select("*")
    .eq("workspace_id", workspaceId)
    .order("full_name", { ascending: true });

  if (error) {
    console.error("[getRepositoriesForWorkspace]", error.message);
    return [];
  }

  return (data ?? []) as Repository[];
}

/** Enables a repository for a workspace (upsert by github_repo_id). */
export async function enableRepository(params: {
  workspaceId: string;
  githubRepoId: number;
  fullName: string;
  defaultBranch: string;
  isPrivate: boolean;
}): Promise<Repository> {
  const supabase = await createSupabaseServerClient();

  const { data, error } = await supabase
    .from("repositories")
    .upsert(
      {
        workspace_id: params.workspaceId,
        github_repo_id: params.githubRepoId,
        full_name: params.fullName,
        default_branch: params.defaultBranch,
        is_private: params.isPrivate,
        is_enabled: true,
        is_available: true,
        last_synced_at: new Date().toISOString(),
      },
      { onConflict: "workspace_id,github_repo_id" }
    )
    .select()
    .single();

  if (error || !data) {
    throw new Error(`Failed to enable repository: ${error?.message}`);
  }

  return data as Repository;
}

/** Soft-disables a repository by its DB UUID. */
export async function disableRepository(
  repositoryId: string,
  workspaceId: string
): Promise<void> {
  const supabase = await createSupabaseServerClient();

  const { error } = await supabase
    .from("repositories")
    .update({ is_enabled: false })
    .eq("id", repositoryId)
    .eq("workspace_id", workspaceId);

  if (error) {
    throw new Error(`Failed to disable repository: ${error.message}`);
  }
}

/** Returns repositories assigned to a specific agent. */
export async function getRepositoriesForAgent(
  agentId: string
): Promise<Repository[]> {
  const supabase = await createSupabaseServerClient();

  const { data, error } = await supabase
    .from("repositories")
    .select("*, agent_repositories!inner(agent_id)")
    .eq("agent_repositories.agent_id", agentId)
    .order("full_name", { ascending: true });

  if (error) {
    console.error("[getRepositoriesForAgent]", error.message);
    return [];
  }

  return (data ?? []) as Repository[];
}
