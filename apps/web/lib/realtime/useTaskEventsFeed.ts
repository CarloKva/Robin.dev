"use client";

import { useEffect, useRef, useState } from "react";
import { useAuth } from "@clerk/nextjs";
import type { RealtimeChannel, RealtimePostgresInsertPayload } from "@supabase/supabase-js";
import type { TimelineEntry, TaskEventType } from "@robin/shared-types";
import { getSupabaseBrowserClient } from "@/lib/supabase/client";
import { narrativize } from "@/lib/events/narrativize";

type UseTaskEventsFeedOptions = {
  taskId: string;
  initialEvents: TimelineEntry[];
};

type UseTaskEventsFeedResult = {
  events: TimelineEntry[];
  isConnected: boolean;
};

/**
 * Combines SSR-fetched initial events with live Realtime updates.
 * Deduplicates by event ID to prevent double-rendering when the same
 * event arrives both from SSR and Realtime.
 *
 * Usage:
 *   const { events, isConnected } = useTaskEventsFeed({ taskId, initialEvents });
 */
export function useTaskEventsFeed({
  taskId,
  initialEvents,
}: UseTaskEventsFeedOptions): UseTaskEventsFeedResult {
  const { getToken } = useAuth();
  const [events, setEvents] = useState<TimelineEntry[]>(initialEvents);
  const [isConnected, setIsConnected] = useState(false);
  const seenIds = useRef(new Set(initialEvents.map((e) => e.id)));
  const channelRef = useRef<RealtimeChannel | null>(null);

  useEffect(() => {
    let cancelled = false;

    async function subscribe() {
      const supabase = getSupabaseBrowserClient();

      const token = await getToken({ template: "supabase" });
      if (token) {
        await supabase.realtime.setAuth(token);
      }

      if (cancelled) return;

      const channel = supabase
        .channel(`task-events-feed-${taskId}`)
        .on(
          "postgres_changes",
          {
            event: "INSERT",
            schema: "public",
            table: "task_events",
            filter: `task_id=eq.${taskId}`,
          },
          (payload: RealtimePostgresInsertPayload<Record<string, unknown>>) => {
            const raw = payload.new as {
              id: string;
              event_type: string;
              actor_type: string;
              actor_id: string;
              payload: Record<string, unknown>;
              created_at: string;
            };

            // Deduplicate
            if (seenIds.current.has(raw.id)) return;
            seenIds.current.add(raw.id);

            const entry: TimelineEntry = {
              id: raw.id,
              event_type: raw.event_type as TaskEventType,
              actor_type: raw.actor_type as "agent" | "human",
              actor_id: raw.actor_id,
              payload: raw.payload,
              created_at: raw.created_at,
              narrative: narrativize({
                event_type: raw.event_type as TaskEventType,
                payload: raw.payload,
                actor_type: raw.actor_type as "agent" | "human",
                actor_id: raw.actor_id,
              }),
            };

            setEvents((prev) => [...prev, entry]);
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

  return { events, isConnected };
}
