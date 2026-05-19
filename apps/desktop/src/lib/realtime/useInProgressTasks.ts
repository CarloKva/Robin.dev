import { useCallback, useEffect, useState } from 'react';

import { supabase } from '@/lib/supabase/client';
import type { TaskPriority, TaskStatus } from '@robin/shared-types';
import { useChannel } from './useChannel';

export interface WipTask {
  id: string;
  title: string;
  description: string | null;
  status: TaskStatus;
  priority: TaskPriority;
  branch: string | null;
  repo: string | null;
  prUrl: string | null;
  prNumber: number | null;
  agentId: string | null;
  currentActivity: string | null;
  progress: number | null;
  startedAt: string | null;
}

interface UseInProgressResult {
  tasks: WipTask[];
  loading: boolean;
}

interface IterationEmbed {
  iteration_number: number | null;
  status: string | null;
  pr_url: string | null;
  pr_number: number | null;
  started_at: string | null;
  completed_at: string | null;
  summary: string | null;
}

interface RepoEmbed {
  full_name: string | null;
}

const WIP_STATUSES: TaskStatus[] = ['queued', 'in_progress', 'in_review', 'review_pending'];

export function useInProgressTasks(workspaceId: string | null): UseInProgressResult {
  const [tasks, setTasks] = useState<WipTask[]>([]);
  const [loading, setLoading] = useState(true);

  const refresh = useCallback(async () => {
    if (!workspaceId) {
      setTasks([]);
      setLoading(false);
      return;
    }
    setLoading(true);
    const { data, error } = await supabase()
      .from('tasks')
      .select(
        `
        id, title, description, status, priority, assigned_agent_id, created_at, updated_at,
        repositories!tasks_repository_id_fkey ( full_name ),
        task_iterations ( iteration_number, status, pr_url, pr_number, started_at, completed_at, summary )
        `,
      )
      .eq('workspace_id', workspaceId)
      .in('status', WIP_STATUSES)
      .order('updated_at', { ascending: false });
    if (error) {
      console.warn('useInProgressTasks fetch failed', error.message);
      setLoading(false);
      return;
    }
    const rows = (data ?? []) as Array<Record<string, unknown>>;
    setTasks(
      rows.map((row) => {
        const repoEmbed = row['repositories'] as RepoEmbed | RepoEmbed[] | null;
        const repo = pickRepo(repoEmbed);
        const iters = (row['task_iterations'] as IterationEmbed[] | null) ?? [];
        const latest = pickLatestIteration(iters);
        return {
          id: row['id'] as string,
          title: (row['title'] as string) ?? '',
          description: (row['description'] as string | null) ?? null,
          status: row['status'] as TaskStatus,
          priority: row['priority'] as TaskPriority,
          branch: null,
          repo,
          prUrl: latest?.pr_url ?? null,
          prNumber: latest?.pr_number ?? extractPrNumber(latest?.pr_url ?? null),
          agentId: (row['assigned_agent_id'] as string | null) ?? null,
          currentActivity: latest?.summary ?? null,
          progress: null,
          startedAt: latest?.started_at ?? null,
        };
      }),
    );
    setLoading(false);
  }, [workspaceId]);

  useEffect(() => {
    void refresh();
  }, [refresh]);

  useChannel({
    channelName: `wip-tasks-${workspaceId ?? 'none'}`,
    table: 'tasks',
    event: '*',
    ...(workspaceId ? { filter: `workspace_id=eq.${workspaceId}` } : {}),
    onPayload: () => {
      void refresh();
    },
    enabled: Boolean(workspaceId),
  });

  return { tasks, loading };
}

function pickRepo(embed: RepoEmbed | RepoEmbed[] | null): string | null {
  if (!embed) return null;
  if (Array.isArray(embed)) return embed[0]?.full_name ?? null;
  return embed.full_name ?? null;
}

function pickLatestIteration(iters: IterationEmbed[]): IterationEmbed | null {
  if (iters.length === 0) return null;
  return [...iters].sort(
    (a, b) => (b.iteration_number ?? 0) - (a.iteration_number ?? 0),
  )[0] ?? null;
}

function extractPrNumber(url: string | null): number | null {
  if (!url) return null;
  const m = url.match(/\/pull\/(\d+)/);
  return m ? Number(m[1]) : null;
}
