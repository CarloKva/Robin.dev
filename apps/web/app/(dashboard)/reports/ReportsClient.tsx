"use client";

import { useState, useMemo, useCallback } from "react";
import {
  BarChart,
  Bar,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  Legend,
  LineChart,
  Line,
  PieChart,
  Pie,
  Cell,
  ResponsiveContainer,
} from "recharts";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { CustomSelect } from "@/components/ui/CustomSelect";
import type {
  SprintSummary,
  ReportTask,
  ReportRepository,
  ReportAgent,
  AgentStats,
  WeeklyDataPoint,
} from "@/lib/db/reports";

// ── Constants ─────────────────────────────────────────────────────────────────

const TYPE_COLORS: Record<string, string> = {
  feature: "#8b5cf6",
  bug: "#ef4444",
  docs: "#3b82f6",
  refactor: "#f59e0b",
  chore: "#6b7280",
  accessibility: "#06b6d4",
  security: "#f97316",
};

const PRIORITY_COLORS: Record<string, string> = {
  critical: "#dc2626",
  urgent: "#ea580c",
  high: "#f59e0b",
  medium: "#3b82f6",
  low: "#94a3b8",
};

const PRIORITY_ORDER = ["critical", "urgent", "high", "medium", "low"];

const STATUS_LABELS: Record<string, string> = {
  backlog: "Backlog",
  sprint_ready: "Pronta",
  pending: "In attesa",
  queued: "In coda",
  in_progress: "In corso",
  in_review: "In review",
  rework: "Rework",
  review_pending: "Review attesa",
  approved: "Approvata",
  rejected: "Rifiutata",
  done: "Done",
  completed: "Completata",
  failed: "Fallita",
  cancelled: "Cancellata",
};

const TOOLTIP_STYLE = {
  background: "hsl(var(--popover))",
  border: "1px solid hsl(var(--border))",
  borderRadius: "6px",
  fontSize: 12,
} as const;

const COMPLETED_STATUSES = new Set(["done", "completed", "approved"]);
const FAILED_STATUSES = new Set(["failed", "cancelled"]);

function formatMinutes(mins: number): string {
  if (mins < 60) return `${mins}m`;
  const h = Math.floor(mins / 60);
  const m = mins % 60;
  return m > 0 ? `${h}h ${m}m` : `${h}h`;
}

function shortSprintName(name: string): string {
  const match = name.match(/W(\d+)/);
  if (match) return `W${match[1]}`;
  return name.slice(0, 8);
}

function repoShortName(full_name: string): string {
  return full_name.split("/").pop() ?? full_name;
}

// ── Sub-components ────────────────────────────────────────────────────────────

function KpiCard({
  label,
  value,
  sub,
  valueColor,
}: {
  label: string;
  value: string | number;
  sub?: string;
  valueColor?: string;
}) {
  return (
    <div className="rounded-lg border border-border bg-card p-5">
      <p className="text-xs text-muted-foreground">{label}</p>
      <p className={`mt-1 text-3xl font-bold tabular-nums ${valueColor ?? ""}`}>{value}</p>
      {sub !== undefined && <p className="mt-1 text-xs text-muted-foreground">{sub}</p>}
    </div>
  );
}

function QualityBar({
  label,
  value,
  goodWhen,
  help,
}: {
  label: string;
  value: number | null;
  goodWhen: "high" | "low";
  help?: string;
}) {
  if (value === null) {
    return (
      <div>
        <div className="flex justify-between mb-1.5">
          <span className="text-sm font-medium">{label}</span>
          <span className="text-sm text-muted-foreground">—</span>
        </div>
        <div className="h-2 rounded-full bg-muted" />
        {help !== undefined && <p className="text-xs text-muted-foreground mt-1">{help}</p>}
      </div>
    );
  }

  const isGood = goodWhen === "high" ? value >= 70 : value <= 20;
  const isMedium = !isGood && (goodWhen === "high" ? value >= 50 : value <= 40);
  const color = isGood ? "#10b981" : isMedium ? "#f59e0b" : "#ef4444";

  return (
    <div>
      <div className="flex justify-between mb-1.5">
        <span className="text-sm font-medium">{label}</span>
        <span className="text-sm font-bold tabular-nums" style={{ color }}>
          {value}%
        </span>
      </div>
      <div className="h-2 rounded-full bg-muted overflow-hidden">
        <div
          className="h-full rounded-full transition-all"
          style={{ width: `${Math.min(value, 100)}%`, background: color }}
        />
      </div>
      {help !== undefined && <p className="text-xs text-muted-foreground mt-1">{help}</p>}
    </div>
  );
}

// ── Main component ────────────────────────────────────────────────────────────

interface ReportsClientProps {
  sprints: SprintSummary[];
  tasks: ReportTask[];
  repositories: ReportRepository[];
  agents: ReportAgent[];
  agentStats: AgentStats[];
  weeklyThroughput: WeeklyDataPoint[];
}

export function ReportsClient({
  sprints,
  tasks,
  repositories,
  agents,
  agentStats,
  weeklyThroughput,
}: ReportsClientProps) {
  const router = useRouter();

  // ── Derived aggregates ────────────────────────────────────────────────────

  const completedSprints = useMemo(
    () => sprints.filter((s) => s.status === "completed"),
    [sprints]
  );

  const completedTasks = useMemo(
    () => tasks.filter((t) => COMPLETED_STATUSES.has(t.status)),
    [tasks]
  );

  const failedTasks = useMemo(
    () => tasks.filter((t) => FAILED_STATUSES.has(t.status)),
    [tasks]
  );

  const totalCompleted = completedTasks.length;
  const totalFailed = failedTasks.length;
  const totalTerminal = totalCompleted + totalFailed;

  const firstAttemptRate =
    totalCompleted > 0
      ? Math.round(
          (completedTasks.filter((t) => t.rework_count === 0).length / totalCompleted) * 100
        )
      : null;

  const reworkRate =
    totalCompleted > 0
      ? Math.round(
          (completedTasks.filter((t) => t.rework_count > 0).length / totalCompleted) * 100
        )
      : null;

  const failureRate =
    totalTerminal > 0 ? Math.round((totalFailed / totalTerminal) * 100) : null;

  const sprintCycleTimes = completedSprints.filter((s) => s.avg_cycle_time_minutes != null);
  const avgCycleTimeMin =
    sprintCycleTimes.length > 0
      ? Math.round(
          sprintCycleTimes.reduce((acc, s) => acc + s.avg_cycle_time_minutes!, 0) /
            sprintCycleTimes.length
        )
      : null;

  const avgCompletionRate =
    completedSprints.length > 0
      ? Math.round(
          completedSprints.reduce((acc, s) => {
            const total = tasks.filter((t) => t.sprint_id === s.id).length;
            return acc + (total > 0 ? ((s.tasks_completed ?? 0) / total) * 100 : 0);
          }, 0) / completedSprints.length
        )
      : null;

  // ── Chart data ────────────────────────────────────────────────────────────

  const velocityData = completedSprints.map((s) => ({
    name: shortSprintName(s.name),
    Totali: tasks.filter((t) => t.sprint_id === s.id).length,
    Completate: s.tasks_completed ?? 0,
    Fallite: s.tasks_failed ?? 0,
  }));

  const cycleTimeData = completedSprints
    .filter((s) => s.avg_cycle_time_minutes != null)
    .map((s) => ({
      name: shortSprintName(s.name),
      "Cycle time (min)": s.avg_cycle_time_minutes!,
    }));

  const typeCountMap: Record<string, number> = {};
  tasks.forEach((t) => {
    const type = t.type ?? "other";
    typeCountMap[type] = (typeCountMap[type] ?? 0) + 1;
  });
  const typeData = Object.entries(typeCountMap)
    .map(([name, value]) => ({ name, value }))
    .sort((a, b) => b.value - a.value);

  const priorityCountMap: Record<string, number> = {};
  tasks.forEach((t) => {
    const p = t.priority ?? "medium";
    priorityCountMap[p] = (priorityCountMap[p] ?? 0) + 1;
  });
  const priorityData = PRIORITY_ORDER.filter((p) => priorityCountMap[p] !== undefined).map(
    (p) => ({ name: p, count: priorityCountMap[p]! })
  );

  const repoData = repositories
    .map((r) => ({
      name: repoShortName(r.full_name),
      full_name: r.full_name,
      Task: tasks.filter((t) => t.repository_id === r.id).length,
    }))
    .filter((r) => r.Task > 0)
    .sort((a, b) => b.Task - a.Task);

  const reworkBuckets = [
    { name: "0 rework", count: completedTasks.filter((t) => t.rework_count === 0).length },
    { name: "1 rework", count: completedTasks.filter((t) => t.rework_count === 1).length },
    { name: "2+ rework", count: completedTasks.filter((t) => t.rework_count >= 2).length },
  ].filter((b) => b.count > 0);

  const reworkBucketColors = ["#10b981", "#f59e0b", "#ef4444"] as const;

  // ── Task table state ──────────────────────────────────────────────────────

  const [filterType, setFilterType] = useState("");
  const [filterSprint, setFilterSprint] = useState("");
  const [filterAgent, setFilterAgent] = useState("");
  const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set());
  const [isSendingToBacklog, setIsSendingToBacklog] = useState(false);

  const filteredTasks = useMemo(
    () =>
      tasks.filter((t) => {
        if (filterType && t.type !== filterType) return false;
        if (filterSprint) {
          if (filterSprint === "__no_sprint__") {
            if (t.sprint_id !== null) return false;
          } else {
            if (t.sprint_id !== filterSprint) return false;
          }
        }
        if (filterAgent) {
          if (filterAgent === "__no_agent__") {
            if (t.assigned_agent_id !== null) return false;
          } else {
            if (t.assigned_agent_id !== filterAgent) return false;
          }
        }
        return true;
      }),
    [tasks, filterType, filterSprint, filterAgent]
  );

  const allFilteredSelected =
    filteredTasks.length > 0 && filteredTasks.every((t) => selectedIds.has(t.id));

  const toggleSelect = useCallback((id: string) => {
    setSelectedIds((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  }, []);

  const toggleSelectAll = () => {
    if (allFilteredSelected) {
      setSelectedIds((prev) => {
        const next = new Set(prev);
        filteredTasks.forEach((t) => next.delete(t.id));
        return next;
      });
    } else {
      setSelectedIds((prev) => {
        const next = new Set(prev);
        filteredTasks.forEach((t) => next.add(t.id));
        return next;
      });
    }
  };

  const moveToBacklog = async () => {
    if (selectedIds.size === 0) return;
    setIsSendingToBacklog(true);
    try {
      await fetch("/api/tasks/bulk", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          action: "move_to_backlog",
          taskIds: Array.from(selectedIds),
          payload: {},
        }),
      });
      setSelectedIds(new Set());
      router.refresh();
    } finally {
      setIsSendingToBacklog(false);
    }
  };

  // ── Select options ────────────────────────────────────────────────────────

  const typeOptions = [
    { value: "", label: "Tutti i tipi" },
    { value: "bug", label: "Bug" },
    { value: "feature", label: "Feature" },
    { value: "refactor", label: "Refactor" },
    { value: "chore", label: "Chore" },
    { value: "docs", label: "Docs" },
    { value: "accessibility", label: "Accessibility" },
    { value: "security", label: "Security" },
  ];

  const sprintOptions = [
    { value: "", label: "Tutti gli sprint" },
    { value: "__no_sprint__", label: "Senza sprint (backlog)" },
    ...sprints.map((s) => ({ value: s.id, label: s.name })),
  ];

  const agentOptions = [
    { value: "", label: "Tutti gli agenti" },
    { value: "__no_agent__", label: "Senza agente assegnato" },
    ...agents.map((a) => ({ value: a.id, label: a.name })),
  ];

  // ── Empty state ───────────────────────────────────────────────────────────

  if (completedSprints.length === 0 && tasks.length === 0) {
    return (
      <div className="space-y-8">
        <div>
          <h1 className="text-2xl font-bold">Analytics</h1>
          <p className="text-sm text-muted-foreground">
            Performance e qualità del lavoro degli agenti.
          </p>
        </div>
        <div className="rounded-lg border border-dashed border-border p-16 text-center">
          <p className="text-sm text-muted-foreground">Nessun dato disponibile ancora.</p>
          <p className="mt-1 text-xs text-muted-foreground">
            Crea e completa il primo sprint per vedere i dati.
          </p>
        </div>
      </div>
    );
  }

  // ── Render ────────────────────────────────────────────────────────────────

  return (
    <div className="space-y-8">
      {/* ── Header ──────────────────────────────────────────────────────── */}
      <div>
        <h1 className="text-2xl font-bold">Analytics</h1>
        <p className="text-sm text-muted-foreground">
          Performance e qualità del lavoro degli agenti.
        </p>
      </div>

      {/* ── Hero KPIs ───────────────────────────────────────────────────── */}
      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-6">
        <KpiCard label="Task completate" value={totalCompleted} sub={`di ${tasks.length} totali`} />
        <KpiCard
          label="Successo 1° tentativo"
          value={firstAttemptRate !== null ? `${firstAttemptRate}%` : "—"}
          valueColor={
            firstAttemptRate === null
              ? ""
              : firstAttemptRate >= 70
                ? "text-emerald-600"
                : firstAttemptRate >= 50
                  ? "text-yellow-600"
                  : "text-red-500"
          }
          sub="Task senza rework"
        />
        <KpiCard
          label="Tasso rework"
          value={reworkRate !== null ? `${reworkRate}%` : "—"}
          valueColor={
            reworkRate === null
              ? ""
              : reworkRate <= 20
                ? "text-emerald-600"
                : reworkRate <= 40
                  ? "text-yellow-600"
                  : "text-red-500"
          }
          sub="Task con ≥1 ciclo di rework"
        />
        <KpiCard
          label="Tasso fallimento"
          value={failureRate !== null ? `${failureRate}%` : "—"}
          valueColor={
            failureRate === null
              ? ""
              : failureRate <= 10
                ? "text-emerald-600"
                : failureRate <= 25
                  ? "text-yellow-600"
                  : "text-red-500"
          }
          sub="Task fallite o cancellate"
        />
        <KpiCard
          label="Cycle time medio"
          value={avgCycleTimeMin !== null ? formatMinutes(avgCycleTimeMin) : "—"}
          sub="Media sprint completati"
        />
        <KpiCard
          label="Sprint completati"
          value={completedSprints.length}
          sub={`di ${sprints.length} totali`}
        />
      </div>

      {/* ── Throughput + Cycle time ──────────────────────────────────────── */}
      <div className="grid gap-6 lg:grid-cols-2">
        <section className="rounded-lg border border-border bg-card p-6">
          <h2 className="text-sm font-semibold">Throughput settimanale</h2>
          <p className="mt-0.5 mb-5 text-xs text-muted-foreground">
            Task completate e fallite nelle ultime 12 settimane
          </p>
          <ResponsiveContainer width="100%" height={220}>
            <BarChart data={weeklyThroughput} margin={{ top: 0, right: 8, bottom: 0, left: -16 }}>
              <CartesianGrid strokeDasharray="3 3" stroke="hsl(var(--border))" />
              <XAxis dataKey="label" tick={{ fontSize: 10 }} interval={2} />
              <YAxis tick={{ fontSize: 11 }} allowDecimals={false} />
              <Tooltip contentStyle={TOOLTIP_STYLE} />
              <Legend iconType="square" iconSize={10} wrapperStyle={{ fontSize: 12 }} />
              <Bar dataKey="completed" name="Completate" fill="#10b981" radius={[3, 3, 0, 0]} />
              <Bar dataKey="failed" name="Fallite" fill="#ef4444" radius={[3, 3, 0, 0]} />
            </BarChart>
          </ResponsiveContainer>
        </section>

        {cycleTimeData.length > 0 ? (
          <section className="rounded-lg border border-border bg-card p-6">
            <h2 className="text-sm font-semibold">Cycle time per sprint</h2>
            <p className="mt-0.5 mb-5 text-xs text-muted-foreground">
              Minuti medi dall&apos;inizio alla fine di una task
            </p>
            <ResponsiveContainer width="100%" height={220}>
              <LineChart data={cycleTimeData} margin={{ top: 0, right: 8, bottom: 0, left: -16 }}>
                <CartesianGrid strokeDasharray="3 3" stroke="hsl(var(--border))" />
                <XAxis dataKey="name" tick={{ fontSize: 11 }} />
                <YAxis tick={{ fontSize: 11 }} allowDecimals={false} />
                <Tooltip contentStyle={TOOLTIP_STYLE} />
                <Line
                  type="monotone"
                  dataKey="Cycle time (min)"
                  stroke="#8b5cf6"
                  strokeWidth={2}
                  dot={{ r: 4, fill: "#8b5cf6" }}
                  activeDot={{ r: 5 }}
                />
              </LineChart>
            </ResponsiveContainer>
          </section>
        ) : (
          <section className="rounded-lg border border-border bg-card p-6 flex items-center justify-center min-h-[300px]">
            <p className="text-sm text-muted-foreground">
              Cycle time disponibile dopo il primo sprint completato.
            </p>
          </section>
        )}
      </div>

      {/* ── Sprint Velocity ──────────────────────────────────────────────── */}
      {velocityData.length > 0 && (
        <section className="rounded-lg border border-border bg-card p-6">
          <h2 className="text-sm font-semibold">Velocità per sprint</h2>
          <p className="mt-0.5 mb-5 text-xs text-muted-foreground">
            Task totali, completate e fallite per ogni sprint completato
          </p>
          <ResponsiveContainer width="100%" height={260}>
            <BarChart data={velocityData} margin={{ top: 0, right: 8, bottom: 0, left: -16 }}>
              <CartesianGrid strokeDasharray="3 3" stroke="hsl(var(--border))" />
              <XAxis dataKey="name" tick={{ fontSize: 11 }} />
              <YAxis tick={{ fontSize: 11 }} allowDecimals={false} />
              <Tooltip contentStyle={TOOLTIP_STYLE} />
              <Legend iconType="square" iconSize={10} wrapperStyle={{ fontSize: 12 }} />
              <Bar dataKey="Totali" fill="#94a3b8" radius={[3, 3, 0, 0]} />
              <Bar dataKey="Completate" fill="#10b981" radius={[3, 3, 0, 0]} />
              <Bar dataKey="Fallite" fill="#ef4444" radius={[3, 3, 0, 0]} />
            </BarChart>
          </ResponsiveContainer>
        </section>
      )}

      {/* ── Quality signals + Type distribution ─────────────────────────── */}
      <div className="grid gap-6 lg:grid-cols-2">
        <section className="rounded-lg border border-border bg-card p-6">
          <h2 className="text-sm font-semibold">Segnali di qualità</h2>
          <p className="mt-0.5 mb-6 text-xs text-muted-foreground">
            Indicatori di qualità del lavoro prodotto
          </p>
          <div className="space-y-5">
            <QualityBar
              label="Successo al primo tentativo"
              value={firstAttemptRate}
              goodWhen="high"
              help="% task completate senza cicli di rework"
            />
            <QualityBar
              label="Tasso rework"
              value={reworkRate}
              goodWhen="low"
              help="% task completate che hanno richiesto almeno un rework"
            />
            <QualityBar
              label="Tasso di fallimento"
              value={failureRate}
              goodWhen="low"
              help="% task terminate come fallite o cancellate"
            />
            <QualityBar
              label="Completamento sprint"
              value={avgCompletionRate}
              goodWhen="high"
              help="% media di task completate per sprint (su sprint completati)"
            />
          </div>
        </section>

        {typeData.length > 0 && (
          <section className="rounded-lg border border-border bg-card p-6">
            <h2 className="text-sm font-semibold">Distribuzione per tipo</h2>
            <p className="mt-0.5 mb-5 text-xs text-muted-foreground">
              Tutti i tipi di task nel workspace
            </p>
            <div className="flex items-center gap-6">
              <ResponsiveContainer width="55%" height={200}>
                <PieChart>
                  <Pie
                    data={typeData}
                    cx="50%"
                    cy="50%"
                    innerRadius={52}
                    outerRadius={80}
                    paddingAngle={2}
                    dataKey="value"
                  >
                    {typeData.map((entry) => (
                      <Cell key={entry.name} fill={TYPE_COLORS[entry.name] ?? "#6b7280"} />
                    ))}
                  </Pie>
                  <Tooltip contentStyle={TOOLTIP_STYLE} />
                </PieChart>
              </ResponsiveContainer>
              <div className="flex flex-col gap-2.5">
                {typeData.map((entry) => (
                  <div key={entry.name} className="flex items-center gap-2 text-xs">
                    <span
                      className="h-2.5 w-2.5 shrink-0 rounded-full"
                      style={{ background: TYPE_COLORS[entry.name] ?? "#6b7280" }}
                    />
                    <span className="capitalize text-muted-foreground">{entry.name}</span>
                    <span className="ml-auto font-medium tabular-nums">{entry.value}</span>
                  </div>
                ))}
              </div>
            </div>
          </section>
        )}
      </div>

      {/* ── Priority + Rework distribution ──────────────────────────────── */}
      <div className="grid gap-6 lg:grid-cols-2">
        {priorityData.length > 0 && (
          <section className="rounded-lg border border-border bg-card p-6">
            <h2 className="text-sm font-semibold">Distribuzione priorità</h2>
            <p className="mt-0.5 mb-5 text-xs text-muted-foreground">
              Task per livello di priorità
            </p>
            <ResponsiveContainer width="100%" height={Math.max(120, priorityData.length * 44)}>
              <BarChart
                data={priorityData}
                layout="vertical"
                margin={{ top: 0, right: 8, bottom: 0, left: 8 }}
              >
                <CartesianGrid strokeDasharray="3 3" stroke="hsl(var(--border))" />
                <XAxis type="number" tick={{ fontSize: 11 }} allowDecimals={false} />
                <YAxis dataKey="name" type="category" tick={{ fontSize: 11 }} width={64} />
                <Tooltip contentStyle={TOOLTIP_STYLE} />
                <Bar dataKey="count" name="Task" radius={[0, 3, 3, 0]}>
                  {priorityData.map((entry) => (
                    <Cell key={entry.name} fill={PRIORITY_COLORS[entry.name] ?? "#6b7280"} />
                  ))}
                </Bar>
              </BarChart>
            </ResponsiveContainer>
          </section>
        )}

        {reworkBuckets.length > 0 && (
          <section className="rounded-lg border border-border bg-card p-6">
            <h2 className="text-sm font-semibold">Distribuzione cicli rework</h2>
            <p className="mt-0.5 mb-5 text-xs text-muted-foreground">
              Quante task hanno richiesto rework (su task completate)
            </p>
            <ResponsiveContainer width="100%" height={Math.max(120, reworkBuckets.length * 44)}>
              <BarChart
                data={reworkBuckets}
                layout="vertical"
                margin={{ top: 0, right: 8, bottom: 0, left: 8 }}
              >
                <CartesianGrid strokeDasharray="3 3" stroke="hsl(var(--border))" />
                <XAxis type="number" tick={{ fontSize: 11 }} allowDecimals={false} />
                <YAxis dataKey="name" type="category" tick={{ fontSize: 11 }} width={72} />
                <Tooltip contentStyle={TOOLTIP_STYLE} />
                <Bar dataKey="count" name="Task" radius={[0, 3, 3, 0]}>
                  {reworkBuckets.map((_, i) => (
                    <Cell key={i} fill={reworkBucketColors[i] ?? "#6b7280"} />
                  ))}
                </Bar>
              </BarChart>
            </ResponsiveContainer>
          </section>
        )}
      </div>

      {/* ── Repository distribution ──────────────────────────────────────── */}
      {repoData.length > 0 && (
        <section className="rounded-lg border border-border bg-card p-6">
          <h2 className="text-sm font-semibold">Task per repository</h2>
          <p className="mt-0.5 mb-5 text-xs text-muted-foreground">
            Distribuzione del carico tra i repository abilitati
          </p>
          <ResponsiveContainer width="100%" height={Math.max(180, repoData.length * 44)}>
            <BarChart
              data={repoData}
              layout="vertical"
              margin={{ top: 0, right: 8, bottom: 0, left: 8 }}
            >
              <CartesianGrid strokeDasharray="3 3" stroke="hsl(var(--border))" />
              <XAxis type="number" tick={{ fontSize: 11 }} allowDecimals={false} />
              <YAxis dataKey="name" type="category" tick={{ fontSize: 11 }} width={120} />
              <Tooltip
                contentStyle={TOOLTIP_STYLE}
                formatter={(value) => [value, "Task"]}
                labelFormatter={(label) => {
                  const repo = repoData.find((r) => r.name === label);
                  return repo?.full_name ?? label;
                }}
              />
              <Bar dataKey="Task" fill="#8b5cf6" radius={[0, 3, 3, 0]} />
            </BarChart>
          </ResponsiveContainer>
        </section>
      )}

      {/* ── Agent performance table ──────────────────────────────────────── */}
      {agentStats.length > 0 && (
        <section className="rounded-lg border border-border bg-card">
          <div className="px-5 py-4 border-b border-border">
            <h2 className="text-sm font-semibold">Performance agenti</h2>
            <p className="mt-0.5 text-xs text-muted-foreground">
              Metriche aggregate per agente
            </p>
          </div>
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-border bg-muted/30">
                  <th className="px-5 py-2.5 text-left font-medium text-muted-foreground">
                    Agente
                  </th>
                  <th className="px-5 py-2.5 text-right font-medium text-muted-foreground">
                    Totale
                  </th>
                  <th className="px-5 py-2.5 text-right font-medium text-muted-foreground">
                    Completate
                  </th>
                  <th className="px-5 py-2.5 text-right font-medium text-muted-foreground">
                    Tasso successo
                  </th>
                  <th className="px-5 py-2.5 text-right font-medium text-muted-foreground">
                    Rework %
                  </th>
                  <th className="px-5 py-2.5 text-right font-medium text-muted-foreground hidden lg:table-cell">
                    Cicli medi
                  </th>
                  <th className="px-5 py-2.5 text-right font-medium text-muted-foreground hidden lg:table-cell">
                    Fallite
                  </th>
                </tr>
              </thead>
              <tbody className="divide-y divide-border">
                {[...agentStats]
                  .sort((a, b) => b.completed - a.completed)
                  .map((stat) => {
                    const agent = agents.find((a) => a.id === stat.agent_id);
                    return (
                      <tr
                        key={stat.agent_id}
                        className="hover:bg-accent/30 transition-colors"
                      >
                        <td className="px-5 py-3 font-medium">
                          {agent?.name ?? (
                            <span className="italic text-muted-foreground">
                              Agente sconosciuto
                            </span>
                          )}
                        </td>
                        <td className="px-5 py-3 text-right tabular-nums text-muted-foreground">
                          {stat.total}
                        </td>
                        <td className="px-5 py-3 text-right tabular-nums font-medium">
                          {stat.completed}
                        </td>
                        <td className="px-5 py-3 text-right tabular-nums">
                          {stat.success_rate !== null ? (
                            <span
                              className="font-medium"
                              style={{
                                color:
                                  stat.success_rate >= 70
                                    ? "#10b981"
                                    : stat.success_rate >= 50
                                      ? "#f59e0b"
                                      : "#ef4444",
                              }}
                            >
                              {stat.success_rate}%
                            </span>
                          ) : (
                            "—"
                          )}
                        </td>
                        <td className="px-5 py-3 text-right tabular-nums">
                          {stat.rework_rate !== null ? (
                            <span
                              className="font-medium"
                              style={{
                                color:
                                  stat.rework_rate <= 20
                                    ? "#10b981"
                                    : stat.rework_rate <= 40
                                      ? "#f59e0b"
                                      : "#ef4444",
                              }}
                            >
                              {stat.rework_rate}%
                            </span>
                          ) : (
                            "—"
                          )}
                        </td>
                        <td className="px-5 py-3 text-right tabular-nums text-muted-foreground hidden lg:table-cell">
                          {stat.avg_rework}
                        </td>
                        <td className="px-5 py-3 text-right tabular-nums text-muted-foreground hidden lg:table-cell">
                          {stat.failed}
                        </td>
                      </tr>
                    );
                  })}
              </tbody>
            </table>
          </div>
        </section>
      )}

      {/* ── Task table ───────────────────────────────────────────────────── */}
      <section className="rounded-lg border border-border bg-card">
        <div className="flex flex-wrap items-center justify-between gap-3 px-5 py-4 border-b border-border">
          <h2 className="text-sm font-semibold">Lista task ({filteredTasks.length})</h2>
          <div className="flex flex-wrap items-center gap-2">
            <CustomSelect
              value={filterType}
              onChange={setFilterType}
              options={typeOptions}
              className="w-40"
            />
            <CustomSelect
              value={filterSprint}
              onChange={setFilterSprint}
              options={sprintOptions}
              className="w-48"
            />
            {agents.length > 0 && (
              <CustomSelect
                value={filterAgent}
                onChange={setFilterAgent}
                options={agentOptions}
                className="w-44"
              />
            )}
            {(filterType || filterSprint || filterAgent) && (
              <button
                onClick={() => {
                  setFilterType("");
                  setFilterSprint("");
                  setFilterAgent("");
                }}
                className="text-xs text-muted-foreground underline hover:text-foreground"
              >
                Azzera
              </button>
            )}
          </div>
        </div>

        {filteredTasks.length === 0 ? (
          <div className="px-5 py-10 text-center text-sm text-muted-foreground">
            Nessuna task trovata con questi filtri.
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-border bg-muted/30">
                  <th className="w-10 px-4 py-2.5">
                    <input
                      type="checkbox"
                      checked={allFilteredSelected}
                      onChange={toggleSelectAll}
                      className="cursor-pointer accent-primary"
                      aria-label="Seleziona tutte"
                    />
                  </th>
                  <th className="px-4 py-2.5 text-left font-medium text-muted-foreground">
                    Titolo
                  </th>
                  <th className="px-4 py-2.5 text-left font-medium text-muted-foreground hidden sm:table-cell">
                    Tipo
                  </th>
                  <th className="px-4 py-2.5 text-left font-medium text-muted-foreground hidden md:table-cell">
                    Status
                  </th>
                  <th className="px-4 py-2.5 text-left font-medium text-muted-foreground hidden lg:table-cell">
                    Sprint
                  </th>
                  <th className="px-4 py-2.5 text-right font-medium text-muted-foreground hidden lg:table-cell">
                    Rework
                  </th>
                  <th className="px-4 py-2.5 text-left font-medium text-muted-foreground hidden xl:table-cell">
                    Agente
                  </th>
                </tr>
              </thead>
              <tbody className="divide-y divide-border">
                {filteredTasks.map((task) => {
                  const sprint = sprints.find((s) => s.id === task.sprint_id);
                  const agent = agents.find((a) => a.id === task.assigned_agent_id);
                  return (
                    <tr key={task.id} className="hover:bg-accent/30 transition-colors">
                      <td className="w-10 px-4 py-2.5">
                        <input
                          type="checkbox"
                          checked={selectedIds.has(task.id)}
                          onChange={() => toggleSelect(task.id)}
                          className="cursor-pointer accent-primary"
                          aria-label={`Seleziona ${task.title}`}
                        />
                      </td>
                      <td className="px-4 py-2.5 font-medium text-foreground max-w-xs truncate">
                        <Link href={`/tasks/${task.id}`} className="hover:underline">
                          {task.title}
                        </Link>
                      </td>
                      <td className="px-4 py-2.5 hidden sm:table-cell">
                        {task.type ? (
                          <span
                            className="inline-flex items-center rounded-full px-2 py-0.5 text-xs font-medium text-white"
                            style={{ background: TYPE_COLORS[task.type] ?? "#6b7280" }}
                          >
                            {task.type}
                          </span>
                        ) : (
                          <span className="text-muted-foreground">—</span>
                        )}
                      </td>
                      <td className="px-4 py-2.5 text-muted-foreground hidden md:table-cell">
                        {STATUS_LABELS[task.status] ?? task.status}
                      </td>
                      <td className="px-4 py-2.5 text-muted-foreground hidden lg:table-cell">
                        {sprint?.name ?? (
                          <span className="italic text-xs">Backlog</span>
                        )}
                      </td>
                      <td className="px-4 py-2.5 text-right tabular-nums hidden lg:table-cell">
                        {task.rework_count > 0 ? (
                          <span className="text-orange-500 font-medium">{task.rework_count}</span>
                        ) : (
                          <span className="text-muted-foreground">0</span>
                        )}
                      </td>
                      <td className="px-4 py-2.5 text-muted-foreground hidden xl:table-cell">
                        {agent?.name ?? <span className="italic text-xs">—</span>}
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}
      </section>

      {/* ── Bulk action bar ──────────────────────────────────────────────── */}
      {selectedIds.size > 0 && (
        <div className="fixed inset-x-4 bottom-20 z-50 mx-auto max-w-2xl md:bottom-6">
          <div className="flex items-center gap-3 rounded-xl border border-border bg-popover px-4 py-3 shadow-lg">
            <span className="text-sm font-medium text-foreground inline-flex items-center gap-2">
              {isSendingToBacklog && (
                <span className="h-3.5 w-3.5 animate-spin rounded-full border-2 border-current border-t-transparent" />
              )}
              {selectedIds.size} task {selectedIds.size === 1 ? "selezionata" : "selezionate"}
            </span>
            <div className="flex flex-1 items-center justify-end gap-2">
              <button
                onClick={() => setSelectedIds(new Set())}
                disabled={isSendingToBacklog}
                className="text-xs text-muted-foreground underline hover:text-foreground disabled:opacity-50"
              >
                Deseleziona
              </button>
              <button
                onClick={() => void moveToBacklog()}
                disabled={isSendingToBacklog}
                className="rounded bg-primary px-3 py-1.5 text-xs font-medium text-primary-foreground hover:bg-primary/90 disabled:opacity-50"
              >
                {isSendingToBacklog ? "Spostando..." : "Riporta in backlog"}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
