"use client";

import Link from "next/link";
import { useAgentStatus } from "@/lib/realtime/useAgentStatus";
import { cn } from "@/lib/utils";
import type { AgentStatusEnum } from "@robin/shared-types";

interface AgentHeroSectionProps {
  workspaceId: string;
  agentName: string;
  initialStatus: AgentStatusEnum;
  initialTaskTitle: string | null;
}

const statusConfig: Record<
  AgentStatusEnum,
  { label: string; dotClass: string; sectionClass: string; textClass: string }
> = {
  idle: {
    label: "Agente pronto",
    dotClass: "bg-slate-400",
    sectionClass: "border-border bg-card",
    textClass: "text-muted-foreground",
  },
  busy: {
    label: "In esecuzione",
    dotClass: "bg-emerald-500 animate-pulse",
    sectionClass: "border-emerald-200 bg-emerald-50 dark:border-emerald-800 dark:bg-emerald-950/10",
    textClass: "text-emerald-700 dark:text-emerald-400",
  },
  error: {
    label: "Errore",
    dotClass: "bg-red-500",
    sectionClass: "border-red-200 bg-red-50 dark:border-red-800 dark:bg-red-950/10",
    textClass: "text-red-700 dark:text-red-400",
  },
  offline: {
    label: "Offline",
    dotClass: "bg-zinc-300",
    sectionClass: "border-border bg-card",
    textClass: "text-muted-foreground",
  },
};

/**
 * Large hero section at the top of the dashboard.
 * Shows the agent name, real-time status, and the task currently in progress.
 * Updates live via Supabase Realtime without a page reload.
 */
export function AgentHeroSection({
  workspaceId,
  agentName,
  initialStatus,
  initialTaskTitle,
}: AgentHeroSectionProps) {
  const { status, taskTitle, isOffline } = useAgentStatus({
    workspaceId,
    initialStatus,
    initialTaskTitle,
  });

  const displayStatus = isOffline ? "offline" : status;
  const config = statusConfig[displayStatus] ?? statusConfig.offline;

  return (
    <div
      className={cn(
        "rounded-xl border p-6 transition-colors",
        config.sectionClass
      )}
    >
      <div className="flex items-start justify-between gap-4">
        <div className="flex items-center gap-3">
          <span
            className={cn(
              "inline-block h-3 w-3 rounded-full flex-shrink-0",
              config.dotClass
            )}
          />
          <div>
            <p className={cn("text-sm font-semibold", config.textClass)}>
              {isOffline ? "Realtime offline" : config.label}
            </p>
            <p className="text-xl font-bold text-foreground">{agentName}</p>
          </div>
        </div>

        {status !== "busy" && !isOffline && (
          <Link
            href="/tasks/new"
            className="flex-shrink-0 rounded-lg bg-primary px-4 py-2 text-sm font-semibold text-primary-foreground hover:opacity-90 transition-opacity"
          >
            Assegna una task
          </Link>
        )}
      </div>

      {status === "busy" && taskTitle && (
        <div className="mt-4 rounded-lg border border-emerald-200 bg-white/60 px-4 py-3 dark:border-emerald-800 dark:bg-black/20">
          <p className="text-xs font-medium uppercase tracking-wide text-emerald-600 dark:text-emerald-500">
            Task in corso
          </p>
          <p className="mt-0.5 font-semibold text-foreground">{taskTitle}</p>
        </div>
      )}

      {status === "idle" && !taskTitle && (
        <p className="mt-3 text-sm text-muted-foreground">
          Nessuna task in coda — l&apos;agente è pronto per ricevere lavoro.
        </p>
      )}

      {status === "error" && (
        <p className="mt-3 text-sm text-red-600 dark:text-red-400">
          L&apos;agente ha riscontrato un errore.{" "}
          <Link href="/tasks" className="underline">
            Controlla la lista task
          </Link>
          .
        </p>
      )}
    </div>
  );
}

/** Skeleton shown during SSR before agent status loads. */
export function AgentHeroSkeleton() {
  return (
    <div className="rounded-xl border border-border bg-card p-6 animate-pulse">
      <div className="flex items-center gap-3">
        <div className="h-3 w-3 rounded-full bg-muted" />
        <div>
          <div className="h-3 w-20 rounded bg-muted" />
          <div className="mt-1.5 h-6 w-32 rounded bg-muted" />
        </div>
      </div>
      <div className="mt-4 h-16 rounded-lg bg-muted" />
    </div>
  );
}
