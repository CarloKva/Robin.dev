"use client";

import { useRouter } from "next/navigation";
import { History } from "lucide-react";
import { cn } from "@/lib/utils";
import { formatRelativeIt, formatTokens } from "@/lib/format";
import type { AgentRunWithRelations } from "@/lib/db/maintenance";
import type { MaintenanceCapabilityId, AgentRunStatus } from "@robin/shared-types";

type Repo = { id: string; full_name: string };

type Props = {
  repositories: Repo[];
  selectedRepositoryId: string | null;
  selectedCapability: MaintenanceCapabilityId | null;
  runs: AgentRunWithRelations[];
};

const CAPABILITIES: Array<{ value: MaintenanceCapabilityId; label: string }> = [
  { value: "spec_discovery", label: "Spec Coverage" },
  { value: "spec_impl", label: "Spec Implementation" },
  { value: "bug_discovery", label: "Bug Discovery" },
  { value: "bug_impl", label: "Bug Fix Implementation" },
];

const STATUS_COLOR: Record<AgentRunStatus, string> = {
  queued: "bg-zinc-100 text-zinc-700 border-zinc-300",
  running: "bg-blue-50 text-blue-700 border-blue-200",
  completed: "bg-emerald-50 text-emerald-700 border-emerald-200",
  failed: "bg-red-50 text-red-700 border-red-200",
  cancelled: "bg-zinc-100 text-zinc-700 border-zinc-300",
  budget_exceeded: "bg-amber-50 text-amber-700 border-amber-200",
  no_agent: "bg-amber-50 text-amber-700 border-amber-200",
  validation_failed: "bg-orange-50 text-orange-700 border-orange-200",
  skipped: "bg-zinc-100 text-zinc-500 border-zinc-300",
};

export function RunsClient(props: Props) {
  const router = useRouter();

  function setParam(key: string, value: string | null) {
    const url = new URL(window.location.href);
    if (value) url.searchParams.set(key, value);
    else url.searchParams.delete(key);
    router.push(`/maintenance/runs?${url.searchParams.toString()}`);
  }

  return (
    <div className="max-w-6xl mx-auto p-6 space-y-6">
      <header className="space-y-1">
        <h1 className="text-2xl font-semibold flex items-center gap-2">
          <History className="h-6 w-6" />
          Run history
        </h1>
        <p className="text-sm text-muted-foreground">
          Storico delle maintenance run ordinato dal più recente.
        </p>
      </header>

      <div className="flex flex-wrap items-center gap-3 text-sm">
        <div className="flex items-center gap-2">
          <label htmlFor="runs-repo" className="text-muted-foreground">Repository</label>
          <select
            id="runs-repo"
            className="h-9 rounded-md border border-input bg-background px-3 text-sm"
            value={props.selectedRepositoryId ?? ""}
            onChange={(e) => setParam("repository_id", e.target.value || null)}
          >
            <option value="">Tutti</option>
            {props.repositories.map((r) => (
              <option key={r.id} value={r.id}>{r.full_name}</option>
            ))}
          </select>
        </div>

        <div className="flex items-center gap-2">
          <label htmlFor="runs-capability" className="text-muted-foreground">Capability</label>
          <select
            id="runs-capability"
            className="h-9 rounded-md border border-input bg-background px-3 text-sm"
            value={props.selectedCapability ?? ""}
            onChange={(e) => setParam("capability_definition_id", e.target.value || null)}
          >
            <option value="">Tutte</option>
            {CAPABILITIES.map((c) => (
              <option key={c.value} value={c.value}>{c.label}</option>
            ))}
          </select>
        </div>

        <span className="ml-auto text-xs text-muted-foreground">
          {props.runs.length} run{props.runs.length === 1 ? "" : "s"}
        </span>
      </div>

      {props.runs.length === 0 ? (
        <div className="rounded-lg border border-dashed border-border p-10 text-center text-sm text-muted-foreground">
          Nessuna run trovata.
        </div>
      ) : (
        <div className="rounded-lg border border-border overflow-hidden">
          <table className="w-full text-sm">
            <thead className="bg-muted text-xs uppercase text-muted-foreground">
              <tr>
                <th className="text-left px-3 py-2 font-medium">When</th>
                <th className="text-left px-3 py-2 font-medium">Repository</th>
                <th className="text-left px-3 py-2 font-medium">Capability</th>
                <th className="text-left px-3 py-2 font-medium">Trigger</th>
                <th className="text-left px-3 py-2 font-medium">Status</th>
                <th className="text-left px-3 py-2 font-medium">Runner</th>
                <th className="text-right px-3 py-2 font-medium">Tokens</th>
                <th className="text-right px-3 py-2 font-medium">Findings</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-border">
              {props.runs.map((run) => (
                <tr key={run.id} className="hover:bg-muted/50">
                  <td className="px-3 py-2 text-xs text-muted-foreground" title={run.created_at}>
                    {formatRelativeIt(run.created_at)}
                  </td>
                  <td className="px-3 py-2 font-mono text-xs">
                    {run.repository?.full_name ?? "—"}
                  </td>
                  <td className="px-3 py-2">
                    {run.capability_definition?.display_name ?? run.capability_definition_id}
                  </td>
                  <td className="px-3 py-2 text-xs text-muted-foreground">{run.trigger}</td>
                  <td className="px-3 py-2">
                    <StatusPill status={run.status} />
                    {run.error_message && (
                      <p
                        className="text-xs text-red-600 mt-0.5 line-clamp-1 max-w-xs"
                        title={run.error_message}
                      >
                        {run.error_message}
                      </p>
                    )}
                  </td>
                  <td className="px-3 py-2 text-xs">
                    {run.runner_agent?.name ?? "—"}
                  </td>
                  <td className="px-3 py-2 text-right font-mono text-xs">
                    {run.tokens_used > 0 ? formatTokens(run.tokens_used) : "—"}
                  </td>
                  <td className="px-3 py-2 text-right font-mono text-xs">
                    {run.findings_created > 0 ? run.findings_created : "—"}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}

function StatusPill({ status }: { status: AgentRunStatus }) {
  return (
    <span
      className={cn(
        "rounded-full px-2 py-0.5 text-xs font-medium border",
        STATUS_COLOR[status]
      )}
    >
      {status}
    </span>
  );
}

