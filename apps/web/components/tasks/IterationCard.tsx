"use client";

import { useEffect, useState } from "react";
import { AlertCircle, ChevronDown, ExternalLink } from "lucide-react";
import type { TaskIteration, TimelineEntry } from "@robin/shared-types";
import { Timeline } from "@/components/timeline/Timeline";
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
  const [visible, setVisible] = useState(false);

  useEffect(() => {
    const timer = setTimeout(() => setVisible(true), stepIndex * 80);
    return () => clearTimeout(timer);
  }, [stepIndex]);

  const filteredEvents = filterEvents(allEvents, iteration, nextIterationStartedAt);
  const isError = iteration.status === "failed";

  // Dot visual state
  const dotState: "current" | "completed" | "waiting" =
    isCurrent
      ? "current"
      : iteration.status === "completed"
      ? "completed"
      : "waiting";

  const timestamp = formatTimestamp(
    iteration.started_at ?? iteration.created_at
  );

  return (
    <div
      className="relative flex gap-3"
      style={{
        opacity: visible ? 1 : 0,
        transform: visible ? "translateX(0)" : "translateX(-8px)",
        transition: "opacity 300ms ease, transform 300ms ease",
      }}
    >
      {/* Numbered dot — sits on the vertical connector line */}
      <div className="relative z-10 shrink-0">
        {/* Pulsing ring for current step */}
        {dotState === "current" && (
          <span
            className="absolute inset-0 rounded-full animate-ping bg-[#007AFF] opacity-30"
            aria-hidden="true"
          />
        )}
        <div
          className={cn(
            "relative flex h-7 w-7 items-center justify-center rounded-full text-xs font-semibold select-none",
            dotState === "current" && "bg-[#007AFF] text-white",
            dotState === "completed" && "bg-[#34C759] text-white",
            dotState === "waiting" &&
              "border border-[#D1D1D6] bg-[#F2F2F7] text-[#8E8E93] dark:border-[#48484A] dark:bg-[#2C2C2E] dark:text-[#8E8E93]"
          )}
        >
          {iteration.iteration_number}
        </div>
      </div>

      {/* Step card */}
      <div
        className={cn(
          "flex-1 min-w-0 rounded-xl border bg-card overflow-hidden",
          isCurrent && !isError
            ? "border-[#007AFF]/30 bg-[#007AFF]/5"
            : isError
            ? "border-red-400/40 dark:border-red-800/60"
            : "border-border"
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

          {iteration.pr_url !== null && (
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

        {/* Body — collapsible with max-height transition */}
        <div
          className="overflow-hidden"
          style={{
            maxHeight: expanded ? "1000px" : "0",
            transition: "max-height 250ms ease",
          }}
        >
          <div
            className={cn(
              "border-t px-4 pb-4 pt-3 space-y-2",
              isError ? "border-red-400/40 dark:border-red-800/60" : "border-border"
            )}
          >
            {/* Output snippet */}
            {iteration.summary !== null ? (
              <div
                className={cn(
                  "font-mono text-xs rounded-ios-sm p-3 max-h-32 overflow-y-auto",
                  "bg-gray-50 dark:bg-[#2C2C2E]",
                  isError && "border border-red-400/60"
                )}
              >
                <pre className="whitespace-pre-wrap break-words">{iteration.summary}</pre>
              </div>
            ) : (
              filteredEvents.length === 0 && (
                <p className="text-xs text-[#8E8E93]">Nessun output disponibile.</p>
              )
            )}

            {/* Filtered events timeline */}
            {filteredEvents.length > 0 && (
              <div className="mt-1">
                <Timeline
                  entries={filteredEvents}
                  emptyMessage="Nessun evento per questa iterazione."
                />
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
