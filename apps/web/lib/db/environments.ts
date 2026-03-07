/**
 * DB queries for workspace_environments table.
 * All queries use the user-scoped Supabase client — RLS enforced.
 */

import { createSupabaseServerClient } from "@/lib/supabase/server";
import type { WorkspaceEnvironment } from "@robin/shared-types";

export async function getEnvironmentsForRepository(
  repositoryId: string
): Promise<WorkspaceEnvironment[]> {
  const supabase = await createSupabaseServerClient();

  const { data, error } = await supabase
    .from("workspace_environments")
    .select("*")
    .eq("repository_id", repositoryId)
    .order("environment_type", { ascending: true });

  if (error) {
    console.error("[getEnvironmentsForRepository]", error.message);
    return [];
  }

  return (data ?? []) as WorkspaceEnvironment[];
}

export async function getEnvironmentById(
  id: string,
  workspaceId: string
): Promise<WorkspaceEnvironment | null> {
  const supabase = await createSupabaseServerClient();

  const { data, error } = await supabase
    .from("workspace_environments")
    .select("*")
    .eq("id", id)
    .eq("workspace_id", workspaceId)
    .maybeSingle();

  if (error) {
    console.error("[getEnvironmentById]", error.message);
    return null;
  }

  return data as WorkspaceEnvironment | null;
}

export async function createEnvironment(params: {
  workspaceId: string;
  repositoryId: string;
  name: string;
  environmentType: "staging" | "production";
  targetBranch: string;
  autoMerge: boolean;
}): Promise<WorkspaceEnvironment> {
  const supabase = await createSupabaseServerClient();

  const { data, error } = await supabase
    .from("workspace_environments")
    .insert({
      workspace_id: params.workspaceId,
      repository_id: params.repositoryId,
      name: params.name,
      environment_type: params.environmentType,
      target_branch: params.targetBranch,
      auto_merge: params.autoMerge,
    })
    .select()
    .single();

  if (error || !data) {
    throw new Error(`Failed to create environment: ${error?.message}`);
  }

  return data as WorkspaceEnvironment;
}

export async function updateEnvironment(
  id: string,
  workspaceId: string,
  updates: Partial<{
    name: string;
    targetBranch: string;
    autoMerge: boolean;
  }>
): Promise<WorkspaceEnvironment> {
  const supabase = await createSupabaseServerClient();

  const { data, error } = await supabase
    .from("workspace_environments")
    .update({
      ...(updates.name !== undefined && { name: updates.name }),
      ...(updates.targetBranch !== undefined && { target_branch: updates.targetBranch }),
      ...(updates.autoMerge !== undefined && { auto_merge: updates.autoMerge }),
    })
    .eq("id", id)
    .eq("workspace_id", workspaceId)
    .select()
    .single();

  if (error || !data) {
    throw new Error(`Failed to update environment: ${error?.message}`);
  }

  return data as WorkspaceEnvironment;
}

export async function deleteEnvironment(
  id: string,
  workspaceId: string
): Promise<void> {
  const supabase = await createSupabaseServerClient();

  const { error } = await supabase
    .from("workspace_environments")
    .delete()
    .eq("id", id)
    .eq("workspace_id", workspaceId);

  if (error) {
    throw new Error(`Failed to delete environment: ${error.message}`);
  }
}

export async function saveEnvironmentEnvVars(
  id: string,
  workspaceId: string,
  encryptedVars: string
): Promise<void> {
  const supabase = await createSupabaseServerClient();

  const { error } = await supabase
    .from("workspace_environments")
    .update({ env_vars_encrypted: encryptedVars })
    .eq("id", id)
    .eq("workspace_id", workspaceId);

  if (error) {
    throw new Error(`Failed to save env vars: ${error.message}`);
  }
}
