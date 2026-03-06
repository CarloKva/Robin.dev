"use client";

import { useState, useMemo } from "react";
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
import { CustomSelect } from "@/components/ui/CustomSelect";
import type { SprintSummary, ReportTask, ReportRepository, ReportAgent } from "@/lib/db/reports";

interface ReportsClientProps {
  sprints: SprintSummary[];
  tasks: ReportTask[];
  repositories: ReportRepository[];
  agents: ReportAgent[];
}

const TYPE_COLORS: Record<string, string> = {
  feature: "#8b5cf6",
  bug: "#ef4444",
  docs: "#3b82f6",
  refactor: "#f59e0b",
  chore: "#6b7280",
  accessibility: "#06b6d4",
  security: "#f97316",
};

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

function shortSprintName(name: string): string {
  const match = name.match(/W(\d+)/);
  if (match) return `W${match[1]}`;
  return name.slice(0, 8);
}

export function ReportsClient({ sprints, tasks, repositories, agents }: ReportsClientProps) {
  const completedSprints = sprints.filter((s) => s.status === "completed");

  // ── Task table filters ─────────────────────────────────────────────────────
  const [filterType, setFilterType] = useState("");
  const [filterSprint, setFilterSprint] = useState("");
  const [filterAgent, setFilterAgent] = useState("");

  const filteredTasks = useMemo(() => {
    return tasks.filter((t) => {
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
    });
  }, [tasks, filterType, filterSprint, filterAgent]);

  // ── Chart data ─────────────────────────────────────────────────────────────

  const velocityData = completedSprints.map((s) => {
    const total = tasks.filter((t) => t.sprint_id === s.id).length;
    return {
      name: shortSprintName(s.name),
      Totali: total,
      Completate: s.tasks_completed ?? 0,
      Fallite: s.tasks_failed ?? 0,
    };
  });

  const cycleTimeData = completedSprints
    .filter((s) => s.avg_cycle_time_minutes != null)
    .map((s) => ({
      name: shortSprintName(s.name),
      "Cycle time (min)": s.avg_cycle_time_minutes!,
    }));

  const typeCount: Record<string, number> = {};
  tasks.forEach((t) => {
    const type = t.type ?? "other";
    typeCount[type] = (typeCount[type] ?? 0) + 1;
  });
  const typeData = Object.entries(typeCount)
    .map(([name, value]) => ({ name, value }))
    .sort((a, b) => b.value - a.value);

  const repoData = repositories
    .map((r) => ({
      name: r.name,
      Task: tasks.filter((t) => t.repository_id === r.id).length,
    }))
    .filter((r) => r.Task > 0)
    .sort((a, b) => b.Task - a.Task);

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

  // ── Select options ─────────────────────────────────────────────────────────

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

  if (completedSprints.length === 0 && tasks.length === 0) {
    return (
      <div className="rounded-lg border border-dashed border-border p-16 text-center">
        <p className="text-sm text-muted-foreground">Nessun dato disponibile ancora.</p>
        <p className="mt-1 text-xs text-muted-foreground">
          Crea e completa il primo sprint per vedere i dati.
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

      {/* Charts — only if there are completed sprints */}
      {completedSprints.length > 0 && (
        <>
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
                          <Cell key={entry.name} fill={TYPE_COLORS[entry.name] ?? "#6b7280"} />
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
        </>
      )}

      {/* ── Task table ──────────────────────────────────────────────────────── */}
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
                onClick={() => { setFilterType(""); setFilterSprint(""); setFilterAgent(""); }}
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
                  <th className="px-4 py-2.5 text-left font-medium text-muted-foreground">Titolo</th>
                  <th className="px-4 py-2.5 text-left font-medium text-muted-foreground hidden sm:table-cell">Tipo</th>
                  <th className="px-4 py-2.5 text-left font-medium text-muted-foreground hidden md:table-cell">Status</th>
                  <th className="px-4 py-2.5 text-left font-medium text-muted-foreground hidden lg:table-cell">Sprint</th>
                  <th className="px-4 py-2.5 text-left font-medium text-muted-foreground hidden lg:table-cell">Agente</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-border">
                {filteredTasks.map((task) => {
                  const sprint = sprints.find((s) => s.id === task.sprint_id);
                  const agent = agents.find((a) => a.id === task.assigned_agent_id);
                  return (
                    <tr key={task.id} className="hover:bg-accent/30 transition-colors">
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
                        {sprint?.name ?? <span className="italic text-xs">Backlog</span>}
                      </td>
                      <td className="px-4 py-2.5 text-muted-foreground hidden lg:table-cell">
                        {agent?.name ?? <span className="italic text-xs text-muted-foreground">—</span>}
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}
      </section>
    </div>
  );
}
