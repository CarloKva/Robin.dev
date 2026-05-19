import type { EnvironmentType, WorkspaceEnvironment } from '@robin/shared-types';

import { apiFetch } from './client';

export function listEnvironments(repositoryId: string): Promise<{ environments: WorkspaceEnvironment[] }> {
  return apiFetch<{ environments: WorkspaceEnvironment[] }>(
    `/api/environments?repository_id=${encodeURIComponent(repositoryId)}`,
  );
}

interface CreateEnvironmentInput {
  repositoryId: string;
  environmentType: EnvironmentType;
  targetBranch: string;
  autoMerge: boolean;
}

export function createEnvironment(input: CreateEnvironmentInput): Promise<unknown> {
  return apiFetch('/api/environments', {
    method: 'POST',
    body: JSON.stringify({
      repository_id: input.repositoryId,
      environment_type: input.environmentType,
      target_branch: input.targetBranch,
      auto_merge: input.autoMerge,
    }),
  });
}

export function updateEnvironment(
  id: string,
  patch: Partial<{ target_branch: string; auto_merge: boolean }>,
): Promise<unknown> {
  return apiFetch(`/api/environments/${id}`, {
    method: 'PATCH',
    body: JSON.stringify(patch),
  });
}

export function deleteEnvironment(id: string): Promise<unknown> {
  return apiFetch(`/api/environments/${id}`, { method: 'DELETE' });
}

export function setEnvVars(id: string, vars: Record<string, string>): Promise<unknown> {
  return apiFetch(`/api/environments/${id}/env-vars`, {
    method: 'PUT',
    body: JSON.stringify({ env_vars: vars }),
  });
}
