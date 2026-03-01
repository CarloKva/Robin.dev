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
    <div className="rounded-xl border border-border bg-card p-4 space-y-3">
      <h3 className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">
        Iterazioni
      </h3>
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
            />
          );
        })}
      </div>
    </div>
  );
}
