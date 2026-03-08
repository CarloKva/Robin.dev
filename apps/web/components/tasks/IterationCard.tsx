"use client";

import { useState } from "react";
import { AlertCircle, ChevronDown, ExternalLink } from "lucide-react";
import type { TaskIteration, TimelineEntry } from "@robin/shared-types";
import { cn } from "@/lib/utils";

// ── Label maps ────────────────────────────────────────────────────────────────

const TRIGGER_LABEL: Record<TaskIteration["trigger"], string> = {
  initial: "Esecuzione originale",
  github_comment: "Rework da commenti GitHub",
  dashboard: "Rework dalla dashboard",
};

// ── Helpers ───────────────────────────────────────────────────────────────────

function formatTimestamp(iso: string | null): string {
  if (!iso) return "—";
  return new Date(iso).toLocaleDateString("it-IT", {
    day: "numeric",
    month: "short",
    year: "numeric",
    hour: "2-digit",
    minute: "2-digit",
  });
}

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

// ── Dot state ─────────────────────────────────────────────────────────────────

type DotState = "completed" | "current" | "failed" | "waiting";

function getDotState(
  iteration: TaskIteration,
  isCurrent: boolean
): DotState {
  if (isCurrent) return "current";
  if (iteration.status === "completed") return "completed";
  if (iteration.status === "failed") return "failed";
  return "waiting";
}

// ── Component ─────────────────────────────────────────────────────────────────

interface IterationCardProps {
  iteration: TaskIteration;
  isCurrent: boolean;
  allEvents: TimelineEntry[];
  nextIterationStartedAt: string | null;
  stepIndex: number;
}

export function IterationCard({
  iteration,
  isCurrent,
  allEvents,
  nextIterationStartedAt,
  stepIndex,
}: IterationCardProps) {
  const [expanded, setExpanded] = useState(isCurrent);

  const dotState = getDotState(iteration, isCurrent);
  const isError = iteration.status === "failed";
  const filteredEvents = filterEvents(allEvents, iteration, nextIterationStartedAt);

  const snippet =
    iteration.summary ??
    (filteredEvents.length > 0
      ? filteredEvents.map((e) => e.narrative).join("\n")
      : null);

  const timestamp = formatTimestamp(
    iteration.started_at ?? iteration.created_at
  );

  return (
    <div
      className="animate-iteration-step relative"
      style={{ animationDelay: `${stepIndex * 80}ms` }}
    >
      {/* Dot — absolutely positioned to sit on the connector line */}
      <div
        className={cn(
          "absolute -left-9 flex items-center justify-center rounded-full text-xs font-semibold select-none z-10",
          "h-7 w-7",
          dotState === "completed" &&
            "bg-[#34C759] text-white",
          dotState === "current" &&
            "bg-[#007AFF] text-white",
          dotState === "failed" &&
            "bg-red-500 text-white",
          dotState === "waiting" &&
            "bg-[#F2F2F7] dark:bg-[#2C2C2E] text-[#8E8E93] border border-[#D1D1D6] dark:border-[#48484A]"
        )}
      >
        {iteration.iteration_number}

        {/* Pulsing ring for current step */}
        {dotState === "current" && (
          <span
            className="absolute inset-0 rounded-full animate-ping bg-[#007AFF] opacity-30"
            aria-hidden="true"
          />
        )}
      </div>

      {/* Card */}
      <div
        className={cn(
          "rounded-xl border transition-colors",
          isCurrent
            ? "border-[#007AFF]/30 bg-[#007AFF]/5"
            : isError
            ? "border-red-400/40 bg-card"
            : "border-border bg-card"
        )}
      >
        {/* Header — always visible */}
        <button
          type="button"
          onClick={() => setExpanded((o) => !o)}
          className="flex w-full items-center gap-2 px-4 py-3 text-left"
          aria-expanded={expanded}
        >
          {isError && (
            <AlertCircle className="h-4 w-4 flex-shrink-0 text-red-500" />
          )}

          <div className="flex-1 min-w-0">
            <span className="font-medium text-sm text-foreground truncate block">
              {TRIGGER_LABEL[iteration.trigger]}
            </span>
            <span className="text-xs text-[#8E8E93]">{timestamp}</span>
          </div>

          {iteration.pr_url && (
            <a
              href={iteration.pr_url}
              target="_blank"
              rel="noopener noreferrer"
              onClick={(e) => e.stopPropagation()}
              className="flex-shrink-0 text-[#007AFF] hover:opacity-70 transition-opacity"
              aria-label="Pull Request"
            >
              <ExternalLink className="h-3.5 w-3.5" />
            </a>
          )}

          <ChevronDown
            className={cn(
              "flex-shrink-0 h-4 w-4 text-[#8E8E93] transition-transform duration-200",
              expanded && "rotate-180"
            )}
          />
        </button>

        {/* Body — collapsible */}
        <div
          className={cn(
            "overflow-hidden transition-[max-height] duration-[250ms] ease-in-out",
            expanded ? "max-h-64" : "max-h-0"
          )}
        >
          <div
            className={cn(
              "border-t px-4 pb-4 pt-3",
              isError ? "border-red-400/40" : "border-border"
            )}
          >
            {snippet ? (
              <div
                className={cn(
                  "font-mono text-xs rounded-lg p-3 max-h-32 overflow-y-auto",
                  "bg-gray-50 dark:bg-[#2C2C2E]",
                  isError && "border border-red-400/60"
                )}
              >
                <pre className="whitespace-pre-wrap break-words">{snippet}</pre>
              </div>
            ) : (
              <p className="text-xs text-[#8E8E93]">Nessun output disponibile.</p>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
