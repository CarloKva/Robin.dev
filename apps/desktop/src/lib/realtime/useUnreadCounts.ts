import { useEffect, useState } from 'react';

import { supabase } from '@/lib/supabase/client';
import { getInboxReadMap } from '@/lib/storage/inboxRead';
import { useChannel } from './useChannel';

export interface UnreadCounts {
  inbox: number;
  urgentInbox: boolean;
  inProgress: number;
}

/**
 * Aggregate counts for the popover's `TabStrip` badges:
 *   - inbox = completed/failed/review tasks the user hasn't marked read
 *   - inProgress = tasks with status in {queued, in_progress, in_review, review_pending}
 *
 * Reads from the `tasks` table directly; the inbox-letters projection
 * (see `lib/inbox/projectLetter.ts`) is built lazily by `useInboxFeed`.
 */
export function useUnreadCounts(workspaceId: string | null): UnreadCounts {
  const [counts, setCounts] = useState<UnreadCounts>({
    inbox: 0,
    urgentInbox: false,
    inProgress: 0,
  });

  useEffect(() => {
    let cancelled = false;

    async function refresh() {
      if (!workspaceId) {
        setCounts({ inbox: 0, urgentInbox: false, inProgress: 0 });
        return;
      }
      const [letters, wip, read] = await Promise.all([
        supabase()
          .from('tasks')
          .select('id, status')
          .eq('workspace_id', workspaceId)
          .in('status', ['completed', 'failed', 'review_pending', 'rejected', 'in_review']),
        supabase()
          .from('tasks')
          .select('id', { count: 'exact', head: true })
          .eq('workspace_id', workspaceId)
          .in('status', ['queued', 'in_progress', 'in_review', 'review_pending']),
        getInboxReadMap(),
      ]);
      if (cancelled) return;
      const lettersData = (letters.data ?? []) as Array<{ id: string; status: string }>;
      const unread = lettersData.filter((t) => !read[t.id]);
      setCounts({
        inbox: unread.length,
        urgentInbox: unread.some((t) => t.status === 'failed' || t.status === 'rejected'),
        inProgress: wip.count ?? 0,
      });
    }

    void refresh();
    return () => {
      cancelled = true;
    };
  }, [workspaceId]);

  useChannel({
    channelName: `tasks-${workspaceId ?? 'none'}`,
    table: 'tasks',
    event: '*',
    ...(workspaceId ? { filter: `workspace_id=eq.${workspaceId}` } : {}),
    onPayload: () => {
      setCounts((prev) => prev);
    },
    enabled: Boolean(workspaceId),
  });

  return counts;
}
