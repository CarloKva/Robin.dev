"use client";

import { useEffect, useState, useTransition } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { Calendar } from "lucide-react";
import { createBrowserClient } from "@supabase/ssr";
import { cn } from "@/lib/utils";
import type { Task, Sprint } from "@robin/shared-types";

// ── Types ─────────────────────────────────────────────────────────────────────

interface TaskRowProps {
  task: Task;
}

// ── Status groupings ──────────────────────────────────────────────────────────

type GroupKey = "pending" | "in_progress" | "in_review" | "done";

const GROUP_LABELS: Record<GroupKey, string> = {
  pending: "Pending",
  in_progress: "In Progress",
  in_review: "In Review",
  done: "Done",
};

const TASK_TO_GROUP: Record<string, GroupKey> = {
  sprint_ready: "pending",
  pending: "pending",
  queued: "pending",
  in_progress: "in_progress",
  rework: "in_progress",
  in_review: "in_review",
  review_pending: "in_review",
  done: "done",
  completed: "done",
  approved: "done",
  rejected: "done",
  failed: "done",
  cancelled: "done",
};

function groupTasks(tasks: Task[]): Record<GroupKey, Task[]> {
  const groups: Record<GroupKey, Task[]> = {
    pending: [],
    in_progress: [],
    in_review: [],
    done: [],
  };
  for (const task of tasks) {
    const group = TASK_TO_GROUP[task.status] ?? "pending";
    groups[group]!.push(task);
  }
  return groups;
}

// ── Sprint status badge ───────────────────────────────────────────────────────

const SPRINT_STATUS_CONFIG: Record<string, { label: string; className: string }> = {
  planning: { label: "In pianificazione", className: "bg-muted text-muted-foreground" },
  active: { label: "Attivo", className: "bg-foreground/10 text-foreground" },
  completed: { label: "Completato", className: "bg-muted text-muted-foreground" },
  cancelled: { label: "Annullato", className: "bg-muted text-muted-foreground/60" },
};

// ── Priority badge ────────────────────────────────────────────────────────────

const PRIORITY_BADGE: Record<string, string> = {
  high: "bg-red-50 text-red-700 dark:bg-red-900/20 dark:text-red-400",
  urgent: "bg-red-50 text-red-700 dark:bg-red-900/20 dark:text-red-400",
  critical: "bg-red-50 text-red-700 dark:bg-red-900/20 dark:text-red-400",
  medium: "bg-amber-50 text-amber-700 dark:bg-amber-900/20 dark:text-amber-400",
  low: "bg-zinc-100 text-zinc-600 dark:bg-zinc-800 dark:text-zinc-400",
};

// ── Helpers ───────────────────────────────────────────────────────────────────

function formatDate(iso: string | null): string {
  if (!iso) return "—";
  return new Date(iso).toLocaleDateString("it-IT", { day: "2-digit", month: "short" });
}

function formatTimestamp(iso: string): string {
  return new Date(iso).toLocaleDateString("it-IT", { day: "2-digit", month: "short" });
}

function getInitials(name: string): string {
  return name
    .split(/\s+/)
    .map((w) => w[0] ?? "")
    .join("")
    .toUpperCase()
    .slice(0, 2);
}

// ── TaskRow compound component ────────────────────────────────────────────────

function TaskRowBase({ task }: TaskRowProps) {
  const priorityClass = PRIORITY_BADGE[task.priority] ?? PRIORITY_BADGE["low"]!;

  return (
    <div className="flex h-11 items-center gap-3 border-b border-border px-4 hover:bg-accent/50 transition-colors last:border-b-0">
      {/* Title */}
      <Link
        href={`/tasks/${task.id}`}
        className="min-w-0 flex-1 text-sm font-medium text-foreground hover:underline truncate"
      >
        {task.title}
      </Link>

      {/* Priority badge */}
      <span
        className={cn(
          "shrink-0 rounded-full px-2 py-0.5 text-xs font-medium capitalize",
          priorityClass
        )}
      >
        {task.priority}
      </span>

      {/* Agent avatar (initials placeholder) */}
      {task.assigned_agent_id && (
        <div
          className="flex h-6 w-6 shrink-0 items-center justify-center rounded-full bg-muted text-xs font-medium text-muted-foreground"
          title={task.assigned_agent_id}
        >
          {getInitials(task.assigned_agent_id.slice(0, 4))}
        </div>
      )}

      {/* Timestamp */}
      <span className="shrink-0 text-xs text-muted-foreground">
        {formatTimestamp(task.updated_at)}
      </span>
    </div>
  );
}

const TaskRow = TaskRowBase;

// ── Group section ─────────────────────────────────────────────────────────────

interface TaskGroupProps {
  label: string;
  tasks: Task[];
}

function TaskGroup({ label, tasks }: TaskGroupProps) {
  if (tasks.length === 0) return null;

  return (
    <div>
      {/* Group header */}
      <div className="flex items-center gap-2 px-4 py-2">
        <span className="text-xs font-medium uppercase tracking-wide text-muted-foreground">
          {label}
        </span>
        <span className="rounded bg-muted px-1.5 py-0.5 text-xs text-muted-foreground">
          {tasks.length}
        </span>
      </div>

      {/* Task rows */}
      <div className="border-t border-border">
        {tasks.map((task) => (
          <TaskRow key={task.id} task={task} />
        ))}
      </div>
    </div>
  );
}

// ── Header activate button ────────────────────────────────────────────────────

interface ActivateButtonProps {
  sprintId: string;
}

function ActivateButton({ sprintId }: ActivateButtonProps) {
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [, startTransition] = useTransition();
  const router = useRouter();

  async function handleActivate() {
    setLoading(true);
    setError(null);
    try {
      const res = await fetch(`/api/sprints/${sprintId}/start`, { method: "POST" });
      const body = (await res.json()) as { error?: string };
      if (!res.ok) {
        setError(body.error ?? "Errore nell'avvio dello sprint.");
        return;
      }
      startTransition(() => router.refresh());
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="flex flex-col items-end gap-1">
      <button
        type="button"
        disabled={loading}
        onClick={() => void handleActivate()}
        className="inline-flex items-center gap-1.5 rounded-md border border-border px-3 py-1.5 text-sm font-medium transition-colors hover:bg-accent disabled:opacity-40 disabled:cursor-not-allowed"
      >
        {loading ? (
          <>
            <span className="h-3.5 w-3.5 animate-spin rounded-full border-2 border-current border-t-transparent" />
            Avviando...
          </>
        ) : (
          "Avvia Sprint"
        )}
      </button>
      {error && (
        <span className="text-xs text-destructive">{error}</span>
      )}
    </div>
  );
}

// ── SprintDetailGroupedView ───────────────────────────────────────────────────

interface SprintDetailGroupedViewProps {
  sprint: Sprint;
  initialTasks: Task[];
}

export function SprintDetailGroupedView({
  sprint,
  initialTasks,
}: SprintDetailGroupedViewProps) {
  const [tasks, setTasks] = useState(initialTasks);

  // Realtime subscription for active sprints
  useEffect(() => {
    if (sprint.status !== "active") return;

    const supabase = createBrowserClient(
      process.env["NEXT_PUBLIC_SUPABASE_URL"]!,
      process.env["NEXT_PUBLIC_SUPABASE_ANON_KEY"]!
    );

    const channel = supabase
      .channel(`sprint-detail-grouped:${sprint.id}`)
      .on(
        "postgres_changes",
        {
          event: "UPDATE",
          schema: "public",
          table: "tasks",
          filter: `sprint_id=eq.${sprint.id}`,
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
  }, [sprint.id, sprint.status]);

  const statusConfig =
    SPRINT_STATUS_CONFIG[sprint.status] ?? SPRINT_STATUS_CONFIG["planning"]!;
  const startDate = formatDate(sprint.started_at ?? sprint.created_at);
  const endDate = sprint.completed_at
    ? formatDate(sprint.completed_at)
    : null;
  const periodLabel = endDate ? `${startDate} → ${endDate}` : startDate;

  const groups = groupTasks(tasks);
  const groupKeys: GroupKey[] = ["pending", "in_progress", "in_review", "done"];
  const hasAnyTask = tasks.length > 0;

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center gap-3 flex-wrap justify-between">
        <div className="flex items-center gap-3 flex-wrap">
          <h1 className="text-xl font-semibold">{sprint.name}</h1>

          {/* Date range */}
          <div className="flex items-center gap-1.5 text-sm text-muted-foreground">
            <Calendar size={14} />
            <span>{periodLabel}</span>
          </div>

          {/* Status badge */}
          <span
            className={cn(
              "inline-flex items-center rounded-full px-2 py-0.5 text-xs font-medium",
              statusConfig.className
            )}
          >
            {statusConfig.label}
          </span>
        </div>

        {/* Activate button — only if planning */}
        {sprint.status === "planning" && (
          <ActivateButton sprintId={sprint.id} />
        )}
      </div>

      {/* Task list grouped by status */}
      {!hasAnyTask ? (
        <div className="rounded-lg border border-dashed border-border p-12 text-center">
          <p className="text-sm text-muted-foreground">Nessuna task in questo sprint.</p>
          <p className="mt-2">
            <Link
              href="/backlog"
              className="text-sm text-muted-foreground underline underline-offset-2 hover:text-foreground transition-colors"
            >
              Vai al backlog →
            </Link>
          </p>
        </div>
      ) : (
        <div className="overflow-hidden rounded-lg border border-border">
          {groupKeys.map((key) => (
            <TaskGroup
              key={key}
              label={GROUP_LABELS[key]}
              tasks={groups[key]}
            />
          ))}
        </div>
      )}
    </div>
  );
}
