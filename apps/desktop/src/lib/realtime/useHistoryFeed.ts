import { useCallback, useEffect, useState } from 'react';

import { supabase } from '@/lib/supabase/client';
import { useChannel } from './useChannel';

export type HistoryKind = 'pr.opened';

export interface HistoryEntry {
  id: string;
  kind: HistoryKind;
  agentId: string | null;
  taskId: string;
  taskTitle: string | null;
  message: string;
  branch: string | null;
  prNumber: number | null;
  prUrl: string | null;
  commitSha: string | null;
  repo: string | null;
  createdAt: string;
}

interface UseHistoryFeedResult {
  entries: HistoryEntry[];
  loading: boolean;
}

const KINDS = ['agent.pr.opened'];

interface TaskEmbed {
  id: string;
  title: string | null;
  repositories?: { full_name?: string | null } | { full_name?: string | null }[] | null;
}

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
      .select(
        `
        id, task_id, actor_id, actor_type, event_type, payload, created_at,
        tasks ( id, title, repositories!tasks_repository_id_fkey ( full_name ) )
        `,
      )
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
  if (eventType !== 'agent.pr.opened') return null;
  const payload = (row['payload'] as Record<string, unknown> | null) ?? {};
  const id = row['id'] as string;
  const createdAt = row['created_at'] as string;
  const taskId = row['task_id'] as string;
  const actorType = row['actor_type'] as string;
  const actorId = (row['actor_id'] as string) ?? null;
  const agentId = actorType === 'agent' ? actorId : null;
  const taskJoin = row['tasks'] as TaskEmbed | null;
  const repo = pickRepo(taskJoin?.repositories ?? null);
  const taskTitle = taskJoin?.title ?? null;

  return {
    id,
    kind: 'pr.opened',
    agentId,
    taskId,
    taskTitle,
    message: (payload['title'] as string) ?? taskTitle ?? 'PR opened',
    branch: (payload['branch'] as string | null) ?? null,
    prNumber: (payload['pr_number'] as number | null) ?? extractPrNumber((payload['pr_url'] as string) ?? null),
    prUrl: (payload['pr_url'] as string) ?? null,
    commitSha: (payload['commit_sha'] as string | null) ?? null,
    repo,
    createdAt,
  };
}

function pickRepo(embed: TaskEmbed['repositories']): string | null {
  if (!embed) return null;
  if (Array.isArray(embed)) return embed[0]?.full_name ?? null;
  return embed.full_name ?? null;
}

function extractPrNumber(url: string | null): number | null {
  if (!url) return null;
  const m = url.match(/\/pull\/(\d+)/);
  return m ? Number(m[1]) : null;
}
