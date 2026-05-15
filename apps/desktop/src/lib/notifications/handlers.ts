/**
 * Native notification fanout.
 *
 * Subscribes to workspace-wide `task_events` INSERTs and fires a macOS banner
 * for the four kinds called out in the spec (§Phase 1.5 / §M10):
 *   - agent.blocked
 *   - task.completed
 *   - task.failed
 *   - agent.pr.opened
 *
 * Respects the per-workspace `workspace_settings.notify_native_desktop`
 * boolean introduced by `supabase/migrations/0022_native_desktop_notifications.sql`.
 */

import { supabase } from '@/lib/supabase/client';

interface FireOptions {
  title: string;
  body: string;
  deeplink?: string;
}

const TAURI = typeof window !== 'undefined' && '__TAURI_INTERNALS__' in window;

export async function fireNative({ title, body, deeplink }: FireOptions): Promise<void> {
  if (!TAURI) {
    console.info('[notify]', title, '—', body);
    return;
  }
  const { invoke } = await import('@tauri-apps/api/core');
  await invoke('cmd_notify', { title, body, deeplink: deeplink ?? null });
}

type Unsubscribe = () => void;

export function startNotificationFanout(workspaceId: string): Unsubscribe {
  let enabled = true;
  void supabase()
    .from('workspace_settings')
    .select('notify_native_desktop')
    .eq('workspace_id', workspaceId)
    .maybeSingle()
    .then(({ data }) => {
      const row = data as { notify_native_desktop?: boolean } | null;
      enabled = row?.notify_native_desktop !== false;
    });

  const channel = supabase()
    .channel(`native-notifications-${workspaceId}`)
    .on(
      'postgres_changes',
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      { event: 'INSERT', schema: 'public', table: 'task_events', filter: `workspace_id=eq.${workspaceId}` } as any,
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      (payload: any) => {
        if (!enabled) return;
        const row = payload.new as Record<string, unknown>;
        const eventType = row['event_type'] as string;
        const taskId = row['task_id'] as string;
        const data = (row['payload'] as Record<string, unknown> | null) ?? {};
        const deeplink = `robin://task/${taskId}`;

        switch (eventType) {
          case 'agent.blocked':
            void fireNative({
              title: 'An engineer needs you',
              body: (data['question'] as string) ?? 'They have a question on your task.',
              deeplink,
            });
            break;
          case 'task.completed':
            void fireNative({ title: 'Task complete', body: 'You have a new letter waiting.', deeplink });
            break;
          case 'task.failed':
            void fireNative({
              title: 'Task failed',
              body: (data['message'] as string) ?? 'See the inbox for details.',
              deeplink,
            });
            break;
          case 'agent.pr.opened':
            void fireNative({
              title: 'PR ready for review',
              body: (data['title'] as string) ?? 'A pull request was opened.',
              deeplink,
            });
            break;
          default:
            break;
        }
      },
    )
    .subscribe();

  return () => {
    void supabase().removeChannel(channel);
  };
}
