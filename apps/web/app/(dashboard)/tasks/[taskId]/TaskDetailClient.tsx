"use client";

import Link from "next/link";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { useSearchParams } from "next/navigation";
import {
  ArrowDown,
  AlertCircle,
  CheckCircle2,
  ChevronRight,
  ExternalLink,
  Github,
  Pencil,
  SlidersHorizontal,
  X,
} from "lucide-react";
import type { Agent, Sprint, Task, TimelineEntry, TaskProjectedState, TaskIteration } from "@robin/shared-types";
import { useTaskEventsFeed } from "@/lib/realtime/useTaskEventsFeed";
import { projectTaskState } from "@/lib/db/projectTaskState";
import { Timeline } from "@/components/timeline/Timeline";
import { EditableField } from "@/components/tasks/EditableField";
import { TaskExecutionMetrics } from "@/components/tasks/TaskExecutionMetrics";
import { PRCard } from "@/components/tasks/PRCard";
import { DeployPreviewCard } from "@/components/tasks/DeployPreviewCard";
import { IterationsList } from "@/components/tasks/IterationsList";
import { cn } from "@/lib/utils";

interface TaskDetailClientProps {
  task: Task;
  initialEvents: TimelineEntry[];
  initialProjectedState: TaskProjectedState;
  initialIterations: TaskIteration[];
  agent: Agent | null;
  sprint: Pick<Sprint, "id" | "name" | "status"> | null;
}

// ── Status / Priority maps ──────────────────────────────────────────────────

const STATUS_LABEL: Record<string, string> = {
  backlog: "Backlog", sprint_ready: "Sprint ready",
  pending: "Pending", queued: "In coda", in_progress: "In corso",
  in_review: "In review", review_pending: "In review",
  rework: "Rework",
  approved: "Approvata", rejected: "Rifiutata",
  done: "Done", completed: "Completata", failed: "Fallita", cancelled: "Annullata",
};

const STATUS_BADGE: Record<string, string> = {
  backlog: "bg-neutral-100 text-neutral-500 dark:bg-neutral-800 dark:text-neutral-400",
  sprint_ready: "bg-sky-100 text-sky-600 dark:bg-sky-900/30 dark:text-sky-400",
  pending: "bg-neutral-100 text-neutral-600 dark:bg-neutral-800 dark:text-neutral-400",
  queued: "bg-sky-100 text-sky-700 dark:bg-sky-900/30 dark:text-sky-400",
  in_progress: "bg-brand-100 text-brand-700 dark:bg-brand-900/30 dark:text-brand-400",
  in_review: "bg-amber-100 text-amber-700 dark:bg-amber-900/30 dark:text-amber-400",
  review_pending: "bg-amber-100 text-amber-700 dark:bg-amber-900/30 dark:text-amber-400",
  rework: "bg-orange-100 text-orange-700 dark:bg-orange-900/30 dark:text-orange-400",
  approved: "bg-emerald-100 text-emerald-700 dark:bg-emerald-900/30 dark:text-emerald-400",
  rejected: "bg-red-100 text-red-700 dark:bg-red-900/30 dark:text-red-400",
  done: "bg-emerald-100 text-emerald-800 dark:bg-emerald-900/30 dark:text-emerald-400",
  completed: "bg-emerald-100 text-emerald-800 dark:bg-emerald-900/30 dark:text-emerald-400",
  failed: "bg-red-100 text-red-800 dark:bg-red-900/30 dark:text-red-400",
  cancelled: "bg-neutral-100 text-neutral-500 dark:bg-neutral-800 dark:text-neutral-400",
};

const PRIORITY_LABEL: Record<string, string> = {
  low: "Low", medium: "Medium", high: "High", urgent: "Urgent", critical: "Critical",
};

const PRIORITY_BADGE: Record<string, string> = {
  low: "bg-slate-100 text-slate-600 dark:bg-slate-800 dark:text-slate-400",
  medium: "bg-yellow-100 text-yellow-700 dark:bg-yellow-900/30 dark:text-yellow-400",
  high: "bg-orange-100 text-orange-700 dark:bg-orange-900/30 dark:text-orange-400",
  urgent: "bg-red-100 text-red-700 dark:bg-red-900/30 dark:text-red-400",
  critical: "bg-red-100 text-red-800 font-semibold dark:bg-red-900/30 dark:text-red-400",
};

const TASK_TYPE_LABEL: Record<string, string> = {
  bug: "Bug", feature: "Feature", docs: "Docs", refactor: "Refactor",
  chore: "Chore", accessibility: "Accessibility", security: "Security",
};

// ── StatusBadge ────────────────────────────────────────────────────────────

function StatusBadge({ status }: { status: string }) {
  return (
    <span
      className={cn(
        "rounded-full px-2.5 py-0.5 text-xs font-medium",
        STATUS_BADGE[status] ?? "bg-muted text-muted-foreground"
      )}
    >
      {STATUS_LABEL[status] ?? status}
    </span>
  );
}

// ── InlineTitleEditor ──────────────────────────────────────────────────────

function InlineTitleEditor({
  value,
  onSave,
  disabled,
}: {
  value: string;
  onSave: (v: string) => Promise<void>;
  disabled: boolean;
}) {
  const [editing, setEditing] = useState(false);
  const [draft, setDraft] = useState(value);
  const inputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    if (!editing) setDraft(value);
  }, [value, editing]);

  useEffect(() => {
    if (editing) {
      inputRef.current?.focus();
      const len = inputRef.current?.value.length ?? 0;
      inputRef.current?.setSelectionRange(len, len);
    }
  }, [editing]);

  async function save() {
    if (draft.trim() === value.trim()) { setEditing(false); return; }
    await onSave(draft.trim());
    setEditing(false);
  }

  function cancel() { setDraft(value); setEditing(false); }

  if (editing) {
    return (
      <input
        ref={inputRef}
        value={draft}
        onChange={(e) => setDraft(e.target.value)}
        onBlur={() => void save()}
        onKeyDown={(e) => {
          if (e.key === "Enter") { e.preventDefault(); void save(); }
          if (e.key === "Escape") { e.preventDefault(); cancel(); }
        }}
        className="w-full border-0 border-b-2 border-[#007AFF] bg-transparent text-2xl font-bold text-foreground outline-none focus:outline-none"
      />
    );
  }

  return (
    <div
      className={cn("group flex items-center gap-2", !disabled && "cursor-pointer")}
      onClick={() => !disabled && setEditing(true)}
      title={disabled ? "Non modificabile mentre l'agente lavora" : "Click per modificare"}
    >
      <span className="text-2xl font-bold text-foreground leading-tight">{value}</span>
      {!disabled && (
        <Pencil className="h-4 w-4 shrink-0 text-[#8E8E93] opacity-0 transition-opacity group-hover:opacity-100" />
      )}
    </div>
  );
}

// ── Component ─────────────────────────────────────────────────────────────────

export function TaskDetailClient({
  task,
  initialEvents,
  initialProjectedState,
  initialIterations,
  agent,
  sprint,
}: TaskDetailClientProps) {
  const { events, isConnected } = useTaskEventsFeed({
    taskId: task.id,
    initialEvents,
  });

  // Live projected state from full event stream
  const projectedState = useMemo<TaskProjectedState>(() => {
    if (events === initialEvents) return initialProjectedState;
    return projectTaskState(
      events.map((e) => ({
        id: e.id,
        task_id: task.id,
        workspace_id: task.workspace_id,
        event_type: e.event_type,
        actor_type: e.actor_type,
        actor_id: e.actor_id,
        payload: e.payload,
        created_at: e.created_at,
      }))
    );
  }, [events, initialEvents, initialProjectedState, task.id, task.workspace_id]);

  // Local title/description state for optimistic inline editing
  const [localTitle, setLocalTitle] = useState(task.title);
  const [localDescription, setLocalDescription] = useState(task.description);

  const isAgentWorking =
    projectedState.status === "in_progress" ||
    projectedState.status === "queued";

  const canEdit = !isAgentWorking;

  // ── Inline save helpers ─────────────────────────────────────────────────────

  const saveField = useCallback(
    async (field: "title" | "description", value: string) => {
      if (field === "title") setLocalTitle(value);
      if (field === "description") setLocalDescription(value);

      await fetch(`/api/tasks/${task.id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ [field]: value }),
      });
    },
    [task.id]
  );

  // ── Contextual actions ──────────────────────────────────────────────────────

  const [confirmCancel, setConfirmCancel] = useState(false);
  const [actionLoading, setActionLoading] = useState(false);

  async function handleUnblock() {
    setActionLoading(true);
    try {
      await fetch(`/api/tasks/${task.id}/events`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          event_type: "human.approved",
          payload: {},
        }),
      });
    } finally {
      setActionLoading(false);
    }
  }

  async function handleCancel() {
    setActionLoading(true);
    try {
      await fetch(`/api/tasks/${task.id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ status: "cancelled" }),
      });
      setConfirmCancel(false);
    } finally {
      setActionLoading(false);
    }
  }

  // ── "New event" badge ───────────────────────────────────────────────────────

  const initialCountRef = useRef(initialEvents.length);
  const [pendingCount, setPendingCount] = useState(0);
  const isAtBottomRef = useRef(true);
  const bottomSentinelRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const sentinel = bottomSentinelRef.current;
    if (!sentinel) return;
    const observer = new IntersectionObserver(
      ([entry]) => {
        if (!entry) return;
        isAtBottomRef.current = entry.isIntersecting;
        if (entry.isIntersecting) setPendingCount(0);
      },
      { rootMargin: "64px" }
    );
    observer.observe(sentinel);
    return () => observer.disconnect();
  }, []);

  const prevLengthRef = useRef(initialEvents.length);
  useEffect(() => {
    const newCount = events.length - prevLengthRef.current;
    prevLengthRef.current = events.length;
    if (newCount > 0 && events.length > initialCountRef.current && !isAtBottomRef.current) {
      setPendingCount((p) => p + newCount);
    }
  }, [events.length]);

  function scrollToBottom() {
    bottomSentinelRef.current?.scrollIntoView({ behavior: "smooth" });
    setPendingCount(0);
  }

  // ── Mobile bottom drawer ─────────────────────────────────────────────────────

  const [drawerOpen, setDrawerOpen] = useState(false);
  const [dragOffset, setDragOffset] = useState(0);
  const [isDragging, setIsDragging] = useState(false);
  const dragStartYRef = useRef(0);
  const dragStartTimeRef = useRef(0);

  useEffect(() => {
    if (drawerOpen) {
      document.body.style.overflow = "hidden";
    } else {
      document.body.style.overflow = "";
    }
    return () => { document.body.style.overflow = ""; };
  }, [drawerOpen]);

  function handleDrawerTouchStart(e: React.TouchEvent) {
    const touch = e.touches[0];
    if (!touch) return;
    dragStartYRef.current = touch.clientY;
    dragStartTimeRef.current = Date.now();
    setIsDragging(true);
  }

  function handleDrawerTouchMove(e: React.TouchEvent) {
    const touch = e.touches[0];
    if (!touch) return;
    const delta = Math.max(0, touch.clientY - dragStartYRef.current);
    setDragOffset(delta);
  }

  function handleDrawerTouchEnd() {
    setIsDragging(false);
    const elapsed = Date.now() - dragStartTimeRef.current;
    const velocity = elapsed > 0 ? dragOffset / (elapsed / 1000) : 0;
    if (dragOffset > 80 || velocity > 500) {
      setDrawerOpen(false);
    }
    setDragOffset(0);
  }

  function closeDrawer() {
    setDrawerOpen(false);
    setDragOffset(0);
  }

  // ── Repo URL for commit SHA links ────────────────────────────────────────────

  const repoUrl = projectedState.prData?.pr_url
    ? projectedState.prData.pr_url.replace(/\/pull\/\d+.*$/, "")
    : undefined;

  // ── Success banner (shown after task creation) ───────────────────────────

  const searchParams = useSearchParams();
  const [showCreatedBanner, setShowCreatedBanner] = useState(
    () => searchParams.get("created") === "1"
  );

  // ── Date helpers ─────────────────────────────────────────────────────────────

  const createdDate = new Date(task.created_at).toLocaleDateString("it-IT", {
    day: "numeric", month: "short", year: "numeric",
  });
  const updatedDate = new Date(task.updated_at).toLocaleDateString("it-IT", {
    day: "numeric", month: "short", year: "numeric",
  });

  // ── Render ──────────────────────────────────────────────────────────────────

  return (
    <div className="space-y-4">
      {/* Success banner */}
      {showCreatedBanner && (
        <div className="flex items-center gap-3 rounded-lg border border-emerald-200 bg-emerald-50 px-4 py-3 text-sm text-emerald-800 dark:border-emerald-800 dark:bg-emerald-950 dark:text-emerald-300">
          <CheckCircle2 className="h-4 w-4 shrink-0" />
          <span className="flex-1">
            Task creata — l&apos;agente la prenderà in carico a breve.
          </span>
          <button
            type="button"
            onClick={() => setShowCreatedBanner(false)}
            className="rounded p-0.5 hover:bg-emerald-100 dark:hover:bg-emerald-900"
          >
            <X className="h-3.5 w-3.5" />
          </button>
        </div>
      )}

      {/* 60/40 split layout */}
      <div className="grid grid-cols-1 gap-6 md:gap-8 lg:grid-cols-[3fr_2fr]">

        {/* ── LEFT COLUMN: header + description + timeline ── */}
        <div className="min-w-0 space-y-4">

          {/* Breadcrumb */}
          <nav className="flex items-center gap-1 text-xs text-[#8E8E93]">
            <Link href="/backlog" className="hover:text-foreground transition-colors">
              Planning
            </Link>
            <ChevronRight className="h-3 w-3 shrink-0" />
            {sprint ? (
              <>
                <Link
                  href={`/backlog?sprint=${sprint.id}`}
                  className="hover:text-foreground transition-colors max-w-[160px] truncate"
                >
                  {sprint.name}
                </Link>
                <ChevronRight className="h-3 w-3 shrink-0" />
              </>
            ) : (
              <>
                <Link href="/tasks" className="hover:text-foreground transition-colors">
                  Tasks
                </Link>
                <ChevronRight className="h-3 w-3 shrink-0" />
              </>
            )}
            <span className="text-foreground">Task</span>
          </nav>

          {/* Title + status pill + metadata row */}
          <div className="space-y-2">
            <div className="flex flex-wrap items-start gap-3">
              <div className="flex-1 min-w-0">
                <InlineTitleEditor
                  value={localTitle}
                  onSave={(v) => saveField("title", v)}
                  disabled={!canEdit}
                />
              </div>
              <StatusBadge status={projectedState.status} />
            </div>

            {/* Metadata row */}
            <div className="flex flex-wrap items-center gap-1 text-xs text-[#8E8E93]">
              <span>Creata il {createdDate}</span>
              <span>·</span>
              <span>Aggiornata il {updatedDate}</span>
              <span>·</span>
              <span>{TASK_TYPE_LABEL[task.type] ?? task.type}</span>
              {!canEdit && (
                <>
                  <span>·</span>
                  <span className="text-amber-500">In sola lettura</span>
                </>
              )}
            </div>
          </div>

          {/* Description */}
          <div className="space-y-1">
            <p className="text-xs font-medium text-muted-foreground">Descrizione</p>
            <EditableField
              value={localDescription || "Nessuna descrizione."}
              onSave={(v) => saveField("description", v)}
              disabled={!canEdit}
              multiline
              className="text-sm text-foreground"
            />
          </div>

          {/* Blocked alert */}
          {projectedState.blockedReason && (
            <div className="flex items-start gap-2 rounded-xl border border-amber-300 bg-amber-50 p-4 dark:border-amber-700 dark:bg-amber-950/20">
              <AlertCircle className="mt-0.5 h-4 w-4 flex-shrink-0 text-amber-600" />
              <div>
                <p className="text-sm font-semibold text-amber-800 dark:text-amber-400">
                  Agente bloccato
                </p>
                <p className="mt-0.5 text-sm text-amber-700 dark:text-amber-500">
                  {projectedState.blockedReason}
                </p>
              </div>
            </div>
          )}

          {/* Timeline section */}
          <div className="rounded-xl border border-border bg-card p-4">
            <div className="mb-4 flex items-center justify-between gap-2">
              <h2 className="text-sm font-semibold text-foreground">
                Timeline eventi
              </h2>
              <div className="flex items-center gap-2">
                {pendingCount > 0 && (
                  <button
                    onClick={scrollToBottom}
                    className="inline-flex items-center gap-1 rounded-full bg-brand-600 px-2.5 py-0.5 text-xs font-medium text-white hover:bg-brand-700"
                  >
                    <ArrowDown className="h-3 w-3" />
                    {pendingCount} new
                  </button>
                )}
                <span
                  className={cn(
                    "h-1.5 w-1.5 rounded-full",
                    isConnected ? "bg-emerald-500" : "bg-neutral-300"
                  )}
                  title={isConnected ? "Realtime connesso" : "Realtime offline"}
                />
                <span className="text-xs text-muted-foreground">
                  {events.length} eventi
                </span>
              </div>
            </div>
            <Timeline entries={events} emptyMessage="Nessun evento registrato." />
            <div ref={bottomSentinelRef} className="h-px" />
          </div>

          {/* Iterations history */}
          <IterationsList iterations={initialIterations} allEvents={events} />
        </div>

        {/* ── RIGHT COLUMN: metadata panel (hidden on mobile < md) ── */}
        <div className="hidden md:block lg:sticky lg:top-6 lg:self-start">
          <div className="rounded-[18px] bg-white shadow-sm dark:bg-[#1C1C1E] p-4 space-y-0 border border-border">

            {/* Status */}
            <MetaPanelRow label="Status">
              <StatusBadge status={projectedState.status} />
            </MetaPanelRow>

            <div className="h-px bg-border/60 my-1" />

            {/* Priorità */}
            <MetaPanelRow label="Priorità">
              <span
                className={cn(
                  "rounded-full px-2.5 py-0.5 text-xs font-medium",
                  PRIORITY_BADGE[task.priority] ?? "bg-muted text-muted-foreground"
                )}
              >
                {PRIORITY_LABEL[task.priority] ?? task.priority}
              </span>
            </MetaPanelRow>

            <div className="h-px bg-border/60 my-1" />

            {/* Agente assegnato */}
            <MetaPanelRow label="Agente">
              {agent ? (
                <div className="flex items-center gap-2">
                  <div className="flex h-6 w-6 shrink-0 items-center justify-center rounded-full bg-brand-100 text-xs font-semibold text-brand-700 dark:bg-brand-900/30 dark:text-brand-400">
                    {agent.name.charAt(0).toUpperCase()}
                  </div>
                  <span className="text-sm font-medium text-foreground truncate">
                    {agent.name}
                  </span>
                </div>
              ) : (
                <span className="text-sm text-muted-foreground">Non assegnato</span>
              )}
            </MetaPanelRow>

            {/* Repository */}
            {projectedState.prData?.pr_url && (
              <>
                <div className="h-px bg-border/60 my-1" />
                <MetaPanelRow label="Repository">
                  <a
                    href={repoUrl}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="flex items-center gap-1.5 text-sm text-[#007AFF] hover:underline"
                  >
                    <Github className="h-3.5 w-3.5 shrink-0" />
                    <span className="truncate">
                      {repoUrl?.replace("https://github.com/", "") ?? "GitHub"}
                    </span>
                    <ExternalLink className="h-3 w-3 shrink-0 opacity-60" />
                  </a>
                </MetaPanelRow>
              </>
            )}

            <div className="h-px bg-border/60 my-1" />

            {/* Creata */}
            <MetaPanelRow label="Creata">
              <span className="text-sm text-foreground">{createdDate}</span>
            </MetaPanelRow>

            <div className="h-px bg-border/60 my-1" />

            {/* Aggiornata */}
            <MetaPanelRow label="Aggiornata">
              <span className="text-sm text-foreground">{updatedDate}</span>
            </MetaPanelRow>

          </div>

          {/* Execution metrics */}
          <div className="mt-4">
            <TaskExecutionMetrics events={events} createdAt={task.created_at} />
          </div>

          {/* PR artifact */}
          <PRCard
            data={projectedState.prData}
            events={events}
            {...(repoUrl !== undefined && { repoUrl })}
          />

          {/* Deploy preview */}
          {projectedState.deployData && (
            <div className="mt-4">
              <DeployPreviewCard data={projectedState.deployData} />
            </div>
          )}

          {/* Contextual actions */}
          <div className="mt-4">
            <ActionButtons
              projectedStatus={projectedState.status}
              blockedReason={projectedState.blockedReason}
              confirmCancel={confirmCancel}
              actionLoading={actionLoading}
              onUnblock={handleUnblock}
              onCancelRequest={() => setConfirmCancel(true)}
              onCancelConfirm={handleCancel}
              onCancelAbort={() => setConfirmCancel(false)}
            />
          </div>
        </div>
      </div>

      {/* ── Mobile trigger button (fixed bottom, visible only < md) ── */}
      <div className="fixed bottom-4 left-1/2 -translate-x-1/2 z-40 md:hidden">
        <button
          type="button"
          onClick={() => setDrawerOpen(true)}
          className="flex items-center gap-2 rounded-full bg-[#1C1C1E] dark:bg-white px-5 py-3 shadow-ios-md"
        >
          <SlidersHorizontal className="h-4 w-4 text-white dark:text-[#1C1C1E]" />
          <span className="text-sm font-semibold text-white dark:text-[#1C1C1E]">
            Dettagli
          </span>
        </button>
      </div>

      {/* ── Bottom drawer overlay (mobile only) ── */}
      {drawerOpen && (
        <div
          className="fixed inset-0 bg-black/40 backdrop-blur-sm z-50 md:hidden"
          onClick={closeDrawer}
          style={{ transition: "opacity 200ms", opacity: 1 }}
        />
      )}

      {/* ── Bottom drawer (mobile only) ── */}
      <div
        className="fixed bottom-0 left-0 right-0 z-50 md:hidden max-h-[75vh] overflow-y-auto rounded-t-2xl bg-white dark:bg-[#1C1C1E]"
        style={{
          transform: drawerOpen ? `translateY(${dragOffset}px)` : "translateY(100%)",
          transition: isDragging
            ? "none"
            : drawerOpen
            ? "transform 350ms cubic-bezier(0.32, 0.72, 0, 1)"
            : "transform 250ms ease-in",
        }}
      >
        {/* Handle bar */}
        <div
          className="flex justify-center pt-3 pb-1 touch-none"
          onTouchStart={handleDrawerTouchStart}
          onTouchMove={handleDrawerTouchMove}
          onTouchEnd={handleDrawerTouchEnd}
        >
          <div className="h-1 w-9 rounded-full bg-[#D1D1D6]" />
        </div>

        {/* Drawer content */}
        <div className="px-4 pb-10 space-y-0">
          <div className="rounded-[18px] bg-white dark:bg-[#1C1C1E] divide-y divide-border/60">

            <MetaPanelRow label="Status">
              <StatusBadge status={projectedState.status} />
            </MetaPanelRow>

            <MetaPanelRow label="Priorità">
              <span
                className={cn(
                  "rounded-full px-2.5 py-0.5 text-xs font-medium",
                  PRIORITY_BADGE[task.priority] ?? "bg-muted text-muted-foreground"
                )}
              >
                {PRIORITY_LABEL[task.priority] ?? task.priority}
              </span>
            </MetaPanelRow>

            <MetaPanelRow label="Agente">
              {agent ? (
                <div className="flex items-center gap-2">
                  <div className="flex h-6 w-6 shrink-0 items-center justify-center rounded-full bg-brand-100 text-xs font-semibold text-brand-700 dark:bg-brand-900/30 dark:text-brand-400">
                    {agent.name.charAt(0).toUpperCase()}
                  </div>
                  <span className="text-sm font-medium text-foreground truncate">
                    {agent.name}
                  </span>
                </div>
              ) : (
                <span className="text-sm text-muted-foreground">Non assegnato</span>
              )}
            </MetaPanelRow>

            {projectedState.prData?.pr_url && (
              <MetaPanelRow label="Repository">
                <a
                  href={repoUrl}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="flex items-center gap-1.5 text-sm text-[#007AFF] hover:underline"
                >
                  <Github className="h-3.5 w-3.5 shrink-0" />
                  <span className="truncate">
                    {repoUrl?.replace("https://github.com/", "") ?? "GitHub"}
                  </span>
                  <ExternalLink className="h-3 w-3 shrink-0 opacity-60" />
                </a>
              </MetaPanelRow>
            )}

            <MetaPanelRow label="Creata">
              <span className="text-sm text-foreground">{createdDate}</span>
            </MetaPanelRow>

            <MetaPanelRow label="Aggiornata">
              <span className="text-sm text-foreground">{updatedDate}</span>
            </MetaPanelRow>

          </div>
        </div>
      </div>
    </div>
  );
}

// ── Sub-components ─────────────────────────────────────────────────────────────

function MetaPanelRow({
  label,
  children,
}: {
  label: string;
  children: React.ReactNode;
}) {
  return (
    <div className="flex items-center justify-between gap-2 py-2.5">
      <span className="text-xs text-[#8E8E93] shrink-0">{label}</span>
      <div className="flex items-center justify-end min-w-0">{children}</div>
    </div>
  );
}

function ActionButtons({
  projectedStatus,
  blockedReason,
  confirmCancel,
  actionLoading,
  onUnblock,
  onCancelRequest,
  onCancelConfirm,
  onCancelAbort,
}: {
  projectedStatus: string;
  blockedReason: string | null;
  confirmCancel: boolean;
  actionLoading: boolean;
  onUnblock: () => void;
  onCancelRequest: () => void;
  onCancelConfirm: () => void;
  onCancelAbort: () => void;
}) {
  const canCancel =
    projectedStatus === "pending" || projectedStatus === "queued";
  const canUnblock = !!blockedReason;

  if (!canUnblock && !canCancel) return null;

  return (
    <div className="space-y-2">
      <h3 className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">
        Azioni
      </h3>

      {canUnblock && (
        <button
          onClick={onUnblock}
          disabled={actionLoading}
          className="w-full rounded-lg bg-emerald-600 px-4 py-3 text-sm font-semibold text-white hover:bg-emerald-700 disabled:opacity-50 transition-colors min-h-[44px]"
        >
          Sblocca agente
        </button>
      )}

      {canCancel && !confirmCancel && (
        <button
          onClick={onCancelRequest}
          disabled={actionLoading}
          className="w-full rounded-lg border border-red-300 bg-red-50 px-4 py-3 text-sm font-semibold text-red-700 hover:bg-red-100 disabled:opacity-50 transition-colors dark:border-red-800 dark:bg-red-950/20 dark:text-red-400 min-h-[44px]"
        >
          Annulla task
        </button>
      )}

      {confirmCancel && (
        <div className="rounded-lg border border-red-300 bg-red-50 p-3 dark:border-red-800 dark:bg-red-950/20">
          <p className="text-sm font-semibold text-red-700 dark:text-red-400">
            Conferma annullamento
          </p>
          <p className="mt-0.5 text-xs text-red-600 dark:text-red-500">
            La task verrà annullata. Questa azione non si può annullare.
          </p>
          <div className="mt-3 flex gap-2">
            <button
              onClick={onCancelConfirm}
              disabled={actionLoading}
              className="flex-1 rounded-md bg-red-600 px-3 py-2 text-xs font-semibold text-white hover:bg-red-700 disabled:opacity-50"
            >
              Sì, annulla
            </button>
            <button
              onClick={onCancelAbort}
              disabled={actionLoading}
              className="flex-1 rounded-md border border-border bg-card px-3 py-2 text-xs font-medium text-foreground hover:bg-accent"
            >
              No, indietro
            </button>
          </div>
        </div>
      )}
    </div>
  );
}
