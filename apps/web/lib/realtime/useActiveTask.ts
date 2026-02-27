"use client";

import { useEffect, useRef, useState } from "react";
import { useAuth } from "@clerk/nextjs";
import type { RealtimeChannel, RealtimePostgresInsertPayload } from "@supabase/supabase-js";
import type { TaskEventType, TaskStatus, EventPayloadMap } from "@robin/shared-types";
import { getSupabaseBrowserClient } from "@/lib/supabase/client";

type UseActiveTaskOptions = {
  workspaceId: string;
  /** ID of the task that was in_progress at SSR time, if any. */
  initialActiveTaskId: string | null;
};

type UseActiveTaskResult = {
  /** ID of the task currently being executed by the agent, or null if idle. */
  activeTaskId: string | null;
  /** task_id → status map for tasks whose status changed via Realtime. */
  statusOverrides: Map<string, TaskStatus>;
};

/**
 * Subscribes to workspace-level task_events and tracks which task is currently
 * active (in_progress / queued) in real-time.
 *
 * Also tracks status overrides: if a task changes state while the list is open,
 * the new status is reflected immediately without re-fetching.
 */
export function useActiveTask({
  workspaceId,
  initialActiveTaskId,
}: UseActiveTaskOptions): UseActiveTaskResult {
  const { getToken } = useAuth();
  const [activeTaskId, setActiveTaskId] = useState<string | null>(initialActiveTaskId);
  const [statusOverrides, setStatusOverrides] = useState<Map<string, TaskStatus>>(new Map());
  const channelRef = useRef<RealtimeChannel | null>(null);

  useEffect(() => {
    let cancelled = false;

    async function subscribe() {
      const supabase = getSupabaseBrowserClient();

      const token = await getToken({ template: "supabase" });
      if (token) await supabase.realtime.setAuth(token);

      if (cancelled) return;

      const channel = supabase
        .channel(`active-task-${workspaceId}`)
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
            const taskId = raw.task_id;

            if (eventType === "task.state.changed") {
              const p = raw.payload as EventPayloadMap["task.state.changed"];
              const newStatus = p.to;

              // Update status override map
              setStatusOverrides((prev) => new Map(prev).set(taskId, newStatus));

              // Track active task
              if (newStatus === "in_progress" || newStatus === "queued") {
                setActiveTaskId(taskId);
              } else if (taskId === activeTaskId) {
                setActiveTaskId(null);
              }
            } else if (
              eventType === "task.completed" ||
              eventType === "task.failed"
            ) {
              const finalStatus: TaskStatus =
                eventType === "task.completed" ? "completed" : "failed";
              setStatusOverrides((prev) => new Map(prev).set(taskId, finalStatus));
              if (taskId === activeTaskId) setActiveTaskId(null);
            }
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
  }, [workspaceId, getToken, activeTaskId]);

  return { activeTaskId, statusOverrides };
}
