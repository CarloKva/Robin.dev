"use client";

import { useEffect } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { Plus, GitPullRequest, Bot } from "lucide-react";
import { AgentStatusGrid } from "@/components/dashboard/AgentStatusGrid";
import { MetricsTile } from "@/components/dashboard/MetricsTile";
import { ActiveTaskCard } from "@/components/dashboard/ActiveTaskCard";
import { WorkspaceFeed } from "@/components/dashboard/WorkspaceFeed";
import type { DashboardMetrics, FeedEntry, ActiveTaskData, DashboardAgent } from "@/lib/db/dashboard";

interface DashboardClientProps {
  workspaceId: string;
  initialAgents: DashboardAgent[];
  metrics: DashboardMetrics;
  activeTask: ActiveTaskData | null;
  initialFeed: FeedEntry[];
  userName: string;
}

const METRICS_REFRESH_INTERVAL_MS = 60_000;

/**
 * Client shell for the dashboard.
 * Orchestrates all dashboard sections and handles the 60s metrics refresh
 * via router.refresh() (re-runs Server Component without full page reload).
 */
export function DashboardClient({
  workspaceId,
  initialAgents,
  metrics,
  activeTask,
  initialFeed,
  userName,
}: DashboardClientProps) {
  const router = useRouter();

  // Refresh server-fetched metrics (task counts) every 60s.
  // Realtime handles the feed and agent grid — this only refreshes the tiles.
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

  return (
    <div className="space-y-6">
      {/* Agents grid — real-time status of all agents */}
      <section>
        <div className="mb-3 flex items-center justify-between">
          <h2 className="text-sm font-semibold text-foreground">Agenti attivi</h2>
          <Link href="/agents" className="text-xs text-muted-foreground hover:text-foreground">
            Gestisci →
          </Link>
        </div>
        <AgentStatusGrid workspaceId={workspaceId} initialAgents={initialAgents} />
      </section>

      {/* Metric tiles */}
      <div className="grid grid-cols-1 gap-4 sm:grid-cols-3">
        <MetricsTile
          value={metrics.completedThisWeek}
          label="Completate questa settimana"
          type="completed"
          sparkline={metrics.completedSparkline}
        />
        <MetricsTile
          value={metrics.inQueue}
          label="In coda / in esecuzione"
          type="queue"
          sparkline={metrics.inQueueSparkline}
        />
        <MetricsTile
          value={metrics.needsAttention}
          label="Richiedono attenzione"
          type="attention"
          sparkline={metrics.needsAttentionSparkline}
        />
      </div>

      {/* Active task + Feed */}
      <div className="grid grid-cols-1 gap-6 lg:grid-cols-2">
        <ActiveTaskCard task={activeTask} />
        <WorkspaceFeed workspaceId={workspaceId} initialFeed={initialFeed} />
      </div>
    </div>
  );
}

/** Shown on first access when the workspace has no tasks yet. */
function OnboardingEmptyState({ userName }: { userName: string }) {
  const firstName = userName || null;

  const steps = [
    {
      num: "1",
      icon: <Plus className="h-4 w-4 text-primary" />,
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
    document.dispatchEvent(new CustomEvent("open-create-modal"));
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
          aria-hidden="true"
          className="text-primary"
        >
          <rect width="96" height="96" rx="24" className="fill-primary/10" />
          <circle cx="48" cy="38" r="14" className="fill-primary/20 stroke-primary" strokeWidth="2" />
          <circle cx="42" cy="35" r="2.5" className="fill-primary" />
          <circle cx="54" cy="35" r="2.5" className="fill-primary" />
          <path d="M42 42 Q48 47 54 42" className="stroke-primary" strokeWidth="2" strokeLinecap="round" fill="none" />
          <rect x="30" y="58" width="36" height="6" rx="3" className="fill-primary/30" />
          <rect x="36" y="68" width="24" height="6" rx="3" className="fill-primary/20" />
        </svg>
      </div>

      {/* Headline + subtitle */}
      <div
        style={{ animation: "fadeInUp 0.4s ease both", animationDelay: "100ms" }}
      >
        <h2 className="text-2xl font-bold text-foreground">
          {firstName ? `Benvenuto, ${firstName}! ` : "Benvenuto! "}
          Robin è pronto a lavorare.
        </h2>
        <p className="mt-2 text-muted-foreground">
          Crea la tua prima task e lascia che l&apos;agente scriva il codice per te.
        </p>
      </div>

      {/* Step cards */}
      <div className="relative mt-10 w-full">
        {/* Dashed connector — desktop only */}
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

      {/* CTA */}
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
