"use client";

import { useState, useEffect } from "react";
import Link from "next/link";
import { ChevronDown, ChevronRight } from "lucide-react";
import { cn } from "@/lib/utils";
import type { Sprint } from "@robin/shared-types";

const STATUS_CONFIG: Record<Sprint["status"], { label: string; className: string }> = {
  planning: { label: "In pianificazione", className: "text-blue-600 bg-blue-100 dark:bg-blue-900/30" },
  active: { label: "Attivo", className: "text-green-600 bg-green-100 dark:bg-green-900/30" },
  completed: { label: "Completato", className: "text-slate-500 bg-slate-100 dark:bg-slate-800" },
  cancelled: { label: "Annullato", className: "text-red-500 bg-red-100 dark:bg-red-900/30" },
};

const STORAGE_KEY = "sprint-archive-expanded";

interface SprintArchiveTableProps {
  sprints: Sprint[];
  taskCountMap: Record<string, number>;
  defaultExpanded?: boolean;
}

export function SprintArchiveTable({ sprints, taskCountMap, defaultExpanded = false }: SprintArchiveTableProps) {
  const [isExpanded, setIsExpanded] = useState(defaultExpanded);
  const [expandedRowId, setExpandedRowId] = useState<string | null>(null);
  const [mounted, setMounted] = useState(false);

  useEffect(() => {
    setMounted(true);
    const stored = localStorage.getItem(STORAGE_KEY);
    if (stored !== null) {
      setIsExpanded(stored === "true");
    }
  }, []);

  function toggleExpanded() {
    const next = !isExpanded;
    setIsExpanded(next);
    localStorage.setItem(STORAGE_KEY, String(next));
  }

  function toggleRow(id: string) {
    setExpandedRowId((prev) => (prev === id ? null : id));
  }

  if (sprints.length === 0) return null;

  // Sort by completed_at descending, fallback to created_at
  const sorted = [...sprints].sort((a, b) => {
    const dateA = a.completed_at ?? a.started_at ?? a.created_at;
    const dateB = b.completed_at ?? b.started_at ?? b.created_at;
    return new Date(dateB).getTime() - new Date(dateA).getTime();
  });

  return (
    <section className="space-y-2">
      <button
        type="button"
        onClick={toggleExpanded}
        className="flex items-center gap-1.5 text-sm font-semibold uppercase tracking-wide text-muted-foreground hover:text-foreground transition-colors"
      >
        {isExpanded ? <ChevronDown className="h-4 w-4" /> : <ChevronRight className="h-4 w-4" />}
        Archivio
        <span className="ml-1 text-xs font-normal normal-case">({sprints.length})</span>
      </button>

      {/* Render table regardless of mount to avoid hydration mismatch — visibility controlled by isExpanded */}
      {mounted && isExpanded && (
        <div className="overflow-x-auto rounded-lg border border-border">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-border bg-muted/40 text-xs uppercase tracking-wide text-muted-foreground">
                <th className="px-4 py-2 text-left font-medium">Nome</th>
                <th className="px-4 py-2 text-left font-medium">Data avvio</th>
                <th className="px-4 py-2 text-left font-medium">Data chiusura</th>
                <th className="px-4 py-2 text-left font-medium">Task</th>
                <th className="px-4 py-2 text-left font-medium">Stato</th>
              </tr>
            </thead>
            <tbody>
              {sorted.map((sprint) => {
                const config = STATUS_CONFIG[sprint.status];
                const startedDate = sprint.started_at
                  ? new Date(sprint.started_at).toLocaleDateString("it-IT", { day: "2-digit", month: "short", year: "numeric" })
                  : "—";
                const completedDate = sprint.completed_at
                  ? new Date(sprint.completed_at).toLocaleDateString("it-IT", { day: "2-digit", month: "short", year: "numeric" })
                  : "—";
                const totalTasks = taskCountMap[sprint.id] ?? 0;
                const isRowExpanded = expandedRowId === sprint.id;

                return (
                  <>
                    <tr
                      key={sprint.id}
                      onClick={() => toggleRow(sprint.id)}
                      className={cn(
                        "cursor-pointer border-b border-border transition-colors last:border-0",
                        isRowExpanded
                          ? "bg-accent/60"
                          : "hover:bg-accent/40"
                      )}
                    >
                      <td className="px-4 py-2.5 font-medium">{sprint.name}</td>
                      <td className="px-4 py-2.5 text-muted-foreground">{startedDate}</td>
                      <td className="px-4 py-2.5 text-muted-foreground">{completedDate}</td>
                      <td className="px-4 py-2.5 text-muted-foreground">
                        {sprint.tasks_completed}/{totalTasks}
                      </td>
                      <td className="px-4 py-2.5">
                        <span className={cn("rounded-full px-2 py-0.5 text-xs font-medium", config.className)}>
                          {config.label}
                        </span>
                      </td>
                    </tr>
                    {isRowExpanded && (
                      <tr key={`${sprint.id}-summary`} className="border-b border-border last:border-0 bg-muted/20">
                        <td colSpan={5} className="px-4 py-3">
                          <SprintInlineSummary sprint={sprint} />
                        </td>
                      </tr>
                    )}
                  </>
                );
              })}
            </tbody>
          </table>
        </div>
      )}
    </section>
  );
}

function SprintInlineSummary({ sprint }: { sprint: Sprint }) {
  return (
    <div className="flex flex-wrap items-start gap-6 text-sm">
      {sprint.goal && (
        <div>
          <p className="text-xs font-medium uppercase tracking-wide text-muted-foreground">Obiettivo</p>
          <p className="mt-0.5 text-foreground">{sprint.goal}</p>
        </div>
      )}
      <div className="flex gap-4">
        {sprint.tasks_completed > 0 && (
          <div>
            <p className="text-xs font-medium uppercase tracking-wide text-muted-foreground">Completate</p>
            <p className="mt-0.5 font-semibold text-green-600">{sprint.tasks_completed}</p>
          </div>
        )}
        {sprint.tasks_failed > 0 && (
          <div>
            <p className="text-xs font-medium uppercase tracking-wide text-muted-foreground">Fallite</p>
            <p className="mt-0.5 font-semibold text-red-500">{sprint.tasks_failed}</p>
          </div>
        )}
        {sprint.tasks_moved_back > 0 && (
          <div>
            <p className="text-xs font-medium uppercase tracking-wide text-muted-foreground">Rimosse</p>
            <p className="mt-0.5 font-semibold text-muted-foreground">{sprint.tasks_moved_back}</p>
          </div>
        )}
        {sprint.avg_cycle_time_minutes != null && (
          <div>
            <p className="text-xs font-medium uppercase tracking-wide text-muted-foreground">Cycle time</p>
            <p className="mt-0.5 font-semibold">{sprint.avg_cycle_time_minutes} min</p>
          </div>
        )}
      </div>
      <div className="ml-auto">
        <Link
          href={`/sprints/${sprint.id}`}
          className="text-xs text-muted-foreground underline-offset-2 hover:underline hover:text-foreground transition-colors"
          onClick={(e) => e.stopPropagation()}
        >
          Apri dettaglio →
        </Link>
      </div>
    </div>
  );
}
