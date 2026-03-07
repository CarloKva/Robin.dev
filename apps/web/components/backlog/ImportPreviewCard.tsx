"use client";

import { useState, useEffect, useRef } from "react";
import { AlertTriangle, Check, Copy, CopyCheck } from "lucide-react";
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
  /** Called with the IDs of the tasks that were created. */
  onImported: (taskIds: string[]) => void;
  /** When set, shows a countdown and auto-triggers import at 0. */
  autoApproveCountdownSeconds?: number;
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
  autoApproveCountdownSeconds,
}: ImportPreviewCardProps) {
  const [loading, setLoading] = useState(false);
  const [apiError, setApiError] = useState<string | null>(null);
  const [copied, setCopied] = useState(false);
  const [defaultRepo, setDefaultRepo] = useState<string>(() => repositories[0]?.full_name ?? "");

  // Auto-approve countdown
  const [countdown, setCountdown] = useState<number | null>(
    autoApproveCountdownSeconds != null ? autoApproveCountdownSeconds : null
  );
  const handleImportRef = useRef<() => Promise<void>>(async () => {});

  const tasksWithoutRepo = tasks.filter((t) => !t.repository);
  const needsFallback = tasksWithoutRepo.length > 0;
  const canImport = tasks.length > 0 && (!needsFallback || defaultRepo !== "");

  // Keep ref to the latest handleImport to avoid stale closure in effects
  useEffect(() => {
    handleImportRef.current = handleImport;
  });

  // Tick countdown down every second
  useEffect(() => {
    if (countdown === null || countdown <= 0) return;
    const id = setTimeout(() => setCountdown((c) => (c !== null ? c - 1 : null)), 1000);
    return () => clearTimeout(id);
  }, [countdown]);

  // Auto-trigger import when countdown reaches 0
  useEffect(() => {
    if (countdown === 0) {
      void handleImportRef.current();
    }
  }, [countdown]);

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
      const data = (await res.json()) as {
        error?: string;
        hint?: string;
        repositories?: string[];
        details?: { fieldErrors?: Record<string, string[]>; formErrors?: string[] };
        tasks?: { id: string }[];
      };
      if (!res.ok) {
        const parts: string[] = [data.error ?? "Errore durante l'import"];
        if (data.hint) parts.push(data.hint);
        if (data.repositories && data.repositories.length > 0) {
          parts.push(`Repository mancanti: ${data.repositories.join(", ")}`);
        }
        if (data.details) {
          const fieldErrs = Object.entries(data.details.fieldErrors ?? {})
            .map(([field, msgs]) => `  • ${field}: ${msgs.join(", ")}`)
            .join("\n");
          const formErrs = (data.details.formErrors ?? []).map((e) => `  • ${e}`).join("\n");
          if (fieldErrs || formErrs) parts.push(`Dettagli validazione:\n${fieldErrs}${formErrs}`);
        }
        setApiError(parts.join("\n"));
        return;
      }
      const taskIds = (data.tasks ?? []).map((t) => t.id);
      onImported(taskIds);
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
            <p className="flex items-center gap-1 text-xs font-semibold text-yellow-700 dark:text-yellow-400 mb-1">
              <AlertTriangle className="h-3 w-3" />
              {errors.length} {errors.length === 1 ? "task saltata" : "task saltate"} (dati non validi)
            </p>
            <ul className="space-y-0.5">
              {errors.map((err, i) => (
                <li key={i} className="text-xs text-yellow-700 dark:text-yellow-400">
                  <span className="font-medium">Blocco #{err.blockIndex + 1}:</span> {err.reason}
                </li>
              ))}
            </ul>
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
      {apiError && (
        <div className="px-3 pt-2.5 pb-1 border-t border-border bg-red-50 dark:bg-red-950/20">
          <div className="flex items-start justify-between gap-2 mb-1.5">
            <p className="text-xs font-semibold text-red-700 dark:text-red-400 flex items-center gap-1">
              <AlertTriangle className="h-3 w-3 shrink-0" />
              Errore durante l&apos;import
            </p>
            <button
              onClick={() => {
                void navigator.clipboard.writeText(
                  `ERRORE IMPORT ROBIN.MD\n\n${apiError}${errors.length > 0 ? `\n\nERRORI DI PARSING (${errors.length} task saltate):\n${errors.map((e) => `- Blocco #${e.blockIndex + 1}: ${e.reason}`).join("\n")}` : ""}`
                ).then(() => {
                  setCopied(true);
                  setTimeout(() => setCopied(false), 2000);
                });
              }}
              className="shrink-0 flex items-center gap-1 rounded px-1.5 py-0.5 text-xs text-red-600 dark:text-red-400 hover:bg-red-100 dark:hover:bg-red-900/30 transition-colors"
              title="Copia errori per LLM"
            >
              {copied ? <CopyCheck className="h-3 w-3" /> : <Copy className="h-3 w-3" />}
              {copied ? "Copiato" : "Copia"}
            </button>
          </div>
          <pre className="text-xs text-red-700 dark:text-red-400 whitespace-pre-wrap break-words font-mono leading-relaxed max-h-32 overflow-y-auto">
            {apiError}
          </pre>
        </div>
      )}
      {/* Auto-approve countdown bar */}
      {countdown !== null && countdown > 0 && (
        <div className="flex items-center justify-between border-t border-border bg-blue-50 px-3 py-2 dark:bg-blue-900/20">
          <span className="text-xs text-blue-700 dark:text-blue-300">
            Importazione automatica in{" "}
            <span className="font-bold">{countdown}s</span>
          </span>
          <button
            onClick={() => setCountdown(null)}
            className="text-xs text-blue-600 underline hover:no-underline dark:text-blue-400"
          >
            Interrompi
          </button>
        </div>
      )}
      <div className="flex items-center gap-2 px-3 py-2.5 border-t border-border">
        <div className="flex-1" />
        <button
          onClick={onDismiss}
          disabled={loading}
          className="rounded-md border border-border bg-background px-2.5 py-1 text-xs font-medium hover:bg-accent transition-colors disabled:opacity-50"
        >
          Scarta
        </button>
        <button
          onClick={() => {
            setCountdown(null);
            void handleImport();
          }}
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
