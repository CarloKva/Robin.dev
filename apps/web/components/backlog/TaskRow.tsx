"use client";

import { useState, useRef } from "react";
import Link from "next/link";
import { cn } from "@/lib/utils";
import { InlineSelect } from "./InlineSelect";
import type { Task, Repository } from "@robin/shared-types";

const PRIORITY_OPTIONS = [
  { value: "critical", label: "Critical", className: "text-red-600 bg-red-50 dark:bg-red-950/30" },
  { value: "high", label: "High", className: "text-orange-600 bg-orange-50 dark:bg-orange-950/30" },
  { value: "medium", label: "Medium", className: "text-yellow-600 bg-yellow-50 dark:bg-yellow-950/30" },
  { value: "low", label: "Low", className: "text-slate-500 bg-slate-100 dark:bg-slate-800" },
];

const TYPE_OPTIONS = [
  { value: "bug", label: "Bug", className: "text-red-700 bg-red-100 dark:bg-red-900/30" },
  { value: "feature", label: "Feature", className: "text-blue-700 bg-blue-100 dark:bg-blue-900/30" },
  { value: "refactor", label: "Refactor", className: "text-purple-700 bg-purple-100 dark:bg-purple-900/30" },
  { value: "chore", label: "Chore", className: "text-slate-600 bg-slate-100 dark:bg-slate-800" },
  { value: "docs", label: "Docs", className: "text-green-700 bg-green-100 dark:bg-green-900/30" },
  { value: "accessibility", label: "A11y", className: "text-cyan-700 bg-cyan-100 dark:bg-cyan-900/30" },
  { value: "security", label: "Security", className: "text-rose-700 bg-rose-100 dark:bg-rose-900/30" },
];

const EFFORT_OPTIONS = [
  { value: "xs", label: "XS", className: "text-slate-500" },
  { value: "s", label: "S", className: "text-slate-500" },
  { value: "m", label: "M", className: "text-slate-500" },
  { value: "l", label: "L", className: "text-slate-500" },
];

interface TaskRowProps {
  task: Task;
  selected: boolean;
  onSelectToggle: (id: string) => void;
  repositories: Repository[];
  disabled?: boolean;
}

async function patchTask(taskId: string, updates: Record<string, unknown>) {
  await fetch(`/api/tasks/${taskId}`, {
    method: "PATCH",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(updates),
  });
}

export function TaskRow({ task, selected, onSelectToggle, repositories, disabled = false }: TaskRowProps) {
  const [localTask, setLocalTask] = useState(task);
  const [editingTitle, setEditingTitle] = useState(false);
  const [titleValue, setTitleValue] = useState(task.title);
  const titleInputRef = useRef<HTMLInputElement>(null);

  const isEditable = !disabled && !["queued", "in_progress", "in_review"].includes(localTask.status);
  const isComplete = !!(localTask.title && localTask.description && localTask.type && localTask.priority && localTask.repository_id);

  function optimisticUpdate(updates: Partial<Task>) {
    setLocalTask((prev) => ({ ...prev, ...updates }));
  }

  async function handleInlineChange(field: string, value: string) {
    optimisticUpdate({ [field]: value } as Partial<Task>);
    await patchTask(localTask.id, { [field]: value });
  }

  async function handleTitleSave() {
    const trimmed = titleValue.trim();
    if (!trimmed || trimmed === localTask.title) {
      setEditingTitle(false);
      setTitleValue(localTask.title);
      return;
    }
    optimisticUpdate({ title: trimmed });
    setEditingTitle(false);
    await patchTask(localTask.id, { title: trimmed });
  }

  const repoOptions = repositories.map((r) => ({
    value: r.id,
    label: r.full_name.split("/")[1] ?? r.full_name,
  }));

  const createdDate = new Date(localTask.created_at).toLocaleDateString("it-IT", {
    day: "2-digit",
    month: "short",
  });

  return (
    <div
      className={cn(
        "group flex items-center gap-3 rounded-md px-3 py-2.5 transition-colors",
        "hover:bg-accent/40",
        selected && "bg-accent/60"
      )}
    >
      {/* Checkbox */}
      <input
        type="checkbox"
        checked={selected}
        onChange={() => onSelectToggle(localTask.id)}
        className="h-4 w-4 shrink-0 rounded border-border accent-primary"
        aria-label={`Seleziona "${localTask.title}"`}
      />

      {/* Completeness indicator */}
      <span
        className={cn(
          "h-2 w-2 shrink-0 rounded-full",
          isComplete ? "bg-green-500" : "bg-muted-foreground/30"
        )}
        title={isComplete ? "Task completa" : "Campi mancanti"}
      />

      {/* Title (double-click to edit) */}
      <div className="min-w-0 flex-1">
        {editingTitle ? (
          <input
            ref={titleInputRef}
            value={titleValue}
            onChange={(e) => setTitleValue(e.target.value)}
            onBlur={handleTitleSave}
            onKeyDown={(e) => {
              if (e.key === "Enter") handleTitleSave();
              if (e.key === "Escape") {
                setEditingTitle(false);
                setTitleValue(localTask.title);
              }
            }}
            autoFocus
            className="w-full rounded border border-border bg-background px-1 py-0.5 text-sm focus:outline-none focus:ring-1 focus:ring-ring"
          />
        ) : (
          <span
            onDoubleClick={() => {
              if (isEditable) setEditingTitle(true);
            }}
            className={cn(
              "block truncate text-sm font-medium",
              isEditable && "cursor-text"
            )}
            title={localTask.title}
          >
            <Link
              href={`/tasks/${localTask.id}`}
              className="hover:underline"
              onClick={(e) => editingTitle && e.preventDefault()}
            >
              {localTask.title}
            </Link>
          </span>
        )}
      </div>

      {/* Meta badges — inline editable */}
      <div className="flex shrink-0 items-center gap-1.5">
        <InlineSelect
          value={localTask.type}
          options={TYPE_OPTIONS}
          onSelect={(v) => handleInlineChange("type", v)}
          disabled={!isEditable}
        />

        <InlineSelect
          value={localTask.priority}
          options={PRIORITY_OPTIONS}
          onSelect={(v) => handleInlineChange("priority", v)}
          disabled={!isEditable}
        />

        <InlineSelect
          value={localTask.estimated_effort ?? undefined}
          options={EFFORT_OPTIONS}
          onSelect={(v) => handleInlineChange("estimated_effort", v)}
          placeholder="effort"
          disabled={!isEditable}
        />

        {repositories.length > 0 && (
          <InlineSelect
            value={localTask.repository_id ?? undefined}
            options={repoOptions}
            onSelect={(v) => handleInlineChange("repository_id", v)}
            placeholder="repo"
            disabled={!isEditable}
            triggerClassName="max-w-[100px] truncate"
          />
        )}

        <span className="text-xs text-muted-foreground">{createdDate}</span>
      </div>
    </div>
  );
}
