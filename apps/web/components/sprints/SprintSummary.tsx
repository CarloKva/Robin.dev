"use client";

import Link from "next/link";
import { SprintProgressBar } from "./SprintProgressBar";
import type { SprintWithTasks } from "@robin/shared-types";

interface SprintSummaryProps {
  sprint: SprintWithTasks;
}

export function SprintSummary({ sprint }: SprintSummaryProps) {
  const doneTasks = sprint.tasks.filter((t) => ["done", "completed"].includes(t.status));
  const failedTasks = sprint.tasks.filter((t) => t.status === "failed");
  const movedBack = sprint.tasks.filter((t) => t.status === "backlog" || !t.sprint_id);

  return (
    <div className="space-y-6">
      {/* Metrics */}
      <div className="grid grid-cols-2 gap-4 md:grid-cols-4">
        {[
          { label: "Completate", value: sprint.tasks_completed, color: "text-green-600" },
          { label: "Fallite", value: sprint.tasks_failed, color: "text-red-600" },
          { label: "Spostate in backlog", value: sprint.tasks_moved_back, color: "text-amber-600" },
          {
            label: "Cycle time medio",
            value: sprint.avg_cycle_time_minutes ? `${sprint.avg_cycle_time_minutes}min` : "—",
            color: "text-foreground",
          },
        ].map(({ label, value, color }) => (
          <div key={label} className="rounded-lg border border-border bg-card p-4 text-center">
            <p className={`text-2xl font-bold ${color}`}>{value}</p>
            <p className="mt-1 text-xs text-muted-foreground">{label}</p>
          </div>
        ))}
      </div>

      <SprintProgressBar tasks={sprint.tasks} />

      {/* Task list */}
      <div className="rounded-lg border border-border bg-card">
        {sprint.tasks.map((task, idx) => (
          <div
            key={task.id}
            className={`flex items-center gap-3 px-4 py-3 ${idx < sprint.tasks.length - 1 ? "border-b border-border" : ""}`}
          >
            <span
              className={`h-2 w-2 shrink-0 rounded-full ${
                ["done", "completed"].includes(task.status)
                  ? "bg-green-500"
                  : task.status === "failed"
                  ? "bg-red-500"
                  : "bg-amber-400"
              }`}
            />
            <Link href={`/tasks/${task.id}`} className="min-w-0 flex-1">
              <p className="truncate text-sm hover:underline">{task.title}</p>
            </Link>
            <span className="text-xs text-muted-foreground capitalize">{task.status}</span>
          </div>
        ))}
      </div>
    </div>
  );
}
