"use client";

import Link from "next/link";
import { useRelativeTime } from "@/lib/hooks/useRelativeTime";
import { cn } from "@/lib/utils";
import type { ADWPPhase } from "@robin/shared-types";
import type { ActiveTaskData } from "@/lib/db/dashboard";

const phaseConfig: Record<
  ADWPPhase,
  { label: string; class: string }
> = {
  analysis: { label: "Analysis", class: "bg-sky-100 text-sky-700 dark:bg-sky-900/30 dark:text-sky-400" },
  design: { label: "Design", class: "bg-gray-100 text-gray-700 dark:bg-gray-800/30 dark:text-gray-400" },
  write: { label: "Write", class: "bg-brand-100 text-brand-700 dark:bg-brand-900/30 dark:text-brand-400" },
  proof: { label: "Proof", class: "bg-amber-100 text-amber-700 dark:bg-amber-900/30 dark:text-amber-400" },
};

interface ActiveTaskCardProps {
  task: ActiveTaskData | null;
}

/**
 * Shows the currently active task in the dashboard.
 * When no task is active, displays an empty state with a CTA.
 */
export function ActiveTaskCard({ task }: ActiveTaskCardProps) {
  if (!task) {
    return (
      <div className="flex flex-col items-center justify-center rounded-xl border border-dashed border-border bg-card px-6 py-10 text-center">
        <p className="font-semibold text-foreground">Nessuna task attiva</p>
        <p className="mt-1 text-sm text-muted-foreground">
          L&apos;agente è pronto — nessuna task in coda.
        </p>
        <Link
          href="/tasks/new"
          className="mt-4 rounded-lg bg-primary px-4 py-2 text-sm font-semibold text-primary-foreground hover:opacity-90 transition-opacity"
        >
          Crea una task
        </Link>
      </div>
    );
  }

  return <ActiveTaskContent task={task} />;
}

function ActiveTaskContent({ task }: { task: ActiveTaskData }) {
  const elapsed = useRelativeTime(task.created_at);
  const phase = task.projectedState.currentPhase;

  return (
    <div className="rounded-xl border border-border bg-card p-6">
      <div className="flex items-start justify-between gap-4">
        <div className="min-w-0 flex-1">
          <p className="text-xs font-medium uppercase tracking-wide text-muted-foreground">
            Task in corso
          </p>
          <p className="mt-0.5 truncate text-lg font-semibold text-foreground">
            {task.title}
          </p>
        </div>
        {phase && (
          <span
            className={cn(
              "flex-shrink-0 rounded-full px-2.5 py-0.5 text-xs font-semibold",
              phaseConfig[phase]?.class ??
                "bg-muted text-muted-foreground"
            )}
          >
            {phaseConfig[phase]?.label ?? phase}
          </span>
        )}
      </div>

      <div className="mt-3 flex items-center gap-4 text-sm text-muted-foreground">
        <span>Iniziata {elapsed}</span>
        {task.projectedState.prUrl && (
          <a
            href={task.projectedState.prUrl}
            target="_blank"
            rel="noopener noreferrer"
            className="text-brand-600 hover:underline dark:text-brand-400"
          >
            PR aperta ↗
          </a>
        )}
      </div>

      <div className="mt-4 flex items-center justify-end">
        <Link
          href={`/tasks/${task.id}`}
          className="text-sm font-medium text-primary hover:underline"
        >
          Vai alla task →
        </Link>
      </div>
    </div>
  );
}

export function ActiveTaskSkeleton() {
  return (
    <div className="rounded-xl border border-border bg-card p-6 animate-pulse">
      <div className="h-4 w-24 rounded bg-muted" />
      <div className="mt-1.5 h-6 w-3/4 rounded bg-muted" />
      <div className="mt-3 h-4 w-32 rounded bg-muted" />
    </div>
  );
}
