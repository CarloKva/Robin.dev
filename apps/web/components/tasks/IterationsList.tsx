"use client";

import type { TaskIteration, TimelineEntry } from "@robin/shared-types";
import { IterationCard } from "./IterationCard";

interface IterationsListProps {
  iterations: TaskIteration[];
  allEvents: TimelineEntry[];
}

export function IterationsList({ iterations, allEvents }: IterationsListProps) {
  if (iterations.length === 0) return null;

  const maxNumber = Math.max(...iterations.map((i) => i.iteration_number));

  return (
    <div>
      <h3 className="mb-3 text-xs font-semibold uppercase tracking-wide text-muted-foreground">
        Iterazioni
      </h3>
      <div className="relative">
        {/* Vertical connector line */}
        <div
          className="absolute left-[13px] top-3.5 bottom-3.5 w-0.5 bg-[#D1D1D6] dark:bg-[#38383A]"
          aria-hidden="true"
        />
        <div className="space-y-3">
          {iterations.map((iteration, index) => {
            const next = iterations[index + 1] ?? null;
            return (
              <IterationCard
                key={iteration.id}
                iteration={iteration}
                isCurrent={iteration.iteration_number === maxNumber}
                allEvents={allEvents}
                nextIterationStartedAt={next?.started_at ?? null}
                stepIndex={index}
              />
            );
          })}
        </div>
      </div>
    </div>
  );
}
