"use client";

import { useSearchParams, useRouter } from "next/navigation";
import { useMemo, useState, useTransition } from "react";
import { SprintPlanningView } from "@/components/sprints/SprintPlanningView";
import { ActiveSprintBoard } from "@/components/sprints/ActiveSprintBoard";
import { CreateSprintButton } from "@/components/sprints/CreateSprintButton";
import type { SprintWithTasks } from "@robin/shared-types";

interface SprintTabViewProps {
  activeSprint: SprintWithTasks | null;
  planningSprint: SprintWithTasks | null;
  workspaceId: string;
}

export function SprintTabView({
  activeSprint,
  planningSprint,
  workspaceId,
}: SprintTabViewProps) {
  const searchParams = useSearchParams();
  const router = useRouter();
  const [completing, setCompleting] = useState(false);
  const [completeError, setCompleteError] = useState<string | null>(null);
  const [, startTransition] = useTransition();

  async function handleComplete(sprintId: string) {
    if (!confirm("Completare lo sprint? Le task non finite torneranno nel backlog.")) return;
    setCompleting(true);
    setCompleteError(null);
    try {
      const res = await fetch(`/api/sprints/${sprintId}/complete`, { method: "POST" });
      if (!res.ok) {
        const body = await res.json() as { error?: string };
        setCompleteError(body.error ?? "Errore nel completamento dello sprint.");
        return;
      }
      startTransition(() => router.refresh());
    } finally {
      setCompleting(false);
    }
  }
  const repositoryId = searchParams.get("repositoryId");

  // Filter sprint tasks by selected repository if one is active
  const filteredActiveSprint = useMemo(() => {
    if (!activeSprint || !repositoryId) return activeSprint;
    return { ...activeSprint, tasks: activeSprint.tasks.filter((t) => t.repository_id === repositoryId) };
  }, [activeSprint, repositoryId]);

  const filteredPlanningSprint = useMemo(() => {
    if (!planningSprint || !repositoryId) return planningSprint;
    return { ...planningSprint, tasks: planningSprint.tasks.filter((t) => t.repository_id === repositoryId) };
  }, [planningSprint, repositoryId]);

  const currentSprint = filteredActiveSprint ?? filteredPlanningSprint;

  if (!currentSprint) {
    return (
      <div className="flex items-center justify-between">
        <p className="text-sm text-muted-foreground">
          Nessuno sprint attivo. Crea uno sprint e aggiungi task dal backlog.
        </p>
        <CreateSprintButton />
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* Current sprint header — minimal */}
      <div className="flex flex-col gap-4 sm:flex-row sm:items-start sm:justify-between">
        <div className="min-w-0">
          <div className="flex items-center gap-2">
            <h2 className="truncate text-lg font-semibold">{currentSprint.name}</h2>
            <span
              className={`shrink-0 rounded-full px-2 py-0.5 text-xs font-medium ${
                currentSprint.status === "active"
                  ? "bg-emerald-100 text-emerald-600 dark:bg-emerald-900/30"
                  : "bg-sky-100 text-sky-600 dark:bg-sky-900/30"
              }`}
            >
              {currentSprint.status === "active" ? "Attivo" : "In pianificazione"}
            </span>
          </div>
          {currentSprint.goal && (
            <p className="mt-0.5 text-sm italic text-muted-foreground">
              &ldquo;{currentSprint.goal}&rdquo;
            </p>
          )}
        </div>
        <div className="flex flex-wrap items-center gap-2">
          {!activeSprint && <CreateSprintButton />}
          {currentSprint.status === "active" && (
            <button
              onClick={() => void handleComplete(currentSprint.id)}
              disabled={completing}
              className="rounded border border-border bg-background px-3 py-1.5 text-sm font-medium hover:bg-accent transition-colors disabled:opacity-50"
            >
              {completing ? "Completando..." : "Chiudi sprint"}
            </button>
          )}
        </div>
      </div>
      {completeError && (
        <div className="rounded-md bg-destructive/10 px-3 py-2 text-xs text-destructive">
          {completeError}
        </div>
      )}

      {/* Sprint content */}
      {currentSprint.status === "planning" && (
        <SprintPlanningView sprint={currentSprint} tasks={currentSprint.tasks} />
      )}

      {currentSprint.status === "active" && (
        <ActiveSprintBoard
          initialTasks={currentSprint.tasks}
          sprintId={currentSprint.id}
          workspaceId={workspaceId}
        />
      )}

    </div>
  );
}
