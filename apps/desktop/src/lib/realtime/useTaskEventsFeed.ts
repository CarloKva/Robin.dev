import { useCallback, useEffect, useState } from 'react';

import { supabase } from '@/lib/supabase/client';
import { narrativize } from '@/lib/events/narrativize';
import type { TaskEventType, TimelineEntry } from '@robin/shared-types';
import { useChannel } from './useChannel';

export interface TaskHeader {
  id: string;
  title: string;
  status: string;
  assignedAgentId: string | null;
  repo: string | null;
  branch: string | null;
  prUrl: string | null;
  workspaceId: string;
}

interface UseTaskEventsFeedResult {
  task: TaskHeader | null;
  events: TimelineEntry[];
  loading: boolean;
}

/**
 * Single-task timeline feed. Mirrors the web hook but reads from the
 * Keychain-backed Supabase client and ports `narrativize` for entry text.
 */
export function useTaskEventsFeed(taskId: string): UseTaskEventsFeedResult {
  const [task, setTask] = useState<TaskHeader | null>(null);
  const [events, setEvents] = useState<TimelineEntry[]>([]);
  const [loading, setLoading] = useState(true);

  const refresh = useCallback(async () => {
    if (!taskId) {
      setLoading(false);
      return;
    }
    setLoading(true);
    const [taskRes, eventsRes] = await Promise.all([
      supabase()
        .from('tasks')
        .select('id, title, status, assigned_agent_id, repo_full_name, branch, pr_url, workspace_id')
        .eq('id', taskId)
        .maybeSingle(),
      supabase()
        .from('task_events')
        .select('id, event_type, actor_type, actor_id, payload, created_at')
        .eq('task_id', taskId)
        .order('created_at', { ascending: true })
        .limit(500),
    ]);

    if (taskRes.error) {
      console.warn('useTaskEventsFeed task fetch failed', taskRes.error.message);
    } else if (taskRes.data) {
      const row = taskRes.data as Record<string, unknown>;
      setTask({
        id: row['id'] as string,
        title: row['title'] as string,
        status: row['status'] as string,
        assignedAgentId: (row['assigned_agent_id'] as string | null) ?? null,
        repo: (row['repo_full_name'] as string | null) ?? null,
        branch: (row['branch'] as string | null) ?? null,
        prUrl: (row['pr_url'] as string | null) ?? null,
        workspaceId: row['workspace_id'] as string,
      });
    }

    const raw = (eventsRes.data ?? []) as Array<Record<string, unknown>>;
    setEvents(raw.map(toTimelineEntry));
    setLoading(false);
  }, [taskId]);

  useEffect(() => {
    void refresh();
  }, [refresh]);

  useChannel({
    channelName: `task-events-feed-${taskId}`,
    table: 'task_events',
    event: 'INSERT',
    filter: `task_id=eq.${taskId}`,
    onPayload: (row) => {
      const entry = toTimelineEntry(row);
      setEvents((prev) => (prev.some((e) => e.id === entry.id) ? prev : [...prev, entry]));
    },
    enabled: Boolean(taskId),
  });

  return { task, events, loading };
}

function toTimelineEntry(row: Record<string, unknown>): TimelineEntry {
  const event_type = row['event_type'] as TaskEventType;
  const actor_type = row['actor_type'] as 'agent' | 'human';
  const actor_id = row['actor_id'] as string;
  const payload = (row['payload'] as Record<string, unknown>) ?? {};
  return {
    id: row['id'] as string,
    event_type,
    actor_type,
    actor_id,
    payload,
    created_at: row['created_at'] as string,
    narrative: narrativize({ event_type, payload, actor_type, actor_id }),
  };
}
