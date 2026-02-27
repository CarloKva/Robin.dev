"use client";

import { useEffect, useRef, useState } from "react";
import { useAuth } from "@clerk/nextjs";
import type { RealtimeChannel, RealtimePostgresInsertPayload } from "@supabase/supabase-js";
import type { AgentStatusEnum, TaskEventType, EventPayloadMap } from "@robin/shared-types";
import { getSupabaseBrowserClient } from "@/lib/supabase/client";

type UseAgentStatusOptions = {
  workspaceId: string;
  initialStatus: AgentStatusEnum;
  initialTaskTitle: string | null;
};

type UseAgentStatusResult = {
  status: AgentStatusEnum;
  taskTitle: string | null;
  /** True only after a successful connection is established and then lost. */
  isOffline: boolean;
};

/**
 * Subscribes to workspace-level task_events and derives the agent's current
 * status from incoming events. Updates in real-time without polling.
 *
 * Initial state comes from SSR (passed as props from the layout Server Component).
 * The hook enriches that with live updates.
 *
 * `isOffline` is false on first load (before connection established) to avoid
 * a flash of "Realtime offline" text during the WebSocket handshake.
 */
export function useAgentStatus({
  workspaceId,
  initialStatus,
  initialTaskTitle,
}: UseAgentStatusOptions): UseAgentStatusResult {
  const { getToken } = useAuth();
  const [status, setStatus] = useState<AgentStatusEnum>(initialStatus);
  const [taskTitle, setTaskTitle] = useState<string | null>(initialTaskTitle);
  const [isConnected, setIsConnected] = useState(false);
  const [hasEverConnected, setHasEverConnected] = useState(false);
  const channelRef = useRef<RealtimeChannel | null>(null);
  const currentTaskIdRef = useRef<string | null>(null);

  useEffect(() => {
    let cancelled = false;

    async function subscribe() {
      const supabase = getSupabaseBrowserClient();

      const token = await getToken({ template: "supabase" });
      if (token) await supabase.realtime.setAuth(token);

      if (cancelled) return;

      const channel = supabase
        .channel(`agent-status-${workspaceId}`)
        .on(
          "postgres_changes",
          {
            event: "INSERT",
            schema: "public",
            table: "task_events",
            filter: `workspace_id=eq.${workspaceId}`,
          },
          (payload: RealtimePostgresInsertPayload<Record<string, unknown>>) => {
            const raw = payload.new as {
              task_id: string;
              event_type: string;
              payload: Record<string, unknown>;
            };

            const eventType = raw.event_type as TaskEventType;

            // Fetch title when we see a new task_id for the first time
            if (raw.task_id !== currentTaskIdRef.current) {
              currentTaskIdRef.current = raw.task_id;
              void supabase
                .from("tasks")
                .select("title")
                .eq("id", raw.task_id)
                .single()
                .then(({ data }: { data: { title: string } | null }) => {
                  if (data?.title) setTaskTitle(data.title);
                });
            }

            // Derive agent status from event type
            switch (eventType) {
              case "agent.phase.started":
                setStatus("busy");
                break;

              case "task.state.changed": {
                const p = raw.payload as EventPayloadMap["task.state.changed"];
                if (p.to === "in_progress" || p.to === "queued") {
                  setStatus("busy");
                } else if (p.to === "review_pending") {
                  // Agent finished — PR is in review, agent goes idle
                  setStatus("idle");
                } else if (p.to === "completed" || p.to === "cancelled") {
                  setStatus("idle");
                  setTaskTitle(null);
                  currentTaskIdRef.current = null;
                } else if (p.to === "failed") {
                  setStatus("error");
                }
                break;
              }

              case "task.completed":
                setStatus("idle");
                setTaskTitle(null);
                currentTaskIdRef.current = null;
                break;

              case "task.failed":
                setStatus("error");
                break;

              default:
                break;
            }
          }
        )
        .subscribe((s: string) => {
          const connected = s === "SUBSCRIBED";
          setIsConnected(connected);
          if (connected) setHasEverConnected(true);
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
  }, [workspaceId, getToken]);

  return {
    status,
    taskTitle,
    // isOffline is false during initial WebSocket handshake to avoid flash
    isOffline: hasEverConnected && !isConnected,
  };
}
