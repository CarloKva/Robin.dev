"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { cn } from "@/lib/utils";
import type { Task, Sprint } from "@robin/shared-types";

interface SprintPlanningViewProps {
  sprint: Sprint;
  tasks: Task[];
}

export function SprintPlanningView({ sprint, tasks: initialTasks }: SprintPlanningViewProps) {
  const [tasks, setTasks] = useState(initialTasks.sort((a, b) => (a.sprint_order ?? 0) - (b.sprint_order ?? 0)));
  const [starting, setStarting] = useState(false);
  const [startError, setStartError] = useState<string | null>(null);
  const [, startTransition] = useTransition();
  const router = useRouter();

  async function removeFromSprint(taskId: string) {
    setTasks((prev) => prev.filter((t) => t.id !== taskId));
    await fetch(`/api/tasks/${taskId}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ sprint_id: null, status: "backlog", sprint_order: null }),
    });
  }

  async function moveTask(taskId: string, direction: "up" | "down") {
    const idx = tasks.findIndex((t) => t.id === taskId);
    if ((direction === "up" && idx === 0) || (direction === "down" && idx === tasks.length - 1)) return;

    const newTasks = [...tasks];
    const swapIdx = direction === "up" ? idx - 1 : idx + 1;
    [newTasks[idx], newTasks[swapIdx]] = [newTasks[swapIdx]!, newTasks[idx]!];

    // Reassign sprint_order
    const updated = newTasks.map((t, i) => ({ ...t, sprint_order: i }));
    setTasks(updated);

    await fetch(`/api/sprints/${sprint.id}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        taskOrder: updated.map((t) => ({ taskId: t.id, sprint_order: t.sprint_order! })),
      }),
    });
  }

  async function handleStart() {
    setStarting(true);
    setStartError(null);
    try {
      const res = await fetch(`/api/sprints/${sprint.id}/start`, { method: "POST" });
      const body = await res.json();
      if (!res.ok) {
        setStartError(body.error ?? "Errore nell'avvio dello sprint.");
        return;
      }
      startTransition(() => router.refresh());
    } finally {
      setStarting(false);
    }
  }

  const readyCount = tasks.filter((t) => t.status === "sprint_ready").length;

  return (
    <div className="space-y-6">
      {/* Sprint info */}
      <div className="rounded-lg border border-border bg-card p-4">
        <div className="flex items-center justify-between gap-4">
          <div>
            <p className="text-sm text-muted-foreground">
              {tasks.length} task nello sprint · {readyCount} pronte
            </p>
            {sprint.goal && (
              <p className="mt-1 text-sm italic text-muted-foreground">&ldquo;{sprint.goal}&rdquo;</p>
            )}
          </div>

          <div className="flex items-center gap-2">
            <Link
              href="/backlog"
              className="rounded-md border border-border px-3 py-2 text-sm hover:bg-accent min-h-[44px] flex items-center"
            >
              + Aggiungi dal backlog
            </Link>
            <button
              onClick={() => void handleStart()}
              disabled={starting || readyCount === 0}
              className="rounded-md bg-primary px-4 py-2 text-sm font-semibold text-primary-foreground hover:bg-primary/90 disabled:opacity-40 min-h-[44px]"
            >
              {starting ? "Avviando..." : "Avvia Sprint"}
            </button>
          </div>
        </div>

        {startError && (
          <div className="mt-3 rounded-md bg-destructive/10 px-3 py-2 text-sm text-destructive">
            {startError}
          </div>
        )}

        {readyCount === 0 && tasks.length > 0 && (
          <div className="mt-3 rounded-md bg-amber-50 dark:bg-amber-900/20 px-3 py-2 text-sm text-amber-700 dark:text-amber-300">
            Nessuna task in stato &ldquo;sprint_ready&rdquo;. Sposta le task dal backlog o aggiornane lo stato.
          </div>
        )}
      </div>

      {/* Task list */}
      {tasks.length === 0 ? (
        <div className="rounded-lg border border-dashed border-border p-12 text-center">
          <p className="text-sm text-muted-foreground">Nessuna task nello sprint.</p>
          <p className="mt-2">
            <Link href="/backlog" className="text-sm text-primary hover:underline">
              Vai al backlog →
            </Link>
          </p>
        </div>
      ) : (
        <div className="rounded-lg border border-border bg-card">
          {tasks.map((task, idx) => (
            <div
              key={task.id}
              className={cn(
                "flex items-center gap-3 px-4 py-3 transition-colors hover:bg-accent/20",
                idx < tasks.length - 1 && "border-b border-border"
              )}
            >
              {/* Order controls */}
              <div className="flex flex-col gap-0.5">
                <button
                  onClick={() => void moveTask(task.id, "up")}
                  disabled={idx === 0}
                  className="text-xs text-muted-foreground hover:text-foreground disabled:opacity-20 leading-none"
                  aria-label="Sposta su"
                >
                  ▲
                </button>
                <button
                  onClick={() => void moveTask(task.id, "down")}
                  disabled={idx === tasks.length - 1}
                  className="text-xs text-muted-foreground hover:text-foreground disabled:opacity-20 leading-none"
                  aria-label="Sposta giù"
                >
                  ▼
                </button>
              </div>

              <span className="w-6 text-center text-xs text-muted-foreground">{idx + 1}</span>

              <Link href={`/tasks/${task.id}`} className="min-w-0 flex-1">
                <p className="truncate text-sm font-medium hover:underline">{task.title}</p>
                <p className="text-xs text-muted-foreground capitalize">
                  {task.type} · {task.priority}
                  {task.estimated_effort && ` · ${task.estimated_effort.toUpperCase()}`}
                </p>
              </Link>

              <span
                className={cn(
                  "shrink-0 rounded-full px-2 py-0.5 text-xs",
                  task.status === "sprint_ready"
                    ? "bg-green-100 text-green-600 dark:bg-green-900/30"
                    : "bg-muted text-muted-foreground"
                )}
              >
                {task.status === "sprint_ready" ? "Pronta" : task.status}
              </span>

              <button
                onClick={() => void removeFromSprint(task.id)}
                className="shrink-0 text-xs text-muted-foreground hover:text-destructive"
                aria-label="Rimuovi dallo sprint"
              >
                ✕
              </button>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
