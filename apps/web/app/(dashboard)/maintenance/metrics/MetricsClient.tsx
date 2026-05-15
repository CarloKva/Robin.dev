"use client";

import { AlertTriangle, BarChart2 } from "lucide-react";
import Link from "next/link";
import { cn } from "@/lib/utils";
import { formatTokens } from "@/lib/format";
import type {
  CapabilityHealthReview,
  MaintenanceMetricsRow,
} from "@/lib/db/maintenance";
import type { MaintenanceCapabilityId } from "@robin/shared-types";

type EnrichedMetrics = MaintenanceMetricsRow & { repository_full_name: string };

type Props = {
  metrics: EnrichedMetrics[];
  healthReviews: CapabilityHealthReview[];
};

const CAPABILITY_LABEL: Record<MaintenanceCapabilityId, string> = {
  spec_discovery: "Spec Coverage",
  spec_impl: "Spec Implementation",
  bug_discovery: "Bug Discovery",
  bug_impl: "Bug Fix Implementation",
};

const FP_THRESHOLD = 0.3;
const PR_MERGE_THRESHOLD = 0.5;
const COST_THRESHOLD = 20.0;

export function MetricsClient(props: Props) {
  const byCapability = aggregateByCapability(props.metrics);

  return (
    <div className="max-w-6xl mx-auto p-6 space-y-6">
      <header className="space-y-1 flex items-start justify-between gap-4">
        <div className="space-y-1">
          <h1 className="text-2xl font-semibold flex items-center gap-2">
            <BarChart2 className="h-6 w-6" />
            Metriche maintenance
          </h1>
          <p className="text-sm text-muted-foreground">
            False-positive rate, PR merge rate, costo per merged PR e dettagli per
            capability/repository. Le soglie del kill switch sono FP &gt; 30%,
            merge &lt; 50%, cost/PR &gt; $20.
          </p>
        </div>
        <Link
          href="/maintenance"
          className="shrink-0 text-xs underline text-muted-foreground hover:text-foreground"
        >
          ← Overview
        </Link>
      </header>

      <section className="space-y-3">
        <h2 className="text-sm font-semibold uppercase text-muted-foreground">
          Per capability (totale workspace)
        </h2>
        {byCapability.length === 0 ? (
          <EmptyState />
        ) : (
          <div className="grid gap-3 md:grid-cols-2">
            {byCapability.map((cap) => (
              <CapabilityTile key={cap.capability_definition_id} cap={cap} />
            ))}
          </div>
        )}
      </section>

      <section className="space-y-3">
        <h2 className="text-sm font-semibold uppercase text-muted-foreground">
          Per repository × capability
        </h2>
        {props.metrics.length === 0 ? (
          <EmptyState />
        ) : (
          <div className="rounded-lg border border-border overflow-hidden">
            <table className="w-full text-sm">
              <thead className="bg-muted text-xs uppercase text-muted-foreground">
                <tr>
                  <th className="text-left px-3 py-2 font-medium">Repository</th>
                  <th className="text-left px-3 py-2 font-medium">Capability</th>
                  <th className="text-right px-3 py-2 font-medium">Findings</th>
                  <th className="text-right px-3 py-2 font-medium">FP %</th>
                  <th className="text-right px-3 py-2 font-medium">Implementati</th>
                  <th className="text-right px-3 py-2 font-medium">Tokens</th>
                  <th className="text-right px-3 py-2 font-medium">Cost USD</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-border">
                {props.metrics.map((row) => (
                  <tr key={`${row.repository_id}-${row.capability_definition_id}`}>
                    <td className="px-3 py-2 font-mono text-xs">
                      {row.repository_full_name}
                    </td>
                    <td className="px-3 py-2 text-xs">
                      {CAPABILITY_LABEL[row.capability_definition_id]}
                    </td>
                    <td className="px-3 py-2 text-right font-mono text-xs">
                      {row.total_findings}
                    </td>
                    <td
                      className={cn(
                        "px-3 py-2 text-right font-mono text-xs",
                        row.false_positive_rate !== null &&
                          row.false_positive_rate > FP_THRESHOLD
                          ? "text-red-600 font-semibold"
                          : ""
                      )}
                    >
                      {row.false_positive_rate === null
                        ? "—"
                        : `${(row.false_positive_rate * 100).toFixed(0)}%`}
                    </td>
                    <td className="px-3 py-2 text-right font-mono text-xs">
                      {row.implemented_findings}
                    </td>
                    <td className="px-3 py-2 text-right font-mono text-xs">
                      {row.tokens_used > 0 ? formatTokens(row.tokens_used) : "—"}
                    </td>
                    <td className="px-3 py-2 text-right font-mono text-xs">
                      {row.cost_usd > 0 ? `$${row.cost_usd.toFixed(2)}` : "—"}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </section>

      <section className="space-y-3">
        <h2 className="text-sm font-semibold uppercase text-muted-foreground">
          Health reviews settimanali (kill switch)
        </h2>
        {props.healthReviews.length === 0 ? (
          <p className="text-xs text-muted-foreground italic">
            Nessuna review disponibile ancora — la prima si genera entro un&apos;ora
            dall&apos;attivazione del kill switch sull&apos;orchestratore.
          </p>
        ) : (
          <div className="rounded-lg border border-border overflow-hidden">
            <table className="w-full text-sm">
              <thead className="bg-muted text-xs uppercase text-muted-foreground">
                <tr>
                  <th className="text-left px-3 py-2 font-medium">Settimana</th>
                  <th className="text-left px-3 py-2 font-medium">Capability</th>
                  <th className="text-right px-3 py-2 font-medium">Findings</th>
                  <th className="text-right px-3 py-2 font-medium">FP %</th>
                  <th className="text-right px-3 py-2 font-medium">PR merged</th>
                  <th className="text-right px-3 py-2 font-medium">PR merge %</th>
                  <th className="text-right px-3 py-2 font-medium">$ / PR</th>
                  <th className="px-3 py-2 font-medium">Breach</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-border">
                {props.healthReviews.map((r) => (
                  <tr key={`${r.capability_definition_id}-${r.week_starting}`}>
                    <td className="px-3 py-2 text-xs font-mono">{r.week_starting}</td>
                    <td className="px-3 py-2 text-xs">
                      {CAPABILITY_LABEL[r.capability_definition_id]}
                    </td>
                    <td className="px-3 py-2 text-right font-mono text-xs">
                      {r.total_findings}
                    </td>
                    <td
                      className={cn(
                        "px-3 py-2 text-right font-mono text-xs",
                        r.false_positive_rate !== null &&
                          r.false_positive_rate > FP_THRESHOLD
                          ? "text-red-600 font-semibold"
                          : ""
                      )}
                    >
                      {r.false_positive_rate === null
                        ? "—"
                        : `${(r.false_positive_rate * 100).toFixed(0)}%`}
                    </td>
                    <td className="px-3 py-2 text-right font-mono text-xs">
                      {r.prs_merged} / {r.prs_opened}
                    </td>
                    <td
                      className={cn(
                        "px-3 py-2 text-right font-mono text-xs",
                        r.pr_merge_rate !== null &&
                          r.pr_merge_rate < PR_MERGE_THRESHOLD
                          ? "text-red-600 font-semibold"
                          : ""
                      )}
                    >
                      {r.pr_merge_rate === null
                        ? "—"
                        : `${(r.pr_merge_rate * 100).toFixed(0)}%`}
                    </td>
                    <td
                      className={cn(
                        "px-3 py-2 text-right font-mono text-xs",
                        r.cost_per_merged_pr_usd !== null &&
                          r.cost_per_merged_pr_usd > COST_THRESHOLD
                          ? "text-red-600 font-semibold"
                          : ""
                      )}
                    >
                      {r.cost_per_merged_pr_usd === null
                        ? "—"
                        : `$${r.cost_per_merged_pr_usd.toFixed(2)}`}
                    </td>
                    <td className="px-3 py-2">
                      {r.any_breach && (
                        <span className="inline-flex items-center gap-1 text-red-600 text-xs">
                          <AlertTriangle className="h-3.5 w-3.5" />
                          breach
                        </span>
                      )}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </section>
    </div>
  );
}

function CapabilityTile({ cap }: { cap: AggregatedCapability }) {
  return (
    <div className="rounded-lg border border-border bg-card p-4 space-y-2">
      <h3 className="font-semibold text-sm">
        {CAPABILITY_LABEL[cap.capability_definition_id] ?? cap.capability_definition_id}
      </h3>
      <dl className="grid grid-cols-2 gap-x-4 gap-y-1 text-xs">
        <dt className="text-muted-foreground">Findings</dt>
        <dd className="font-mono">{cap.total_findings}</dd>
        <dt className="text-muted-foreground">FP rate</dt>
        <dd
          className={cn(
            "font-mono",
            cap.false_positive_rate !== null && cap.false_positive_rate > FP_THRESHOLD
              ? "text-red-600 font-semibold"
              : ""
          )}
        >
          {cap.false_positive_rate === null
            ? "—"
            : `${(cap.false_positive_rate * 100).toFixed(0)}%`}
        </dd>
        <dt className="text-muted-foreground">Implementati</dt>
        <dd className="font-mono">{cap.implemented_findings}</dd>
        <dt className="text-muted-foreground">Tokens</dt>
        <dd className="font-mono">
          {cap.tokens_used > 0 ? formatTokens(cap.tokens_used) : "—"}
        </dd>
        <dt className="text-muted-foreground">Cost USD</dt>
        <dd className="font-mono">
          {cap.cost_usd > 0 ? `$${cap.cost_usd.toFixed(2)}` : "—"}
        </dd>
      </dl>
    </div>
  );
}

function EmptyState() {
  return (
    <div className="rounded-lg border border-dashed border-border p-8 text-center text-sm text-muted-foreground">
      Nessuna metrica disponibile ancora.
    </div>
  );
}

type AggregatedCapability = {
  capability_definition_id: MaintenanceCapabilityId;
  total_findings: number;
  rejected_findings: number;
  implemented_findings: number;
  tokens_used: number;
  cost_usd: number;
  false_positive_rate: number | null;
};

function aggregateByCapability(rows: EnrichedMetrics[]): AggregatedCapability[] {
  const map = new Map<MaintenanceCapabilityId, AggregatedCapability>();
  for (const row of rows) {
    const id = row.capability_definition_id;
    const existing = map.get(id) ?? {
      capability_definition_id: id,
      total_findings: 0,
      rejected_findings: 0,
      implemented_findings: 0,
      tokens_used: 0,
      cost_usd: 0,
      false_positive_rate: null,
    };
    existing.total_findings += row.total_findings;
    existing.rejected_findings += row.rejected_findings;
    existing.implemented_findings += row.implemented_findings;
    existing.tokens_used += row.tokens_used;
    existing.cost_usd += Number(row.cost_usd);
    map.set(id, existing);
  }
  for (const cap of map.values()) {
    cap.false_positive_rate =
      cap.total_findings > 0 ? cap.rejected_findings / cap.total_findings : null;
  }
  return Array.from(map.values());
}
