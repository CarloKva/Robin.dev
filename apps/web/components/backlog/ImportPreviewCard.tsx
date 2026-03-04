"use client";

import { useState } from "react";
import { AlertTriangle, Check } from "lucide-react";
import { cn } from "@/lib/utils";
import type { Repository } from "@robin/shared-types";
import type { ParsedTask, ParseError } from "@/types/robin-md";

interface ImportPreviewCardProps {
  tasks: ParsedTask[];
  errors: ParseError[];
  truncated: boolean;
  originalCount: number;
  repositories: Repository[];
  onDismiss: () => void;
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
  spike: "bg-gray-100 text-gray-700 dark:bg-gray-800/40 dark:text-gray-300",
  chore: "bg-slate-100 text-slate-600 dark:bg-slate-800 dark:text-slate-300",
};

const PRIORITY_ICON: Record<ParsedTask["priority"], string> = {
  high: "↑",
  medium: "=",
  low: "—",
};

export function ImportPreviewCard({
  tasks,
  errors,
  truncated,
  originalCount,
  repositories,
  onDismiss,
  onImported,
}: ImportPreviewCardProps) {
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
    } catch {
      setApiError("Errore di rete durante l'import");
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="w-full rounded-xl border border-border bg-background shadow-sm overflow-hidden">
      {/* Header */}
      <div className="flex items-center justify-between px-3 py-2.5 border-b border-border bg-accent/30">
        <span className="text-xs font-semibold">
          {tasks.length} task pronte per l&apos;import
        </span>
        {truncated && (
          <span className="text-xs text-amber-600 dark:text-amber-400">
            (prime 50 di {originalCount})
          </span>
        )}
      </div>

      {/* Body */}
      <div className="max-h-52 overflow-y-auto">
        {/* Repo fallback selector */}
        {needsFallback && (
          <div className="px-3 py-2 border-b border-border bg-blue-50 dark:bg-blue-900/20">
            <p className="text-xs text-blue-800 dark:text-blue-300 mb-1.5">
              {tasksWithoutRepo.length === tasks.length
                ? "Nessuna task specifica una repository."
                : `${tasksWithoutRepo.length} task senza repository.`}{" "}
              Scegli quella di default:
            </p>
            {repositories.length === 0 ? (
              <p className="text-xs text-red-600 dark:text-red-400">
                Nessuna repository collegata. Configurane una in Settings.
              </p>
            ) : (
              <select
                value={defaultRepo}
                onChange={(e) => setDefaultRepo(e.target.value)}
                className="h-7 w-full rounded border border-border bg-background px-2 text-xs text-foreground focus:outline-none focus:ring-1 focus:ring-ring"
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

        {/* Parse errors */}
        {errors.length > 0 && (
          <div className="px-3 py-2 border-b border-border bg-yellow-50 dark:bg-yellow-900/20">
            <p className="flex items-center gap-1 text-xs text-yellow-700 dark:text-yellow-400">
              <AlertTriangle className="h-3 w-3" />
              {errors.length} {errors.length === 1 ? "task saltata" : "task saltate"} (dati non validi)
            </p>
          </div>
        )}

        {/* Task list */}
        {tasks.length === 0 ? (
          <p className="px-3 py-4 text-center text-xs text-muted-foreground">
            Nessuna task valida trovata.
          </p>
        ) : (
          <ul className="divide-y divide-border">
            {tasks.map((task, i) => {
              const repoLabel = task.repository ?? (defaultRepo !== "" ? defaultRepo : null);
              return (
                <li key={i} className="flex items-center gap-2 px-3 py-2 text-xs">
                  <span className="shrink-0 text-muted-foreground w-4 text-right tabular-nums">
                    {i + 1}.
                  </span>
                  <span className="flex-1 min-w-0 font-medium truncate">{task.title}</span>
                  <span className={cn("shrink-0 rounded px-1 py-0.5 text-xs font-medium", TYPE_CLASS[task.type])}>
                    {TYPE_LABEL[task.type]}
                  </span>
                  <span className="shrink-0 text-muted-foreground w-4 text-center">
                    {PRIORITY_ICON[task.priority]}
                  </span>
                  {repoLabel === null && (
                    <AlertTriangle className="h-3 w-3 shrink-0 text-red-500" />
                  )}
                </li>
              );
            })}
          </ul>
        )}
      </div>

      {/* Footer */}
      <div className="flex items-center gap-2 px-3 py-2.5 border-t border-border">
        {apiError && (
          <p className="flex-1 text-xs text-red-600 dark:text-red-400 truncate">{apiError}</p>
        )}
        {!apiError && <div className="flex-1" />}
        <button
          onClick={onDismiss}
          disabled={loading}
          className="rounded-md border border-border bg-background px-2.5 py-1 text-xs font-medium hover:bg-accent transition-colors disabled:opacity-50"
        >
          Scarta
        </button>
        <button
          onClick={() => void handleImport()}
          disabled={loading || !canImport}
          className="flex items-center gap-1 rounded-md bg-primary px-2.5 py-1 text-xs font-medium text-primary-foreground hover:bg-primary/90 transition-colors disabled:opacity-50"
        >
          {loading ? (
            "Importando…"
          ) : (
            <>
              <Check className="h-3 w-3" />
              Importa {tasks.length} task
            </>
          )}
        </button>
      </div>
    </div>
  );
}
