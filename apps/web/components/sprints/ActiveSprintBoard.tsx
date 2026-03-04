"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { createBrowserClient } from "@supabase/ssr";
import { SprintProgressBar } from "./SprintProgressBar";
import { cn } from "@/lib/utils";
import type { Task } from "@robin/shared-types";

const STATUS_CONFIG: Record<string, { label: string; className: string }> = {
  backlog:        { label: "Backlog",       className: "text-slate-500 bg-slate-100 dark:bg-slate-800" },
  sprint_ready:   { label: "Pronta",        className: "text-blue-500 bg-blue-50 dark:bg-blue-900/20" },
  pending:        { label: "In attesa",     className: "text-slate-500 bg-slate-100 dark:bg-slate-800" },
  queued:         { label: "In coda",       className: "text-slate-600 bg-slate-100 dark:bg-slate-800" },
  in_progress:    { label: "In esecuzione", className: "text-blue-600 bg-blue-100 dark:bg-blue-900/30" },
  rework:         { label: "Rework",        className: "text-orange-600 bg-orange-100 dark:bg-orange-900/30" },
  in_review:      { label: "In review",     className: "text-gray-700 bg-gray-100 dark:bg-gray-800/30" },
  review_pending: { label: "Review pending", className: "text-gray-600 bg-gray-50 dark:bg-gray-800/20" },
  approved:       { label: "Approvata",     className: "text-green-600 bg-green-100 dark:bg-green-900/30" },
  done:           { label: "Completata",    className: "text-green-600 bg-green-100 dark:bg-green-900/30" },
  completed:      { label: "Completata",    className: "text-green-600 bg-green-100 dark:bg-green-900/30" },
  rejected:       { label: "Rifiutata",     className: "text-red-600 bg-red-100 dark:bg-red-900/30" },
  failed:         { label: "Fallita",       className: "text-red-600 bg-red-100 dark:bg-red-900/30" },
  cancelled:      { label: "Annullata",     className: "text-slate-400 bg-slate-100 dark:bg-slate-800" },
};

const PRIORITY_CONFIG: Record<string, { label: string; icon: string; className: string }> = {
  critical: { label: "Critical", icon: "↑↑", className: "text-red-600" },
  urgent:   { label: "Urgent",   icon: "↑↑", className: "text-orange-600" },
  high:     { label: "High",     icon: "↑",  className: "text-yellow-600" },
  medium:   { label: "Medium",   icon: "=",  className: "text-slate-500" },
  low:      { label: "Low",      icon: "—",  className: "text-slate-400" },
};

// Sort order for statuses
const STATUS_ORDER = [
  "in_progress", "rework", "in_review", "review_pending",
  "queued", "sprint_ready", "pending", "backlog",
  "approved", "done", "completed", "rejected", "failed", "cancelled",
];

interface ActiveSprintBoardProps {
  initialTasks: Task[];
  sprintId: string;
  workspaceId: string;
}

export function ActiveSprintBoard({ initialTasks, sprintId, workspaceId }: ActiveSprintBoardProps) {
  const [tasks, setTasks] = useState<Task[]>(initialTasks);

  useEffect(() => {
    const supabase = createBrowserClient(
      process.env["NEXT_PUBLIC_SUPABASE_URL"]!,
      process.env["NEXT_PUBLIC_SUPABASE_ANON_KEY"]!
    );

    const channel = supabase
      .channel(`sprint-board:${sprintId}`)
      .on(
        "postgres_changes",
        {
          event: "UPDATE",
          schema: "public",
          table: "tasks",
          filter: `sprint_id=eq.${sprintId}`,
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
  }, [sprintId, workspaceId]);

  const sorted = [...tasks].sort((a, b) => {
    const ai = STATUS_ORDER.indexOf(a.status);
    const bi = STATUS_ORDER.indexOf(b.status);
    return (ai === -1 ? 99 : ai) - (bi === -1 ? 99 : bi);
  });

  return (
    <div className="space-y-4">
      <SprintProgressBar tasks={tasks} />

      {tasks.length === 0 ? (
        <p className="text-sm text-muted-foreground">Nessuna task in questo sprint.</p>
      ) : (
        <div className="overflow-x-auto rounded-md border border-border">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-border bg-muted/40 text-xs uppercase tracking-wide text-muted-foreground">
                <th className="px-4 py-2.5 text-left font-medium">Titolo</th>
                <th className="px-4 py-2.5 text-left font-medium">Stato</th>
                <th className="px-4 py-2.5 text-left font-medium">Priorità</th>
                <th className="px-4 py-2.5 text-left font-medium">Tipo</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-border">
              {sorted.map((task) => {
                const status = STATUS_CONFIG[task.status] ?? { label: task.status, className: "text-muted-foreground bg-muted" };
                const priority = task.priority ? PRIORITY_CONFIG[task.priority] : null;

                return (
                  <tr
                    key={task.id}
                    className="transition-colors hover:bg-accent/30"
                  >
                    <td className="px-4 py-3">
                      <Link
                        href={`/tasks/${task.id}`}
                        className="font-medium hover:text-primary hover:underline"
                      >
                        {task.title}
                      </Link>
                    </td>
                    <td className="px-4 py-3">
                      <span className={cn("rounded-full px-2 py-0.5 text-xs font-medium", status.className)}>
                        {status.label}
                      </span>
                    </td>
                    <td className="px-4 py-3">
                      {priority ? (
                        <span className={cn("font-medium", priority.className)}>
                          {priority.icon} {priority.label}
                        </span>
                      ) : (
                        <span className="text-muted-foreground">—</span>
                      )}
                    </td>
                    <td className="px-4 py-3 capitalize text-muted-foreground">
                      {task.type ?? "—"}
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}
