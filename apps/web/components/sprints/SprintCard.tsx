"use client";

import Link from "next/link";
import { cn } from "@/lib/utils";
import type { Sprint } from "@robin/shared-types";

const STATUS_CONFIG: Record<Sprint["status"], { label: string; className: string }> = {
  planning: { label: "In pianificazione", className: "text-blue-600 bg-blue-100 dark:bg-blue-900/30" },
  active: { label: "Attivo", className: "text-green-600 bg-green-100 dark:bg-green-900/30" },
  completed: { label: "Completato", className: "text-slate-500 bg-slate-100 dark:bg-slate-800" },
  cancelled: { label: "Annullato", className: "text-red-500 bg-red-100 dark:bg-red-900/30" },
};

interface SprintCardProps {
  sprint: Sprint;
  taskCount?: number | undefined;
}

export function SprintCard({ sprint, taskCount }: SprintCardProps) {
  const config = STATUS_CONFIG[sprint.status];
  const startedDate = sprint.started_at
    ? new Date(sprint.started_at).toLocaleDateString("it-IT", { day: "2-digit", month: "short" })
    : null;
  const completedDate = sprint.completed_at
    ? new Date(sprint.completed_at).toLocaleDateString("it-IT", { day: "2-digit", month: "short" })
    : null;

  return (
    <Link href={`/sprints/${sprint.id}`}>
      <div className="rounded-lg border border-border bg-card p-4 transition-colors hover:border-primary/50 hover:bg-accent/30">
        <div className="flex items-start justify-between gap-3">
          <div className="min-w-0">
            <h3 className="truncate font-semibold">{sprint.name}</h3>
            {sprint.goal && (
              <p className="mt-0.5 truncate text-sm text-muted-foreground">{sprint.goal}</p>
            )}
          </div>
          <span className={cn("shrink-0 rounded-full px-2 py-0.5 text-xs font-medium", config.className)}>
            {config.label}
          </span>
        </div>

        <div className="mt-3 flex items-center gap-4 text-xs text-muted-foreground">
          {taskCount !== undefined && (
            <span>{taskCount} task</span>
          )}
          {sprint.status === "completed" && (
            <>
              <span>{sprint.tasks_completed} completate</span>
              {sprint.tasks_failed > 0 && <span className="text-red-500">{sprint.tasks_failed} fallite</span>}
              {sprint.avg_cycle_time_minutes && (
                <span>cycle time: {sprint.avg_cycle_time_minutes}min</span>
              )}
            </>
          )}
          {startedDate && <span>Avviato {startedDate}</span>}
          {completedDate && <span>Chiuso {completedDate}</span>}
          {!startedDate && sprint.status === "planning" && (
            <span>Creato {new Date(sprint.created_at).toLocaleDateString("it-IT", { day: "2-digit", month: "short" })}</span>
          )}
        </div>
      </div>
    </Link>
  );
}
