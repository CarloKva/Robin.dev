"use client";

import { useEffect, useState } from "react";
import { ChevronRight } from "lucide-react";
import { cn } from "@/lib/utils";
import { SprintTaskRow } from "./SprintTaskRow";
import type { SprintWithTasks, Repository } from "@robin/shared-types";

interface Agent {
  id: string;
  name: string;
}

interface SprintCardProps {
  sprint: SprintWithTasks;
  isExpanded: boolean;
  onToggleExpand: () => void;
  isDragOver: boolean;
  onDragOver: (e: React.DragEvent) => void;
  onDragLeave: (e: React.DragEvent) => void;
  onDrop: (e: React.DragEvent) => void;
  draggingTaskId: string | null;
  justDroppedTaskId: string | null;
  isEditingName: boolean;
  editingSprintName: string;
  onEditNameChange: (name: string) => void;
  onSaveName: () => void;
  onStartEditName: () => void;
  sprintNameInputRef: React.RefObject<HTMLInputElement>;
  onSprintNameKeyDown: (e: React.KeyboardEvent<HTMLInputElement>) => void;
  loading: boolean;
  error: string | null;
  onStartSprint: () => void;
  onCompleteSprint: () => void;
  onRemoveFromSprint: ((taskId: string) => void) | undefined;
  onDragStart: (e: React.DragEvent, taskId: string) => void;
  onDragEnd: () => void;
  openDrawer: () => void;
  repositories: Repository[];
  agents: Agent[];
}

function formatDate(iso: string): string {
  return new Date(iso).toLocaleDateString("it-IT", {
    day: "numeric",
    month: "short",
    year: "numeric",
  });
}

function SprintProgressBar({ completed, total }: { completed: number; total: number }) {
  const [mounted, setMounted] = useState(false);

  useEffect(() => {
    const id = requestAnimationFrame(() => setMounted(true));
    return () => cancelAnimationFrame(id);
  }, []);

  const pct = total > 0 ? Math.round((completed / total) * 100) : 0;

  return (
    <div
      className="h-1 w-full bg-[#F2F2F7] dark:bg-[#2C2C2E] rounded-full overflow-hidden"
      role="progressbar"
      aria-valuenow={pct}
      aria-valuemin={0}
      aria-valuemax={100}
    >
      <div
        className="h-full rounded-full bg-[#34C759]"
        style={{
          width: mounted ? `${pct}%` : "0%",
          transition: "width 600ms ease-out",
        }}
      />
    </div>
  );
}

export function SprintCard({
  sprint,
  isExpanded,
  onToggleExpand,
  isDragOver,
  onDragOver,
  onDragLeave,
  onDrop,
  draggingTaskId,
  justDroppedTaskId,
  isEditingName,
  editingSprintName,
  onEditNameChange,
  onSaveName,
  onStartEditName,
  sprintNameInputRef,
  onSprintNameKeyDown,
  loading,
  error,
  onStartSprint,
  onCompleteSprint,
  onRemoveFromSprint,
  onDragStart,
  onDragEnd,
  openDrawer,
  repositories,
  agents,
}: SprintCardProps) {
  const isActive = sprint.status === "active";
  const isPlanning = sprint.status === "planning";

  const completedCount = sprint.tasks.filter(
    (t) => t.status === "done" || t.status === "completed"
  ).length;
  const readyCount = sprint.tasks.filter((t) => t.status === "sprint_ready").length;

  // Date range display
  let dateRange: string | null = null;
  if (sprint.started_at && sprint.completed_at) {
    dateRange = `${formatDate(sprint.started_at)} — ${formatDate(sprint.completed_at)}`;
  } else if (sprint.started_at) {
    dateRange = `dal ${formatDate(sprint.started_at)}`;
  }

  return (
    <div
      className={cn(
        "rounded-ios-lg shadow-ios-sm bg-white dark:bg-[#1C1C1E] mb-4 overflow-hidden transition-colors duration-150",
        isDragOver && "ring-1 ring-[#007AFF] bg-[#007AFF]/5 dark:bg-[#007AFF]/10"
      )}
      onDragOver={onDragOver}
      onDragLeave={onDragLeave}
      onDrop={onDrop}
    >
      {/* Header */}
      <div
        className={cn(
          "flex items-center gap-2 px-4 py-3 cursor-pointer select-none hover:bg-black/[0.02] dark:hover:bg-white/[0.03] transition-colors duration-150"
        )}
        onClick={isEditingName ? undefined : onToggleExpand}
      >
        {/* Chevron */}
        <ChevronRight
          className={cn(
            "h-4 w-4 text-[#8E8E93] shrink-0 transition-transform duration-200",
            isExpanded ? "rotate-90" : ""
          )}
        />

        {/* Left: name + date */}
        <div className="flex-1 min-w-0">
          {isEditingName ? (
            <input
              ref={sprintNameInputRef}
              type="text"
              value={editingSprintName}
              onChange={(e) => onEditNameChange(e.target.value)}
              onBlur={onSaveName}
              onKeyDown={onSprintNameKeyDown}
              onClick={(e) => e.stopPropagation()}
              className="w-full rounded border border-ring bg-background px-2 py-0.5 text-sm font-semibold focus:outline-none focus:ring-1 focus:ring-ring"
              autoFocus
            />
          ) : (
            <div className="flex items-center gap-2 flex-wrap">
              <button
                onDoubleClick={(e) => {
                  e.stopPropagation();
                  onStartEditName();
                }}
                onClick={(e) => e.stopPropagation()}
                className="font-semibold text-base truncate text-left"
                title="Doppio clic per rinominare"
              >
                {sprint.name}
              </button>
              {dateRange && (
                <span className="text-xs text-[#8E8E93] shrink-0">{dateRange}</span>
              )}
            </div>
          )}
        </div>

        {/* Right: status badge + task pill */}
        <div className="flex items-center gap-2 shrink-0" onClick={(e) => e.stopPropagation()}>
          {isActive && (
            <span className="rounded-full bg-[#34C759]/10 px-2.5 py-0.5 text-xs font-medium text-[#34C759]">
              Attivo
            </span>
          )}
          {isPlanning && (
            <span className="rounded-full bg-[#8E8E93]/10 px-2.5 py-0.5 text-xs font-medium text-[#8E8E93]">
              Pianificato
            </span>
          )}
          {sprint.status === "completed" && (
            <span className="rounded-full bg-[#8E8E93]/10 px-2.5 py-0.5 text-xs font-medium text-[#8E8E93]">
              Completato
            </span>
          )}
          <span className="text-xs text-[#8E8E93]">
            {sprint.tasks.length} {sprint.tasks.length === 1 ? "task" : "task"} · {completedCount} {completedCount === 1 ? "completata" : "completate"}
          </span>

          {/* Sprint action buttons */}
          {isPlanning && (
            <button
              onClick={() => onStartSprint()}
              disabled={loading || readyCount === 0}
              className="rounded border border-border bg-background px-2.5 py-1 text-xs font-medium hover:bg-accent transition-colors disabled:opacity-40"
              title={readyCount === 0 ? "Nessuna task pronta" : "Avvia lo sprint"}
            >
              {loading ? "Avviando..." : "Avvia sprint"}
            </button>
          )}
          {isActive && (
            <button
              onClick={() => onCompleteSprint()}
              disabled={loading}
              className="rounded border border-border bg-background px-2.5 py-1 text-xs font-medium hover:bg-accent transition-colors disabled:opacity-50"
            >
              {loading ? "Completando..." : "Completa lo sprint"}
            </button>
          )}
        </div>
      </div>

      {/* Progress bar — always visible */}
      <div className="px-4 pb-3">
        <SprintProgressBar completed={completedCount} total={sprint.tasks.length} />
      </div>

      {/* Error */}
      {error && (
        <div className="mx-4 mb-2 rounded-md bg-destructive/10 px-3 py-2 text-xs text-destructive">
          {error}
        </div>
      )}

      {/* Collapsible body */}
      <div
        style={{
          display: "grid",
          gridTemplateRows: isExpanded ? "1fr" : "0fr",
          transition: "grid-template-rows 250ms cubic-bezier(0.25, 0.46, 0.45, 0.94)",
        }}
      >
        <div className="overflow-hidden">
        <div className="border-t border-border/60">
          {sprint.tasks.length === 0 ? (
            <div
              className={cn(
                "flex flex-col items-center justify-center gap-1 px-4 py-8 text-center transition-colors duration-150",
                isDragOver && "bg-[#007AFF]/5"
              )}
            >
              <p className="text-sm text-muted-foreground">
                {isDragOver
                  ? "Rilascia qui per aggiungere allo sprint"
                  : "Nessuna task in questo sprint"}
              </p>
              {!isDragOver && isPlanning && (
                <p className="text-xs text-muted-foreground">
                  Trascina task dal backlog qui sotto per aggiungerle allo sprint.
                </p>
              )}
            </div>
          ) : (
            <div>
              {sprint.tasks.map((task) => {
                const isDragging = draggingTaskId === task.id;
                const justLanded = justDroppedTaskId === task.id;
                return (
                  <div
                    key={task.id}
                    draggable
                    onDragStart={(e) => onDragStart(e, task.id)}
                    onDragEnd={onDragEnd}
                    className={cn(
                      "cursor-grab active:cursor-grabbing",
                      isDragging && "border border-dashed border-border/60 rounded-sm mx-1 my-0.5",
                      justLanded && "animate-task-landing"
                    )}
                  >
                    <div className={isDragging ? "invisible" : ""}>
                      <SprintTaskRow
                        task={task}
                        repositories={repositories}
                        agents={agents}
                        {...(isPlanning && onRemoveFromSprint
                          ? { onRemove: () => onRemoveFromSprint(task.id) }
                          : {})}
                      />
                    </div>
                  </div>
                );
              })}
            </div>
          )}

          {isPlanning && (
            <div className="border-t border-border/60">
              <button
                onClick={openDrawer}
                className="flex w-full items-center gap-2 px-4 py-2.5 text-sm text-muted-foreground hover:text-foreground hover:bg-accent/40 transition-colors"
              >
                <span>+</span>
                <span>Crea</span>
              </button>
            </div>
          )}
        </div>
        </div>
      </div>
    </div>
  );
}
