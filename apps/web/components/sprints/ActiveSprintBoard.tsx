"use client";

import { useEffect, useState } from "react";
import { createBrowserClient } from "@supabase/ssr";
import { TaskStatusCard } from "./TaskStatusCard";
import { SprintProgressBar } from "./SprintProgressBar";
import type { Task } from "@robin/shared-types";

const ACTIVE_GROUPS = [
  {
    label: "In coda",
    statuses: ["queued", "sprint_ready", "pending"],
    emptyLabel: "Nessuna task in coda",
  },
  {
    label: "In esecuzione",
    statuses: ["in_progress", "rework"],
    emptyLabel: "Nessuna task in esecuzione",
  },
  {
    label: "In review",
    statuses: ["in_review", "review_pending"],
    emptyLabel: "Nessuna task in review",
  },
  {
    label: "Completate",
    statuses: ["done", "completed", "approved"],
    emptyLabel: "Nessuna task completata",
  },
  {
    label: "Fallite / Annullate",
    statuses: ["failed", "cancelled", "rejected"],
    emptyLabel: null,
  },
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

    // Subscribe to task changes for this sprint
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

  return (
    <div className="space-y-6">
      <SprintProgressBar tasks={tasks} />

      <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-4 xl:grid-cols-5">
        {ACTIVE_GROUPS.map(({ label, statuses, emptyLabel }) => {
          const grouped = tasks.filter((t) => statuses.includes(t.status));
          if (grouped.length === 0 && emptyLabel === null) return null;

          return (
            <div key={label} className="space-y-2">
              <h3 className="text-sm font-semibold text-muted-foreground uppercase tracking-wide">
                {label}{" "}
                {grouped.length > 0 && (
                  <span className="font-normal text-foreground">({grouped.length})</span>
                )}
              </h3>
              {grouped.length === 0 ? (
                emptyLabel && (
                  <p className="rounded-md border border-dashed border-border p-3 text-xs text-muted-foreground">
                    {emptyLabel}
                  </p>
                )
              ) : (
                <div className="space-y-2">
                  {grouped.map((task) => (
                    <TaskStatusCard key={task.id} task={task} />
                  ))}
                </div>
              )}
            </div>
          );
        })}
      </div>
    </div>
  );
}
