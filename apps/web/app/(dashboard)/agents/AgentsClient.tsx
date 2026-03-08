"use client";

import { useEffect, useState, useTransition } from "react";
import { Plus, CheckCircle, Activity } from "lucide-react";
import { useRouter } from "next/navigation";
import { getSupabaseBrowserClient } from "@/lib/supabase/client";
import { AgentCreationForm } from "@/components/agents/AgentCreationForm";
import { cn } from "@/lib/utils";
import type { AgentWithStatus, AgentProvisioningStatus, Repository } from "@robin/shared-types";

// ─── Extended agent type with provisioning fields ────────────────────────────

type AgentRow = AgentWithStatus & {
  provisioning_status?: AgentProvisioningStatus;
  vps_id?: number | null;
  vps_created_at?: string | null;
  provisioned_at?: string | null;
  provisioning_error?: string | null;
  avatar_url?: string | null;
};

// ─── Avatar helpers ───────────────────────────────────────────────────────────

function nameToHue(name: string): number {
  let hash = 0;
  for (let i = 0; i < name.length; i++) {
    hash = (hash * 31 + name.charCodeAt(i)) & 0xffffffff;
  }
  return Math.abs(hash) % 360;
}

function getInitials(name: string): string {
  return name
    .split(/\s+/)
    .slice(0, 2)
    .map((w) => w[0]?.toUpperCase() ?? "")
    .join("");
}

// ─── Status helpers ───────────────────────────────────────────────────────────

function resolveAgentDisplayStatus(agent: AgentRow): {
  label: string;
  dotClass: string;
  badgeClass: string;
} {
  const provStatus = (agent.provisioning_status ?? "online") as AgentProvisioningStatus;
  const isActivelyProvisioning = provStatus === "pending" || provStatus === "provisioning";
  const isDeprovisioned = provStatus === "deprovisioned" || provStatus === "deprovisioning";

  if (isActivelyProvisioning) {
    return {
      label: "Provisioning",
      dotClass: "bg-blue-500 animate-pulse",
      badgeClass:
        "bg-blue-50 text-blue-700 border-blue-200 dark:bg-blue-950 dark:text-blue-400 dark:border-blue-800",
    };
  }
  if (isDeprovisioned) {
    return {
      label: "Eliminato",
      dotClass: "bg-zinc-300 dark:bg-zinc-600",
      badgeClass:
        "bg-zinc-50 text-zinc-400 border-zinc-200 dark:bg-zinc-900 dark:text-zinc-600 dark:border-zinc-700",
    };
  }

  const lastSeen = agent.last_seen_at ? new Date(agent.last_seen_at) : null;
  const isAlive = lastSeen !== null && Date.now() - lastSeen.getTime() < 2 * 60 * 1000;

  if (!isAlive) {
    return {
      label: "Offline",
      dotClass: "bg-zinc-300 dark:bg-zinc-600",
      badgeClass:
        "bg-zinc-50 text-zinc-500 border-zinc-200 dark:bg-zinc-900 dark:text-zinc-500 dark:border-zinc-700",
    };
  }

  if (agent.effective_status === "busy") {
    return {
      label: "In esecuzione",
      dotClass: "bg-blue-500 animate-pulse",
      badgeClass:
        "bg-blue-50 text-blue-700 border-blue-200 dark:bg-blue-950 dark:text-blue-400 dark:border-blue-800",
    };
  }

  return {
    label: "Online",
    dotClass: "bg-emerald-500 animate-pulse",
    badgeClass:
      "bg-emerald-50 text-emerald-700 border-emerald-200 dark:bg-emerald-950 dark:text-emerald-400 dark:border-emerald-800",
  };
}

// ─── Agent Card ───────────────────────────────────────────────────────────────

function AgentCard({ agent }: { agent: AgentRow }) {
  const router = useRouter();
  const hue = nameToHue(agent.name);
  const initials = getInitials(agent.name);
  const statusDisplay = resolveAgentDisplayStatus(agent);
  const isIdle = agent.effective_status !== "busy";

  return (
    <div
      className={cn(
        "flex flex-col rounded-ios-lg shadow-ios-sm bg-white dark:bg-[#1C1C1E]",
        "border border-border/60 transition-all duration-200 ease-out",
        "hover:scale-[1.02] hover:shadow-ios-md"
      )}
    >
      {/* Card body */}
      <div className="p-5 flex flex-col gap-4 flex-1">
        {/* Header row: avatar + name + status badge */}
        <div className="flex items-start justify-between gap-3">
          <div className="flex items-center gap-3 min-w-0">
            {/* Avatar with initials */}
            <div
              className="h-12 w-12 shrink-0 rounded-full flex items-center justify-center text-sm font-semibold select-none"
              style={{
                background: `hsl(${hue}, 65%, 50%)`,
                color: `hsl(${hue}, 65%, 95%)`,
              }}
              aria-label={agent.name}
            >
              {initials}
            </div>
            <div className="min-w-0">
              <h3 className="font-semibold text-base text-foreground truncate">{agent.name}</h3>
              {agent.slug && (
                <p className="mt-0.5 truncate font-mono text-xs text-muted-foreground">{agent.slug}</p>
              )}
            </div>
          </div>

          {/* Status badge */}
          <span
            className={cn(
              "inline-flex shrink-0 items-center gap-1.5 rounded-full border px-2.5 py-0.5 text-xs font-medium",
              statusDisplay.badgeClass
            )}
          >
            <span className={cn("h-1.5 w-1.5 rounded-full", statusDisplay.dotClass)} />
            {statusDisplay.label}
          </span>
        </div>

        {/* Current task pill */}
        <div className="flex">
          <span className="inline-flex items-center gap-1.5 rounded-full bg-zinc-100 dark:bg-zinc-800 px-3 py-1 text-xs text-zinc-600 dark:text-zinc-400 max-w-full">
            <span className="truncate">
              {isIdle ? "In attesa" : "Task in corso"}
            </span>
          </span>
        </div>

        {/* Metrics row */}
        <div className="flex items-center gap-2">
          <span className="inline-flex items-center gap-1.5 rounded-full bg-zinc-100 dark:bg-zinc-800 px-3 py-1 text-xs text-zinc-600 dark:text-zinc-400">
            <CheckCircle className="h-3.5 w-3.5 text-emerald-500 shrink-0" />
            <span>0 task completate</span>
          </span>
          <span className="inline-flex items-center gap-1.5 rounded-full bg-zinc-100 dark:bg-zinc-800 px-3 py-1 text-xs text-zinc-600 dark:text-zinc-400">
            <Activity className="h-3.5 w-3.5 text-blue-500 shrink-0" />
            <span>— uptime</span>
          </span>
        </div>

        {/* Provisioning progress banner */}
        {(agent.provisioning_status === "pending" || agent.provisioning_status === "provisioning") && (
          <div className="flex items-center gap-2 rounded-lg bg-blue-50 dark:bg-blue-950 px-3 py-2 text-xs text-blue-700 dark:text-blue-400">
            <svg className="h-3.5 w-3.5 shrink-0 animate-spin" viewBox="0 0 24 24" fill="none">
              <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
              <path
                className="opacity-75"
                fill="currentColor"
                d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"
              />
            </svg>
            <span>
              {agent.provisioning_status === "pending"
                ? "In attesa di avvio..."
                : "Creazione server in corso — ~3-5 min"}
            </span>
          </div>
        )}

        {/* Provisioning error banner */}
        {agent.provisioning_status === "error" && agent.provisioning_error && (
          <p className="truncate rounded-lg bg-red-50 dark:bg-red-950 px-3 py-2 text-xs text-red-700 dark:text-red-400">
            {agent.provisioning_error}
          </p>
        )}
      </div>

      {/* Footer: Dettaglio button */}
      <div className="border-t border-border/60 px-5 py-3">
        <button
          onClick={() => router.push(`/agents/${agent.id}`)}
          className="w-full rounded-lg py-1.5 text-sm font-medium text-muted-foreground transition-colors hover:bg-muted hover:text-foreground"
        >
          Dettaglio
        </button>
      </div>
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
        className="relative w-full max-w-md rounded-xl border border-border bg-white dark:bg-[#1C1C1E] p-6 shadow-2xl"
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

function EmptyState({ onCreateClick }: { onCreateClick: () => void }) {
  return (
    <div className="flex flex-col items-center justify-center py-20 text-center">
      {/* Robot idle SVG illustration */}
      <svg
        width="96"
        height="96"
        viewBox="0 0 96 96"
        fill="none"
        className="mb-6 opacity-80"
        aria-hidden="true"
      >
        {/* Body */}
        <rect x="24" y="44" width="48" height="36" rx="8" fill="#E5E7EB" className="dark:fill-zinc-700" />
        {/* Head */}
        <rect x="28" y="16" width="40" height="32" rx="8" fill="#E5E7EB" className="dark:fill-zinc-700" />
        {/* Antenna */}
        <line x1="48" y1="16" x2="48" y2="8" stroke="#9CA3AF" strokeWidth="2" strokeLinecap="round" className="dark:stroke-zinc-500" />
        <circle cx="48" cy="6" r="3" fill="#9CA3AF" className="dark:fill-zinc-500" />
        {/* Eyes */}
        <rect x="34" y="26" width="8" height="6" rx="3" fill="#6B7280" className="dark:fill-zinc-400" />
        <rect x="54" y="26" width="8" height="6" rx="3" fill="#6B7280" className="dark:fill-zinc-400" />
        {/* Mouth */}
        <rect x="38" y="38" width="20" height="3" rx="1.5" fill="#9CA3AF" className="dark:fill-zinc-500" />
        {/* Arms */}
        <rect x="8" y="48" width="16" height="8" rx="4" fill="#E5E7EB" className="dark:fill-zinc-700" />
        <rect x="72" y="48" width="16" height="8" rx="4" fill="#E5E7EB" className="dark:fill-zinc-700" />
        {/* Legs */}
        <rect x="32" y="76" width="12" height="14" rx="4" fill="#D1D5DB" className="dark:fill-zinc-600" />
        <rect x="52" y="76" width="12" height="14" rx="4" fill="#D1D5DB" className="dark:fill-zinc-600" />
        {/* Chest panel */}
        <rect x="36" y="54" width="24" height="16" rx="4" fill="#D1D5DB" className="dark:fill-zinc-600" />
        <circle cx="44" cy="62" r="3" fill="#9CA3AF" className="dark:fill-zinc-400" />
        <circle cx="52" cy="62" r="3" fill="#9CA3AF" className="dark:fill-zinc-400" />
      </svg>

      <h3 className="text-lg font-semibold text-foreground">Nessun agente configurato</h3>
      <p className="mt-2 max-w-sm text-sm text-[#8E8E93]">
        Aggiungi il tuo primo agente per iniziare ad automatizzare il lavoro
      </p>
      <button
        onClick={onCreateClick}
        className="mt-6 inline-flex items-center gap-2 rounded-xl bg-primary px-5 py-2.5 text-sm font-semibold text-primary-foreground transition-colors hover:bg-primary/90"
      >
        <Plus className="h-4 w-4" />
        Aggiungi agente
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
  const [updatePending, startUpdateTransition] = useTransition();
  const [updateMsg, setUpdateMsg] = useState<string | null>(null);

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
  const onlineCount = visibleAgents.filter((a) => {
    if (!a.last_seen_at) return false;
    return Date.now() - new Date(a.last_seen_at).getTime() < 2 * 60 * 1000;
  }).length;

  return (
    <>
      <div className="space-y-6">
        {/* Page header */}
        <div className="flex items-start justify-between gap-4">
          <div>
            <h1 className="text-2xl font-bold text-foreground">Agenti</h1>
            <p className="mt-1 text-sm text-[#8E8E93]">
              Gestisci e monitora gli agenti AI del tuo workspace in tempo reale.
            </p>
          </div>
          <div className="flex items-center gap-2 shrink-0">
            {onlineCount > 0 && (
              <button
                onClick={() => {
                  setUpdateMsg(null);
                  startUpdateTransition(async () => {
                    const res = await fetch("/api/admin/update-agents", { method: "POST" });
                    const data = (await res.json().catch(() => ({}))) as {
                      receiverCount?: number;
                      error?: string;
                    };
                    if (res.ok) {
                      setUpdateMsg(`Aggiornamento inviato a ${data.receiverCount ?? 0} agenti`);
                      setTimeout(() => setUpdateMsg(null), 5000);
                    } else {
                      setUpdateMsg(data.error ?? "Errore");
                    }
                  });
                }}
                disabled={updatePending}
                className="rounded-xl border border-border px-3.5 py-2 text-sm font-medium text-muted-foreground transition-colors hover:border-primary hover:text-primary disabled:cursor-not-allowed disabled:opacity-50"
              >
                {updatePending ? "Invio..." : "Aggiorna tutti"}
              </button>
            )}
            <button
              onClick={() => setShowModal(true)}
              className="inline-flex items-center gap-2 rounded-xl bg-primary px-4 py-2 text-sm font-semibold text-primary-foreground transition-colors hover:bg-primary/90"
            >
              <Plus className="h-4 w-4" />
              Aggiungi agente
            </button>
          </div>
        </div>

        {updateMsg && (
          <div className="rounded-xl border border-blue-200 bg-blue-50 px-4 py-2.5 text-sm text-blue-700 dark:border-blue-800 dark:bg-blue-950 dark:text-blue-400">
            {updateMsg}
          </div>
        )}

        {/* Grid or empty state */}
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
