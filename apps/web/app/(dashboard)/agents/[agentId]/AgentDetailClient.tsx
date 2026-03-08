"use client";

import Link from "next/link";
import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { RotateCcw, Square } from "lucide-react";
import { ProvisioningTimeline } from "@/components/agents/ProvisioningTimeline";
import { cn } from "@/lib/utils";
import { STATUS_LABELS } from "@/lib/task-constants";
import type { Repository, AgentProvisioningStatus, TaskStatus } from "@robin/shared-types";

// ─── Types ────────────────────────────────────────────────────────────────────

interface AgentData {
  id: string;
  workspace_id: string;
  name: string;
  slug: string | null;
  vps_ip: string | null;
  vps_region: string | null;
  last_seen_at: string | null;
  orchestrator_version: string | null;
  claude_code_version: string | null;
  created_at: string;
  effective_status: string;
  provisioning_status?: AgentProvisioningStatus;
  vps_id?: number | null;
  vps_created_at?: string | null;
  vps_online_at?: string | null;
  provisioned_at?: string | null;
  provisioning_error?: string | null;
}

interface TaskRow {
  id: string;
  title: string;
  status: TaskStatus;
  priority: string;
  type: string;
  created_at: string;
  updated_at: string;
}

// ─── Avatar helpers ───────────────────────────────────────────────────────────

function getInitials(name: string): string {
  return name
    .split(/\s+/)
    .slice(0, 2)
    .map((w) => w[0]?.toUpperCase() ?? "")
    .join("");
}

// ─── Status badge ─────────────────────────────────────────────────────────────

function resolveAgentDisplayStatus(agent: AgentData): {
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

// ─── Task status badge (monochromatic) ────────────────────────────────────────

const taskStatusBadgeColors: Record<string, string> = {
  pending:        "bg-zinc-100 text-zinc-600 dark:bg-zinc-800 dark:text-zinc-400",
  queued:         "bg-zinc-100 text-zinc-600 dark:bg-zinc-800 dark:text-zinc-400",
  sprint_ready:   "bg-zinc-100 text-zinc-600 dark:bg-zinc-800 dark:text-zinc-400",
  backlog:        "bg-zinc-100 text-zinc-600 dark:bg-zinc-800 dark:text-zinc-400",
  in_progress:    "bg-zinc-100 text-zinc-600 dark:bg-zinc-800 dark:text-zinc-400",
  in_review:      "bg-zinc-100 text-zinc-600 dark:bg-zinc-800 dark:text-zinc-400",
  rework:         "bg-zinc-100 text-zinc-600 dark:bg-zinc-800 dark:text-zinc-400",
  review_pending: "bg-zinc-100 text-zinc-600 dark:bg-zinc-800 dark:text-zinc-400",
  approved:       "bg-zinc-100 text-zinc-600 dark:bg-zinc-800 dark:text-zinc-400",
  rejected:       "bg-zinc-100 text-zinc-600 dark:bg-zinc-800 dark:text-zinc-400",
  done:           "bg-zinc-100 text-zinc-600 dark:bg-zinc-800 dark:text-zinc-400",
  completed:      "bg-zinc-100 text-zinc-600 dark:bg-zinc-800 dark:text-zinc-400",
  failed:         "bg-zinc-100 text-zinc-600 dark:bg-zinc-800 dark:text-zinc-400",
  cancelled:      "bg-zinc-100 text-zinc-600 dark:bg-zinc-800 dark:text-zinc-400",
};

// ─── Uptime helper ────────────────────────────────────────────────────────────

function formatUptime(provisionedAt: string | null): string | null {
  if (!provisionedAt) return null;
  const ms = Date.now() - new Date(provisionedAt).getTime();
  const totalMinutes = Math.floor(ms / 60000);
  const hours = Math.floor(totalMinutes / 60);
  const minutes = totalMinutes % 60;
  if (hours > 0) return `Online da ${hours}h ${minutes}m`;
  return `Online da ${minutes}m`;
}

// ─── AgentDetail.Header ───────────────────────────────────────────────────────

function AgentDetailHeader({
  agent,
  isPending,
  confirmDelete,
  deleteError,
  onDelete,
  onCancelDelete,
  onStop,
  retryPending,
  retryError,
  canRetry,
  onRetry,
}: {
  agent: AgentData;
  isPending: boolean;
  confirmDelete: boolean;
  deleteError: string | null;
  onDelete: () => void;
  onCancelDelete: () => void;
  onStop: () => void;
  retryPending: boolean;
  retryError: string | null;
  canRetry: boolean;
  onRetry: () => void;
}) {
  const initials = getInitials(agent.name);
  const statusDisplay = resolveAgentDisplayStatus(agent);
  const uptime = formatUptime(agent.provisioned_at ?? null);

  return (
    <div className="flex items-start justify-between gap-4">
      <div>
        <Link href="/agents" className="text-sm text-muted-foreground hover:text-foreground">
          ← Agents
        </Link>
        <div className="mt-2 flex items-center gap-3">
          {/* Avatar */}
          <div className="w-10 h-10 rounded-full bg-muted flex items-center justify-center text-lg shrink-0 font-semibold text-muted-foreground select-none">
            {initials}
          </div>
          <div>
            <div className="flex items-center gap-2">
              <h1 className="text-xl font-semibold text-foreground">{agent.name}</h1>
              {/* Status badge */}
              <span
                className={cn(
                  "inline-flex items-center rounded-full border px-2.5 py-0.5 text-xs font-medium",
                  statusDisplay.badgeClass
                )}
              >
                <span className={cn("w-1.5 h-1.5 rounded-full mr-1.5", statusDisplay.dotClass)} />
                {statusDisplay.label}
              </span>
            </div>
            {uptime && (
              <p className="mt-0.5 text-sm text-muted-foreground">{uptime}</p>
            )}
          </div>
        </div>
      </div>

      {/* Action buttons */}
      <div className="flex flex-col items-end gap-2">
        <div className="flex items-center gap-2">
          {canRetry && (
            <button
              onClick={onRetry}
              disabled={retryPending}
              className="inline-flex items-center gap-1.5 rounded-md border border-border px-3 py-1.5 text-sm font-medium text-muted-foreground transition-colors hover:border-zinc-400 hover:text-foreground dark:hover:border-zinc-600 disabled:cursor-not-allowed disabled:opacity-50"
            >
              <RotateCcw className="h-3.5 w-3.5" />
              {retryPending ? "Riprovando..." : "Restart"}
            </button>
          )}
          <button
            onClick={onStop}
            disabled={isPending}
            className="inline-flex items-center gap-1.5 rounded-md border border-border px-3 py-1.5 text-sm font-medium text-muted-foreground transition-colors hover:border-zinc-400 hover:text-foreground dark:hover:border-zinc-600 disabled:cursor-not-allowed disabled:opacity-50"
          >
            <Square className="h-3.5 w-3.5" />
            Stop
          </button>
          <button
            onClick={onDelete}
            disabled={isPending}
            className={cn(
              "rounded-md border px-3 py-1.5 text-sm font-medium transition-colors disabled:cursor-not-allowed disabled:opacity-50",
              confirmDelete
                ? "border-red-300 bg-red-50 text-red-700 hover:bg-red-100 dark:border-red-800 dark:bg-red-950 dark:text-red-400"
                : "border-border text-muted-foreground hover:border-red-300 hover:text-red-600"
            )}
          >
            {isPending ? "Eliminazione..." : confirmDelete ? "Conferma eliminazione" : "Elimina agente"}
          </button>
        </div>
        {confirmDelete && (
          <button
            onClick={onCancelDelete}
            className="text-xs text-muted-foreground hover:text-foreground"
          >
            Annulla
          </button>
        )}
        {deleteError && (
          <p className="text-xs text-red-600 dark:text-red-400">{deleteError}</p>
        )}
        {retryError && (
          <p className="text-xs text-red-600 dark:text-red-400">{retryError}</p>
        )}
      </div>
    </div>
  );
}

// ─── AgentDetail.VPSInfo ──────────────────────────────────────────────────────

function AgentDetailVPSInfo({ agent }: { agent: AgentData }) {
  const provStatus = (agent.provisioning_status ?? "online") as AgentProvisioningStatus;

  const rows: { key: string; value: string; mono?: boolean }[] = [];

  if (agent.vps_ip) rows.push({ key: "VPS IP", value: agent.vps_ip, mono: true });
  if (agent.vps_id) rows.push({ key: "ID Server", value: `#${agent.vps_id}`, mono: true });
  if (agent.vps_region) rows.push({ key: "Regione", value: agent.vps_region.toUpperCase() });
  if (agent.vps_created_at) {
    rows.push({
      key: "VPS creato",
      value: new Date(agent.vps_created_at).toLocaleDateString("it-IT", {
        year: "numeric",
        month: "short",
        day: "numeric",
      }),
    });
  }
  if (agent.provisioned_at) {
    const uptimeHours = Math.round(
      (Date.now() - new Date(agent.provisioned_at).getTime()) / (1000 * 60 * 60)
    );
    rows.push({ key: "Uptime", value: `${uptimeHours}h` });
    rows.push({
      key: "Attivo dal",
      value: new Date(agent.provisioned_at).toLocaleDateString("it-IT", {
        year: "numeric",
        month: "short",
        day: "numeric",
      }),
    });
  }
  if (agent.orchestrator_version) {
    rows.push({ key: "Orchestratore", value: `v${agent.orchestrator_version}`, mono: true });
  }
  if (agent.claude_code_version) {
    rows.push({ key: "Claude Code", value: agent.claude_code_version, mono: true });
  }

  const provStatusLabels: Record<AgentProvisioningStatus, string> = {
    pending: "In coda",
    provisioning: "Provisioning",
    online: "Online",
    error: "Errore",
    deprovisioning: "Eliminazione",
    deprovisioned: "Eliminato",
  };

  rows.push({ key: "Stato", value: provStatusLabels[provStatus] });
  rows.push({
    key: "Creato",
    value: new Date(agent.created_at).toLocaleDateString("it-IT", {
      year: "numeric",
      month: "long",
      day: "numeric",
    }),
  });

  return (
    <div>
      <p className="text-xs font-medium text-muted-foreground uppercase tracking-wide mb-3">
        Info VPS
      </p>
      <div className="border border-border rounded-lg overflow-hidden">
        {rows.map((row, i) => (
          <div
            key={i}
            className={cn(
              "flex justify-between px-4 py-2",
              i < rows.length - 1 && "border-b border-border"
            )}
          >
            <span className="text-sm text-muted-foreground">{row.key}</span>
            <span className={cn("text-sm font-medium text-foreground", row.mono && "font-mono")}>
              {row.value}
            </span>
          </div>
        ))}
      </div>
    </div>
  );
}

// ─── AgentDetail.Tasks ────────────────────────────────────────────────────────

function AgentDetailTasks({ tasks }: { tasks: TaskRow[] }) {
  const priorityLabels: Record<string, string> = {
    critical: "Critica",
    high: "Alta",
    medium: "Media",
    low: "Bassa",
  };

  return (
    <div>
      <p className="text-xs font-medium text-muted-foreground uppercase tracking-wide mb-3">
        Task in corso
      </p>
      {tasks.length === 0 ? (
        <p className="text-xs text-muted-foreground">Nessuna task in corso</p>
      ) : (
        <div className="border border-border rounded-lg overflow-hidden">
          {/* Header */}
          <div className="grid grid-cols-4 bg-muted/50 border-b border-border px-4 py-2">
            <span className="col-span-2 text-xs font-medium text-muted-foreground">Titolo</span>
            <span className="text-xs font-medium text-muted-foreground">Status</span>
            <span className="text-xs font-medium text-muted-foreground">Priorità</span>
          </div>
          {/* Rows */}
          {tasks.map((task, i) => (
            <Link
              key={task.id}
              href={`/tasks/${task.id}`}
              className={cn(
                "grid grid-cols-4 px-4 py-2.5 hover:bg-muted/30 transition-colors",
                i < tasks.length - 1 && "border-b border-border"
              )}
            >
              <div className="col-span-2 min-w-0 pr-4">
                <p className="text-sm font-medium text-foreground truncate">{task.title}</p>
                <p className="text-xs text-muted-foreground">
                  {new Date(task.created_at).toLocaleDateString("it-IT")}
                </p>
              </div>
              <div className="flex items-center">
                <span
                  className={cn(
                    "rounded-full px-2 py-0.5 text-xs font-medium",
                    taskStatusBadgeColors[task.status] ?? "bg-zinc-100 text-zinc-600 dark:bg-zinc-800 dark:text-zinc-400"
                  )}
                >
                  {STATUS_LABELS[task.status] ?? task.status}
                </span>
              </div>
              <div className="flex items-center">
                <span className="text-sm text-muted-foreground">
                  {priorityLabels[task.priority] ?? task.priority}
                </span>
              </div>
            </Link>
          ))}
        </div>
      )}
    </div>
  );
}

// ─── AgentDetail.Logs ─────────────────────────────────────────────────────────

function AgentDetailLogs() {
  return (
    <div>
      <p className="text-xs font-medium text-muted-foreground uppercase tracking-wide mb-3">
        Log recenti
      </p>
      <div className="bg-zinc-950 rounded-lg p-4 font-mono text-xs text-zinc-300 max-h-64 overflow-y-auto">
        <p className="text-zinc-500">Nessun log disponibile.</p>
      </div>
    </div>
  );
}

// ─── Repository list ──────────────────────────────────────────────────────────

function AgentRepositoryList({ repositories }: { repositories: Repository[] }) {
  if (repositories.length === 0) {
    return (
      <p className="text-sm text-muted-foreground">
        Nessun repository assegnato.{" "}
        <Link href="/settings" className="underline">
          Gestisci nelle impostazioni.
        </Link>
      </p>
    );
  }

  return (
    <ul className="space-y-2">
      {repositories.map((repo) => (
        <li key={repo.id} className="flex items-center justify-between gap-3">
          <div className="flex items-center gap-2 min-w-0">
            <span className="truncate font-mono text-sm text-foreground">{repo.full_name}</span>
            {repo.is_private && (
              <span className="shrink-0 rounded-full bg-zinc-100 px-1.5 text-[10px] text-zinc-500 dark:bg-zinc-800 dark:text-zinc-400">
                privata
              </span>
            )}
          </div>
          <a
            href={`https://github.com/${repo.full_name}`}
            target="_blank"
            rel="noopener noreferrer"
            className="shrink-0 text-xs text-muted-foreground underline hover:text-foreground"
          >
            GitHub →
          </a>
        </li>
      ))}
    </ul>
  );
}

// ─── Main component ───────────────────────────────────────────────────────────

interface AgentDetailClientProps {
  agent: AgentData;
  workspaceId: string;
  repositories: Repository[];
  recentTasks: TaskRow[];
}

export function AgentDetailClient({
  agent,
  workspaceId,
  repositories,
  recentTasks,
}: AgentDetailClientProps) {
  const router = useRouter();
  const [isPending, startTransition] = useTransition();
  const [deleteError, setDeleteError] = useState<string | null>(null);
  const [confirmDelete, setConfirmDelete] = useState(false);
  const [retryPending, startRetryTransition] = useTransition();
  const [retryError, setRetryError] = useState<string | null>(null);

  const provStatus = (agent.provisioning_status ?? "online") as AgentProvisioningStatus;
  const isProvisioning = provStatus !== "online" && provStatus !== "deprovisioned" && provStatus !== "error";
  const canRetry = provStatus === "pending" || provStatus === "error";

  function handleRetryProvisioning() {
    setRetryError(null);
    startRetryTransition(async () => {
      const res = await fetch(`/api/agents/${agent.id}/retry-provisioning`, { method: "POST" });
      if (res.ok) {
        router.refresh();
      } else {
        const data = (await res.json().catch(() => ({}))) as { error?: string };
        setRetryError(data.error ?? "Impossibile riprovare il provisioning");
      }
    });
  }

  function handleDelete() {
    if (!confirmDelete) {
      setConfirmDelete(true);
      return;
    }
    setDeleteError(null);
    startTransition(async () => {
      const res = await fetch(`/api/agents/${agent.id}`, { method: "DELETE" });
      if (res.ok) {
        router.push("/agents");
        router.refresh();
      } else {
        const data = (await res.json().catch(() => ({}))) as { error?: string };
        setDeleteError(data.error ?? "Impossibile eliminare l'agente");
        setConfirmDelete(false);
      }
    });
  }

  return (
    <div className="space-y-8">
      {/* Header */}
      <AgentDetailHeader
        agent={agent}
        isPending={isPending}
        confirmDelete={confirmDelete}
        deleteError={deleteError}
        onDelete={handleDelete}
        onCancelDelete={() => setConfirmDelete(false)}
        onStop={() => { /* no-op: stop not implemented */ }}
        retryPending={retryPending}
        retryError={retryError}
        canRetry={canRetry}
        onRetry={handleRetryProvisioning}
      />

      {/* Provisioning timeline — shown when provisioning */}
      {(isProvisioning || provStatus === "error") && (
        <section className="rounded-xl border border-border p-6">
          <div className="flex items-center justify-between mb-4">
            <h2 className="text-base font-semibold">Provisioning</h2>
          </div>
          <ProvisioningTimeline
            agentId={agent.id}
            workspaceId={workspaceId}
            initial={{
              provisioning_status: provStatus,
              vps_created_at: agent.vps_created_at ?? null,
              vps_online_at: agent.vps_online_at ?? null,
              provisioned_at: agent.provisioned_at ?? null,
              provisioning_error: agent.provisioning_error ?? null,
            }}
          />
        </section>
      )}

      {/* Two-column layout: VPS info + repositories */}
      <div className="grid gap-6 lg:grid-cols-2">
        {/* Section 1: VPS Info */}
        <AgentDetailVPSInfo agent={agent} />

        {/* Repositories */}
        <div>
          <p className="text-xs font-medium text-muted-foreground uppercase tracking-wide mb-3">
            Repository assegnate
          </p>
          <AgentRepositoryList repositories={repositories} />
        </div>
      </div>

      {/* Section 2: Task in corso */}
      {!isProvisioning && provStatus !== "error" && (
        <AgentDetailTasks tasks={recentTasks} />
      )}

      {/* Section 3: Log recenti */}
      {!isProvisioning && provStatus !== "error" && (
        <AgentDetailLogs />
      )}
    </div>
  );
}
