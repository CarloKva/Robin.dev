"use client";

import { useEffect, useRef, useState } from "react";
import { useAuth } from "@clerk/nextjs";
import type {
  RealtimeChannel,
  RealtimePostgresInsertPayload,
} from "@supabase/supabase-js";
import type { TaskEventType } from "@robin/shared-types";
import { getSupabaseBrowserClient } from "@/lib/supabase/client";
import { narrativize } from "@/lib/events/narrativize";
import type { FeedEntry } from "@/lib/db/dashboard";

type Options = {
  workspaceId: string;
  initialFeed: FeedEntry[];
  limit?: number;
};

type Result = {
  feed: FeedEntry[];
};

/**
 * Subscribes to workspace-level task_events and prepends new entries
 * to the activity feed in real-time.
 *
 * SSR initial feed is merged with incoming Realtime events.
 * Deduplicates by event ID.
 */
export function useDashboardFeed({
  workspaceId,
  initialFeed,
  limit = 10,
}: Options): Result {
  const { getToken } = useAuth();
  const [feed, setFeed] = useState<FeedEntry[]>(initialFeed);
  const channelRef = useRef<RealtimeChannel | null>(null);
  const seenIds = useRef(new Set(initialFeed.map((e) => e.id)));

  useEffect(() => {
    let cancelled = false;

    async function subscribe() {
      const supabase = getSupabaseBrowserClient();

      const token = await getToken({ template: "supabase" });
      if (token) await supabase.realtime.setAuth(token);

      if (cancelled) return;

      const channel = supabase
        .channel(`dashboard-feed-${workspaceId}`)
        .on(
          "postgres_changes",
          {
            event: "INSERT",
            schema: "public",
            table: "task_events",
            filter: `workspace_id=eq.${workspaceId}`,
          },
          async (
            payload: RealtimePostgresInsertPayload<Record<string, unknown>>
          ) => {
            const raw = payload.new as {
              id: string;
              task_id: string;
              event_type: string;
              payload: Record<string, unknown>;
              actor_type: string;
              actor_id: string;
              created_at: string;
            };

            if (seenIds.current.has(raw.id)) return;
            seenIds.current.add(raw.id);

            // Fetch task title for display in the feed
            const { data: taskData } = await supabase
              .from("tasks")
              .select("title")
              .eq("id", raw.task_id)
              .single();

            const entry: FeedEntry = {
              id: raw.id,
              task_id: raw.task_id,
              task_title: (taskData as { title: string } | null)?.title ?? null,
              event_type: raw.event_type as TaskEventType,
              narrative: narrativize({
                event_type: raw.event_type as TaskEventType,
                payload: raw.payload,
                actor_type: raw.actor_type as "agent" | "human",
                actor_id: raw.actor_id,
              }),
              created_at: raw.created_at,
            };

            setFeed((prev) => [entry, ...prev].slice(0, limit));
          }
        )
        .subscribe();

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
    };
  }, [workspaceId, getToken, limit]);

  return { feed };
}
