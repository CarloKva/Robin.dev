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
const INBOX_STATUSES = ['completed', 'failed', 'review_pending', 'rejected', 'in_review'];

/**
 * Letter feed for the popover Inbox. Schema reality (vs. earlier draft):
 *   - tasks has no completed_at / failed_at / repo_full_name columns
 *   - repo lives on the joined `repositories.full_name` via `tasks.repository_id`
 *   - timing + PR url live on `task_iterations` (last iteration per task)
 *   - error message comes from the last `task.failed` event in `task_events`
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
      .select(
        `
        id, title, status, priority, assigned_agent_id, created_at, updated_at,
        repositories!tasks_repository_id_fkey ( full_name ),
        task_iterations ( iteration_number, status, pr_url, pr_number, started_at, completed_at, summary )
        `,
      )
      .eq('workspace_id', workspaceId)
      .in('status', INBOX_STATUSES)
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

    // Pull task_events for error messages + duration on failure.
    const [{ data: eventRows }, readMap] = await Promise.all([
      supabase()
        .from('task_events')
        .select('id, task_id, event_type, payload, created_at')
        .in('task_id', ids)
        .in('event_type', ['task.failed', 'task.completed'])
        .order('created_at', { ascending: true }),
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
      .map((task) =>
        projectLetter(
          // eslint-disable-next-line @typescript-eslint/no-explicit-any
          task as any,
          // eslint-disable-next-line @typescript-eslint/no-explicit-any
          (byTask.get(task['id'] as string) ?? []) as any,
          readMap,
        ),
      )
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
