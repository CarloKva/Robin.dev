"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { getSupabaseBrowserClient } from "@/lib/supabase/client";
import { AgentCreationForm } from "@/components/agents/AgentCreationForm";
import { cn } from "@/lib/utils";
import type { AgentWithStatus, AgentProvisioningStatus, Repository } from "@robin/shared-types";

// ─── Status config (operational) ────────────────────────────────────────────

const operationalStatusConfig = {
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

// ─── Provisioning status config ───────────────────────────────────────────────

const provisioningStatusConfig: Record<
  AgentProvisioningStatus,
  { label: string; badge: string; ring: string; dot: string }
> = {
  pending: {
    label: "In coda",
    dot: "bg-zinc-300 dark:bg-zinc-600",
    badge: "bg-zinc-50 text-zinc-500 border-zinc-200 dark:bg-zinc-900 dark:text-zinc-500 dark:border-zinc-700",
    ring: "ring-zinc-200 dark:ring-zinc-700",
  },
  provisioning: {
    label: "Provisioning",
    dot: "bg-blue-500 animate-pulse",
    badge: "bg-blue-50 text-blue-700 border-blue-200 dark:bg-blue-950 dark:text-blue-400 dark:border-blue-800",
    ring: "ring-blue-200 dark:ring-blue-800",
  },
  online: {
    label: "Online",
    dot: "bg-emerald-500",
    badge: "bg-emerald-50 text-emerald-700 border-emerald-200 dark:bg-emerald-950 dark:text-emerald-400 dark:border-emerald-800",
    ring: "ring-emerald-200 dark:ring-emerald-800",
  },
  error: {
    label: "Errore",
    dot: "bg-red-500",
    badge: "bg-red-50 text-red-700 border-red-200 dark:bg-red-950 dark:text-red-400 dark:border-red-800",
    ring: "ring-red-200 dark:ring-red-800",
  },
  deprovisioning: {
    label: "Eliminazione",
    dot: "bg-amber-500 animate-pulse",
    badge: "bg-amber-50 text-amber-700 border-amber-200 dark:bg-amber-950 dark:text-amber-400 dark:border-amber-800",
    ring: "ring-amber-200 dark:ring-amber-800",
  },
  deprovisioned: {
    label: "Eliminato",
    dot: "bg-zinc-300 dark:bg-zinc-600",
    badge: "bg-zinc-50 text-zinc-400 border-zinc-200 dark:bg-zinc-900 dark:text-zinc-600 dark:border-zinc-700",
    ring: "ring-zinc-200 dark:ring-zinc-700",
  },
};

// ─── Extended agent type with provisioning fields ────────────────────────────

type AgentRow = AgentWithStatus & {
  provisioning_status?: AgentProvisioningStatus;
  vps_id?: number | null;
  vps_created_at?: string | null;
  provisioned_at?: string | null;
  provisioning_error?: string | null;
};

// ─── Agent Card ───────────────────────────────────────────────────────────────

function AgentCard({ agent }: { agent: AgentRow }) {
  const router = useRouter();
  const provStatus = (agent.provisioning_status ?? "online") as AgentProvisioningStatus;
  const isProvisioning = provStatus !== "online" && provStatus !== "deprovisioned";

  // Choose which badge to show
  let cfg: { label: string; dot: string; badge: string; ring: string };
  if (isProvisioning) {
    cfg = provisioningStatusConfig[provStatus];
  } else {
    const effectiveStatus =
      (agent.effective_status as keyof typeof operationalStatusConfig) in operationalStatusConfig
        ? (agent.effective_status as keyof typeof operationalStatusConfig)
        : "offline";
    cfg = operationalStatusConfig[effectiveStatus];
  }

  const lastSeen = agent.last_seen_at ? new Date(agent.last_seen_at) : null;
  const lastSeenLabel = lastSeen ? formatRelativeTime(lastSeen) : "Mai";

  return (
    <div
      onClick={() => router.push(`/agents/${agent.id}`)}
      className={cn(
        "cursor-pointer rounded-xl border bg-card p-5 shadow-sm ring-1 transition-shadow hover:shadow-md",
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
        {!isProvisioning && (
          <>
            <dt className="text-muted-foreground">Ultimo heartbeat</dt>
            <dd className="text-foreground">{lastSeenLabel}</dd>
          </>
        )}
      </dl>

      {/* Provisioning error banner */}
      {provStatus === "error" && agent.provisioning_error && (
        <p className="mt-3 truncate rounded-md bg-red-50 px-2 py-1.5 text-xs text-red-700 dark:bg-red-950 dark:text-red-400">
          {agent.provisioning_error}
        </p>
      )}
    </div>
  );
}

// ─── Modal ────────────────────────────────────────────────────────────────────

function CreationModal({
  repositories,
  hasGitHubConnection,
  onClose,
}: {
  repositories: Repository[];
  hasGitHubConnection: boolean;
  onClose: () => void;
}) {
  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-sm p-4"
      onClick={(e) => {
        if (e.target === e.currentTarget) onClose();
      }}
    >
      <div
        className="relative w-full max-w-md rounded-xl border border-border bg-card p-6 shadow-2xl"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="mb-5 flex items-center justify-between">
          <h2 className="text-base font-semibold text-foreground">Crea agente</h2>
          <button
            onClick={onClose}
            className="rounded-md p-1 text-muted-foreground transition-colors hover:bg-muted hover:text-foreground"
            aria-label="Chiudi"
          >
            <svg width="16" height="16" viewBox="0 0 16 16" fill="none">
              <path d="M4 4L12 12M12 4L4 12" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" />
            </svg>
          </button>
        </div>
        <AgentCreationForm
          repositories={repositories}
          hasGitHubConnection={hasGitHubConnection}
          onClose={onClose}
        />
      </div>
    </div>
  );
}

// ─── Empty state ──────────────────────────────────────────────────────────────

function EmptyState({
  onCreateClick,
}: {
  onCreateClick: () => void;
}) {
  return (
    <div className="flex flex-col items-center justify-center rounded-xl border border-dashed border-border bg-muted/20 p-12 text-center">
      <div className="mb-3 flex h-12 w-12 items-center justify-center rounded-full bg-muted">
        <span className="text-2xl">🤖</span>
      </div>
      <h3 className="text-sm font-semibold text-foreground">Nessun agente creato</h3>
      <p className="mt-1 max-w-sm text-sm text-muted-foreground">
        Crea il primo agente per iniziare ad eseguire task in autonomia.
      </p>
      <button
        onClick={onCreateClick}
        className="mt-4 rounded-md bg-primary px-4 py-2 text-sm font-medium text-primary-foreground transition-colors hover:bg-primary/90"
      >
        Crea agente
      </button>
    </div>
  );
}

// ─── Main client ──────────────────────────────────────────────────────────────

interface AgentsClientProps {
  workspaceId: string;
  initialAgents: AgentRow[];
  hasGitHubConnection: boolean;
  enabledRepositories: Repository[];
}

export function AgentsClient({
  workspaceId,
  initialAgents,
  hasGitHubConnection,
  enabledRepositories,
}: AgentsClientProps) {
  const [agents, setAgents] = useState<AgentRow[]>(initialAgents);
  const [showModal, setShowModal] = useState(false);

  // Subscribe to realtime on agents table
  useEffect(() => {
    const supabase = getSupabaseBrowserClient();

    const channel = supabase
      .channel(`agents:${workspaceId}`)
      .on(
        "postgres_changes",
        { event: "*", schema: "public", table: "agents", filter: `workspace_id=eq.${workspaceId}` },
        () => void fetchAgents()
      )
      .on(
        "postgres_changes",
        { event: "*", schema: "public", table: "agent_status" },
        () => void fetchAgents()
      )
      .subscribe();

    async function fetchAgents() {
      const { data } = await supabase
        .from("agents_with_status")
        .select("*")
        .eq("workspace_id", workspaceId)
        .order("created_at", { ascending: true });
      if (data) setAgents(data as AgentRow[]);
    }

    return () => { void supabase.removeChannel(channel); };
  }, [workspaceId]);

  const visibleAgents = agents.filter((a) => a.provisioning_status !== "deprovisioned");
  const onlineCount = visibleAgents.filter(
    (a) => a.effective_status === "idle" || a.effective_status === "busy"
  ).length;

  return (
    <>
      <div className="space-y-6">
        {/* Summary + create button */}
        <div className="flex items-center justify-between gap-3">
          <div className="flex items-center gap-3 text-sm text-muted-foreground">
            <span>
              <span className="font-semibold text-foreground">{visibleAgents.length}</span> agenti
            </span>
            <span>·</span>
            <span>
              <span className={cn("font-semibold", onlineCount > 0 ? "text-emerald-600 dark:text-emerald-400" : "text-foreground")}>
                {onlineCount}
              </span>{" "}
              online
            </span>
          </div>
          <button
            onClick={() => setShowModal(true)}
            className="rounded-md bg-primary px-3.5 py-2 text-sm font-medium text-primary-foreground transition-colors hover:bg-primary/90"
          >
            + Crea agente
          </button>
        </div>

        {/* Grid */}
        {visibleAgents.length === 0 ? (
          <EmptyState onCreateClick={() => setShowModal(true)} />
        ) : (
          <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
            {visibleAgents.map((agent) => (
              <AgentCard key={agent.id} agent={agent} />
            ))}
          </div>
        )}
      </div>

      {showModal && (
        <CreationModal
          repositories={enabledRepositories}
          hasGitHubConnection={hasGitHubConnection}
          onClose={() => setShowModal(false)}
        />
      )}
    </>
  );
}

// ─── Helpers ──────────────────────────────────────────────────────────────────

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
