"use client";

import { useEffect } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { Bot, GitPullRequest, Inbox, PenLine, Plus, Zap } from "lucide-react";
import { useRelativeTime } from "@/lib/hooks/useRelativeTime";
import type { DashboardMetrics, FeedEntry, ActiveTaskData, DashboardAgent, RecentTask } from "@/lib/db/dashboard";

interface DashboardClientProps {
  workspaceId: string;
  initialAgents: DashboardAgent[];
  metrics: DashboardMetrics;
  activeTask: ActiveTaskData | null;
  initialFeed: FeedEntry[];
  recentTasks: RecentTask[];
  userName: string;
}

const METRICS_REFRESH_INTERVAL_MS = 60_000;

/**
 * Client shell for the dashboard.
 * Vercel-style layout: header + stat cards + recent tasks table.
 */
export function DashboardClient({
  workspaceId: _workspaceId,
  initialAgents,
  metrics,
  activeTask: _activeTask,
  initialFeed: _initialFeed,
  recentTasks,
  userName,
}: DashboardClientProps) {
  const router = useRouter();

  // Refresh server-fetched metrics every 60s.
  useEffect(() => {
    const id = setInterval(() => {
      router.refresh();
    }, METRICS_REFRESH_INTERVAL_MS);
    return () => clearInterval(id);
  }, [router]);

  // First-time empty state: no tasks ever created in the workspace
  if (metrics.total === 0) {
    return <OnboardingEmptyState userName={userName} />;
  }

  const agentsOnline = initialAgents.filter(
    (a) => a.effective_status === "idle" || a.effective_status === "busy"
  ).length;

  function openCreateModal() {
    document.dispatchEvent(
      new CustomEvent("open-create-modal", { detail: { tab: "task" } })
    );
  }

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-start justify-between">
        <div>
          <h1 className="text-xl font-semibold text-foreground">Dashboard</h1>
          <p className="text-sm text-muted-foreground mt-0.5">
            Panoramica del workspace
          </p>
        </div>
        <button
          type="button"
          onClick={openCreateModal}
          className="inline-flex items-center gap-1.5 rounded-md border border-border bg-background px-3 py-1.5 text-sm font-medium text-foreground shadow-sm hover:bg-accent hover:text-accent-foreground transition-colors"
        >
          <Plus className="h-4 w-4" />
          Nuova task
        </button>
      </div>

      {/* Stat cards */}
      <div className="grid grid-cols-2 gap-4 md:grid-cols-4">
        <StatCard
          label="Sprint attivo"
          value={metrics.activeSprint}
          icon={<Zap className="h-4 w-4 text-muted-foreground" />}
        />
        <StatCard
          label="Task completate"
          value={metrics.completedThisWeek}
          sublabel="questa settimana"
        />
        <StatCard
          label="Task in review"
          value={metrics.inReview}
        />
        <StatCard
          label="Agenti online"
          value={agentsOnline}
          icon={<Bot className="h-4 w-4 text-muted-foreground" />}
        />
      </div>

      {/* Recent tasks table */}
      <div>
        <div className="flex items-center justify-between mb-3">
          <h2 className="text-sm font-semibold text-foreground">Task recenti</h2>
          <Link
            href="/tasks"
            className="text-xs text-muted-foreground hover:text-foreground transition-colors"
          >
            Vedi tutte →
          </Link>
        </div>
        <RecentTasksTable tasks={recentTasks} />
      </div>
    </div>
  );
}

// ─── Stat Card ────────────────────────────────────────────────────────────────

function StatCard({
  label,
  value,
  sublabel,
  icon,
}: {
  label: string;
  value: number;
  sublabel?: string;
  icon?: React.ReactNode;
}) {
  return (
    <div className="border border-border rounded-lg p-4 bg-card hover:border-zinc-400 dark:hover:border-zinc-600 transition-colors">
      <div className="flex items-center justify-between mb-2">
        <span className="text-xs text-muted-foreground uppercase tracking-wide font-medium">
          {label}
        </span>
        {icon}
      </div>
      <span className="text-2xl font-bold text-foreground">{value}</span>
      {sublabel && (
        <p className="text-xs text-muted-foreground mt-0.5">{sublabel}</p>
      )}
    </div>
  );
}

// ─── Recent Tasks Table ───────────────────────────────────────────────────────

const STATUS_BADGE: Record<string, string> = {
  pending:        "bg-zinc-100 text-zinc-700 dark:bg-zinc-800 dark:text-zinc-300",
  sprint_ready:   "bg-zinc-100 text-zinc-700 dark:bg-zinc-800 dark:text-zinc-300",
  backlog:        "bg-zinc-100 text-zinc-700 dark:bg-zinc-800 dark:text-zinc-300",
  queued:         "bg-zinc-100 text-zinc-700 dark:bg-zinc-800 dark:text-zinc-300",
  in_progress:    "bg-blue-50 text-blue-700 dark:bg-blue-950 dark:text-blue-300",
  in_review:      "bg-amber-50 text-amber-700 dark:bg-amber-950 dark:text-amber-300",
  review_pending: "bg-amber-50 text-amber-700 dark:bg-amber-950 dark:text-amber-300",
  rework:         "bg-amber-50 text-amber-700 dark:bg-amber-950 dark:text-amber-300",
  done:           "bg-emerald-50 text-emerald-700 dark:bg-emerald-950 dark:text-emerald-300",
  completed:      "bg-emerald-50 text-emerald-700 dark:bg-emerald-950 dark:text-emerald-300",
  approved:       "bg-emerald-50 text-emerald-700 dark:bg-emerald-950 dark:text-emerald-300",
  failed:         "bg-red-50 text-red-700 dark:bg-red-950 dark:text-red-300",
  blocked:        "bg-red-50 text-red-700 dark:bg-red-950 dark:text-red-300",
  cancelled:      "bg-zinc-100 text-zinc-500 dark:bg-zinc-800 dark:text-zinc-500",
  rejected:       "bg-red-50 text-red-700 dark:bg-red-950 dark:text-red-300",
};

const STATUS_LABEL: Record<string, string> = {
  pending:        "Pending",
  sprint_ready:   "Sprint ready",
  backlog:        "Backlog",
  queued:         "In coda",
  in_progress:    "In corso",
  in_review:      "In review",
  review_pending: "Review",
  rework:         "Rework",
  done:           "Done",
  completed:      "Completata",
  approved:       "Approvata",
  failed:         "Fallita",
  blocked:        "Bloccata",
  cancelled:      "Annullata",
  rejected:       "Rifiutata",
};

function StatusBadge({ status }: { status: string }) {
  const cls = STATUS_BADGE[status] ?? "bg-zinc-100 text-zinc-700 dark:bg-zinc-800 dark:text-zinc-300";
  const label = STATUS_LABEL[status] ?? status;
  return (
    <span className={`inline-flex items-center rounded-full px-2 py-0.5 text-xs font-medium ${cls}`}>
      {label}
    </span>
  );
}

function TaskRow({ task }: { task: RecentTask }) {
  const relativeTime = useRelativeTime(task.updated_at);
  return (
    <tr className="border-b border-border hover:bg-accent/50 transition-colors" style={{ height: "44px" }}>
      <td className="px-4 py-2.5">
        <StatusBadge status={task.status} />
      </td>
      <td className="px-4 py-2.5">
        <Link
          href={`/tasks/${task.id}`}
          className="text-sm font-medium text-foreground hover:underline line-clamp-1"
        >
          {task.title}
        </Link>
      </td>
      <td className="px-4 py-2.5 text-sm text-muted-foreground">
        {task.agent_name ?? "—"}
      </td>
      <td className="px-4 py-2.5 text-sm text-muted-foreground">
        {task.sprint_name ?? "—"}
      </td>
      <td className="px-4 py-2.5 text-xs text-muted-foreground whitespace-nowrap">
        {relativeTime}
      </td>
    </tr>
  );
}

function RecentTasksTable({ tasks }: { tasks: RecentTask[] }) {
  if (tasks.length === 0) {
    return (
      <div className="flex flex-col items-center justify-center py-12 border border-border rounded-lg bg-card">
        <Inbox className="h-8 w-8 text-muted-foreground mb-2" />
        <p className="text-sm text-muted-foreground">Nessuna task ancora</p>
      </div>
    );
  }

  return (
    <div className="border border-border rounded-lg bg-card overflow-hidden">
      <table className="w-full">
        <thead>
          <tr className="border-b border-border">
            <th className="px-4 py-3 text-left text-xs text-muted-foreground uppercase tracking-wide font-medium">
              Status
            </th>
            <th className="px-4 py-3 text-left text-xs text-muted-foreground uppercase tracking-wide font-medium">
              Titolo
            </th>
            <th className="px-4 py-3 text-left text-xs text-muted-foreground uppercase tracking-wide font-medium">
              Agente
            </th>
            <th className="px-4 py-3 text-left text-xs text-muted-foreground uppercase tracking-wide font-medium">
              Sprint
            </th>
            <th className="px-4 py-3 text-left text-xs text-muted-foreground uppercase tracking-wide font-medium">
              Aggiornata
            </th>
          </tr>
        </thead>
        <tbody>
          {tasks.map((task) => (
            <TaskRow key={task.id} task={task} />
          ))}
        </tbody>
      </table>
    </div>
  );
}

// ─── Onboarding Empty State ───────────────────────────────────────────────────

/** Shown on first access when the workspace has no tasks yet. */
function OnboardingEmptyState({ userName }: { userName: string }) {
  const steps = [
    {
      num: "1",
      icon: <PenLine className="h-4 w-4 text-primary" />,
      title: "Crea una task",
      desc: "Descrivi il lavoro in linguaggio naturale — titolo, tipo e priorità.",
    },
    {
      num: "2",
      icon: <Bot className="h-4 w-4 text-primary" />,
      title: "L'agente lavora",
      desc: "Robin analizza, progetta, scrive il codice e apre una PR automaticamente.",
    },
    {
      num: "3",
      icon: <GitPullRequest className="h-4 w-4 text-primary" />,
      title: "Approva la PR",
      desc: "Revisiona il lavoro prodotto e approva la PR direttamente dal gestionale.",
    },
  ] as const;

  function openCreateModal() {
    document.dispatchEvent(
      new CustomEvent("open-create-modal", { detail: { tab: "task" } })
    );
  }

  return (
    <div className="flex flex-col items-center justify-center py-16 text-center max-w-2xl mx-auto px-4">
      {/* Illustration */}
      <div
        className="mb-8"
        style={{ animation: "fadeInUp 0.4s ease both", animationDelay: "0ms" }}
      >
        <svg
          width="96"
          height="96"
          viewBox="0 0 96 96"
          fill="none"
          xmlns="http://www.w3.org/2000/svg"
          aria-label="Illustrazione agente Robin"
          role="img"
        >
          <circle cx="48" cy="48" r="48" fill="#007AFF" fillOpacity="0.08" />
          <line x1="48" y1="18" x2="48" y2="10" stroke="#007AFF" strokeWidth="2.5" strokeLinecap="round" />
          <circle cx="48" cy="8" r="3" fill="#007AFF" />
          <rect x="22" y="18" width="52" height="38" rx="12" fill="#007AFF" fillOpacity="0.12" stroke="#007AFF" strokeWidth="2" />
          <circle cx="36" cy="35" r="5" fill="#007AFF" />
          <circle cx="60" cy="35" r="5" fill="#007AFF" />
          <circle cx="37.5" cy="33.5" r="2" fill="white" />
          <circle cx="61.5" cy="33.5" r="2" fill="white" />
          <path d="M38 47 Q48 54 58 47" stroke="#007AFF" strokeWidth="2.5" strokeLinecap="round" fill="none" />
          <rect x="28" y="58" width="40" height="24" rx="9" fill="#007AFF" fillOpacity="0.12" stroke="#007AFF" strokeWidth="2" />
          <circle cx="48" cy="70" r="4" fill="#007AFF" fillOpacity="0.35" stroke="#007AFF" strokeWidth="1.5" />
          <rect x="10" y="60" width="16" height="10" rx="5" fill="#007AFF" fillOpacity="0.12" stroke="#007AFF" strokeWidth="2" />
          <rect x="70" y="60" width="16" height="10" rx="5" fill="#007AFF" fillOpacity="0.12" stroke="#007AFF" strokeWidth="2" />
        </svg>
      </div>

      <div style={{ animation: "fadeInUp 0.4s ease both", animationDelay: "100ms" }}>
        <h2 className="text-2xl font-bold text-foreground">
          {userName
            ? `Benvenuto, ${userName}! Robin è pronto a lavorare.`
            : "Benvenuto! Robin è pronto a lavorare."}
        </h2>
        <p className="mt-2 text-muted-foreground">
          Crea la tua prima task e lascia che l&apos;agente scriva il codice per te.
        </p>
      </div>

      <div className="relative mt-10 w-full">
        <div
          className="absolute left-0 right-0 hidden sm:block"
          style={{ top: "20px" }}
          aria-hidden="true"
        >
          <div className="mx-auto flex max-w-2xl items-center px-[10%]">
            <div className="flex-1 border-t-2 border-dashed border-border" />
          </div>
        </div>

        <div className="relative grid w-full grid-cols-1 gap-4 sm:grid-cols-3">
          {steps.map((step, i) => (
            <div
              key={step.num}
              className="rounded-xl border border-border bg-card p-5 text-left"
              style={{
                animation: "fadeInUp 0.4s ease both",
                animationDelay: `${200 + i * 100}ms`,
              }}
            >
              <div className="flex items-center gap-2">
                <span className="inline-flex h-10 w-10 flex-shrink-0 items-center justify-center rounded-full bg-primary text-sm font-bold text-primary-foreground">
                  {step.num}
                </span>
                <span className="inline-flex h-8 w-8 items-center justify-center rounded-lg bg-primary/10">
                  {step.icon}
                </span>
              </div>
              <p className="mt-3 font-semibold text-foreground">{step.title}</p>
              <p className="mt-1 text-sm text-muted-foreground">{step.desc}</p>
            </div>
          ))}
        </div>
      </div>

      <div
        className="mt-10"
        style={{ animation: "fadeInUp 0.4s ease both", animationDelay: "500ms" }}
      >
        <button
          type="button"
          onClick={openCreateModal}
          className="inline-flex h-12 items-center gap-2 rounded-xl bg-primary px-6 text-base font-semibold text-primary-foreground shadow-sm transition-opacity hover:opacity-90"
        >
          <Plus className="h-5 w-5" />
          Crea la tua prima task
        </button>
      </div>

      <style>{`
        @keyframes fadeInUp {
          from { opacity: 0; transform: translateY(12px); }
          to   { opacity: 1; transform: translateY(0); }
        }
      `}</style>
    </div>
  );
}
