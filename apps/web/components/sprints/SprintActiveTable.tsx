"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import { useAuth } from "@clerk/nextjs";
import Link from "next/link";
import { createBrowserClient } from "@supabase/ssr";
import type { RealtimePostgresInsertPayload } from "@supabase/supabase-js";
import { ChevronDown, ChevronRight, Copy, Check, ExternalLink } from "lucide-react";
import type { Task, TaskEvent, TaskEventType, Agent, Repository } from "@robin/shared-types";
import { SprintProgressBar } from "./SprintProgressBar";
import { narrativize } from "@/lib/events/narrativize";
import { getSupabaseBrowserClient } from "@/lib/supabase/client";
import { cn } from "@/lib/utils";

// ── Constants ─────────────────────────────────────────────────────────────────

const MAX_LOG_EVENTS = 500;

const STATUS_CONFIG: Record<string, { label: string; className: string }> = {
  queued: { label: "In coda", className: "text-slate-500 bg-slate-100 dark:bg-slate-800" },
  sprint_ready: { label: "Pronta", className: "text-blue-500 bg-blue-50 dark:bg-blue-900/20" },
  pending: { label: "In attesa", className: "text-slate-500 bg-slate-100 dark:bg-slate-800" },
  in_progress: { label: "In esecuzione", className: "text-blue-600 bg-blue-100 dark:bg-blue-900/30" },
  rework: { label: "Rework", className: "text-orange-600 bg-orange-100 dark:bg-orange-900/30" },
  in_review: { label: "In review", className: "text-gray-700 bg-gray-100 dark:bg-gray-800/30" },
  review_pending: { label: "Review pending", className: "text-gray-600 bg-gray-50 dark:bg-gray-800/20" },
  done: { label: "Completata", className: "text-green-600 bg-green-100 dark:bg-green-900/30" },
  completed: { label: "Completata", className: "text-green-600 bg-green-100 dark:bg-green-900/30" },
  approved: { label: "Approvata", className: "text-emerald-600 bg-emerald-100 dark:bg-emerald-900/30" },
  failed: { label: "Fallita", className: "text-red-600 bg-red-100 dark:bg-red-900/30" },
  cancelled: { label: "Annullata", className: "text-slate-400 bg-slate-100 dark:bg-slate-800" },
  rejected: { label: "Rifiutata", className: "text-red-500 bg-red-50 dark:bg-red-900/20" },
};

const TERMINAL_STATES = new Set(["done", "completed", "failed", "cancelled", "approved", "rejected"]);

// ── Helpers ───────────────────────────────────────────────────────────────────

function formatElapsed(fromIso: string | null, toIso?: string): string {
  if (!fromIso) return "—";
  const from = new Date(fromIso).getTime();
  const to = toIso ? new Date(toIso).getTime() : Date.now();
  const seconds = Math.floor((to - from) / 1000);
  if (seconds < 60) return `${seconds}s`;
  const minutes = Math.floor(seconds / 60);
  if (minutes < 60) return `${minutes}m`;
  const hours = Math.floor(minutes / 60);
  const mins = minutes % 60;
  return mins > 0 ? `${hours}h ${mins}m` : `${hours}h`;
}

function formatTimestamp(isoString: string): string {
  const d = new Date(isoString);
  return d.toLocaleTimeString("it-IT", { hour: "2-digit", minute: "2-digit", second: "2-digit" });
}

// ── TaskTerminalPanel ─────────────────────────────────────────────────────────

interface TaskTerminalPanelProps {
  taskId: string;
  taskStatus: string;
}

function TaskTerminalPanel({ taskId, taskStatus }: TaskTerminalPanelProps) {
  const { getToken } = useAuth();
  const [events, setEvents] = useState<TaskEvent[]>([]);
  const [loading, setLoading] = useState(true);
  const [copied, setCopied] = useState(false);
  const bottomRef = useRef<HTMLDivElement>(null);
  const seenIds = useRef(new Set<string>());
  const channelRef = useRef<ReturnType<ReturnType<typeof createBrowserClient>["channel"]> | null>(null);

  // Load initial events from API
  useEffect(() => {
    let cancelled = false;

    fetch(`/api/tasks/${taskId}/events`)
      .then((r) => r.json())
      .then((data: { events?: TaskEvent[] }) => {
        if (cancelled) return;
        const evts = (data.events ?? []) as TaskEvent[];
        const capped = evts.slice(-MAX_LOG_EVENTS);
        seenIds.current = new Set(capped.map((e) => e.id));
        setEvents(capped);
        setLoading(false);
      })
      .catch(() => {
        if (!cancelled) setLoading(false);
      });

    return () => { cancelled = true; };
  }, [taskId]);

  // Subscribe to new events via Realtime
  useEffect(() => {
    if (loading) return;

    let cancelled = false;

    async function subscribe() {
      const supabase = getSupabaseBrowserClient();
      const token = await getToken({ template: "supabase" });
      if (token) {
        await supabase.realtime.setAuth(token);
      }
      if (cancelled) return;

      const channel = supabase
        .channel(`terminal-events-${taskId}`)
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
            if (seenIds.current.has(raw.id)) return;
            seenIds.current.add(raw.id);

            const newEvent: TaskEvent = {
              id: raw.id,
              task_id: taskId,
              workspace_id: "",
              event_type: raw.event_type as TaskEventType,
              actor_type: raw.actor_type as "agent" | "human",
              actor_id: raw.actor_id,
              payload: raw.payload,
              created_at: raw.created_at,
            };

            setEvents((prev) => {
              const next = [...prev, newEvent];
              return next.length > MAX_LOG_EVENTS ? next.slice(-MAX_LOG_EVENTS) : next;
            });
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
  }, [loading, taskId, getToken]);

  // Auto-scroll to bottom on new events
  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [events.length]);

  // Extract error info for failed tasks
  const failedEvent = events.find((e) => e.event_type === "task.failed");
  const errorText = failedEvent
    ? `[${failedEvent.event_type}] ${String((failedEvent.payload as Record<string, unknown>)["message"] ?? "")} (${String((failedEvent.payload as Record<string, unknown>)["error_code"] ?? "")})`
    : null;

  const handleCopyError = async () => {
    if (!errorText) return;
    await navigator.clipboard.writeText(errorText);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  return (
    <div className="border-t border-border bg-gray-950 font-mono text-xs">
      <div className="max-h-64 overflow-y-auto p-3">
        {loading && (
          <span className="text-gray-500">Caricamento log...</span>
        )}

        {!loading && events.length === 0 && (
          <span className="text-gray-600">Nessun evento registrato.</span>
        )}

        {events.map((event) => {
          const text = narrativize({
            event_type: event.event_type,
            payload: event.payload,
            actor_type: event.actor_type,
            actor_id: event.actor_id,
          });
          const isFailed = event.event_type === "task.failed";
          const isCompleted = event.event_type === "task.completed";

          return (
            <div
              key={event.id}
              className={cn(
                "py-0.5 leading-relaxed",
                isFailed ? "text-red-400" : isCompleted ? "text-green-400" : "text-gray-300"
              )}
            >
              <span className="text-gray-600 select-none">[{formatTimestamp(event.created_at)}]</span>{" "}
              <span>{text}</span>
            </div>
          );
        })}

        {taskStatus === "failed" && errorText && (
          <div className="mt-2 border-t border-red-900/50 pt-2">
            <div className="text-red-400 break-words">{errorText}</div>
            <button
              type="button"
              onClick={() => void handleCopyError()}
              className="mt-1.5 inline-flex items-center gap-1 rounded border border-red-800 bg-red-950/40 px-2 py-0.5 text-red-300 transition-colors hover:bg-red-950/70"
            >
              {copied ? <Check size={11} /> : <Copy size={11} />}
              {copied ? "Copiato!" : "Copia errore"}
            </button>
          </div>
        )}

        <div ref={bottomRef} />
      </div>
    </div>
  );
}

// ── SprintActiveTable ─────────────────────────────────────────────────────────

interface SprintActiveTableProps {
  initialTasks: Task[];
  sprintId: string;
  workspaceId: string;
  agents: Agent[];
  repositories: Repository[];
}

export function SprintActiveTable({
  initialTasks,
  sprintId,
  workspaceId,
  agents,
  repositories,
}: SprintActiveTableProps) {
  const [tasks, setTasks] = useState<Task[]>(initialTasks);
  const [openTaskId, setOpenTaskId] = useState<string | null>(null);

  // Lookup maps for agents and repositories
  const agentMap = useMemo(
    () => new Map(agents.map((a) => [a.id, a])),
    [agents]
  );
  const repoMap = useMemo(
    () => new Map(repositories.map((r) => [r.id, r])),
    [repositories]
  );

  // Realtime subscription for task status updates
  useEffect(() => {
    const supabase = createBrowserClient(
      process.env["NEXT_PUBLIC_SUPABASE_URL"]!,
      process.env["NEXT_PUBLIC_SUPABASE_ANON_KEY"]!
    );

    const channel = supabase
      .channel(`sprint-active-table:${sprintId}`)
      .on(
        "postgres_changes",
        {
          event: "UPDATE",
          schema: "public",
          table: "tasks",
          filter: `sprint_id=eq.${sprintId}`,
        },
        (payload) => {
          const updated = payload.new as Task;
          setTasks((prev) =>
            prev.map((t) => (t.id === updated.id ? { ...t, ...updated } : t))
          );
        }
      )
      .subscribe();

    return () => {
      void supabase.removeChannel(channel);
    };
  }, [sprintId, workspaceId]);

  const togglePanel = (taskId: string) => {
    setOpenTaskId((prev) => (prev === taskId ? null : taskId));
  };

  return (
    <div className="space-y-6">
      <SprintProgressBar tasks={tasks} />

      <div className="overflow-x-auto rounded-lg border border-border">
        <table className="w-full text-sm">
          <thead>
            <tr className="border-b border-border bg-muted/40 text-left text-xs font-semibold uppercase tracking-wide text-muted-foreground">
              <th className="px-4 py-3 min-w-[200px]">Task</th>
              <th className="px-4 py-3 min-w-[140px]">Repository</th>
              <th className="px-4 py-3 min-w-[120px]">Status</th>
              <th className="px-4 py-3 min-w-[160px]">Agente</th>
              <th className="px-4 py-3 min-w-[80px]">Durata</th>
              <th className="px-4 py-3 min-w-[80px]">Azioni</th>
            </tr>
          </thead>
          <tbody>
            {tasks.map((task) => {
              const agent = task.assigned_agent_id ? agentMap.get(task.assigned_agent_id) : null;
              const repo = task.repository_id ? repoMap.get(task.repository_id) : null;
              const statusConfig = STATUS_CONFIG[task.status] ?? {
                label: task.status,
                className: "text-muted-foreground bg-muted",
              };
              const isOpen = openTaskId === task.id;
              const isTerminal = TERMINAL_STATES.has(task.status);
              const duration = formatElapsed(
                task.queued_at ?? task.created_at,
                isTerminal ? task.updated_at : undefined
              );

              return (
                <>
                  <tr
                    key={task.id}
                    className={cn(
                      "border-b border-border transition-colors",
                      isOpen ? "bg-accent/30" : "hover:bg-accent/20"
                    )}
                  >
                    {/* Task */}
                    <td className="px-4 py-3">
                      <Link
                        href={`/tasks/${task.id}`}
                        className="font-medium text-foreground hover:text-primary hover:underline line-clamp-2"
                      >
                        {task.title}
                      </Link>
                    </td>

                    {/* Repository */}
                    <td className="px-4 py-3 text-muted-foreground">
                      {repo ? (
                        <span className="font-mono text-xs">{repo.full_name}</span>
                      ) : (
                        <span className="text-muted-foreground/50">—</span>
                      )}
                    </td>

                    {/* Status */}
                    <td className="px-4 py-3">
                      <span
                        className={cn(
                          "inline-flex items-center rounded-full px-2 py-0.5 text-xs font-medium whitespace-nowrap",
                          statusConfig.className,
                          task.status === "in_progress" && "animate-pulse"
                        )}
                      >
                        {statusConfig.label}
                      </span>
                    </td>

                    {/* Agente — expand button */}
                    <td className="px-4 py-3">
                      <button
                        type="button"
                        onClick={() => togglePanel(task.id)}
                        className={cn(
                          "inline-flex items-center gap-1.5 rounded-md px-2 py-1 text-xs transition-colors",
                          isOpen
                            ? "bg-primary/10 text-primary"
                            : "text-muted-foreground hover:bg-accent hover:text-foreground"
                        )}
                        title={isOpen ? "Chiudi terminale" : "Apri terminale"}
                      >
                        {isOpen ? (
                          <ChevronDown size={13} className="shrink-0" />
                        ) : (
                          <ChevronRight size={13} className="shrink-0" />
                        )}
                        <span className="truncate max-w-[100px]">
                          {agent?.name ?? "—"}
                        </span>
                      </button>
                    </td>

                    {/* Durata */}
                    <td className="px-4 py-3 text-muted-foreground tabular-nums">
                      {duration}
                    </td>

                    {/* Azioni */}
                    <td className="px-4 py-3">
                      <Link
                        href={`/tasks/${task.id}`}
                        className="inline-flex items-center gap-1 text-xs text-muted-foreground hover:text-foreground transition-colors"
                        title="Dettagli task"
                      >
                        <ExternalLink size={12} />
                        Dettagli
                      </Link>
                    </td>
                  </tr>

                  {/* Inline terminal panel */}
                  {isOpen && (
                    <tr key={`${task.id}-terminal`}>
                      <td colSpan={6} className="p-0">
                        <TaskTerminalPanel
                          taskId={task.id}
                          taskStatus={task.status}
                        />
                      </td>
                    </tr>
                  )}
                </>
              );
            })}

            {tasks.length === 0 && (
              <tr>
                <td colSpan={6} className="px-4 py-8 text-center text-muted-foreground">
                  Nessuna task in questo sprint.
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </div>
    </div>
  );
}
