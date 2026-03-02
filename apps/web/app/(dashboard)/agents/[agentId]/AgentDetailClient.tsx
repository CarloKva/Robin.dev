"use client";

import Link from "next/link";
import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { ProvisioningTimeline } from "@/components/agents/ProvisioningTimeline";
import { cn } from "@/lib/utils";
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

// ─── Status badge ─────────────────────────────────────────────────────────────

const taskStatusColors: Record<string, string> = {
  completed: "bg-emerald-100 text-emerald-700 dark:bg-emerald-950 dark:text-emerald-400",
  in_progress: "bg-blue-100 text-blue-700 dark:bg-blue-950 dark:text-blue-400",
  review_pending: "bg-amber-100 text-amber-700 dark:bg-amber-950 dark:text-amber-400",
  failed: "bg-red-100 text-red-700 dark:bg-red-950 dark:text-red-400",
  cancelled: "bg-zinc-100 text-zinc-600 dark:bg-zinc-800 dark:text-zinc-400",
};

// ─── Agent info panel ─────────────────────────────────────────────────────────

const provStatusBadge: Record<AgentProvisioningStatus, string> = {
  pending: "bg-zinc-100 text-zinc-600 dark:bg-zinc-800 dark:text-zinc-400",
  provisioning: "bg-blue-100 text-blue-700 dark:bg-blue-950 dark:text-blue-400",
  online: "bg-emerald-100 text-emerald-700 dark:bg-emerald-950 dark:text-emerald-400",
  error: "bg-red-100 text-red-700 dark:bg-red-950 dark:text-red-400",
  deprovisioning: "bg-amber-100 text-amber-700 dark:bg-amber-950 dark:text-amber-400",
  deprovisioned: "bg-zinc-100 text-zinc-500 dark:bg-zinc-900 dark:text-zinc-600",
};

const provStatusLabel: Record<AgentProvisioningStatus, string> = {
  pending: "In coda",
  provisioning: "Provisioning",
  online: "Online",
  error: "Errore",
  deprovisioning: "Eliminazione",
  deprovisioned: "Eliminato",
};

function AgentInfoPanel({ agent }: { agent: AgentData }) {
  const createdAt = new Date(agent.created_at).toLocaleDateString("it-IT", {
    year: "numeric",
    month: "long",
    day: "numeric",
  });

  const uptimeHours = agent.provisioned_at
    ? Math.round(
        (Date.now() - new Date(agent.provisioned_at).getTime()) / (1000 * 60 * 60)
      )
    : null;

  const provisionedAtLabel = agent.provisioned_at
    ? new Date(agent.provisioned_at).toLocaleDateString("it-IT", {
        year: "numeric",
        month: "short",
        day: "numeric",
      })
    : null;

  const vpsCreatedAtLabel = agent.vps_created_at
    ? new Date(agent.vps_created_at).toLocaleDateString("it-IT", {
        year: "numeric",
        month: "short",
        day: "numeric",
      })
    : null;

  const provStatus = agent.provisioning_status;

  return (
    <dl className="grid grid-cols-2 gap-x-6 gap-y-3 text-sm">
      {agent.vps_ip && (
        <>
          <dt className="text-muted-foreground">VPS IP</dt>
          <dd className="font-mono text-foreground">{agent.vps_ip}</dd>
        </>
      )}
      {agent.vps_id && (
        <>
          <dt className="text-muted-foreground">ID Server</dt>
          <dd className="font-mono text-foreground">#{agent.vps_id}</dd>
        </>
      )}
      {agent.vps_region && (
        <>
          <dt className="text-muted-foreground">Regione</dt>
          <dd className="text-foreground">{agent.vps_region.toUpperCase()}</dd>
        </>
      )}
      {vpsCreatedAtLabel && (
        <>
          <dt className="text-muted-foreground">VPS creato</dt>
          <dd className="text-foreground">{vpsCreatedAtLabel}</dd>
        </>
      )}
      {uptimeHours !== null && (
        <>
          <dt className="text-muted-foreground">Uptime</dt>
          <dd className="text-foreground">{uptimeHours}h</dd>
        </>
      )}
      {provisionedAtLabel && (
        <>
          <dt className="text-muted-foreground">Attivo dal</dt>
          <dd className="text-foreground">{provisionedAtLabel}</dd>
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
      {provStatus && (
        <>
          <dt className="text-muted-foreground">Stato</dt>
          <dd>
            <span
              className={cn(
                "inline-flex items-center rounded-full px-2 py-0.5 text-xs font-medium",
                provStatusBadge[provStatus]
              )}
            >
              {provStatusLabel[provStatus]}
            </span>
          </dd>
        </>
      )}
      <dt className="text-muted-foreground">Creato</dt>
      <dd className="text-foreground">{createdAt}</dd>
    </dl>
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

// ─── Task history ─────────────────────────────────────────────────────────────

function AgentTaskHistory({ tasks }: { tasks: TaskRow[] }) {
  if (tasks.length === 0) {
    return <p className="text-sm text-muted-foreground">Nessun task eseguito.</p>;
  }

  return (
    <ul className="divide-y divide-border">
      {tasks.map((task) => (
        <li key={task.id}>
          <Link
            href={`/tasks/${task.id}`}
            className="flex items-center justify-between gap-3 py-3 hover:bg-muted/30 px-1 rounded-md transition-colors"
          >
            <div className="min-w-0">
              <p className="truncate text-sm font-medium text-foreground">{task.title}</p>
              <p className="mt-0.5 text-xs text-muted-foreground">
                {new Date(task.updated_at).toLocaleDateString("it-IT")}
              </p>
            </div>
            <span
              className={cn(
                "shrink-0 rounded-full px-2 py-0.5 text-xs font-medium",
                taskStatusColors[task.status] ?? "bg-zinc-100 text-zinc-600"
              )}
            >
              {task.status}
            </span>
          </Link>
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
      <div className="flex items-start justify-between gap-4">
        <div>
          <div className="flex items-center gap-3">
            <Link
              href="/agents"
              className="text-sm text-muted-foreground hover:text-foreground"
            >
              ← Agents
            </Link>
          </div>
          <h1 className="mt-2 text-2xl font-bold tracking-tight text-foreground">
            {agent.name}
          </h1>
          {agent.slug && (
            <p className="mt-0.5 font-mono text-sm text-muted-foreground">{agent.slug}</p>
          )}
        </div>

        {/* Delete button */}
        <div className="flex flex-col items-end gap-1">
          <button
            onClick={handleDelete}
            disabled={isPending || isProvisioning}
            className={cn(
              "min-h-[36px] rounded-md border px-3.5 py-2 text-sm font-medium transition-colors",
              confirmDelete
                ? "border-red-300 bg-red-50 text-red-700 hover:bg-red-100 dark:border-red-800 dark:bg-red-950 dark:text-red-400"
                : "border-border text-muted-foreground hover:border-red-300 hover:text-red-600",
              "disabled:cursor-not-allowed disabled:opacity-50"
            )}
          >
            {isPending ? "Eliminazione..." : confirmDelete ? "Conferma eliminazione" : "Elimina agente"}
          </button>
          {confirmDelete && (
            <button
              onClick={() => setConfirmDelete(false)}
              className="text-xs text-muted-foreground hover:text-foreground"
            >
              Annulla
            </button>
          )}
          {deleteError && (
            <p className="text-xs text-red-600 dark:text-red-400">{deleteError}</p>
          )}
        </div>
      </div>

      {/* Two-column layout */}
      <div className="grid gap-6 lg:grid-cols-2">
        {/* Left: provisioning timeline or info */}
        <section className="space-y-4 rounded-xl border border-border p-6">
          {isProvisioning || provStatus === "error" ? (
            <>
              <div className="flex items-center justify-between">
                <h2 className="text-base font-semibold">Provisioning</h2>
                {canRetry && (
                  <button
                    onClick={handleRetryProvisioning}
                    disabled={retryPending}
                    className="rounded-md border border-border px-3 py-1.5 text-xs font-medium text-muted-foreground transition-colors hover:border-primary hover:text-primary disabled:cursor-not-allowed disabled:opacity-50"
                  >
                    {retryPending ? "Riprovando..." : "Riprova provisioning"}
                  </button>
                )}
              </div>
              {retryError && (
                <p className="text-xs text-red-600 dark:text-red-400">{retryError}</p>
              )}
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
            </>
          ) : (
            <>
              <h2 className="text-base font-semibold">Info agente</h2>
              <AgentInfoPanel agent={agent} />
            </>
          )}
        </section>

        {/* Right: repositories */}
        <section className="space-y-4 rounded-xl border border-border p-6">
          <h2 className="text-base font-semibold">Repository assegnate</h2>
          <AgentRepositoryList repositories={repositories} />
        </section>
      </div>

      {/* Task history — hidden during provisioning */}
      {!isProvisioning && provStatus !== "error" && (
        <section className="rounded-xl border border-border p-6">
          <h2 className="mb-4 text-base font-semibold">Ultimi task</h2>
          <AgentTaskHistory tasks={recentTasks} />
        </section>
      )}
    </div>
  );
}
