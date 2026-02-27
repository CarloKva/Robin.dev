"use client";

import Link from "next/link";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { useSearchParams } from "next/navigation";
import { ArrowDown, AlertCircle, CheckCircle2, X } from "lucide-react";
import type { Task, TimelineEntry, TaskProjectedState } from "@robin/shared-types";
import { useTaskEventsFeed } from "@/lib/realtime/useTaskEventsFeed";
import { projectTaskState } from "@/lib/db/projectTaskState";
import { Timeline } from "@/components/timeline/Timeline";
import { EditableField } from "@/components/tasks/EditableField";
import { TaskExecutionMetrics } from "@/components/tasks/TaskExecutionMetrics";
import { PRCard } from "@/components/tasks/PRCard";
import { DeployPreviewCard } from "@/components/tasks/DeployPreviewCard";
import { CommitList } from "@/components/tasks/CommitList";
import { cn } from "@/lib/utils";

interface TaskDetailClientProps {
  task: Task;
  initialEvents: TimelineEntry[];
  initialProjectedState: TaskProjectedState;
}

// ── Status label map ──────────────────────────────────────────────────────────

const STATUS_LABEL: Record<string, string> = {
  pending: "Pending", queued: "In coda", in_progress: "In corso",
  review_pending: "In review", approved: "Approvata", rejected: "Rifiutata",
  completed: "Completata", failed: "Fallita", cancelled: "Annullata",
};

const STATUS_BADGE: Record<string, string> = {
  pending: "bg-neutral-100 text-neutral-600",
  queued: "bg-sky-100 text-sky-700",
  in_progress: "bg-brand-100 text-brand-700",
  review_pending: "bg-amber-100 text-amber-700",
  approved: "bg-emerald-100 text-emerald-700",
  rejected: "bg-red-100 text-red-700",
  completed: "bg-emerald-100 text-emerald-800",
  failed: "bg-red-100 text-red-800",
  cancelled: "bg-neutral-100 text-neutral-500",
};

const PRIORITY_LABEL: Record<string, string> = {
  low: "Low", medium: "Medium", high: "High", urgent: "Urgent",
};

const PHASE_LABEL: Record<string, string> = {
  analysis: "Analysis", design: "Design", write: "Write", proof: "Proof",
};

// ── Component ─────────────────────────────────────────────────────────────────

export function TaskDetailClient({
  task,
  initialEvents,
  initialProjectedState,
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

  // ── Mobile sidebar toggle ────────────────────────────────────────────────────

  const [sidebarOpen, setSidebarOpen] = useState(false);

  // ── Repo URL for commit SHA links ────────────────────────────────────────────

  const repoUrl = projectedState.prData?.pr_url
    ? projectedState.prData.pr_url.replace(/\/pull\/\d+.*$/, "")
    : undefined;

  // ── Breadcrumb title ────────────────────────────────────────────────────────

  const crumbTitle =
    localTitle.length > 40
      ? localTitle.slice(0, 40) + "…"
      : localTitle;

  // ── Success banner (shown after task creation) ───────────────────────────

  const searchParams = useSearchParams();
  const [showCreatedBanner, setShowCreatedBanner] = useState(
    () => searchParams.get("created") === "1"
  );

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

      {/* Breadcrumb */}
      <nav className="flex items-center gap-1.5 text-sm text-muted-foreground">
        <Link href="/tasks" className="hover:text-foreground transition-colors">
          Tasks
        </Link>
        <span>/</span>
        <span className="text-foreground truncate">{crumbTitle}</span>
      </nav>

      {/* 2-column layout */}
      <div className="grid grid-cols-1 gap-6 lg:grid-cols-[1fr_2fr]">

        {/* ── LEFT COLUMN: metadata + artifacts + actions ── */}
        <div>
          {/* Mobile toggle button */}
          <button
            type="button"
            onClick={() => setSidebarOpen((o) => !o)}
            className="flex w-full cursor-pointer items-center justify-between rounded-lg border border-border bg-card px-4 py-3 text-sm font-semibold text-foreground lg:hidden"
          >
            Dettagli task
            <span
              className={cn(
                "text-muted-foreground transition-transform",
                sidebarOpen && "rotate-180"
              )}
            >
              ▾
            </span>
          </button>

        <aside className={cn("mt-3 space-y-5 lg:mt-0", !sidebarOpen && "hidden lg:block")}>

          {/* Title + description */}
          <div className="rounded-xl border border-border bg-card p-4 space-y-3">
            <div>
              <p className="mb-1 text-xs font-medium text-muted-foreground">
                Titolo
                {!canEdit && (
                  <span className="ml-1 text-amber-500" title="L'agente sta lavorando">
                    (in sola lettura)
                  </span>
                )}
              </p>
              <EditableField
                value={localTitle}
                onSave={(v) => saveField("title", v)}
                disabled={!canEdit}
                className="text-base font-semibold text-foreground"
              />
            </div>
            <div>
              <p className="mb-1 text-xs font-medium text-muted-foreground">Descrizione</p>
              <EditableField
                value={localDescription || "Nessuna descrizione."}
                onSave={(v) => saveField("description", v)}
                disabled={!canEdit}
                multiline
                className="text-sm text-foreground"
              />
            </div>
          </div>

          {/* Metadata grid */}
          <div className="rounded-xl border border-border bg-card p-4 space-y-3">
            <h3 className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">
              Dettagli
            </h3>
            <div className="grid grid-cols-2 gap-x-4 gap-y-3 text-sm">
              <MetaRow
                label="Stato"
                value={
                  <span
                    className={cn(
                      "rounded-full px-2 py-0.5 text-xs font-medium",
                      STATUS_BADGE[projectedState.status] ?? "bg-muted text-muted-foreground"
                    )}
                  >
                    {STATUS_LABEL[projectedState.status] ?? projectedState.status}
                  </span>
                }
              />
              <MetaRow
                label="Priorità"
                value={PRIORITY_LABEL[task.priority] ?? task.priority}
              />
              {projectedState.currentPhase && (
                <MetaRow
                  label="Fase corrente"
                  value={
                    <span className="rounded-full bg-brand-100 px-2 py-0.5 text-xs font-medium text-brand-700 dark:bg-brand-900/30 dark:text-brand-400">
                      {PHASE_LABEL[projectedState.currentPhase] ?? projectedState.currentPhase}
                    </span>
                  }
                />
              )}
              <MetaRow
                label="Creata"
                value={new Date(task.created_at).toLocaleDateString("it-IT", {
                  day: "numeric", month: "short", year: "numeric",
                })}
              />
              <MetaRow
                label="Aggiornata"
                value={new Date(task.updated_at).toLocaleDateString("it-IT", {
                  day: "numeric", month: "short", year: "numeric",
                })}
              />
            </div>
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

          {/* Execution metrics */}
          <TaskExecutionMetrics events={events} createdAt={task.created_at} />

          {/* PR artifact */}
          {projectedState.prData && (
            <PRCard
              data={projectedState.prData}
              needsReview={
                projectedState.prData.status === "open" &&
                projectedState.status !== "approved"
              }
            />
          )}

          {/* Deploy preview */}
          {projectedState.deployData && (
            <DeployPreviewCard data={projectedState.deployData} />
          )}

          {/* Commit list */}
          <CommitList events={events} {...(repoUrl !== undefined && { repoUrl })} />

          {/* Contextual actions */}
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
        </aside>
        </div>

        {/* ── RIGHT COLUMN: timeline ── */}
        <section className="rounded-xl border border-border bg-card p-4">
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
        </section>
      </div>
    </div>
  );
}

// ── Sub-components ─────────────────────────────────────────────────────────────

function MetaRow({
  label,
  value,
}: {
  label: string;
  value: React.ReactNode;
}) {
  return (
    <div>
      <p className="text-xs text-muted-foreground">{label}</p>
      <div className="mt-0.5 text-sm font-medium text-foreground">{value}</div>
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
