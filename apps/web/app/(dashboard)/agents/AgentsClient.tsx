"use client";

import { useEffect, useState, useTransition } from "react";
import { Plus, Bot } from "lucide-react";
import { useRouter } from "next/navigation";
import { getSupabaseBrowserClient } from "@/lib/supabase/client";
import { AgentCreationForm } from "@/components/agents/AgentCreationForm";
import { AppDialog } from "@/components/ui/app-dialog";
import { cn } from "@/lib/utils";
import type { AgentWithStatus, AgentProvisioningStatus, Repository } from "@robin/shared-types";

// ─── Extended agent type with provisioning fields ────────────────────────────

type AgentRow = AgentWithStatus & {
  provisioning_status?: AgentProvisioningStatus;
  vps_ip?: string | null;
  vps_id?: number | null;
  vps_created_at?: string | null;
  provisioned_at?: string | null;
  provisioning_error?: string | null;
  avatar_url?: string | null;
};

// ─── Avatar helpers ───────────────────────────────────────────────────────────

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
        "bg-blue-50 text-blue-700 border border-blue-200 dark:bg-blue-950 dark:text-blue-400 dark:border-blue-800",
    };
  }
  if (isDeprovisioned) {
    return {
      label: "Eliminato",
      dotClass: "bg-zinc-300 dark:bg-zinc-600",
      badgeClass:
        "bg-zinc-100 text-zinc-500 border border-zinc-200 dark:bg-zinc-800 dark:text-zinc-400",
    };
  }

  const lastSeen = agent.last_seen_at ? new Date(agent.last_seen_at) : null;
  const isAlive = lastSeen !== null && Date.now() - lastSeen.getTime() < 2 * 60 * 1000;

  if (!isAlive) {
    return {
      label: "Offline",
      dotClass: "bg-zinc-300 dark:bg-zinc-600",
      badgeClass:
        "bg-zinc-100 text-zinc-500 border border-zinc-200 dark:bg-zinc-800 dark:text-zinc-400",
    };
  }

  if (agent.effective_status === "busy") {
    return {
      label: "In esecuzione",
      dotClass: "bg-blue-500 animate-pulse",
      badgeClass:
        "bg-blue-50 text-blue-700 border border-blue-200 dark:bg-blue-950 dark:text-blue-400 dark:border-blue-800",
    };
  }

  return {
    label: "Online",
    dotClass: "bg-emerald-500 animate-pulse",
    badgeClass:
      "bg-emerald-50 text-emerald-700 border border-emerald-200 dark:bg-emerald-950 dark:text-emerald-300 dark:border-emerald-800",
  };
}

// ─── Agent Card ───────────────────────────────────────────────────────────────

function AgentCard({ agent }: { agent: AgentRow }) {
  const router = useRouter();
  const initials = getInitials(agent.name);
  const statusDisplay = resolveAgentDisplayStatus(agent);

  const lastHeartbeat = agent.last_seen_at
    ? new Date(agent.last_seen_at).toLocaleString("it-IT", {
        day: "2-digit",
        month: "2-digit",
        year: "numeric",
        hour: "2-digit",
        minute: "2-digit",
      })
    : null;

  return (
    <div
      role="button"
      tabIndex={0}
      onClick={() => router.push(`/agents/${agent.id}`)}
      onKeyDown={(e) => { if (e.key === "Enter" || e.key === " ") router.push(`/agents/${agent.id}`); }}
      className="border border-border rounded-lg p-4 bg-card hover:border-zinc-400 dark:hover:border-zinc-600 transition-colors cursor-pointer"
    >
      {/* Top row: avatar + name + badge */}
      <div className="flex items-start justify-between gap-3">
        <div className="flex items-center gap-3 min-w-0">
          {/* Avatar */}
          <div className="w-10 h-10 rounded-full bg-muted flex items-center justify-center text-lg shrink-0 font-semibold text-muted-foreground select-none">
            {initials}
          </div>
          <div className="min-w-0">
            <p className="text-sm font-semibold text-foreground truncate">{agent.name}</p>
            {agent.slug && (
              <p className="text-xs font-mono text-muted-foreground truncate mt-0.5">{agent.slug}</p>
            )}
          </div>
        </div>

        {/* Status badge */}
        <span
          className={cn(
            "inline-flex shrink-0 items-center rounded-full border px-2.5 py-0.5 text-xs font-medium",
            statusDisplay.badgeClass
          )}
        >
          <span className={cn("w-1.5 h-1.5 rounded-full mr-1.5", statusDisplay.dotClass)} />
          {statusDisplay.label}
        </span>
      </div>

      {/* VPS IP + heartbeat */}
      {(agent.vps_ip ?? lastHeartbeat) && (
        <div className="mt-3 space-y-1">
          {agent.vps_ip && (
            <p className="text-xs font-mono text-muted-foreground">{agent.vps_ip}</p>
          )}
          {lastHeartbeat && (
            <p className="text-xs text-muted-foreground">Ultimo heartbeat: {lastHeartbeat}</p>
          )}
        </div>
      )}

      {/* Provisioning progress banner */}
      {(agent.provisioning_status === "pending" || agent.provisioning_status === "provisioning") && (
        <div className="mt-3 flex items-center gap-2 rounded-lg bg-blue-50 dark:bg-blue-950 px-3 py-2 text-xs text-blue-700 dark:text-blue-400">
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
        <p className="mt-3 truncate rounded-lg bg-red-50 dark:bg-red-950 px-3 py-2 text-xs text-red-700 dark:text-red-400">
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
    <AppDialog onClose={onClose} maxWidth="max-w-md">
      <AppDialog.Header title="Crea agente" />
      <AppDialog.Body>
        <AgentCreationForm
          repositories={repositories}
          hasGitHubConnection={hasGitHubConnection}
          onClose={onClose}
        />
      </AppDialog.Body>
    </AppDialog>
  );
}

// ─── Empty state ──────────────────────────────────────────────────────────────

function EmptyState({ onCreateClick }: { onCreateClick: () => void }) {
  return (
    <div className="flex flex-col items-center justify-center py-20 text-center">
      <Bot className="h-10 w-10 text-muted-foreground mb-4" />
      <p className="text-sm text-muted-foreground">Nessun agente configurato</p>
      <button
        onClick={onCreateClick}
        className="mt-4 inline-flex items-center gap-2 rounded-md border border-border px-4 py-2 text-sm font-medium text-muted-foreground transition-colors hover:border-zinc-400 hover:text-foreground dark:hover:border-zinc-600"
      >
        <Plus className="h-4 w-4" />
        Add agent
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
            <h1 className="text-xl font-semibold text-foreground">Agenti</h1>
            <p className="mt-1 text-sm text-muted-foreground">
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
                className="rounded-md border border-border px-3.5 py-2 text-sm font-medium text-muted-foreground transition-colors hover:border-zinc-400 hover:text-foreground dark:hover:border-zinc-600 disabled:cursor-not-allowed disabled:opacity-50"
              >
                {updatePending ? "Invio..." : "Aggiorna tutti"}
              </button>
            )}
            <button
              onClick={() => setShowModal(true)}
              className="inline-flex items-center gap-2 rounded-md border border-border px-4 py-2 text-sm font-medium text-muted-foreground transition-colors hover:border-zinc-400 hover:text-foreground dark:hover:border-zinc-600"
            >
              <Plus className="h-4 w-4" />
              Add agent
            </button>
          </div>
        </div>

        {updateMsg && (
          <div className="rounded-lg border border-blue-200 bg-blue-50 px-4 py-2.5 text-sm text-blue-700 dark:border-blue-800 dark:bg-blue-950 dark:text-blue-400">
            {updateMsg}
          </div>
        )}

        {/* Grid or empty state */}
        {visibleAgents.length === 0 ? (
          <EmptyState onCreateClick={() => setShowModal(true)} />
        ) : (
          <div className="grid grid-cols-2 gap-4">
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
