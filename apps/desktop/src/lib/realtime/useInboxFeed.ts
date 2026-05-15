import { useCallback, useEffect, useState } from 'react';

import { supabase } from '@/lib/supabase/client';
import { projectLetter, type InboxLetter } from '@/lib/inbox/projectLetter';
import { getInboxReadMap } from '@/lib/storage/inboxRead';
import { useChannel } from './useChannel';

interface UseInboxFeedResult {
  letters: InboxLetter[];
  loading: boolean;
  refresh: () => Promise<void>;
}

const INBOX_LIMIT = 50;

/**
 * Inbox feed. The spec (§Phase 2.1) calls for a letter-shaped projection
 * over `task_events`; v1 keeps it client-side to avoid a new endpoint.
 *
 * We fetch tasks in terminal/review states, hydrate their last ~20 events,
 * and feed both to `projectLetter`. Realtime listens to INSERTs on
 * `task_events` for the workspace and re-projects the affected task on the
 * fly.
 */
export function useInboxFeed(workspaceId: string | null): UseInboxFeedResult {
  const [letters, setLetters] = useState<InboxLetter[]>([]);
  const [loading, setLoading] = useState(true);

  const refresh = useCallback(async () => {
    if (!workspaceId) {
      setLetters([]);
      setLoading(false);
      return;
    }
    setLoading(true);

    const { data: taskRows, error: taskErr } = await supabase()
      .from('tasks')
      .select('id, title, status, priority, assigned_agent_id, repo_full_name, created_at, updated_at, completed_at, failed_at')
      .eq('workspace_id', workspaceId)
      .in('status', ['completed', 'failed', 'review_pending', 'rejected', 'in_review'])
      .order('updated_at', { ascending: false })
      .limit(INBOX_LIMIT);

    if (taskErr) {
      console.warn('useInboxFeed task fetch failed', taskErr.message);
      setLoading(false);
      return;
    }

    const tasks = (taskRows ?? []) as Array<Record<string, unknown>>;
    const ids = tasks.map((t) => t['id'] as string);
    if (ids.length === 0) {
      setLetters([]);
      setLoading(false);
      return;
    }

    const [{ data: eventRows }, readMap] = await Promise.all([
      supabase()
        .from('task_events')
        .select('id, task_id, event_type, actor_type, actor_id, payload, created_at')
        .in('task_id', ids)
        .order('created_at', { ascending: true })
        .limit(INBOX_LIMIT * 20),
      getInboxReadMap(),
    ]);

    const byTask = new Map<string, Array<Record<string, unknown>>>();
    for (const row of (eventRows ?? []) as Array<Record<string, unknown>>) {
      const id = row['task_id'] as string;
      const list = byTask.get(id) ?? [];
      list.push(row);
      byTask.set(id, list);
    }

    const projected = tasks
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      .map((task) => projectLetter(task as any, byTask.get(task['id'] as string) ?? [], readMap))
      .filter((letter): letter is InboxLetter => letter !== null);
    setLetters(projected);
    setLoading(false);
  }, [workspaceId]);

  useEffect(() => {
    void refresh();
  }, [refresh]);

  useChannel({
    channelName: `inbox-events-${workspaceId ?? 'none'}`,
    table: 'task_events',
    event: 'INSERT',
    ...(workspaceId ? { filter: `workspace_id=eq.${workspaceId}` } : {}),
    onPayload: () => {
      void refresh();
    },
    enabled: Boolean(workspaceId),
  });

  return { letters, loading, refresh };
}
