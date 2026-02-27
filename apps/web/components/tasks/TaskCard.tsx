import Link from "next/link";
import { cn } from "@/lib/utils";
import type { Task, TaskStatus, TaskType, TaskPriority } from "@robin/shared-types";

// ── Status config ─────────────────────────────────────────────────────────────

const statusConfig: Record<
  TaskStatus,
  { label: string; badge: string; border: string }
> = {
  pending: {
    label: "Pending",
    badge: "bg-neutral-100 text-neutral-600 dark:bg-neutral-800 dark:text-neutral-400",
    border: "border-l-neutral-300",
  },
  queued: {
    label: "In coda",
    badge: "bg-sky-100 text-sky-700 dark:bg-sky-900/30 dark:text-sky-400",
    border: "border-l-sky-400",
  },
  in_progress: {
    label: "In corso",
    badge: "bg-brand-100 text-brand-700 dark:bg-brand-900/30 dark:text-brand-400",
    border: "border-l-brand-500",
  },
  review_pending: {
    label: "In review",
    badge: "bg-amber-100 text-amber-700 dark:bg-amber-900/30 dark:text-amber-500",
    border: "border-l-amber-400",
  },
  approved: {
    label: "Approvata",
    badge: "bg-emerald-100 text-emerald-700 dark:bg-emerald-900/30 dark:text-emerald-400",
    border: "border-l-emerald-400",
  },
  rejected: {
    label: "Rifiutata",
    badge: "bg-red-100 text-red-700 dark:bg-red-900/30 dark:text-red-400",
    border: "border-l-red-400",
  },
  completed: {
    label: "Completata",
    badge: "bg-emerald-100 text-emerald-800 dark:bg-emerald-900/30 dark:text-emerald-300",
    border: "border-l-emerald-500",
  },
  failed: {
    label: "Fallita",
    badge: "bg-red-100 text-red-800 dark:bg-red-900/30 dark:text-red-300",
    border: "border-l-red-500",
  },
  cancelled: {
    label: "Annullata",
    badge: "bg-neutral-100 text-neutral-500 dark:bg-neutral-800 dark:text-neutral-500",
    border: "border-l-neutral-300",
  },
  backlog: {
    label: "Backlog",
    badge: "bg-neutral-100 text-neutral-500 dark:bg-neutral-800 dark:text-neutral-400",
    border: "border-l-neutral-200",
  },
};

// ── Priority config ───────────────────────────────────────────────────────────

const priorityConfig: Record<TaskPriority, { label: string; dot: string }> = {
  low: { label: "Low", dot: "bg-neutral-400" },
  medium: { label: "Medium", dot: "bg-amber-400" },
  high: { label: "High", dot: "bg-orange-500" },
  urgent: { label: "Urgent", dot: "bg-red-600" },
};

// ── Type config ───────────────────────────────────────────────────────────────

const typeConfig: Record<
  TaskType,
  { label: string; class: string }
> = {
  bug: { label: "Bug", class: "bg-red-50 text-red-600 dark:bg-red-950/30 dark:text-red-400" },
  feature: { label: "Feature", class: "bg-brand-50 text-brand-600 dark:bg-brand-950/30 dark:text-brand-400" },
  docs: { label: "Docs", class: "bg-sky-50 text-sky-600 dark:bg-sky-950/30 dark:text-sky-400" },
  refactor: { label: "Refactor", class: "bg-purple-50 text-purple-600 dark:bg-purple-950/30 dark:text-purple-400" },
  chore: { label: "Chore", class: "bg-neutral-50 text-neutral-600 dark:bg-neutral-950/30 dark:text-neutral-400" },
};

// ── Component ─────────────────────────────────────────────────────────────────

interface TaskCardProps {
  task: Task & { liveStatus?: TaskStatus };
  isActive?: boolean;
}

/**
 * A single task row in the task list.
 * Presentational — all live data must be resolved before passing.
 */
export function TaskCard({ task, isActive = false }: TaskCardProps) {
  const status = task.liveStatus ?? task.status;
  const sConf = statusConfig[status] ?? statusConfig.pending;
  const pConf = priorityConfig[task.priority] ?? priorityConfig.medium;
  const tConf = typeConfig[task.type] ?? typeConfig.feature;

  const isAttention = status === "failed";
  const date = new Date(task.created_at).toLocaleDateString("it-IT", {
    day: "numeric",
    month: "short",
  });

  return (
    <Link
      href={`/tasks/${task.id}`}
      className={cn(
        "group flex items-center gap-3 rounded-lg border border-l-[3px] bg-card px-4 py-3.5 transition-colors hover:bg-accent/50",
        sConf.border,
        isAttention &&
          "border-red-200 bg-red-50/30 dark:border-red-800 dark:bg-red-950/10"
      )}
    >
      {/* Active pulse dot */}
      <span
        className={cn(
          "h-2 w-2 flex-shrink-0 rounded-full",
          isActive ? "bg-brand-500 animate-pulse" : "bg-transparent"
        )}
      />

      {/* Main content */}
      <div className="min-w-0 flex-1">
        <p className="truncate text-sm font-medium text-foreground">
          {task.title}
        </p>
        <div className="mt-1 flex items-center gap-2 text-xs text-muted-foreground">
          <span className="flex items-center gap-1">
            <span className={cn("h-1.5 w-1.5 rounded-full", pConf.dot)} />
            {pConf.label}
          </span>
          <span>·</span>
          <span>{date}</span>
        </div>
      </div>

      {/* Badges */}
      <div className="flex flex-shrink-0 items-center gap-2">
        <span
          className={cn(
            "hidden rounded px-1.5 py-0.5 text-xs font-medium sm:inline-block",
            tConf.class
          )}
        >
          {tConf.label}
        </span>
        <span
          className={cn(
            "rounded-full px-2.5 py-0.5 text-xs font-medium",
            sConf.badge
          )}
        >
          {sConf.label}
        </span>
      </div>
    </Link>
  );
}

export function TaskCardSkeleton() {
  return (
    <div className="flex items-center gap-3 rounded-lg border border-border bg-card px-4 py-3.5 animate-pulse">
      <div className="h-2 w-2 rounded-full bg-muted flex-shrink-0" />
      <div className="flex-1 space-y-2">
        <div className="h-4 w-2/3 rounded bg-muted" />
        <div className="h-3 w-1/4 rounded bg-muted" />
      </div>
      <div className="h-5 w-20 rounded-full bg-muted" />
    </div>
  );
}
