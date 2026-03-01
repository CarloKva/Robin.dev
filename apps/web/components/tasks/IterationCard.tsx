"use client";

import { useState } from "react";
import { ChevronDown, ExternalLink } from "lucide-react";
import type { TaskIteration, TimelineEntry } from "@robin/shared-types";
import { Timeline } from "@/components/timeline/Timeline";
import { cn } from "@/lib/utils";

// ── Label maps ────────────────────────────────────────────────────────────────

const TRIGGER_LABEL: Record<TaskIteration["trigger"], string> = {
  original: "Esecuzione originale",
  github_rework: "Rework da commenti GitHub",
  dashboard_rework: "Rework dalla dashboard",
};

const STATUS_BADGE: Record<TaskIteration["status"], string> = {
  pending:   "bg-neutral-100 text-neutral-600 dark:bg-neutral-800 dark:text-neutral-400",
  running:   "bg-sky-100 text-sky-700 dark:bg-sky-900/30 dark:text-sky-400",
  completed: "bg-emerald-100 text-emerald-700 dark:bg-emerald-900/30 dark:text-emerald-400",
  failed:    "bg-red-100 text-red-700 dark:bg-red-900/30 dark:text-red-400",
};

const STATUS_LABEL: Record<TaskIteration["status"], string> = {
  pending:   "In attesa",
  running:   "In corso",
  completed: "Completata",
  failed:    "Fallita",
};

// ── Helpers ───────────────────────────────────────────────────────────────────

function formatDate(iso: string | null): string {
  if (!iso) return "—";
  return new Date(iso).toLocaleDateString("it-IT", {
    day: "numeric",
    month: "short",
    year: "numeric",
    hour: "2-digit",
    minute: "2-digit",
  });
}

/**
 * Filters timeline entries that belong to this iteration by time range.
 * Uses iteration started_at as lower bound and next iteration started_at
 * (or current time for the last one) as upper bound.
 */
function filterEvents(
  events: TimelineEntry[],
  iteration: TaskIteration,
  nextIterationStartedAt: string | null
): TimelineEntry[] {
  if (!iteration.started_at) return [];

  const from = new Date(iteration.started_at).getTime();
  const to = nextIterationStartedAt
    ? new Date(nextIterationStartedAt).getTime()
    : Infinity;

  return events.filter((e) => {
    const t = new Date(e.created_at).getTime();
    return t >= from && t < to;
  });
}

// ── Component ─────────────────────────────────────────────────────────────────

interface IterationCardProps {
  iteration: TaskIteration;
  isCurrent: boolean;
  allEvents: TimelineEntry[];
  nextIterationStartedAt: string | null;
}

export function IterationCard({
  iteration,
  isCurrent,
  allEvents,
  nextIterationStartedAt,
}: IterationCardProps) {
  const [expanded, setExpanded] = useState(isCurrent);

  const filteredEvents = filterEvents(allEvents, iteration, nextIterationStartedAt);

  const label =
    iteration.iteration_number === 1
      ? `#1 — Esecuzione originale`
      : `#${iteration.iteration_number} — Rework`;

  return (
    <div
      className={cn(
        "rounded-xl border bg-card transition-colors",
        isCurrent
          ? "border-brand-400 ring-1 ring-brand-400/30 dark:border-brand-500"
          : "border-border"
      )}
    >
      {/* Header (always visible) */}
      <button
        type="button"
        onClick={() => setExpanded((o) => !o)}
        className="flex w-full items-start gap-3 p-4 text-left"
        aria-expanded={expanded}
      >
        {/* Iteration number badge */}
        <span className="mt-0.5 flex h-6 w-6 flex-shrink-0 items-center justify-center rounded-full bg-muted text-xs font-semibold text-muted-foreground">
          {iteration.iteration_number}
        </span>

        <div className="flex-1 min-w-0 space-y-1">
          {/* Title row */}
          <div className="flex flex-wrap items-center gap-2">
            <span className="text-sm font-semibold text-foreground truncate">
              {label}
            </span>
            {isCurrent && (
              <span className="rounded-full bg-brand-100 px-2 py-0.5 text-xs font-medium text-brand-700 dark:bg-brand-900/30 dark:text-brand-400">
                Corrente
              </span>
            )}
          </div>

          {/* Trigger + status */}
          <div className="flex flex-wrap items-center gap-2 text-xs text-muted-foreground">
            <span>{TRIGGER_LABEL[iteration.trigger]}</span>
            <span
              className={cn(
                "rounded-full px-2 py-0.5 font-medium",
                STATUS_BADGE[iteration.status]
              )}
            >
              {STATUS_LABEL[iteration.status]}
            </span>
          </div>

          {/* Dates */}
          <div className="flex flex-wrap gap-x-4 gap-y-0.5 text-xs text-muted-foreground">
            <span>Iniziata: {formatDate(iteration.started_at)}</span>
            {iteration.completed_at && (
              <span>Completata: {formatDate(iteration.completed_at)}</span>
            )}
          </div>

          {/* PR link */}
          {iteration.pr_url && (
            <a
              href={iteration.pr_url}
              target="_blank"
              rel="noopener noreferrer"
              onClick={(e) => e.stopPropagation()}
              className="inline-flex items-center gap-1 text-xs text-brand-600 hover:underline dark:text-brand-400"
            >
              <ExternalLink className="h-3 w-3" />
              Pull Request
            </a>
          )}

          {/* Summary */}
          {iteration.summary && (
            <p className="text-xs text-muted-foreground line-clamp-2">
              {iteration.summary}
            </p>
          )}
        </div>

        <ChevronDown
          className={cn(
            "mt-0.5 h-4 w-4 flex-shrink-0 text-muted-foreground transition-transform",
            expanded && "rotate-180"
          )}
        />
      </button>

      {/* Expanded: filtered timeline */}
      {expanded && (
        <div className="border-t border-border px-4 pb-4 pt-3">
          <Timeline
            entries={filteredEvents}
            emptyMessage="Nessun evento per questa iterazione."
          />
        </div>
      )}
    </div>
  );
}
