"use client";

import Link from "next/link";
import { SprintPlanningView } from "@/components/sprints/SprintPlanningView";
import { ActiveSprintBoard } from "@/components/sprints/ActiveSprintBoard";
import { SprintCard } from "@/components/sprints/SprintCard";
import { CreateSprintButton } from "@/components/sprints/CreateSprintButton";
import type { Sprint, SprintWithTasks } from "@robin/shared-types";

interface SprintTabViewProps {
  activeSprint: SprintWithTasks | null;
  planningSprint: SprintWithTasks | null;
  pastSprints: Sprint[];
  workspaceId: string;
}

export function SprintTabView({
  activeSprint,
  planningSprint,
  pastSprints,
  workspaceId,
}: SprintTabViewProps) {
  const currentSprint = activeSprint ?? planningSprint;

  if (!currentSprint) {
    return (
      <div className="space-y-6">
        <div className="flex items-center justify-between">
          <p className="text-sm text-muted-foreground">
            Nessuno sprint attivo. Crea uno sprint e aggiungi task dal backlog.
          </p>
          <CreateSprintButton />
        </div>

        {pastSprints.length > 0 && (
          <section className="space-y-3">
            <h2 className="text-sm font-semibold uppercase tracking-wide text-muted-foreground">
              Sprint passati
            </h2>
            <div className="grid gap-3 md:grid-cols-2">
              {pastSprints.map((s) => (
                <SprintCard key={s.id} sprint={s} />
              ))}
            </div>
          </section>
        )}
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* Current sprint header */}
      <div className="flex items-start justify-between gap-4">
        <div className="min-w-0">
          <div className="flex items-center gap-2">
            <h2 className="truncate text-lg font-semibold">{currentSprint.name}</h2>
            <span
              className={`shrink-0 rounded-full px-2 py-0.5 text-xs font-medium ${
                currentSprint.status === "active"
                  ? "bg-green-100 text-green-600 dark:bg-green-900/30"
                  : "bg-blue-100 text-blue-600 dark:bg-blue-900/30"
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
        <div className="flex items-center gap-2">
          {!activeSprint && <CreateSprintButton />}
          <Link
            href={`/sprints/${currentSprint.id}`}
            className="rounded-md border border-border px-3 py-2 text-sm hover:bg-accent min-h-[44px] flex items-center"
          >
            Dettaglio sprint →
          </Link>
        </div>
      </div>

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

      {/* Past sprints (collapsed) */}
      {pastSprints.length > 0 && (
        <section className="space-y-3">
          <h2 className="text-sm font-semibold uppercase tracking-wide text-muted-foreground">
            Sprint passati
          </h2>
          <div className="grid gap-3 md:grid-cols-2">
            {pastSprints.slice(0, 4).map((s) => (
              <SprintCard key={s.id} sprint={s} />
            ))}
          </div>
          {pastSprints.length > 4 && (
            <p className="text-sm text-muted-foreground">
              +{pastSprints.length - 4} sprint passati.{" "}
              <Link href="/sprints" className="text-primary hover:underline">
                Vedi tutti →
              </Link>
            </p>
          )}
        </section>
      )}
    </div>
  );
}
