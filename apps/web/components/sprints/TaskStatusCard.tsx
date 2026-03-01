"use client";

import Link from "next/link";
import { cn } from "@/lib/utils";
import type { Task } from "@robin/shared-types";

const STATUS_CONFIG: Record<string, { label: string; className: string }> = {
  queued: { label: "In coda", className: "text-slate-500 bg-slate-100 dark:bg-slate-800" },
  in_progress: { label: "In esecuzione", className: "text-blue-600 bg-blue-100 dark:bg-blue-900/30 animate-pulse" },
  in_review: { label: "In review", className: "text-purple-600 bg-purple-100 dark:bg-purple-900/30" },
  rework: { label: "Rework", className: "text-orange-600 bg-orange-100 dark:bg-orange-900/30" },
  done: { label: "Completata", className: "text-green-600 bg-green-100 dark:bg-green-900/30" },
  completed: { label: "Completata", className: "text-green-600 bg-green-100 dark:bg-green-900/30" },
  failed: { label: "Fallita", className: "text-red-600 bg-red-100 dark:bg-red-900/30" },
  cancelled: { label: "Annullata", className: "text-slate-400 bg-slate-100 dark:bg-slate-800" },
  sprint_ready: { label: "Pronta", className: "text-blue-500 bg-blue-50 dark:bg-blue-900/20" },
};

interface TaskStatusCardProps {
  task: Task;
  agentName?: string | null;
}

export function TaskStatusCard({ task, agentName }: TaskStatusCardProps) {
  const config = STATUS_CONFIG[task.status] ?? { label: task.status, className: "text-muted-foreground bg-muted" };

  return (
    <Link href={`/tasks/${task.id}`}>
      <div className="rounded-md border border-border bg-card p-3 transition-colors hover:border-primary/30 hover:bg-accent/20">
        <div className="flex items-start justify-between gap-2">
          <p className="line-clamp-2 text-sm font-medium">{task.title}</p>
          <span className={cn("shrink-0 rounded-full px-2 py-0.5 text-xs font-medium whitespace-nowrap", config.className)}>
            {config.label}
          </span>
        </div>

        <div className="mt-2 flex items-center gap-2 text-xs text-muted-foreground">
          {agentName && <span>Agente: {agentName}</span>}
          {task.type && <span className="capitalize">{task.type}</span>}
          {task.priority && <span className="capitalize">{task.priority}</span>}
        </div>
      </div>
    </Link>
  );
}
