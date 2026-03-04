"use client";

import React, { useState, useRef, useEffect, useTransition } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { cn } from "@/lib/utils";
import { Bug, Sparkles, RefreshCw, Settings, FileText, Accessibility, Lock, ChevronUp, ChevronDown, ChevronRight, X } from "lucide-react";
import type { Task, SprintWithTasks } from "@robin/shared-types";

type TaskStatus = Task["status"];

const STATUS_COUNTS_CONFIG: { key: string; statuses: TaskStatus[]; color: string; bg: string } [] = [
  { key: "todo", statuses: ["sprint_ready", "queued"], color: "text-slate-600 dark:text-slate-300", bg: "bg-slate-100 dark:bg-slate-800" },
  { key: "doing", statuses: ["in_progress", "in_review", "rework"], color: "text-blue-700 dark:text-blue-300", bg: "bg-blue-100 dark:bg-blue-900/40" },
  { key: "done", statuses: ["done", "completed"], color: "text-green-700 dark:text-green-300", bg: "bg-green-100 dark:bg-green-900/40" },
];

const STATUS_LABELS: Record<TaskStatus, string> = {
  backlog: "Backlog",
  sprint_ready: "Da fare",
  pending: "In attesa",
  queued: "In coda",
  in_progress: "In progress",
  in_review: "In review",
  rework: "Rework",
  review_pending: "Review",
  approved: "Approvato",
  rejected: "Rifiutato",
  done: "Fatto",
  completed: "Completato",
  failed: "Fallito",
  cancelled: "Annullato",
};

const STATUS_COLORS: Record<TaskStatus, string> = {
  backlog: "bg-slate-300 dark:bg-slate-600",
  sprint_ready: "bg-blue-400",
  pending: "bg-slate-400",
  queued: "bg-blue-500",
  in_progress: "bg-blue-600",
  in_review: "bg-yellow-500",
  rework: "bg-orange-500",
  review_pending: "bg-yellow-400",
  approved: "bg-green-400",
  rejected: "bg-red-400",
  done: "bg-green-500",
  completed: "bg-green-600",
  failed: "bg-red-500",
  cancelled: "bg-slate-400",
};

const PRIORITY_ICONS: Record<string, { icon: string; className: string }> = {
  critical: { icon: "↑↑", className: "text-red-600 font-bold" },
  high: { icon: "↑", className: "text-orange-500 font-semibold" },
  medium: { icon: "=", className: "text-yellow-600" },
  low: { icon: "—", className: "text-slate-400" },
};

const TYPE_ICON_MAP: Record<string, React.ElementType> = {
  bug: Bug,
  feature: Sparkles,
  refactor: RefreshCw,
  chore: Settings,
  docs: FileText,
  accessibility: Accessibility,
  security: Lock,
};

interface SprintSectionProps {
  sprint: SprintWithTasks;
  isExpanded: boolean;
  onToggle: () => void;
  selectedIds: Set<string>;
  onSelectTask: (id: string) => void;
  onSelectAll: (select: boolean) => void;
  onRefresh: () => void;
}

export function SprintSection({
  sprint,
  isExpanded,
  onToggle,
  selectedIds,
  onSelectTask,
  onSelectAll,
  onRefresh,
}: SprintSectionProps) {
  const [tasks, setTasks] = useState<Task[]>(sprint.tasks);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // Inline sprint name editing
  const [sprintName, setSprintName] = useState(sprint.name);
  const [editingName, setEditingName] = useState(false);
  const [nameValue, setNameValue] = useState(sprint.name);
  const [nameSaving, setNameSaving] = useState(false);
  const [nameError, setNameError] = useState<string | null>(null);
  const nameInputRef = useRef<HTMLInputElement>(null);

  const [, startTransition] = useTransition();
  const router = useRouter();

  useEffect(() => {
    if (editingName) {
      nameInputRef.current?.focus();
      nameInputRef.current?.select();
    }
  }, [editingName]);

  async function handleSaveName() {
    const trimmed = nameValue.trim();
    if (!trimmed) {
      setNameError("Il nome non può essere vuoto");
      nameInputRef.current?.focus();
      return;
    }
    if (trimmed === sprintName) {
      setEditingName(false);
      setNameError(null);
      return;
    }
    setNameSaving(true);
    setNameError(null);
    try {
      const res = await fetch(`/api/sprints/${sprint.id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ name: trimmed }),
      });
      if (!res.ok) {
        setNameError("Errore nel salvataggio");
        setNameSaving(false);
        nameInputRef.current?.focus();
        return;
      }
      setSprintName(trimmed);
      setEditingName(false);
    } catch {
      setNameError("Errore nel salvataggio");
      setNameSaving(false);
      nameInputRef.current?.focus();
    }
  }

  function handleNameKeyDown(e: React.KeyboardEvent<HTMLInputElement>) {
    if (e.key === "Enter") {
      e.preventDefault();
      void handleSaveName();
    } else if (e.key === "Escape") {
      setNameValue(sprintName);
      setEditingName(false);
      setNameError(null);
    }
  }

  const isActive = sprint.status === "active";
  const isPlanning = sprint.status === "planning";

  const allSelected = tasks.length > 0 && tasks.every((t) => selectedIds.has(t.id));
  const someSelected = tasks.some((t) => selectedIds.has(t.id));

  function getStatusCounts() {
    return STATUS_COUNTS_CONFIG.map((cfg) => ({
      ...cfg,
      count: tasks.filter((t) => cfg.statuses.includes(t.status)).length,
    }));
  }

  async function handleRemoveTask(taskId: string) {
    setTasks((prev) => prev.filter((t) => t.id !== taskId));
    await fetch(`/api/tasks/${taskId}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ sprint_id: null, status: "backlog", sprint_order: null }),
    });
    onRefresh();
  }

  async function handleMoveTask(taskId: string, direction: "up" | "down") {
    const idx = tasks.findIndex((t) => t.id === taskId);
    if ((direction === "up" && idx === 0) || (direction === "down" && idx === tasks.length - 1)) return;

    const newTasks = [...tasks];
    const swapIdx = direction === "up" ? idx - 1 : idx + 1;
    [newTasks[idx], newTasks[swapIdx]] = [newTasks[swapIdx]!, newTasks[idx]!];
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
    setLoading(true);
    setError(null);
    try {
      const res = await fetch(`/api/sprints/${sprint.id}/start`, { method: "POST" });
      const body = await res.json();
      if (!res.ok) {
        setError(body.error ?? "Errore nell'avvio dello sprint.");
        return;
      }
      startTransition(() => router.refresh());
    } finally {
      setLoading(false);
    }
  }

  async function handleComplete() {
    if (!confirm("Completare lo sprint? Le task non finite torneranno nel backlog.")) return;
    setLoading(true);
    try {
      const res = await fetch(`/api/sprints/${sprint.id}/complete`, { method: "POST" });
      if (!res.ok) {
        const body = await res.json();
        setError(body.error ?? "Errore nel completamento dello sprint.");
        return;
      }
      startTransition(() => router.refresh());
    } finally {
      setLoading(false);
    }
  }

  const readyCount = tasks.filter((t) => t.status === "sprint_ready").length;
  const statusCounts = getStatusCounts();

  const startedDate = sprint.started_at
    ? new Date(sprint.started_at).toLocaleDateString("it-IT", { day: "2-digit", month: "short" })
    : null;

  return (
    <div className="rounded-lg border border-border bg-card">
      {/* Section header */}
      <div
        className={cn(
          "flex items-center gap-3 px-3 py-2.5 select-none",
          isExpanded && tasks.length > 0 && "border-b border-border"
        )}
      >
        {/* Select all */}
        <input
          type="checkbox"
          checked={allSelected}
          ref={(el) => { if (el) el.indeterminate = someSelected && !allSelected; }}
          onChange={(e) => onSelectAll(e.target.checked)}
          onClick={(e) => e.stopPropagation()}
          className="h-4 w-4 rounded border-border accent-primary shrink-0"
          aria-label="Seleziona tutto nello sprint"
        />

        {/* Expand/collapse chevron (separate from name for independent click) */}
        <button
          onClick={onToggle}
          className="shrink-0 text-xs text-muted-foreground hover:text-foreground transition-colors p-0.5"
          aria-expanded={isExpanded}
          aria-label={isExpanded ? "Comprimi sprint" : "Espandi sprint"}
        >
          <ChevronRight className={cn("h-3.5 w-3.5 transition-transform", isExpanded ? "rotate-90" : "")} />
        </button>

        {/* Sprint name — inline editable */}
        <div className="min-w-0 flex-1 flex items-center gap-2">
          {editingName ? (
            <span className="flex flex-col gap-0.5 min-w-0">
              <input
                ref={nameInputRef}
                value={nameValue}
                onChange={(e) => { setNameValue(e.target.value); setNameError(null); }}
                onBlur={() => void handleSaveName()}
                onKeyDown={handleNameKeyDown}
                disabled={nameSaving}
                maxLength={100}
                className="rounded border border-primary bg-background px-2 py-0.5 text-sm font-semibold outline-none focus:ring-2 focus:ring-primary/30 disabled:opacity-50 min-w-0 w-full max-w-[240px]"
              />
              {nameError && (
                <span className="text-xs font-normal text-destructive">{nameError}</span>
              )}
            </span>
          ) : (
            <span
              onClick={() => { setNameValue(sprintName); setEditingName(true); }}
              title="Clicca per modificare il nome"
              className="font-semibold text-sm truncate cursor-text underline decoration-dashed underline-offset-4 decoration-muted-foreground/30 hover:decoration-muted-foreground/60 transition-colors"
            >
              {sprintName}
            </span>
          )}
          {isActive && startedDate && (
            <span className="text-xs text-muted-foreground shrink-0">avviato {startedDate}</span>
          )}
          <span className="text-xs text-muted-foreground shrink-0">
            ({tasks.length} {tasks.length === 1 ? "ticket" : "ticket"})
          </span>
          {isActive && (
            <span className="shrink-0 rounded-full bg-green-100 dark:bg-green-900/30 px-2 py-0.5 text-xs font-medium text-green-700 dark:text-green-300">
              Attivo
            </span>
          )}
          {isPlanning && (
            <span className="shrink-0 rounded-full bg-amber-100 dark:bg-amber-900/30 px-2 py-0.5 text-xs font-medium text-amber-700 dark:text-amber-300">
              Pianificazione
            </span>
          )}
        </div>

        {/* Status counts */}
        <div className="flex items-center gap-1 shrink-0">
          {statusCounts.map(({ key, count, color, bg }) => (
            <span
              key={key}
              className={cn(
                "min-w-[22px] rounded px-1.5 py-0.5 text-center text-xs font-medium tabular-nums",
                color,
                bg
              )}
            >
              {count}
            </span>
          ))}
        </div>

        {/* Action button */}
        <div className="flex items-center gap-1 shrink-0">
          {isActive && (
            <button
              onClick={() => void handleComplete()}
              disabled={loading}
              className="rounded border border-border bg-background px-2.5 py-1 text-xs font-medium hover:bg-accent transition-colors disabled:opacity-50"
            >
              {loading ? "Completando..." : "Completa lo sprint"}
            </button>
          )}
          {isPlanning && (
            <button
              onClick={() => void handleStart()}
              disabled={loading || readyCount === 0}
              className="rounded border border-border bg-background px-2.5 py-1 text-xs font-medium hover:bg-accent transition-colors disabled:opacity-40"
              title={readyCount === 0 ? "Nessuna task pronta" : "Avvia lo sprint"}
            >
              {loading ? "Avviando..." : "Avvia sprint"}
            </button>
          )}
        </div>
      </div>

      {/* Error */}
      {error && (
        <div className="mx-3 mt-2 rounded-md bg-destructive/10 px-3 py-2 text-xs text-destructive">
          {error}
        </div>
      )}

      {/* Task list */}
      {isExpanded && (
        <div className="divide-y divide-border">
          {tasks.length === 0 ? (
            <div className="px-4 py-6 text-center text-sm text-muted-foreground">
              Nessuna task nello sprint.{" "}
              {isPlanning && (
                <span className="text-primary">Seleziona task dal backlog e aggiungile allo sprint.</span>
              )}
            </div>
          ) : (
            tasks.map((task, idx) => (
              <SprintTaskRow
                key={task.id}
                task={task}
                idx={idx}
                totalCount={tasks.length}
                isPlanning={isPlanning}
                selected={selectedIds.has(task.id)}
                onSelect={() => onSelectTask(task.id)}
                onRemove={() => void handleRemoveTask(task.id)}
                onMove={(dir) => void handleMoveTask(task.id, dir)}
              />
            ))
          )}
          {isPlanning && tasks.length > 0 && (
            <div className="px-4 py-2 text-xs text-muted-foreground">
              {readyCount} di {tasks.length} pronte per l&apos;avvio
            </div>
          )}
        </div>
      )}
    </div>
  );
}

interface SprintTaskRowProps {
  task: Task;
  idx: number;
  totalCount: number;
  isPlanning: boolean;
  selected: boolean;
  onSelect: () => void;
  onRemove: () => void;
  onMove: (direction: "up" | "down") => void;
}

function SprintTaskRow({ task, idx, totalCount, isPlanning, selected, onSelect, onRemove, onMove }: SprintTaskRowProps) {
  const priority = PRIORITY_ICONS[task.priority] ?? { icon: "—", className: "text-slate-400" };
  const TypeIcon = TYPE_ICON_MAP[task.type];

  return (
    <div
      className={cn(
        "group flex items-center gap-3 px-4 py-2.5 transition-colors text-sm",
        "hover:bg-accent/40",
        selected && "bg-accent/60"
      )}
    >
      {/* Checkbox */}
      <input
        type="checkbox"
        checked={selected}
        onChange={onSelect}
        className="h-4 w-4 shrink-0 rounded border-border accent-primary"
        aria-label={`Seleziona "${task.title}"`}
      />

      {/* Reorder controls (planning only) */}
      {isPlanning && (
        <div className="flex flex-col gap-0 shrink-0">
          <button
            onClick={() => onMove("up")}
            disabled={idx === 0}
            className="text-muted-foreground hover:text-foreground disabled:opacity-20"
            aria-label="Sposta su"
          >
            <ChevronUp className="h-3 w-3" />
          </button>
          <button
            onClick={() => onMove("down")}
            disabled={idx === totalCount - 1}
            className="text-muted-foreground hover:text-foreground disabled:opacity-20"
            aria-label="Sposta giù"
          >
            <ChevronDown className="h-3 w-3" />
          </button>
        </div>
      )}

      {/* Status dot */}
      <span
        className={cn("h-2.5 w-2.5 shrink-0 rounded-sm", STATUS_COLORS[task.status])}
        title={STATUS_LABELS[task.status]}
      />

      {/* Type icon */}
      {TypeIcon && <TypeIcon className="h-3.5 w-3.5 shrink-0 text-muted-foreground" />}

      {/* Title */}
      <Link
        href={`/tasks/${task.id}`}
        className="min-w-0 flex-1 font-medium truncate hover:underline"
      >
        {task.title}
      </Link>

      {/* Status badge */}
      <span className={cn(
        "shrink-0 rounded px-1.5 py-0.5 text-xs font-medium",
        task.status === "sprint_ready" && "bg-blue-100 text-blue-700 dark:bg-blue-900/30 dark:text-blue-300",
        task.status === "in_progress" && "bg-blue-600 text-white",
        task.status === "in_review" && "bg-yellow-100 text-yellow-700 dark:bg-yellow-900/30",
        task.status === "rework" && "bg-orange-100 text-orange-700 dark:bg-orange-900/30",
        task.status === "done" && "bg-green-100 text-green-700 dark:bg-green-900/30",
        task.status === "queued" && "bg-slate-100 text-slate-600 dark:bg-slate-800",
        task.status === "failed" && "bg-red-100 text-red-700 dark:bg-red-900/30",
        task.status === "cancelled" && "bg-slate-100 text-slate-400",
      )}>
        {STATUS_LABELS[task.status]}
      </span>

      {/* Priority */}
      <span className={cn("shrink-0 text-sm w-5 text-center", priority.className)}>
        {priority.icon}
      </span>

      {/* Effort */}
      {task.estimated_effort && (
        <span className="shrink-0 text-xs text-muted-foreground uppercase w-4 text-center">
          {task.estimated_effort}
        </span>
      )}

      {/* Remove (planning only) */}
      {isPlanning && (
        <button
          onClick={onRemove}
          className="shrink-0 text-muted-foreground opacity-0 group-hover:opacity-100 hover:text-destructive transition-opacity"
          aria-label="Rimuovi dallo sprint"
        >
          <X className="h-3.5 w-3.5" />
        </button>
      )}
    </div>
  );
}
