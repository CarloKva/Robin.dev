import { useCallback, useEffect, useState } from 'react';

import { supabase } from '@/lib/supabase/client';
import { useChannel } from './useChannel';

export type HistoryKind = 'commit.pushed' | 'pr.opened' | 'pr.merged' | 'task.completed';

export interface HistoryEntry {
  id: string;
  kind: HistoryKind;
  agentId: string | null;
  taskId: string;
  message: string;
  branch: string | null;
  prNumber: number | null;
  prUrl: string | null;
  commitSha: string | null;
  createdAt: string;
}

interface UseHistoryFeedResult {
  entries: HistoryEntry[];
  loading: boolean;
}

const KINDS = ['agent.commit.pushed', 'agent.pr.opened', 'agent.pr.updated', 'task.completed'];

export function useHistoryFeed(workspaceId: string | null): UseHistoryFeedResult {
  const [entries, setEntries] = useState<HistoryEntry[]>([]);
  const [loading, setLoading] = useState(true);

  const refresh = useCallback(async () => {
    if (!workspaceId) {
      setEntries([]);
      setLoading(false);
      return;
    }
    setLoading(true);
    const { data, error } = await supabase()
      .from('task_events')
      .select('id, task_id, actor_id, actor_type, event_type, payload, created_at')
      .eq('workspace_id', workspaceId)
      .in('event_type', KINDS)
      .order('created_at', { ascending: false })
      .limit(200);
    if (error) {
      console.warn('useHistoryFeed fetch failed', error.message);
      setLoading(false);
      return;
    }
    const rows = (data ?? []) as Array<Record<string, unknown>>;
    setEntries(rows.map(toEntry).filter((e): e is HistoryEntry => e !== null));
    setLoading(false);
  }, [workspaceId]);

  useEffect(() => {
    void refresh();
  }, [refresh]);

  useChannel({
    channelName: `history-${workspaceId ?? 'none'}`,
    table: 'task_events',
    event: 'INSERT',
    ...(workspaceId ? { filter: `workspace_id=eq.${workspaceId}` } : {}),
    onPayload: () => {
      void refresh();
    },
    enabled: Boolean(workspaceId),
  });

  return { entries, loading };
}

function toEntry(row: Record<string, unknown>): HistoryEntry | null {
  const eventType = row['event_type'] as string;
  const payload = (row['payload'] as Record<string, unknown> | null) ?? {};
  const id = row['id'] as string;
  const createdAt = row['created_at'] as string;
  const taskId = row['task_id'] as string;
  const actorType = row['actor_type'] as string;
  const actorId = (row['actor_id'] as string) ?? null;
  const agentId = actorType === 'agent' ? actorId : null;

  switch (eventType) {
    case 'agent.commit.pushed':
      return {
        id,
        kind: 'commit.pushed',
        agentId,
        taskId,
        message: (payload['message'] as string) ?? '',
        branch: (payload['branch'] as string) ?? null,
        prNumber: null,
        prUrl: null,
        commitSha: (payload['commit_sha'] as string) ?? null,
        createdAt,
      };
    case 'agent.pr.opened':
      return {
        id,
        kind: 'pr.opened',
        agentId,
        taskId,
        message: (payload['title'] as string) ?? 'PR opened',
        branch: (payload['branch'] as string) ?? null,
        prNumber: (payload['pr_number'] as number | null) ?? null,
        prUrl: (payload['pr_url'] as string) ?? null,
        commitSha: (payload['commit_sha'] as string) ?? null,
        createdAt,
      };
    case 'agent.pr.updated': {
      const status = payload['status'] as string | undefined;
      if (status !== 'merged') return null;
      return {
        id,
        kind: 'pr.merged',
        agentId,
        taskId,
        message: 'PR merged',
        branch: null,
        prNumber: (payload['pr_number'] as number | null) ?? null,
        prUrl: (payload['pr_url'] as string) ?? null,
        commitSha: null,
        createdAt,
      };
    }
    case 'task.completed':
      return {
        id,
        kind: 'task.completed',
        agentId,
        taskId,
        message: 'Task completed',
        branch: null,
        prNumber: null,
        prUrl: null,
        commitSha: null,
        createdAt,
      };
    default:
      return null;
  }
}
