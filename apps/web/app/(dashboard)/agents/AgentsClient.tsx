"use client";

import { useEffect, useState } from "react";
import { getSupabaseBrowserClient } from "@/lib/supabase/client";
import type { AgentWithStatus } from "@robin/shared-types";
import { cn } from "@/lib/utils";

// ─── Status config ──────────────────────────────────────────────────────────

const statusConfig = {
  idle: {
    label: "Idle",
    dot: "bg-slate-400",
    badge: "bg-slate-100 text-slate-700 border-slate-200 dark:bg-slate-800 dark:text-slate-300 dark:border-slate-700",
    ring: "ring-slate-200 dark:ring-slate-700",
  },
  busy: {
    label: "Working",
    dot: "bg-emerald-500 animate-pulse",
    badge: "bg-emerald-50 text-emerald-700 border-emerald-200 dark:bg-emerald-950 dark:text-emerald-400 dark:border-emerald-800",
    ring: "ring-emerald-200 dark:ring-emerald-800",
  },
  error: {
    label: "Error",
    dot: "bg-red-500",
    badge: "bg-red-50 text-red-700 border-red-200 dark:bg-red-950 dark:text-red-400 dark:border-red-800",
    ring: "ring-red-200 dark:ring-red-800",
  },
  offline: {
    label: "Offline",
    dot: "bg-zinc-300 dark:bg-zinc-600",
    badge: "bg-zinc-50 text-zinc-500 border-zinc-200 dark:bg-zinc-900 dark:text-zinc-500 dark:border-zinc-700",
    ring: "ring-zinc-200 dark:ring-zinc-700",
  },
} as const;

type EffectiveStatus = keyof typeof statusConfig;

// ─── Agent Card ─────────────────────────────────────────────────────────────

function AgentCard({ agent }: { agent: AgentWithStatus }) {
  const status = (agent.effective_status as EffectiveStatus) in statusConfig
    ? (agent.effective_status as EffectiveStatus)
    : "offline";
  const cfg = statusConfig[status];

  const lastSeen = agent.last_seen_at
    ? new Date(agent.last_seen_at)
    : null;

  const lastSeenLabel = lastSeen
    ? formatRelativeTime(lastSeen)
    : "Mai";

  return (
    <div
      className={cn(
        "rounded-xl border bg-card p-5 shadow-sm ring-1 transition-shadow hover:shadow-md",
        cfg.ring
      )}
    >
      {/* Header row */}
      <div className="flex items-start justify-between gap-3">
        <div className="min-w-0">
          <h3 className="truncate text-sm font-semibold text-foreground">{agent.name}</h3>
          {agent.slug && (
            <p className="mt-0.5 truncate font-mono text-xs text-muted-foreground">{agent.slug}</p>
          )}
        </div>
        <span
          className={cn(
            "inline-flex shrink-0 items-center gap-1.5 rounded-full border px-2.5 py-0.5 text-xs font-medium",
            cfg.badge
          )}
        >
          <span className={cn("h-1.5 w-1.5 rounded-full", cfg.dot)} />
          {cfg.label}
        </span>
      </div>

      {/* Info grid */}
      <dl className="mt-4 grid grid-cols-2 gap-x-4 gap-y-2.5 text-xs">
        {agent.vps_ip && (
          <>
            <dt className="text-muted-foreground">VPS IP</dt>
            <dd className="truncate font-mono text-foreground">{agent.vps_ip}</dd>
          </>
        )}
        {agent.vps_region && (
          <>
            <dt className="text-muted-foreground">Regione</dt>
            <dd className="text-foreground">{agent.vps_region.toUpperCase()}</dd>
          </>
        )}
        {agent.github_account && (
          <>
            <dt className="text-muted-foreground">GitHub</dt>
            <dd className="truncate text-foreground">@{agent.github_account}</dd>
          </>
        )}
        {agent.orchestrator_version && (
          <>
            <dt className="text-muted-foreground">Orchestratore</dt>
            <dd className="font-mono text-foreground">v{agent.orchestrator_version}</dd>
          </>
        )}
        {agent.claude_code_version && (
          <>
            <dt className="text-muted-foreground">Claude Code</dt>
            <dd className="font-mono text-foreground">{agent.claude_code_version}</dd>
          </>
        )}
        <dt className="text-muted-foreground">Ultimo heartbeat</dt>
        <dd className="text-foreground">{lastSeenLabel}</dd>
      </dl>
    </div>
  );
}

// ─── Empty state ─────────────────────────────────────────────────────────────

function EmptyState() {
  return (
    <div className="flex flex-col items-center justify-center rounded-xl border border-dashed border-border bg-muted/20 p-12 text-center">
      <div className="mb-3 flex h-12 w-12 items-center justify-center rounded-full bg-muted">
        <span className="text-2xl">🤖</span>
      </div>
      <h3 className="text-sm font-semibold text-foreground">Nessun agente configurato</h3>
      <p className="mt-1 max-w-sm text-sm text-muted-foreground">
        Provisiona il primo VPS seguendo il runbook in{" "}
        <code className="rounded bg-muted px-1 py-0.5 text-xs">docs/runbook/provisioning.md</code>.
      </p>
    </div>
  );
}

// ─── Main client component ───────────────────────────────────────────────────

interface AgentsClientProps {
  workspaceId: string;
  initialAgents: AgentWithStatus[];
}

export function AgentsClient({ workspaceId, initialAgents }: AgentsClientProps) {
  const [agents, setAgents] = useState<AgentWithStatus[]>(initialAgents);

  // Subscribe to Realtime changes on agents table
  useEffect(() => {
    const supabase = getSupabaseBrowserClient();

    const channel = supabase
      .channel(`agents:${workspaceId}`)
      .on(
        "postgres_changes",
        {
          event: "*",
          schema: "public",
          table: "agents",
          filter: `workspace_id=eq.${workspaceId}`,
        },
        () => {
          // Refetch agents when any change occurs
          void fetchAgents();
        }
      )
      .on(
        "postgres_changes",
        {
          event: "*",
          schema: "public",
          table: "agent_status",
        },
        () => {
          void fetchAgents();
        }
      )
      .subscribe();

    async function fetchAgents() {
      const { data } = await supabase
        .from("agents_with_status")
        .select("*")
        .eq("workspace_id", workspaceId)
        .order("created_at", { ascending: true });

      if (data) setAgents(data as AgentWithStatus[]);
    }

    return () => {
      void supabase.removeChannel(channel);
    };
  }, [workspaceId]);

  const onlineCount = agents.filter(
    (a) => a.effective_status === "idle" || a.effective_status === "busy"
  ).length;

  return (
    <div className="space-y-6">
      {/* Summary bar */}
      <div className="flex items-center gap-3 text-sm text-muted-foreground">
        <span>
          <span className="font-semibold text-foreground">{agents.length}</span> agenti totali
        </span>
        <span>·</span>
        <span>
          <span
            className={cn(
              "font-semibold",
              onlineCount > 0 ? "text-emerald-600 dark:text-emerald-400" : "text-foreground"
            )}
          >
            {onlineCount}
          </span>{" "}
          online
        </span>
      </div>

      {/* Grid */}
      {agents.length === 0 ? (
        <EmptyState />
      ) : (
        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
          {agents.map((agent) => (
            <AgentCard key={agent.id} agent={agent} />
          ))}
        </div>
      )}
    </div>
  );
}

// ─── Helpers ─────────────────────────────────────────────────────────────────

function formatRelativeTime(date: Date): string {
  const diffMs = Date.now() - date.getTime();
  const diffSec = Math.floor(diffMs / 1000);
  const diffMin = Math.floor(diffSec / 60);

  if (diffSec < 60) return `${diffSec}s fa`;
  if (diffMin < 60) return `${diffMin}m fa`;
  const diffH = Math.floor(diffMin / 60);
  if (diffH < 24) return `${diffH}h fa`;
  return `${Math.floor(diffH / 24)}g fa`;
}
