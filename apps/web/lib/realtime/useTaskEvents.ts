"use client";

import { useEffect, useRef, useState } from "react";
import { useAuth } from "@clerk/nextjs";
import type { RealtimeChannel, RealtimePostgresInsertPayload } from "@supabase/supabase-js";
import type { TaskEvent } from "@robin/shared-types";
import { getSupabaseBrowserClient } from "@/lib/supabase/client";

type UseTaskEventsOptions = {
  taskId: string;
};

type UseTaskEventsResult = {
  latestEvent: TaskEvent | null;
  isConnected: boolean;
};

/**
 * Subscribes to Supabase Realtime postgres_changes INSERT on task_events
 * for a specific task. Yields the latest event received.
 *
 * The Clerk JWT is set on the Realtime client before subscribing so that
 * RLS policies are enforced on the channel.
 *
 * Cleanup: channel is removed on unmount — no memory leaks.
 */
export function useTaskEvents({ taskId }: UseTaskEventsOptions): UseTaskEventsResult {
  const { getToken } = useAuth();
  const [latestEvent, setLatestEvent] = useState<TaskEvent | null>(null);
  const [isConnected, setIsConnected] = useState(false);
  const channelRef = useRef<RealtimeChannel | null>(null);

  useEffect(() => {
    let cancelled = false;

    async function subscribe() {
      const supabase = getSupabaseBrowserClient();

      // Attach Clerk JWT so RLS applies to the Realtime channel
      const token = await getToken({ template: "supabase" });
      if (token) {
        await supabase.realtime.setAuth(token);
      }

      if (cancelled) return;

      const channel = supabase
        .channel(`task-events-${taskId}`)
        .on(
          "postgres_changes",
          {
            event: "INSERT",
            schema: "public",
            table: "task_events",
            filter: `task_id=eq.${taskId}`,
          },
          (payload: RealtimePostgresInsertPayload<Record<string, unknown>>) => {
            setLatestEvent(payload.new as unknown as TaskEvent);
          }
        )
        .subscribe((status: string) => {
          setIsConnected(status === "SUBSCRIBED");
        });

      channelRef.current = channel;
    }

    void subscribe();

    return () => {
      cancelled = true;
      const supabase = getSupabaseBrowserClient();
      if (channelRef.current) {
        void supabase.removeChannel(channelRef.current);
        channelRef.current = null;
      }
      setIsConnected(false);
    };
  }, [taskId, getToken]);

  return { latestEvent, isConnected };
}
