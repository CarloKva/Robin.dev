"use client";

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
import type { SprintSummary, ReportTask, ReportRepository } from "@/lib/db/reports";

interface ReportsClientProps {
  sprints: SprintSummary[];
  tasks: ReportTask[];
  repositories: ReportRepository[];
}

const TYPE_COLORS: Record<string, string> = {
  feature: "#8b5cf6",
  bug: "#ef4444",
  docs: "#3b82f6",
  refactor: "#f59e0b",
  chore: "#6b7280",
};

function shortSprintName(name: string): string {
  const match = name.match(/W(\d+)/);
  if (match) return `W${match[1]}`;
  return name.slice(0, 8);
}

export function ReportsClient({ sprints, tasks, repositories }: ReportsClientProps) {
  const completedSprints = sprints.filter((s) => s.status === "completed");

  // Sprint velocity chart data
  const velocityData = completedSprints.map((s) => {
    const total = tasks.filter((t) => t.sprint_id === s.id).length;
    return {
      name: shortSprintName(s.name),
      Totali: total,
      Completate: s.tasks_completed ?? 0,
      Fallite: s.tasks_failed ?? 0,
    };
  });

  // Cycle time trend
  const cycleTimeData = completedSprints
    .filter((s) => s.avg_cycle_time_minutes != null)
    .map((s) => ({
      name: shortSprintName(s.name),
      "Cycle time (min)": s.avg_cycle_time_minutes!,
    }));

  // Task type distribution
  const typeCount: Record<string, number> = {};
  tasks.forEach((t) => {
    const type = t.type ?? "other";
    typeCount[type] = (typeCount[type] ?? 0) + 1;
  });
  const typeData = Object.entries(typeCount)
    .map(([name, value]) => ({ name, value }))
    .sort((a, b) => b.value - a.value);

  // Tasks per repo
  const repoData = repositories
    .map((r) => ({
      name: r.name,
      Task: tasks.filter((t) => t.repository_id === r.id).length,
    }))
    .filter((r) => r.Task > 0)
    .sort((a, b) => b.Task - a.Task);

  // Summary stats
  const avgTasksPerSprint =
    completedSprints.length > 0
      ? Math.round(
          completedSprints.reduce((acc, s) => acc + (s.tasks_completed ?? 0), 0) /
            completedSprints.length
        )
      : 0;

  const avgCompletionRate =
    completedSprints.length > 0
      ? Math.round(
          completedSprints.reduce((acc, s) => {
            const total = tasks.filter((t) => t.sprint_id === s.id).length;
            return acc + (total > 0 ? ((s.tasks_completed ?? 0) / total) * 100 : 0);
          }, 0) / completedSprints.length
        )
      : 0;

  const statCards = [
    { label: "Sprint totali", value: sprints.length },
    { label: "Sprint completati", value: completedSprints.length },
    { label: "Task completate / sprint (media)", value: avgTasksPerSprint },
    { label: "Tasso completamento medio", value: `${avgCompletionRate}%` },
  ];

  if (completedSprints.length === 0) {
    return (
      <div className="rounded-lg border border-dashed border-border p-16 text-center">
        <p className="text-sm text-muted-foreground">Nessun sprint completato ancora.</p>
        <p className="mt-1 text-xs text-muted-foreground">
          Completa il primo sprint per vedere i dati.
        </p>
      </div>
    );
  }

  return (
    <div className="space-y-8">
      {/* Summary stat cards */}
      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
        {statCards.map((card) => (
          <div key={card.label} className="rounded-lg border border-border bg-card p-5">
            <p className="text-xs text-muted-foreground">{card.label}</p>
            <p className="mt-1 text-3xl font-bold tabular-nums">{card.value}</p>
          </div>
        ))}
      </div>

      {/* Sprint velocity */}
      {velocityData.length > 0 && (
        <section className="rounded-lg border border-border bg-card p-6">
          <h2 className="mb-5 text-sm font-semibold">Task per sprint completato</h2>
          <ResponsiveContainer width="100%" height={260}>
            <BarChart data={velocityData} margin={{ top: 0, right: 8, bottom: 0, left: -16 }}>
              <CartesianGrid strokeDasharray="3 3" stroke="hsl(var(--border))" />
              <XAxis dataKey="name" tick={{ fontSize: 11 }} />
              <YAxis tick={{ fontSize: 11 }} allowDecimals={false} />
              <Tooltip
                contentStyle={{
                  background: "hsl(var(--popover))",
                  border: "1px solid hsl(var(--border))",
                  borderRadius: "6px",
                  fontSize: 12,
                }}
              />
              <Legend iconType="square" iconSize={10} wrapperStyle={{ fontSize: 12 }} />
              <Bar dataKey="Totali" fill="#94a3b8" radius={[3, 3, 0, 0]} />
              <Bar dataKey="Completate" fill="#10b981" radius={[3, 3, 0, 0]} />
              <Bar dataKey="Fallite" fill="#ef4444" radius={[3, 3, 0, 0]} />
            </BarChart>
          </ResponsiveContainer>
        </section>
      )}

      {/* Cycle time + Type distribution */}
      <div className="grid gap-6 lg:grid-cols-2">
        {cycleTimeData.length > 0 && (
          <section className="rounded-lg border border-border bg-card p-6">
            <h2 className="mb-5 text-sm font-semibold">Cycle time medio per sprint (min)</h2>
            <ResponsiveContainer width="100%" height={220}>
              <LineChart data={cycleTimeData} margin={{ top: 0, right: 8, bottom: 0, left: -16 }}>
                <CartesianGrid strokeDasharray="3 3" stroke="hsl(var(--border))" />
                <XAxis dataKey="name" tick={{ fontSize: 11 }} />
                <YAxis tick={{ fontSize: 11 }} allowDecimals={false} />
                <Tooltip
                  contentStyle={{
                    background: "hsl(var(--popover))",
                    border: "1px solid hsl(var(--border))",
                    borderRadius: "6px",
                    fontSize: 12,
                  }}
                />
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
        )}

        {typeData.length > 0 && (
          <section className="rounded-lg border border-border bg-card p-6">
            <h2 className="mb-5 text-sm font-semibold">Distribuzione task per tipo</h2>
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
                      <Cell
                        key={entry.name}
                        fill={TYPE_COLORS[entry.name] ?? "#6b7280"}
                      />
                    ))}
                  </Pie>
                  <Tooltip
                    contentStyle={{
                      background: "hsl(var(--popover))",
                      border: "1px solid hsl(var(--border))",
                      borderRadius: "6px",
                      fontSize: 12,
                    }}
                  />
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

      {/* Tasks per repository */}
      {repoData.length > 0 && (
        <section className="rounded-lg border border-border bg-card p-6">
          <h2 className="mb-5 text-sm font-semibold">Task per repository</h2>
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
                contentStyle={{
                  background: "hsl(var(--popover))",
                  border: "1px solid hsl(var(--border))",
                  borderRadius: "6px",
                  fontSize: 12,
                }}
              />
              <Bar dataKey="Task" fill="#8b5cf6" radius={[0, 3, 3, 0]} />
            </BarChart>
          </ResponsiveContainer>
        </section>
      )}
    </div>
  );
}
