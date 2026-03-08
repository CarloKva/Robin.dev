"use client";

import { useEffect } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
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
    return <OnboardingEmptyState />;
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
function OnboardingEmptyState() {
  const steps = [
    {
      num: "1",
      title: "Crea una task",
      desc: "Descrivi il lavoro in linguaggio naturale — titolo, tipo e priorità.",
    },
    {
      num: "2",
      title: "L'agente lavora",
      desc: "Robin analizza, progetta, scrive il codice e apre una PR automaticamente.",
    },
    {
      num: "3",
      title: "Approva la PR",
      desc: "Revisiona il lavoro prodotto e approva la PR direttamente dal gestionale.",
    },
  ];

  return (
    <div className="flex flex-col items-center justify-center py-16 text-center">
      <h2 className="text-2xl font-bold text-foreground">
        Benvenuto in Robin.dev
      </h2>
      <p className="mt-2 text-muted-foreground">
        Il tuo workspace è pronto. Ecco come iniziare.
      </p>

      <div className="mt-10 grid w-full max-w-2xl grid-cols-1 gap-4 sm:grid-cols-3">
        {steps.map((step) => (
          <div
            key={step.num}
            className="rounded-xl border border-border bg-card p-5 text-left"
          >
            <span className="inline-flex h-8 w-8 items-center justify-center rounded-full bg-primary text-sm font-bold text-primary-foreground">
              {step.num}
            </span>
            <p className="mt-3 font-semibold text-foreground">{step.title}</p>
            <p className="mt-1 text-sm text-muted-foreground">{step.desc}</p>
          </div>
        ))}
      </div>

      <Link
        href="/tasks/new"
        className="mt-10 rounded-lg bg-primary px-6 py-3 text-base font-semibold text-primary-foreground hover:opacity-90 transition-opacity min-h-[44px] inline-flex items-center"
      >
        Crea la tua prima task
      </Link>
    </div>
  );
}
