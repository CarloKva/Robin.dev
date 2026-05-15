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
  agentId: string | null;
  currentActivity: string | null;
  progress: number | null;
  startedAt: string | null;
}

interface UseInProgressResult {
  tasks: WipTask[];
  loading: boolean;
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
        'id, title, description, status, priority, branch, repo_full_name, pr_url, assigned_agent_id, current_activity, progress, started_at, updated_at',
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
      rows.map((row) => ({
        id: row['id'] as string,
        title: (row['title'] as string) ?? '',
        description: (row['description'] as string | null) ?? null,
        status: row['status'] as TaskStatus,
        priority: row['priority'] as TaskPriority,
        branch: (row['branch'] as string | null) ?? null,
        repo: (row['repo_full_name'] as string | null) ?? null,
        prUrl: (row['pr_url'] as string | null) ?? null,
        agentId: (row['assigned_agent_id'] as string | null) ?? null,
        currentActivity: (row['current_activity'] as string | null) ?? null,
        progress: (row['progress'] as number | null) ?? null,
        startedAt: (row['started_at'] as string | null) ?? null,
      })),
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
