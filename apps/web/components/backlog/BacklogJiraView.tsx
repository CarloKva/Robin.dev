"use client";

import {
  useState,
  useTransition,
  useMemo,
  useCallback,
  useEffect,
  useRef,
} from "react";
import { Search, X, ChevronRight, ArrowUpDown, Check, Sparkles } from "lucide-react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { cn } from "@/lib/utils";
import { TaskRow } from "./TaskRow";
import { BulkActionBar } from "./BulkActionBar";
import { CreateTaskDrawer } from "./CreateTaskDrawer";
import { BrainstormModal } from "./BrainstormModal";
import { CustomSelect } from "@/components/ui/CustomSelect";
import { useKeyboardShortcut } from "@/lib/hooks/useKeyboardShortcut";
import type { Task, Repository, Sprint, SprintWithTasks, ContextDocument } from "@robin/shared-types";
import { PRIORITY_ICONS, STATUS_LABELS, STATUS_COLORS } from "@/lib/task-constants";

const TASK_TYPES = [
  { value: "", label: "Tipo" },
  { value: "bug", label: "Bug" },
  { value: "feature", label: "Feature" },
  { value: "refactor", label: "Refactor" },
  { value: "chore", label: "Chore" },
  { value: "docs", label: "Docs" },
  { value: "accessibility", label: "Accessibility" },
  { value: "security", label: "Security" },
];

type TaskStatus = Task["status"];

const STATUS_COUNTS_CONFIG: {
  key: string;
  statuses: TaskStatus[];
  color: string;
  bg: string;
}[] = [
  {
    key: "todo",
    statuses: ["sprint_ready", "queued"],
    color: "text-slate-600 dark:text-slate-300",
    bg: "bg-slate-100 dark:bg-slate-800",
  },
  {
    key: "doing",
    statuses: ["in_progress", "in_review", "rework"],
    color: "text-blue-700 dark:text-blue-300",
    bg: "bg-blue-100 dark:bg-blue-900/40",
  },
  {
    key: "done",
    statuses: ["done", "completed"],
    color: "text-green-700 dark:text-green-300",
    bg: "bg-green-100 dark:bg-green-900/40",
  },
];

interface Agent {
  id: string;
  name: string;
}

interface BacklogJiraViewProps {
  sprints: SprintWithTasks[];
  backlogTasks: Task[];
  repositories: Repository[];
  allSprints: Sprint[];
  agents?: Agent[];
  contextDocs?: ContextDocument[];
}

export function BacklogJiraView({
  sprints: initialSprints,
  backlogTasks: initialBacklog,
  repositories,
  allSprints,
  agents = [],
  contextDocs = [],
}: BacklogJiraViewProps) {
  const router = useRouter();
  const [, startTransition] = useTransition();

  const [localBacklog, setLocalBacklog] = useState<Task[]>(initialBacklog);
  const [localSprints, setLocalSprints] = useState<SprintWithTasks[]>(initialSprints);

  useEffect(() => setLocalBacklog(initialBacklog), [initialBacklog]);
  useEffect(() => setLocalSprints(initialSprints), [initialSprints]);

  const [search, setSearch] = useState("");
  const [typeFilter, setTypeFilter] = useState("");
  const [expanded, setExpanded] = useState<Set<string>>(() => {
    const s = new Set<string>(["backlog"]);
    initialSprints.forEach((sp) => s.add(sp.id));
    return s;
  });
  const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set());
  const [isDrawerOpen, setIsDrawerOpen] = useState(false);
  const [isBrainstormOpen, setIsBrainstormOpen] = useState(false);

  // ── Sprint creation with name ──────────────────────────────────────────────
  const [showCreateSprintForm, setShowCreateSprintForm] = useState(false);
  const [newSprintName, setNewSprintName] = useState("");
  const [creatingSprint, setCreatingSprint] = useState(false);
  const newSprintInputRef = useRef<HTMLInputElement>(null);

  // ── Sprint name editing ────────────────────────────────────────────────────
  const [editingSprintId, setEditingSprintId] = useState<string | null>(null);
  const [editingSprintName, setEditingSprintName] = useState("");
  const sprintNameInputRef = useRef<HTMLInputElement>(null);

  // DnD state
  const [draggingTaskId, setDraggingTaskId] = useState<string | null>(null);
  const [dragOverSprintId, setDragOverSprintId] = useState<string | null>(null);

  // Sprint action state (per sprint)
  const [sprintLoading, setSprintLoading] = useState<Record<string, boolean>>({});
  const [sprintError, setSprintError] = useState<Record<string, string | null>>({});

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

  function selectAllBacklog(select: boolean) {
    setSelectedIds((prev) => {
      const next = new Set(prev);
      filteredBacklog.forEach((t) => (select ? next.add(t.id) : next.delete(t.id)));
      return next;
    });
  }

  // ── Sprint creation ────────────────────────────────────────────────────────

  function openCreateSprintForm() {
    // Pre-fill with generated week name
    const now = new Date();
    const year = now.getFullYear();
    const week = Math.ceil(
      ((now.getTime() - new Date(year, 0, 1).getTime()) / 86400000 +
        new Date(year, 0, 1).getDay() +
        1) /
        7
    );
    setNewSprintName(`Sprint W${String(week).padStart(2, "0")}-${year}`);
    setShowCreateSprintForm(true);
    setTimeout(() => newSprintInputRef.current?.select(), 30);
  }

  async function handleCreateSprint() {
    const name = newSprintName.trim();
    if (!name) return;
    setCreatingSprint(true);
    try {
      const res = await fetch("/api/sprints", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ name }),
      });
      if (res.ok) {
        setShowCreateSprintForm(false);
        setNewSprintName("");
        refresh();
      }
    } finally {
      setCreatingSprint(false);
    }
  }

  function handleCreateSprintKeyDown(e: React.KeyboardEvent<HTMLInputElement>) {
    if (e.key === "Enter") {
      e.preventDefault();
      void handleCreateSprint();
    }
    if (e.key === "Escape") {
      setShowCreateSprintForm(false);
      setNewSprintName("");
    }
  }

  // ── Sprint name editing ────────────────────────────────────────────────────

  function startEditSprintName(sprint: SprintWithTasks) {
    setEditingSprintId(sprint.id);
    setEditingSprintName(sprint.name);
    setTimeout(() => sprintNameInputRef.current?.select(), 30);
  }

  async function saveSprintName(sprintId: string) {
    const name = editingSprintName.trim();
    if (!name) {
      setEditingSprintId(null);
      return;
    }
    setEditingSprintId(null);
    await fetch(`/api/sprints/${sprintId}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ name }),
    });
    refresh();
  }

  function handleSprintNameKeyDown(e: React.KeyboardEvent<HTMLInputElement>, sprintId: string) {
    if (e.key === "Enter") {
      e.preventDefault();
      void saveSprintName(sprintId);
    }
    if (e.key === "Escape") {
      setEditingSprintId(null);
    }
  }

  // ── Sprint actions ────────────────────────────────────────────────────────

  async function handleStartSprint(sprintId: string) {
    setSprintLoading((p) => ({ ...p, [sprintId]: true }));
    setSprintError((p) => ({ ...p, [sprintId]: null }));
    try {
      const res = await fetch(`/api/sprints/${sprintId}/start`, { method: "POST" });
      const body = await res.json() as { error?: string };
      if (!res.ok) {
        setSprintError((p) => ({ ...p, [sprintId]: body.error ?? "Errore nell'avvio." }));
        return;
      }
      refresh();
    } finally {
      setSprintLoading((p) => ({ ...p, [sprintId]: false }));
    }
  }

  async function handleCompleteSprint(sprintId: string) {
    if (!confirm("Completare lo sprint? Le task non finite torneranno nel backlog.")) return;
    setSprintLoading((p) => ({ ...p, [sprintId]: true }));
    try {
      const res = await fetch(`/api/sprints/${sprintId}/complete`, { method: "POST" });
      if (!res.ok) {
        const body = await res.json() as { error?: string };
        setSprintError((p) => ({ ...p, [sprintId]: body.error ?? "Errore nel completamento." }));
        return;
      }
      refresh();
    } finally {
      setSprintLoading((p) => ({ ...p, [sprintId]: false }));
    }
  }

  async function handleRemoveFromSprint(taskId: string, sprintId: string) {
    const task = localSprints
      .find((s) => s.id === sprintId)
      ?.tasks.find((t) => t.id === taskId);
    if (!task) return;

    setLocalSprints((prev) =>
      prev.map((s) =>
        s.id === sprintId ? { ...s, tasks: s.tasks.filter((t) => t.id !== taskId) } : s
      )
    );
    setLocalBacklog((prev) => [{ ...task, sprint_id: null, status: "backlog" as TaskStatus }, ...prev]);

    await fetch(`/api/tasks/${taskId}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ sprint_id: null, status: "backlog", sprint_order: null }),
    });
    refresh();
  }

  // ── Drag and drop ─────────────────────────────────────────────────────────

  function handleDragStart(e: React.DragEvent, taskId: string) {
    e.dataTransfer.setData("text/plain", taskId);
    e.dataTransfer.effectAllowed = "move";
    setDraggingTaskId(taskId);
  }

  function handleDragEnd() {
    setDraggingTaskId(null);
    setDragOverSprintId(null);
  }

  function handleDragOver(e: React.DragEvent, sprintId: string) {
    e.preventDefault();
    e.dataTransfer.dropEffect = "move";
    setDragOverSprintId(sprintId);
  }

  function handleDragLeave(e: React.DragEvent) {
    if (!(e.currentTarget as HTMLElement).contains(e.relatedTarget as Node)) {
      setDragOverSprintId(null);
    }
  }

  async function handleDrop(e: React.DragEvent, sprintId: string) {
    e.preventDefault();
    const taskId = e.dataTransfer.getData("text/plain");
    setDraggingTaskId(null);
    setDragOverSprintId(null);

    const task = localBacklog.find((t) => t.id === taskId);
    if (!task) return;

    setLocalBacklog((prev) => prev.filter((t) => t.id !== taskId));
    setLocalSprints((prev) =>
      prev.map((s) =>
        s.id === sprintId
          ? { ...s, tasks: [...s.tasks, { ...task, sprint_id: sprintId, status: "sprint_ready" as TaskStatus }] }
          : s
      )
    );

    await fetch(`/api/tasks/${taskId}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ sprint_id: sprintId, status: "sprint_ready" }),
    });
    refresh();
  }

  // ── Drawer ─────────────────────────────────────────────────────────────────

  const openDrawer = useCallback(() => setIsDrawerOpen(true), []);
  useKeyboardShortcut("n", openDrawer);

  // ── Filtered data ──────────────────────────────────────────────────────────

  const filteredBacklog = useMemo(() => {
    return localBacklog.filter((t) => {
      if (typeFilter && t.type !== typeFilter) return false;
      if (search && !t.title.toLowerCase().includes(search.toLowerCase())) return false;
      return true;
    });
  }, [localBacklog, search, typeFilter]);

  const filteredSprints = useMemo(() => {
    if (!search && !typeFilter) return localSprints;
    return localSprints.map((sp) => ({
      ...sp,
      tasks: sp.tasks.filter((t) => {
        if (typeFilter && t.type !== typeFilter) return false;
        if (search && !t.title.toLowerCase().includes(search.toLowerCase())) return false;
        return true;
      }),
    }));
  }, [localSprints, search, typeFilter]);

  const backlogAllSelected =
    filteredBacklog.length > 0 && filteredBacklog.every((t) => selectedIds.has(t.id));
  const backlogSomeSelected = filteredBacklog.some((t) => selectedIds.has(t.id));

  function getStatusCounts(tasks: Task[]) {
    return STATUS_COUNTS_CONFIG.map((cfg) => ({
      ...cfg,
      count: tasks.filter((t) => cfg.statuses.includes(t.status)).length,
    }));
  }

  // ── Render ─────────────────────────────────────────────────────────────────

  return (
    <div className={cn("space-y-0 transition-all duration-300 ease-in-out", isBrainstormOpen ? "md:mr-[480px]" : "")}>
      <BrainstormModal
        isOpen={isBrainstormOpen}
        onClose={() => setIsBrainstormOpen(false)}
        repositories={repositories}
        contextDocs={contextDocs}
        onImported={refresh}
      />

      {/* Floating trigger for brainstorm drawer */}
      <button
        onClick={() => setIsBrainstormOpen((prev) => !prev)}
        className="fixed bottom-4 right-4 z-30 flex h-12 w-12 items-center justify-center rounded-full bg-foreground text-background shadow-lg transition-colors hover:bg-foreground/90"
        aria-label={isBrainstormOpen ? "Chiudi Genera Task" : "Apri Genera Task"}
      >
        {isBrainstormOpen ? <X className="h-5 w-5" /> : <Sparkles className="h-5 w-5" />}
      </button>

      <CreateTaskDrawer
        isOpen={isDrawerOpen}
        onClose={() => setIsDrawerOpen(false)}
        onCreated={refresh}
        repositories={repositories}
        agents={agents}
        contextDocs={contextDocs}
      />

      {/* ── Filter bar ─────────────────────────────────────────────────────── */}
      <div className="mb-4 flex flex-wrap items-center gap-2">
        <div className="relative">
          <Search className="pointer-events-none absolute left-2.5 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
          <input
            type="text"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder="Cerca nel backlog"
            className="h-9 rounded-md border border-border bg-background pl-8 pr-3 text-sm placeholder:text-muted-foreground focus:outline-none focus:ring-1 focus:ring-ring w-52"
          />
        </div>

        <CustomSelect
          value={typeFilter}
          onChange={setTypeFilter}
          options={TASK_TYPES}
          className="w-36 h-9"
        />

        {(search || typeFilter) && (
          <button
            onClick={() => { setSearch(""); setTypeFilter(""); }}
            className="text-xs text-muted-foreground underline hover:text-foreground"
          >
            Azzera filtri
          </button>
        )}

        <div className="flex-1" />
      </div>

      {/* ── Sprint sections ────────────────────────────────────────────────── */}
      <div className="mt-4 space-y-2">
        {filteredSprints.length === 0 ? (
          <div className="rounded-lg border border-dashed border-border bg-card">
            <div className="flex items-center justify-between px-4 py-3">
              <span className="text-sm text-muted-foreground">Nessuno sprint. Crea uno sprint per iniziare a pianificare.</span>
              {showCreateSprintForm ? (
                <div className="flex items-center gap-2 shrink-0 ml-3">
                  <input
                    ref={newSprintInputRef}
                    type="text"
                    value={newSprintName}
                    onChange={(e) => setNewSprintName(e.target.value)}
                    onKeyDown={handleCreateSprintKeyDown}
                    placeholder="Nome sprint"
                    className="h-7 rounded border border-border bg-background px-2 text-xs focus:outline-none focus:ring-1 focus:ring-ring w-44"
                    disabled={creatingSprint}
                    autoFocus
                  />
                  <button
                    onClick={() => void handleCreateSprint()}
                    disabled={creatingSprint || !newSprintName.trim()}
                    className="rounded border border-primary bg-primary px-2.5 py-1 text-xs font-medium text-primary-foreground hover:bg-primary/90 transition-colors disabled:opacity-50"
                  >
                    {creatingSprint ? "…" : <Check className="h-3.5 w-3.5" />}
                  </button>
                  <button
                    onClick={() => { setShowCreateSprintForm(false); setNewSprintName(""); }}
                    className="rounded border border-border bg-background px-2.5 py-1 text-xs font-medium hover:bg-accent transition-colors"
                  >
                    <X className="h-3.5 w-3.5" />
                  </button>
                </div>
              ) : (
                <button
                  onClick={openCreateSprintForm}
                  className="shrink-0 rounded border border-border bg-background px-2.5 py-1 text-xs font-medium hover:bg-accent transition-colors"
                >
                  + Crea sprint
                </button>
              )}
            </div>
          </div>
        ) : (
          <>
            {filteredSprints.map((sprint) => {
              const isExpanded = expanded.has(sprint.id);
              const isActive = sprint.status === "active";
              const isPlanning = sprint.status === "planning";
              const loading = sprintLoading[sprint.id] ?? false;
              const error = sprintError[sprint.id] ?? null;
              const isDragOver = dragOverSprintId === sprint.id;
              const counts = getStatusCounts(sprint.tasks);
              const readyCount = sprint.tasks.filter((t) => t.status === "sprint_ready").length;
              const isEditingName = editingSprintId === sprint.id;

              const startedDate = sprint.started_at
                ? new Date(sprint.started_at).toLocaleDateString("it-IT", { day: "2-digit", month: "short" })
                : null;

              return (
                <div
                  key={sprint.id}
                  className={cn(
                    "rounded-lg border bg-card transition-all",
                    isDragOver
                      ? "border-primary/60 ring-2 ring-primary/30 bg-primary/5"
                      : "border-border"
                  )}
                  onDragOver={(e) => handleDragOver(e, sprint.id)}
                  onDragLeave={handleDragLeave}
                  onDrop={(e) => void handleDrop(e, sprint.id)}
                >
                  {/* Sprint header */}
                  <div
                    className={cn(
                      "flex items-center gap-3 px-3 py-2.5 select-none",
                      isExpanded && sprint.tasks.length > 0 && "border-b border-border"
                    )}
                  >
                    <button
                      onClick={() => toggleExpand(sprint.id)}
                      className="flex items-center gap-2 min-w-0 flex-1 text-left"
                      aria-expanded={isExpanded}
                    >
                      <ChevronRight className={cn("h-3.5 w-3.5 text-muted-foreground transition-transform shrink-0", isExpanded ? "rotate-90" : "")} />
                    </button>

                    {/* Sprint name — click to edit */}
                    {isEditingName ? (
                      <input
                        ref={sprintNameInputRef}
                        type="text"
                        value={editingSprintName}
                        onChange={(e) => setEditingSprintName(e.target.value)}
                        onBlur={() => void saveSprintName(sprint.id)}
                        onKeyDown={(e) => handleSprintNameKeyDown(e, sprint.id)}
                        className="flex-1 rounded border border-ring bg-background px-2 py-0.5 text-sm font-semibold focus:outline-none focus:ring-1 focus:ring-ring min-w-0"
                        autoFocus
                      />
                    ) : (
                      <button
                        onClick={() => toggleExpand(sprint.id)}
                        onDoubleClick={() => startEditSprintName(sprint)}
                        className="flex items-center gap-2 min-w-0 flex-1 text-left"
                        title="Doppio clic per rinominare"
                      >
                        <span className="font-semibold text-sm truncate">{sprint.name}</span>
                        {isActive && startedDate && (
                          <span className="text-xs text-muted-foreground shrink-0">avviato {startedDate}</span>
                        )}
                        <span className="text-xs text-muted-foreground shrink-0">
                          ({sprint.tasks.length} {sprint.tasks.length === 1 ? "ticket" : "ticket"})
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
                      </button>
                    )}

                    {/* Status counts */}
                    <div className="flex items-center gap-1 shrink-0">
                      {counts.map(({ key, count, color, bg }) => (
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

                    {/* Sprint action buttons */}
                    {isPlanning && (
                      <button
                        onClick={() => void handleStartSprint(sprint.id)}
                        disabled={loading || readyCount === 0}
                        className="shrink-0 rounded border border-border bg-background px-2.5 py-1 text-xs font-medium hover:bg-accent transition-colors disabled:opacity-40"
                        title={readyCount === 0 ? "Nessuna task pronta" : "Avvia lo sprint"}
                      >
                        {loading ? "Avviando..." : "Avvia sprint"}
                      </button>
                    )}
                    {isActive && (
                      <button
                        onClick={() => void handleCompleteSprint(sprint.id)}
                        disabled={loading}
                        className="shrink-0 rounded border border-border bg-background px-2.5 py-1 text-xs font-medium hover:bg-accent transition-colors disabled:opacity-50"
                      >
                        {loading ? "Completando..." : "Completa lo sprint"}
                      </button>
                    )}
                  </div>

                  {error && (
                    <div className="mx-3 mt-1 rounded-md bg-destructive/10 px-3 py-2 text-xs text-destructive">
                      {error}
                    </div>
                  )}

                  {/* Sprint task list */}
                  {isExpanded && (
                    <div>
                      {sprint.tasks.length === 0 ? (
                        <div
                          className={cn(
                            "flex flex-col items-center justify-center gap-1 px-4 py-8 text-center transition-colors",
                            isDragOver && "bg-primary/5"
                          )}
                        >
                          <p className="text-sm text-muted-foreground">
                            {isDragOver
                              ? "Rilascia qui per aggiungere allo sprint"
                              : "Nessuna task nello sprint."}
                          </p>
                          {!isDragOver && isPlanning && (
                            <p className="text-xs text-muted-foreground">
                              Trascina task dal backlog qui sotto per aggiungerle allo sprint.
                            </p>
                          )}
                        </div>
                      ) : (
                        <div className="divide-y divide-border">
                          {sprint.tasks.map((task) => {
                            const priority = PRIORITY_ICONS[task.priority] ?? { icon: "—", className: "text-slate-400" };
                            return (
                              <div
                                key={task.id}
                                className="group flex items-center gap-3 px-4 py-2.5 hover:bg-accent/40 text-sm"
                              >
                                <span
                                  className={cn("h-2.5 w-2.5 shrink-0 rounded-sm", STATUS_COLORS[task.status])}
                                  title={STATUS_LABELS[task.status]}
                                />
                                <Link
                                  href={`/tasks/${task.id}`}
                                  className="min-w-0 flex-1 font-medium truncate hover:underline"
                                >
                                  {task.title}
                                </Link>
                                <span
                                  className={cn(
                                    "shrink-0 rounded px-1.5 py-0.5 text-xs font-medium",
                                    task.status === "sprint_ready" && "bg-blue-100 text-blue-700 dark:bg-blue-900/30 dark:text-blue-300",
                                    task.status === "in_progress" && "bg-blue-600 text-white",
                                    task.status === "in_review" && "bg-yellow-100 text-yellow-700 dark:bg-yellow-900/30",
                                    task.status === "rework" && "bg-orange-100 text-orange-700 dark:bg-orange-900/30",
                                    task.status === "done" && "bg-green-100 text-green-700 dark:bg-green-900/30",
                                    task.status === "queued" && "bg-slate-100 text-slate-600 dark:bg-slate-800",
                                    task.status === "failed" && "bg-red-100 text-red-700 dark:bg-red-900/30",
                                    task.status === "cancelled" && "bg-slate-100 text-slate-400",
                                  )}
                                >
                                  {STATUS_LABELS[task.status]}
                                </span>
                                <span className={cn("shrink-0 w-5 text-center text-sm", priority.className)}>
                                  {priority.icon}
                                </span>
                                {task.estimated_effort && (
                                  <span className="shrink-0 text-xs text-muted-foreground uppercase w-4 text-center">
                                    {task.estimated_effort}
                                  </span>
                                )}
                                {isPlanning && (
                                  <button
                                    onClick={() => void handleRemoveFromSprint(task.id, sprint.id)}
                                    className="shrink-0 text-muted-foreground opacity-0 group-hover:opacity-100 hover:text-destructive transition-opacity"
                                    aria-label="Rimuovi dallo sprint"
                                  >
                                    <X className="h-3.5 w-3.5" />
                                  </button>
                                )}
                              </div>
                            );
                          })}
                        </div>
                      )}

                      {isPlanning && (
                        <div className="border-t border-border">
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
                  )}
                </div>
              );
            })}

            {/* Create sprint form — shown below sprint list */}
            {showCreateSprintForm ? (
              <div className="rounded-lg border border-dashed border-primary/40 bg-card p-3">
                <div className="flex items-center gap-2">
                  <input
                    ref={newSprintInputRef}
                    type="text"
                    value={newSprintName}
                    onChange={(e) => setNewSprintName(e.target.value)}
                    onKeyDown={handleCreateSprintKeyDown}
                    placeholder="Nome sprint"
                    className="flex-1 h-8 rounded border border-border bg-background px-2.5 text-sm focus:outline-none focus:ring-1 focus:ring-ring"
                    disabled={creatingSprint}
                    autoFocus
                  />
                  <button
                    onClick={() => void handleCreateSprint()}
                    disabled={creatingSprint || !newSprintName.trim()}
                    className="rounded border border-primary bg-primary px-3 py-1.5 text-xs font-medium text-primary-foreground hover:bg-primary/90 transition-colors disabled:opacity-50"
                  >
                    {creatingSprint ? "Creando…" : "Crea"}
                  </button>
                  <button
                    onClick={() => { setShowCreateSprintForm(false); setNewSprintName(""); }}
                    className="rounded border border-border bg-background px-3 py-1.5 text-xs font-medium hover:bg-accent transition-colors"
                  >
                    Annulla
                  </button>
                </div>
              </div>
            ) : (
              <button
                onClick={openCreateSprintForm}
                className="w-full rounded-lg border border-dashed border-border bg-card px-4 py-2.5 text-sm text-muted-foreground hover:text-foreground hover:bg-accent/30 transition-colors text-left"
              >
                + Crea sprint
              </button>
            )}
          </>
        )}
      </div>

      {/* ── Divider ────────────────────────────────────────────────────────── */}
      <div className="my-6 py-2 flex items-center gap-3">
        <div className="flex-1 border-t border-border" />
        <ArrowUpDown className="h-4 w-4 text-muted-foreground select-none" aria-label="Separa sprint da backlog" />
        <div className="text-xs text-muted-foreground tabular-nums">
          {localBacklog.length} {localBacklog.length === 1 ? "ticket" : "ticket"} · Stima: {
            localBacklog.reduce((sum, t) => {
              const map: Record<string, number> = { xs: 1, s: 2, m: 3, l: 5 };
              return sum + (map[t.estimated_effort ?? ""] ?? 0);
            }, 0)
          }
        </div>
        <div className="flex-1 border-t border-border" />
      </div>

      {/* ── Backlog section ────────────────────────────────────────────────── */}
      <div className="rounded-lg border border-border bg-card">
        {/* Backlog header */}
        <div
          className={cn(
            "flex items-center gap-3 px-3 py-2.5 select-none",
            expanded.has("backlog") && filteredBacklog.length > 0 && "border-b border-border"
          )}
        >
          {/* Select all */}
          <input
            type="checkbox"
            checked={backlogAllSelected}
            ref={(el) => {
              if (el) el.indeterminate = backlogSomeSelected && !backlogAllSelected;
            }}
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
            <ChevronRight className={cn("h-3.5 w-3.5 text-muted-foreground transition-transform shrink-0", expanded.has("backlog") ? "rotate-90" : "")} />
            <span className="font-semibold text-sm">Backlog</span>
            <span className="text-xs text-muted-foreground">
              ({filteredBacklog.length} {filteredBacklog.length === 1 ? "ticket" : "ticket"})
            </span>
          </button>

          {/* Backlog status counts */}
          <div className="flex items-center gap-1 shrink-0">
            {getStatusCounts(filteredBacklog).map(({ key, count, color, bg }) => (
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
        </div>

        {/* Backlog task list */}
        {expanded.has("backlog") && (
          <div>
            {filteredBacklog.length === 0 ? (
              <div className="px-4 py-8 text-center">
                <p className="text-sm text-muted-foreground">
                  {search || typeFilter
                    ? "Nessuna task trovata con questi filtri."
                    : "Il backlog è vuoto."}
                </p>
                {!search && !typeFilter && (
                  <p className="mt-1 text-xs text-muted-foreground">
                    Premi{" "}
                    <kbd
                      className="rounded border border-border px-1 py-0.5 font-mono text-xs cursor-pointer hover:bg-accent"
                      onClick={openDrawer}
                    >
                      N
                    </kbd>{" "}
                    o clicca{" "}
                    <button onClick={openDrawer} className="underline hover:no-underline">
                      + Crea task
                    </button>{" "}
                    per aggiungere una task.
                  </p>
                )}
              </div>
            ) : (
              <div className="divide-y divide-border">
                {filteredBacklog.map((task) => (
                  <div
                    key={task.id}
                    draggable
                    onDragStart={(e) => handleDragStart(e, task.id)}
                    onDragEnd={handleDragEnd}
                    className={cn(
                      "cursor-grab active:cursor-grabbing transition-opacity",
                      draggingTaskId === task.id && "opacity-40"
                    )}
                  >
                    <TaskRow
                      task={task}
                      selected={selectedIds.has(task.id)}
                      onSelectToggle={toggleSelectTask}
                      repositories={repositories}
                    />
                  </div>
                ))}
              </div>
            )}

            {/* + Crea task */}
            <div className="border-t border-border">
              <button
                onClick={openDrawer}
                className="flex w-full items-center gap-2 px-4 py-2.5 text-sm text-muted-foreground hover:text-foreground hover:bg-accent/40 transition-colors"
              >
                <span>+</span>
                <span>Crea task</span>
              </button>
            </div>
          </div>
        )}
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
