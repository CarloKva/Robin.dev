"use client";

import { useRouter } from "next/navigation";
import { cn } from "@/lib/utils";
import type { AgentProvisioningStatus } from "@robin/shared-types";
import type { DashboardAgent } from "@/lib/db/dashboard";

// ─── Status config ────────────────────────────────────────────────────────────

const operationalConfig = {
  idle: {
    label: "Pronto",
    dot: "bg-slate-400",
    badge: "bg-slate-100 text-slate-700 border-slate-200 dark:bg-slate-800 dark:text-slate-300 dark:border-slate-700",
  },
  busy: {
    label: "Working",
    dot: "bg-emerald-500 animate-pulse",
    badge: "bg-emerald-50 text-emerald-700 border-emerald-200 dark:bg-emerald-950 dark:text-emerald-400 dark:border-emerald-800",
  },
  error: {
    label: "Errore",
    dot: "bg-red-500",
    badge: "bg-red-50 text-red-700 border-red-200 dark:bg-red-950 dark:text-red-400 dark:border-red-800",
  },
  offline: {
    label: "Offline",
    dot: "bg-zinc-300 dark:bg-zinc-600",
    badge: "bg-zinc-50 text-zinc-500 border-zinc-200 dark:bg-zinc-900 dark:text-zinc-500 dark:border-zinc-700",
  },
} as const;

const provisioningConfig: Record<AgentProvisioningStatus, { label: string; dot: string; badge: string }> = {
  pending: {
    label: "In coda",
    dot: "bg-zinc-300 dark:bg-zinc-600",
    badge: "bg-zinc-50 text-zinc-500 border-zinc-200 dark:bg-zinc-900 dark:text-zinc-500 dark:border-zinc-700",
  },
  provisioning: {
    label: "Provisioning…",
    dot: "bg-blue-500 animate-pulse",
    badge: "bg-blue-50 text-blue-700 border-blue-200 dark:bg-blue-950 dark:text-blue-400 dark:border-blue-800",
  },
  online: {
    label: "Online",
    dot: "bg-emerald-500",
    badge: "bg-emerald-50 text-emerald-700 border-emerald-200 dark:bg-emerald-950 dark:text-emerald-400 dark:border-emerald-800",
  },
  error: {
    label: "Errore prov.",
    dot: "bg-red-500",
    badge: "bg-red-50 text-red-700 border-red-200 dark:bg-red-950 dark:text-red-400 dark:border-red-800",
  },
  deprovisioning: {
    label: "Eliminazione",
    dot: "bg-amber-500 animate-pulse",
    badge: "bg-amber-50 text-amber-700 border-amber-200 dark:bg-amber-950 dark:text-amber-400 dark:border-amber-800",
  },
  deprovisioned: {
    label: "Eliminato",
    dot: "bg-zinc-300 dark:bg-zinc-600",
    badge: "bg-zinc-50 text-zinc-400 border-zinc-200 dark:bg-zinc-900 dark:text-zinc-600 dark:border-zinc-700",
  },
};

// ─── Component ────────────────────────────────────────────────────────────────

export function AgentMiniCard({ agent }: { agent: DashboardAgent }) {
  const router = useRouter();
  // Show provisioning badge when the agent hasn't yet reached a stable operational state
  const isProvisioning =
    agent.provisioning_status === "pending" ||
    agent.provisioning_status === "provisioning" ||
    agent.provisioning_status === "deprovisioning" ||
    agent.provisioning_status === "error";

  const badge = isProvisioning
    ? provisioningConfig[agent.provisioning_status]
    : operationalConfig[(agent.effective_status as keyof typeof operationalConfig) ?? "offline"];

  const showTaskStrip = agent.effective_status === "busy" && agent.current_task_title;
  const maxRepos = 2;
  const visibleRepos = agent.repository_names.slice(0, maxRepos);
  const extraRepos = agent.repository_names.length - maxRepos;

  return (
    <div
      role="button"
      tabIndex={0}
      onClick={() => router.push(`/agents/${agent.id}`)}
      onKeyDown={(e) => { if (e.key === "Enter") router.push(`/agents/${agent.id}`); }}
      className="cursor-pointer rounded-xl border border-border bg-card p-4 shadow-sm transition-shadow hover:shadow-md"
    >
      {/* Header */}
      <div className="flex items-start justify-between gap-2">
        <div className="min-w-0">
          <p className="truncate text-sm font-semibold text-foreground">{agent.name}</p>
          {agent.slug && (
            <p className="mt-0.5 truncate font-mono text-[11px] text-muted-foreground">{agent.slug}</p>
          )}
        </div>
        <span
          className={cn(
            "inline-flex shrink-0 items-center gap-1.5 rounded-full border px-2 py-0.5 text-[11px] font-medium",
            badge.badge
          )}
        >
          <span className={cn("h-1.5 w-1.5 rounded-full", badge.dot)} />
          {badge.label}
        </span>
      </div>

      {/* Repo chips */}
      {agent.repository_names.length > 0 && (
        <div className="mt-3 flex flex-wrap gap-1">
          {visibleRepos.map((repo) => (
            <span
              key={repo}
              className="rounded bg-muted px-1.5 py-0.5 font-mono text-[10px] text-muted-foreground"
            >
              {repo.split("/")[1] ?? repo}
            </span>
          ))}
          {extraRepos > 0 && (
            <span className="rounded bg-muted px-1.5 py-0.5 text-[10px] text-muted-foreground">
              +{extraRepos}
            </span>
          )}
        </div>
      )}

      {/* Active task strip */}
      {showTaskStrip && (
        <div className="mt-3 rounded-md border border-emerald-200 bg-emerald-50/60 px-2.5 py-1.5 dark:border-emerald-800 dark:bg-emerald-950/30">
          <p className="truncate text-[11px] font-medium text-emerald-700 dark:text-emerald-400">
            {agent.current_task_title}
          </p>
        </div>
      )}

      {/* Idle state */}
      {!isProvisioning && agent.effective_status === "idle" && (
        <p className="mt-3 text-[11px] text-muted-foreground">
          In attesa di task
        </p>
      )}

      {/* Provisioning indicator */}
      {isProvisioning && agent.provisioning_status === "provisioning" && (
        <div className="mt-3 h-1 overflow-hidden rounded-full bg-muted">
          <div className="h-full w-1/2 animate-[shimmer_1.5s_infinite] rounded-full bg-blue-400 dark:bg-blue-600" />
        </div>
      )}
    </div>
  );
}
