"use client";

import { useRouter, usePathname, useSearchParams } from "next/navigation";
import type { WorkspaceMetrics, MetricsPeriod } from "@/lib/db/metrics";
import { cn } from "@/lib/utils";

interface MetricsClientProps {
  metrics: WorkspaceMetrics;
  currentPeriod: MetricsPeriod;
}

const PERIODS: { value: MetricsPeriod; label: string }[] = [
  { value: "7d", label: "7 giorni" },
  { value: "30d", label: "30 giorni" },
  { value: "90d", label: "90 giorni" },
];

export function MetricsClient({ metrics, currentPeriod }: MetricsClientProps) {
  const router = useRouter();
  const pathname = usePathname();
  const searchParams = useSearchParams();

  function changePeriod(p: MetricsPeriod) {
    const params = new URLSearchParams(searchParams.toString());
    params.set("period", p);
    router.push(`${pathname}?${params.toString()}`);
  }

  const cycleTimeTrend =
    metrics.avgCycleTimeMinutes !== null && metrics.prevAvgCycleTimeMinutes !== null
      ? metrics.avgCycleTimeMinutes - metrics.prevAvgCycleTimeMinutes
      : null;

  return (
    <div className="space-y-6">
      {/* Period selector */}
      <div className="flex gap-1 rounded-lg border border-border bg-muted/40 p-1 w-fit">
        {PERIODS.map(({ value, label }) => (
          <button
            key={value}
            type="button"
            onClick={() => changePeriod(value)}
            className={cn(
              "rounded-md px-4 py-1.5 text-sm font-medium transition-colors",
              currentPeriod === value
                ? "bg-background text-foreground shadow-sm"
                : "text-muted-foreground hover:text-foreground"
            )}
          >
            {label}
          </button>
        ))}
      </div>

      {/* Primary metrics grid */}
      <div className="grid grid-cols-2 gap-4 sm:grid-cols-3 lg:grid-cols-5">
        <MetricCard
          label="Task completate"
          value={String(metrics.completedCount)}
          trend={undefined}
          tooltip="Numero totale di task completate con successo nel periodo."
          isPositive={undefined}
        />
        <MetricCard
          label="Cycle time medio"
          value={
            metrics.avgCycleTimeMinutes !== null
              ? formatMinutes(metrics.avgCycleTimeMinutes)
              : "—"
          }
          trend={cycleTimeTrend !== null ? { delta: -cycleTimeTrend, unit: "min" } : undefined}
          tooltip="Tempo medio dal momento di creazione della task al suo completamento. Esclude i valori anomali (> 3 deviazioni standard)."
          isPositive={undefined}
        />
        <MetricCard
          label="PR approval rate"
          value={
            metrics.prApprovalRate !== null ? `${metrics.prApprovalRate}%` : "—"
          }
          trend={undefined}
          tooltip="Percentuale di PR approvate al primo tentativo, senza commit fix(review): successivi."
          isPositive={
            metrics.prApprovalRate !== null ? metrics.prApprovalRate >= 70 : undefined
          }
        />
        <MetricCard
          label="Accuracy rate"
          value={
            metrics.accuracyRate !== null ? `${metrics.accuracyRate}%` : "—"
          }
          trend={undefined}
          tooltip="Percentuale di task con PR completate senza commit post-approvazione (nessun rework dopo human.approved)."
          isPositive={
            metrics.accuracyRate !== null ? metrics.accuracyRate >= 80 : undefined
          }
        />
        <MetricCard
          label="Escalation rate"
          value={
            metrics.escalationRate !== null ? `${metrics.escalationRate}%` : "—"
          }
          trend={undefined}
          tooltip="Percentuale di task completate che sono state bloccate almeno una volta e hanno richiesto intervento umano."
          isPositive={
            metrics.escalationRate !== null ? metrics.escalationRate <= 20 : undefined
          }
        />
      </div>

      {/* Secondary metrics */}
      <div className="grid grid-cols-2 gap-4 sm:grid-cols-3">
        <MetricCard
          label="Task fallite"
          value={String(metrics.failedCount)}
          trend={undefined}
          tooltip="Task che si sono concluse in stato failed nel periodo."
          isPositive={metrics.failedCount === 0 ? true : metrics.failedCount > 3 ? false : undefined}
        />

        {Object.keys(metrics.completedByType).length > 0 && (
          <div className="col-span-2 rounded-xl border border-border bg-card p-4">
            <div className="mb-3 flex items-center gap-2">
              <h3 className="text-sm font-semibold text-foreground">Per tipo</h3>
            </div>
            <div className="flex flex-wrap gap-2">
              {Object.entries(metrics.completedByType)
                .sort(([, a], [, b]) => b - a)
                .map(([type, count]) => (
                  <span
                    key={type}
                    className="inline-flex items-center gap-1.5 rounded-full border border-border bg-muted px-3 py-1 text-xs font-medium"
                  >
                    <TypeEmoji type={type} />
                    {type}
                    <span className="ml-0.5 font-semibold text-foreground">{count}</span>
                  </span>
                ))}
            </div>
          </div>
        )}
      </div>

      {/* Completed tasks table */}
      {metrics.completedTasks.length > 0 && (
        <section>
          <h2 className="mb-3 text-sm font-semibold text-foreground">
            Task completate ({metrics.completedTasks.length})
          </h2>
          <div className="overflow-hidden rounded-xl border border-border">
            <table className="w-full text-sm">
              <thead className="bg-muted/40">
                <tr>
                  <th className="px-4 py-2.5 text-left text-xs font-medium text-muted-foreground">
                    Titolo
                  </th>
                  <th className="px-4 py-2.5 text-left text-xs font-medium text-muted-foreground">
                    Tipo
                  </th>
                  <th className="px-4 py-2.5 text-right text-xs font-medium text-muted-foreground">
                    Cycle time
                  </th>
                  <th className="px-4 py-2.5 text-right text-xs font-medium text-muted-foreground">
                    Completata il
                  </th>
                </tr>
              </thead>
              <tbody className="divide-y divide-border bg-card">
                {metrics.completedTasks.map((t) => (
                  <tr key={t.id} className="hover:bg-muted/30 transition-colors">
                    <td className="max-w-xs truncate px-4 py-2.5 font-medium text-foreground">
                      <a
                        href={`/tasks/${t.id}`}
                        className="hover:text-primary hover:underline transition-colors"
                      >
                        {t.title}
                      </a>
                    </td>
                    <td className="px-4 py-2.5 text-muted-foreground">
                      <span className="inline-flex items-center gap-1">
                        <TypeEmoji type={t.type} />
                        {t.type}
                      </span>
                    </td>
                    <td className="px-4 py-2.5 text-right text-muted-foreground">
                      {formatMinutes(t.cycleTimeMinutes)}
                    </td>
                    <td className="px-4 py-2.5 text-right text-muted-foreground">
                      {new Date(t.completedAt).toLocaleDateString("it-IT")}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </section>
      )}

      {/* Blocked tasks */}
      {metrics.blockedTasks.length > 0 && (
        <section>
          <h2 className="mb-3 text-sm font-semibold text-foreground">
            Task bloccate nel periodo ({metrics.blockedTasks.length})
          </h2>
          <div className="space-y-2">
            {metrics.blockedTasks.map((t) => (
              <div
                key={t.id}
                className="rounded-lg border border-amber-200 bg-amber-50 px-4 py-3 dark:border-amber-800 dark:bg-amber-950/30"
              >
                <div className="flex items-start gap-3">
                  <div className="min-w-0 flex-1">
                    <a
                      href={`/tasks/${t.id}`}
                      className="text-sm font-medium text-foreground hover:underline"
                    >
                      {t.title}
                    </a>
                    <p className="mt-0.5 text-xs text-amber-700 dark:text-amber-400">
                      {t.blockedReason}
                    </p>
                  </div>
                  <span className="shrink-0 rounded-full bg-amber-100 px-2 py-0.5 text-xs font-medium text-amber-700 dark:bg-amber-900/30 dark:text-amber-400">
                    {t.type}
                  </span>
                </div>
              </div>
            ))}
          </div>
        </section>
      )}

      {/* Empty state */}
      {metrics.completedCount === 0 && metrics.failedCount === 0 && (
        <div className="flex flex-col items-center justify-center gap-3 rounded-xl border border-dashed border-border py-16 text-center">
          <p className="text-sm font-medium text-foreground">Nessun dato disponibile</p>
          <p className="text-xs text-muted-foreground">
            Le metriche appariranno quando l&apos;agente completerà le prime task.
          </p>
        </div>
      )}
    </div>
  );
}

// ── MetricCard ───────────────────────────────────────────────────────────────

interface MetricCardProps {
  label: string;
  value: string;
  trend: { delta: number; unit: string } | undefined;
  tooltip: string;
  isPositive: boolean | undefined;
}

function MetricCard({ label, value, trend, tooltip, isPositive }: MetricCardProps) {
  return (
    <div
      className="group relative rounded-xl border border-border bg-card p-4"
      title={tooltip}
    >
      <p className="text-xs font-medium text-muted-foreground">{label}</p>
      <p
        className={cn(
          "mt-1 text-2xl font-bold tabular-nums",
          isPositive === true
            ? "text-emerald-600 dark:text-emerald-400"
            : isPositive === false
            ? "text-red-600 dark:text-red-400"
            : "text-foreground"
        )}
      >
        {value}
      </p>
      {trend && (
        <p
          className={cn(
            "mt-1 text-xs font-medium",
            trend.delta > 0
              ? "text-emerald-600"
              : trend.delta < 0
              ? "text-red-500"
              : "text-muted-foreground"
          )}
        >
          {trend.delta > 0 ? "↑" : trend.delta < 0 ? "↓" : "→"}{" "}
          {trend.delta > 0 ? "+" : ""}
          {Math.abs(trend.delta)}
          {trend.unit} vs periodo prec.
        </p>
      )}
      {/* Tooltip arrow shown on hover via title attribute */}
    </div>
  );
}

// ── Helpers ──────────────────────────────────────────────────────────────────

function formatMinutes(mins: number): string {
  if (mins < 60) return `${mins}m`;
  const h = Math.floor(mins / 60);
  const m = mins % 60;
  return m > 0 ? `${h}h ${m}m` : `${h}h`;
}

function TypeEmoji({ type }: { type: string }) {
  const map: Record<string, string> = {
    bug: "🐛",
    feature: "✨",
    docs: "📝",
    refactor: "♻️",
    chore: "🔧",
  };
  return <span>{map[type] ?? "📋"}</span>;
}
