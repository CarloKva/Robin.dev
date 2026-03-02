"use client";

import { useState } from "react";
import { cn } from "@/lib/utils";
import type { Repository } from "@robin/shared-types";
import type { ParsedTask, ParseError } from "@/types/robin-md";

interface ImportPreviewModalProps {
  tasks: ParsedTask[];
  errors: ParseError[];
  truncated: boolean;
  originalCount: number;
  repositories: Repository[];
  onClose: () => void;
  onImported: () => void;
}

const TYPE_LABEL: Record<ParsedTask["type"], string> = {
  feature: "Feature",
  bug: "Bug",
  spike: "Spike",
  chore: "Chore",
};

const TYPE_CLASS: Record<ParsedTask["type"], string> = {
  feature: "bg-blue-100 text-blue-700 dark:bg-blue-900/40 dark:text-blue-300",
  bug: "bg-red-100 text-red-700 dark:bg-red-900/40 dark:text-red-300",
  spike: "bg-purple-100 text-purple-700 dark:bg-purple-900/40 dark:text-purple-300",
  chore: "bg-slate-100 text-slate-600 dark:bg-slate-800 dark:text-slate-300",
};

const PRIORITY_CLASS: Record<ParsedTask["priority"], string> = {
  high: "bg-orange-100 text-orange-700 dark:bg-orange-900/40 dark:text-orange-300",
  medium: "bg-yellow-100 text-yellow-700 dark:bg-yellow-900/40 dark:text-yellow-300",
  low: "bg-slate-100 text-slate-600 dark:bg-slate-800 dark:text-slate-300",
};

const PRIORITY_ICON: Record<ParsedTask["priority"], string> = {
  high: "↑",
  medium: "=",
  low: "—",
};

export function ImportPreviewModal({
  tasks,
  errors,
  truncated,
  originalCount,
  repositories,
  onClose,
  onImported,
}: ImportPreviewModalProps) {
  const [loading, setLoading] = useState(false);
  const [apiError, setApiError] = useState<string | null>(null);
  const [defaultRepo, setDefaultRepo] = useState<string>(() => repositories[0]?.full_name ?? "");

  const tasksWithoutRepo = tasks.filter((t) => !t.repository);
  const needsFallback = tasksWithoutRepo.length > 0;
  const canImport = tasks.length > 0 && (!needsFallback || defaultRepo !== "");

  async function handleImport() {
    setLoading(true);
    setApiError(null);
    try {
      // Inject fallback repository for tasks that don't specify one
      const tasksToSend = tasks.map((t) => ({
        ...t,
        repository: t.repository ?? defaultRepo,
      }));

      const res = await fetch("/api/backlog/import", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ tasks: tasksToSend }),
      });
      const data = (await res.json()) as { error?: string; hint?: string; repositories?: string[] };
      if (!res.ok) {
        const hint = data.hint ? ` — ${data.hint}` : "";
        const missing =
          data.repositories && data.repositories.length > 0
            ? ` Repository mancanti: ${data.repositories.join(", ")}`
            : "";
        setApiError((data.error ?? "Errore durante l'import") + hint + missing);
        return;
      }
      onImported();
      onClose();
    } catch {
      setApiError("Errore di rete durante l'import");
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="fixed inset-0 z-50 flex items-end justify-center sm:items-center">
      {/* Backdrop */}
      <div
        className="absolute inset-0 bg-black/50"
        onClick={onClose}
        aria-hidden="true"
      />

      {/* Modal panel */}
      <div className="relative z-10 mx-0 sm:mx-4 w-full sm:max-w-2xl max-h-[90vh] flex flex-col rounded-t-xl sm:rounded-xl border border-border bg-card shadow-2xl">
        {/* Header */}
        <div className="flex items-center justify-between border-b border-border px-5 py-4 shrink-0">
          <div>
            <h2 className="font-semibold text-base">
              Anteprima import — {tasks.length}{" "}
              {tasks.length === 1 ? "task" : "task"}
            </h2>
            {truncated && (
              <p className="mt-0.5 text-xs text-amber-600 dark:text-amber-400">
                Il file conteneva {originalCount} task — importate le prime 50.
              </p>
            )}
          </div>
          <button
            onClick={onClose}
            className="rounded-md p-1 text-muted-foreground hover:text-foreground hover:bg-accent transition-colors"
            aria-label="Chiudi"
          >
            ✕
          </button>
        </div>

        {/* Scrollable body */}
        <div className="flex-1 overflow-y-auto px-5 py-3 space-y-3">
          {/* Fallback repository selector */}
          {needsFallback && (
            <div className="rounded-lg border border-blue-300 bg-blue-50 dark:border-blue-700 dark:bg-blue-900/20 px-4 py-3 space-y-2">
              <p className="text-xs font-semibold text-blue-800 dark:text-blue-300">
                {tasksWithoutRepo.length === tasks.length
                  ? "Nessuna task specifica una repository nel file."
                  : `${tasksWithoutRepo.length} task non specificano una repository.`}
                {" "}Scegli quella di default:
              </p>
              {repositories.length === 0 ? (
                <p className="text-xs text-red-600 dark:text-red-400">
                  Nessuna repository collegata al workspace. Collegane una in Settings prima di importare.
                </p>
              ) : (
                <select
                  value={defaultRepo}
                  onChange={(e) => setDefaultRepo(e.target.value)}
                  className="h-8 w-full rounded-md border border-border bg-background px-2.5 text-sm text-foreground focus:outline-none focus:ring-1 focus:ring-ring"
                >
                  <option value="">— Seleziona repository —</option>
                  {repositories.map((r) => (
                    <option key={r.id} value={r.full_name}>
                      {r.full_name}
                    </option>
                  ))}
                </select>
              )}
            </div>
          )}

          {/* Warnings for parse errors */}
          {errors.length > 0 && (
            <div className="rounded-lg border border-yellow-300 bg-yellow-50 dark:border-yellow-700 dark:bg-yellow-900/20 px-4 py-3">
              <p className="text-xs font-semibold text-yellow-800 dark:text-yellow-300 mb-2">
                ⚠ {errors.length} {errors.length === 1 ? "task saltata" : "task saltate"} (dati non validi)
              </p>
              <ul className="space-y-1.5">
                {errors.map((err, i) => (
                  <li key={i} className="text-xs text-yellow-700 dark:text-yellow-400">
                    <span className="font-medium">Blocco #{err.blockIndex + 1}:</span>{" "}
                    {err.reason}
                  </li>
                ))}
              </ul>
            </div>
          )}

          {/* Task list */}
          {tasks.length === 0 ? (
            <p className="py-8 text-center text-sm text-muted-foreground">
              Nessuna task valida trovata nel file.
            </p>
          ) : (
            <ul className="divide-y divide-border rounded-lg border border-border overflow-hidden">
              {tasks.map((task, i) => {
                const descLines = task.description.split("\n").slice(0, 2);
                const preview = descLines.join(" ").replace(/[#*_`]/g, "").trim();
                const repoLabel = task.repository ?? (defaultRepo !== "" ? defaultRepo : null);

                return (
                  <li key={i} className="px-4 py-3 hover:bg-accent/30 transition-colors">
                    <div className="flex items-start gap-2.5">
                      {/* Order */}
                      <span className="mt-0.5 shrink-0 text-xs text-muted-foreground tabular-nums w-5 text-right">
                        {i + 1}.
                      </span>

                      <div className="min-w-0 flex-1 space-y-1">
                        {/* Title + badges */}
                        <div className="flex flex-wrap items-center gap-1.5">
                          <span className="font-medium text-sm leading-snug">
                            {task.title}
                          </span>
                          <span
                            className={cn(
                              "rounded px-1.5 py-0.5 text-xs font-medium",
                              TYPE_CLASS[task.type]
                            )}
                          >
                            {TYPE_LABEL[task.type]}
                          </span>
                          <span
                            className={cn(
                              "rounded px-1.5 py-0.5 text-xs font-medium",
                              PRIORITY_CLASS[task.priority]
                            )}
                          >
                            {PRIORITY_ICON[task.priority]} {task.priority}
                          </span>
                          {repoLabel !== null ? (
                            <span className="rounded px-1.5 py-0.5 text-xs bg-slate-100 text-slate-600 dark:bg-slate-800 dark:text-slate-300 font-mono">
                              {repoLabel}
                              {!task.repository && (
                                <span className="ml-1 text-blue-500 dark:text-blue-400">(default)</span>
                              )}
                            </span>
                          ) : (
                            <span className="rounded px-1.5 py-0.5 text-xs bg-red-100 text-red-600 dark:bg-red-900/40 dark:text-red-400">
                              ⚠ repo mancante
                            </span>
                          )}
                          {task.agent !== undefined && (
                            <span className="rounded px-1.5 py-0.5 text-xs bg-slate-100 text-slate-600 dark:bg-slate-800 dark:text-slate-300">
                              {task.agent}
                            </span>
                          )}
                        </div>

                        {/* Description preview */}
                        {preview && (
                          <p className="text-xs text-muted-foreground line-clamp-2 leading-relaxed">
                            {preview.length > 120 ? preview.slice(0, 120) + "…" : preview}
                          </p>
                        )}

                        {/* depends_on */}
                        {task.depends_on !== undefined && (
                          <p className="text-xs text-muted-foreground">
                            <span className="font-medium">Dipende da:</span>{" "}
                            {task.depends_on}
                          </p>
                        )}
                      </div>
                    </div>
                  </li>
                );
              })}
            </ul>
          )}
        </div>

        {/* Footer */}
        <div className="border-t border-border px-5 py-4 shrink-0 space-y-2">
          {apiError && (
            <p className="text-xs text-red-600 dark:text-red-400">{apiError}</p>
          )}
          <div className="flex gap-2 justify-end">
            <button
              onClick={onClose}
              disabled={loading}
              className="rounded-md border border-border bg-background px-4 py-2 text-sm font-medium hover:bg-accent transition-colors disabled:opacity-50"
            >
              Annulla
            </button>
            <button
              onClick={() => void handleImport()}
              disabled={loading || !canImport}
              className="rounded-md bg-primary px-4 py-2 text-sm font-medium text-primary-foreground hover:bg-primary/90 transition-colors disabled:opacity-50"
            >
              {loading ? "Importando…" : `Importa ${tasks.length} task`}
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
