import { apiFetch, API_BASE_URL } from './client';

export interface RemoteRepo {
  id: number;
  name: string;
  full_name: string;
  private: boolean;
  default_branch: string;
  enabled: boolean;
  workspace_repo_id: string | null;
}

export interface GitHubConnection {
  connected: boolean;
  installation_id?: number;
  account_login?: string;
}

export function getConnection(): Promise<GitHubConnection> {
  return apiFetch<GitHubConnection>('/api/auth/github');
}

export function disconnect(): Promise<unknown> {
  return apiFetch('/api/auth/github', { method: 'DELETE' });
}

export function listRepos(): Promise<{ repos: RemoteRepo[] }> {
  return apiFetch<{ repos: RemoteRepo[] }>('/api/github/repos');
}

export function enableRepo(remoteRepoId: number, fullName: string): Promise<unknown> {
  return apiFetch('/api/github/repos/enable', {
    method: 'POST',
    body: JSON.stringify({ remote_repo_id: remoteRepoId, full_name: fullName }),
  });
}

export function disableRepo(workspaceRepoId: string): Promise<unknown> {
  return apiFetch(`/api/github/repos/${workspaceRepoId}`, { method: 'DELETE' });
}

export function openConnectFlow(): void {
  window.open(`${API_BASE_URL}/api/auth/github`, '_blank', 'noopener,noreferrer');
}
