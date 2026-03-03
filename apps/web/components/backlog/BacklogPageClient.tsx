"use client";

import { useState, useTransition, useMemo, useRef } from "react";
import { useRouter } from "next/navigation";
import { cn } from "@/lib/utils";
import { SprintSection } from "./SprintSection";
import { TaskRow } from "./TaskRow";
import { BulkActionBar } from "./BulkActionBar";
import { ImportPreviewModal } from "./ImportPreviewModal";
import { parseRobinMd } from "@/lib/robin-md-parser";
import type { Task, Repository, Sprint, SprintWithTasks } from "@robin/shared-types";
import type { ParsedTask, ParseError } from "@/types/robin-md";

const MAX_FILE_SIZE_BYTES = 500 * 1024; // 500 KB

const TASK_TYPES = [
  { value: "", label: "Tipo ▾" },
  { value: "bug", label: "Bug" },
  { value: "feature", label: "Feature" },
  { value: "refactor", label: "Refactor" },
  { value: "chore", label: "Chore" },
  { value: "docs", label: "Docs" },
  { value: "accessibility", label: "Accessibility" },
  { value: "security", label: "Security" },
];

interface BacklogPageClientProps {
  sprints: SprintWithTasks[];
  backlogTasks: Task[];
  repositories: Repository[];
  allSprints: Sprint[];
}

export function BacklogPageClient({
  sprints: initialSprints,
  backlogTasks: initialBacklog,
  repositories,
  allSprints,
}: BacklogPageClientProps) {
  const router = useRouter();
  const [, startTransition] = useTransition();

  const [search, setSearch] = useState("");
  const [typeFilter, setTypeFilter] = useState("");
  const [expanded, setExpanded] = useState<Set<string>>(() => {
    const s = new Set<string>();
    initialSprints.forEach((sp) => s.add(sp.id));
    s.add("backlog");
    return s;
  });
  const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set());
  const [isCreatingTask, startCreateTaskTransition] = useTransition();
  const [creatingSprint, setCreatingSprint] = useState(false);

  // Import state
  type ImportModal = { tasks: ParsedTask[]; errors: ParseError[]; truncated: boolean; originalCount: number };
  const [importModal, setImportModal] = useState<ImportModal | null>(null);
  const [importFileError, setImportFileError] = useState<string | null>(null);
  const fileInputRef = useRef<HTMLInputElement | null>(null);

  function refresh() {
    startTransition(() => router.refresh());
  }

  function toggleExpand(id: string) {
    setExpanded((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  }

  function toggleSelectTask(id: string) {
    setSelectedIds((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  }

  function selectAllInSprint(tasks: Task[], select: boolean) {
    setSelectedIds((prev) => {
      const next = new Set(prev);
      tasks.forEach((t) => (select ? next.add(t.id) : next.delete(t.id)));
      return next;
    });
  }

  function selectAllBacklog(select: boolean) {
    setSelectedIds((prev) => {
      const next = new Set(prev);
      filteredBacklog.forEach((t) => (select ? next.add(t.id) : next.delete(t.id)));
      return next;
    });
  }

  async function handleCreateSprint() {
    setCreatingSprint(true);
    try {
      const res = await fetch("/api/sprints", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({}),
      });
      if (res.ok) refresh();
    } finally {
      setCreatingSprint(false);
    }
  }

  function handleCreateTask() {
    startCreateTaskTransition(() => {
      router.push("/tasks/new");
    });
  }

  function handleImportClick() {
    setImportFileError(null);
    fileInputRef.current?.click();
  }

  function handleFileChange(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    // Reset so the same file can be re-selected after closing
    e.target.value = "";
    if (!file) return;

    if (file.size > MAX_FILE_SIZE_BYTES) {
      setImportFileError("Il file supera il limite di 500 KB.");
      return;
    }

    const reader = new FileReader();
    reader.onload = (ev) => {
      const content = ev.target?.result;
      if (typeof content !== "string") return;
      const result = parseRobinMd(content);
      setImportModal({
        tasks: result.tasks,
        errors: result.errors,
        truncated: result.truncated === true,
        originalCount: result.originalCount ?? result.tasks.length + result.errors.length,
      });
    };
    reader.readAsText(file);
  }

  const filteredBacklog = useMemo(() => {
    return initialBacklog.filter((t) => {
      if (typeFilter && t.type !== typeFilter) return false;
      if (search && !t.title.toLowerCase().includes(search.toLowerCase())) return false;
      return true;
    });
  }, [initialBacklog, search, typeFilter]);

  const filteredSprints = useMemo(() => {
    if (!search && !typeFilter) return initialSprints;
    return initialSprints.map((sp) => ({
      ...sp,
      tasks: sp.tasks.filter((t) => {
        if (typeFilter && t.type !== typeFilter) return false;
        if (search && !t.title.toLowerCase().includes(search.toLowerCase())) return false;
        return true;
      }),
    }));
  }, [initialSprints, search, typeFilter]);

  const backlogAllSelected =
    filteredBacklog.length > 0 && filteredBacklog.every((t) => selectedIds.has(t.id));
  const backlogSomeSelected = filteredBacklog.some((t) => selectedIds.has(t.id));

  const backlogTodoCount = filteredBacklog.filter((t) => t.status === "backlog").length;

  return (
    <div className="space-y-0">
      {/* Hidden file input for .robin.md import */}
      <input
        ref={fileInputRef}
        type="file"
        accept=".md"
        className="hidden"
        onChange={handleFileChange}
      />

      {/* Import preview modal */}
      {importModal !== null && (
        <ImportPreviewModal
          tasks={importModal.tasks}
          errors={importModal.errors}
          truncated={importModal.truncated}
          originalCount={importModal.originalCount}
          repositories={repositories}
          onClose={() => setImportModal(null)}
          onImported={() => {
            setImportModal(null);
            refresh();
          }}
        />
      )}

      {/* Search + filter bar */}
      <div className="mb-4 flex flex-wrap items-center gap-2">
        <div className="relative">
          <span className="pointer-events-none absolute left-2.5 top-1/2 -translate-y-1/2 text-muted-foreground text-sm">
            🔍
          </span>
          <input
            type="text"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder="Cerca nel backlog"
            className="h-9 rounded-md border border-border bg-background pl-8 pr-3 text-sm placeholder:text-muted-foreground focus:outline-none focus:ring-1 focus:ring-ring w-52"
          />
        </div>

        <select
          value={typeFilter}
          onChange={(e) => setTypeFilter(e.target.value)}
          className="h-9 rounded-md border border-border bg-background px-2.5 text-sm text-foreground focus:outline-none focus:ring-1 focus:ring-ring"
        >
          {TASK_TYPES.map((t) => (
            <option key={t.value} value={t.value}>
              {t.label}
            </option>
          ))}
        </select>

        {(search || typeFilter) && (
          <button
            onClick={() => { setSearch(""); setTypeFilter(""); }}
            className="text-xs text-muted-foreground underline hover:text-foreground"
          >
            Azzera filtri
          </button>
        )}

        {/* Spacer */}
        <div className="flex-1" />

        {/* Import button */}
        <button
          onClick={handleImportClick}
          className="shrink-0 rounded-md border border-border bg-background px-3 py-1.5 text-xs font-medium hover:bg-accent transition-colors"
          title="Importa task da file .robin.md"
        >
          ↑ Importa .robin.md
        </button>
        {importFileError !== null && (
          <span className="text-xs text-red-600 dark:text-red-400">{importFileError}</span>
        )}
      </div>

      {/* Sprint sections */}
      <div className="space-y-2">
        {filteredSprints.map((sprint) => (
          <SprintSection
            key={sprint.id}
            sprint={sprint}
            isExpanded={expanded.has(sprint.id)}
            onToggle={() => toggleExpand(sprint.id)}
            selectedIds={selectedIds}
            onSelectTask={toggleSelectTask}
            onSelectAll={(select) => selectAllInSprint(sprint.tasks, select)}
            onRefresh={refresh}
          />
        ))}

        {/* Backlog section */}
        <div className="rounded-lg border border-border bg-card">
          {/* Backlog header */}
          <div
            className={cn(
              "flex items-center gap-3 px-3 py-2.5 select-none",
              expanded.has("backlog") && filteredBacklog.length > 0 && "border-b border-border"
            )}
          >
            {/* Select all backlog */}
            <input
              type="checkbox"
              checked={backlogAllSelected}
              ref={(el) => { if (el) el.indeterminate = backlogSomeSelected && !backlogAllSelected; }}
              onChange={(e) => selectAllBacklog(e.target.checked)}
              onClick={(e) => e.stopPropagation()}
              className="h-4 w-4 rounded border-border accent-primary shrink-0"
              aria-label="Seleziona tutto nel backlog"
            />

            {/* Expand/collapse */}
            <button
              onClick={() => toggleExpand("backlog")}
              className="flex items-center gap-2 min-w-0 flex-1 text-left"
            >
              <span className={cn("text-xs text-muted-foreground transition-transform shrink-0", expanded.has("backlog") ? "rotate-90" : "")}>
                ▶
              </span>
              <span className="font-semibold text-sm">Backlog</span>
              <span className="text-xs text-muted-foreground">
                ({filteredBacklog.length} {filteredBacklog.length === 1 ? "ticket" : "ticket"})
              </span>
            </button>

            {/* Backlog status counts */}
            <div className="flex items-center gap-1 shrink-0">
              <span className="min-w-[22px] rounded px-1.5 py-0.5 text-center text-xs font-medium text-slate-600 dark:text-slate-300 bg-slate-100 dark:bg-slate-800 tabular-nums">
                {backlogTodoCount}
              </span>
              <span className="min-w-[22px] rounded px-1.5 py-0.5 text-center text-xs font-medium text-blue-700 dark:text-blue-300 bg-blue-100 dark:bg-blue-900/40 tabular-nums">
                0
              </span>
              <span className="min-w-[22px] rounded px-1.5 py-0.5 text-center text-xs font-medium text-green-700 dark:text-green-300 bg-green-100 dark:bg-green-900/40 tabular-nums">
                0
              </span>
            </div>

            {/* Crea sprint */}
            <button
              onClick={() => void handleCreateSprint()}
              disabled={creatingSprint}
              className="shrink-0 rounded border border-border bg-background px-2.5 py-1 text-xs font-medium hover:bg-accent transition-colors disabled:opacity-50"
            >
              {creatingSprint ? "Creando sprint..." : "Crea sprint"}
            </button>
          </div>

          {/* Backlog task list */}
          {expanded.has("backlog") && (
            <div>
              {filteredBacklog.length === 0 ? (
                <div className="px-4 py-8 text-center">
                  <p className="text-sm text-muted-foreground">
                    {search || typeFilter ? "Nessuna task trovata con questi filtri." : "Il backlog è vuoto."}
                  </p>
                  {!search && !typeFilter && (
                    <p className="mt-1 text-xs text-muted-foreground">
                      Premi{" "}
                      <kbd className="rounded border border-border px-1 py-0.5 font-mono text-xs">N</kbd>{" "}
                      per creare una task.
                    </p>
                  )}
                </div>
              ) : (
                <div className="divide-y divide-border">
                  {filteredBacklog.map((task) => (
                    <TaskRow
                      key={task.id}
                      task={task}
                      selected={selectedIds.has(task.id)}
                      onSelectToggle={toggleSelectTask}
                      repositories={repositories}
                    />
                  ))}
                </div>
              )}

              {/* + Crea */}
              <div className="border-t border-border">
                <button
                  onClick={handleCreateTask}
                  disabled={isCreatingTask}
                  className="flex w-full items-center gap-2 px-4 py-2.5 text-sm text-muted-foreground hover:text-foreground hover:bg-accent/40 transition-colors disabled:opacity-50"
                >
                  <span>+</span>
                  <span>{isCreatingTask ? "Caricamento..." : "Crea task"}</span>
                </button>
              </div>
            </div>
          )}
        </div>
      </div>

      {/* Bulk action bar */}
      <BulkActionBar
        selectedIds={[...selectedIds]}
        sprints={allSprints}
        onDone={() => {
          setSelectedIds(new Set());
          refresh();
        }}
      />
    </div>
  );
}
