"use client";

import { useState, useMemo, useCallback, useEffect, useRef } from "react";
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
  Area,
  AreaChart,
} from "recharts";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { CustomSelect } from "@/components/ui/CustomSelect";
import {
  Calendar,
  Download,
  CheckSquare,
  GitPullRequest,
  Clock,
  Bot,
  TrendingUp,
  TrendingDown,
  ChevronDown,
  FileText,
} from "lucide-react";
import type {
  SprintSummary,
  ReportTask,
  ReportRepository,
  ReportAgent,
  AgentStats,
  WeeklyDataPoint,
} from "@/lib/db/reports";

// ── Constants ─────────────────────────────────────────────────────────────────

const IOS_BLUE = "#007AFF";
const IOS_GREEN = "#34C759";
const IOS_ORANGE = "#FF9500";
const IOS_RED = "#FF3B30";
const IOS_YELLOW = "#FFCC00";

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

const STATUS_DONUT_COLORS: Record<string, string> = {
  done: IOS_GREEN,
  completed: IOS_GREEN,
  approved: IOS_GREEN,
  in_progress: IOS_BLUE,
  queued: IOS_BLUE,
  in_review: IOS_YELLOW,
  review_pending: IOS_YELLOW,
  failed: IOS_RED,
  cancelled: IOS_RED,
  rework: IOS_ORANGE,
  pending: "#8E8E93",
  backlog: "#8E8E93",
  sprint_ready: "#8E8E93",
  rejected: IOS_RED,
};

const TOOLTIP_STYLE = {
  background: "var(--tooltip-bg, white)",
  border: "1px solid rgba(0,0,0,0.08)",
  borderRadius: "12px",
  fontSize: 12,
  boxShadow: "0 4px 12px 0 rgba(0,0,0,0.08)",
  color: "inherit",
} as const;

const IOS_GRID_COLOR = "#F2F2F7";

const COMPLETED_STATUSES = new Set(["done", "completed", "approved"]);
const FAILED_STATUSES = new Set(["failed", "cancelled"]);

function shortSprintName(name: string): string {
  const match = name.match(/W(\d+)/);
  if (match) return `W${match[1]}`;
  return name.slice(0, 8);
}

function repoShortName(full_name: string): string {
  return full_name.split("/").pop() ?? full_name;
}

function formatDateRange(start: Date, end: Date): string {
  const opts: Intl.DateTimeFormatOptions = { day: "numeric", month: "short", year: "numeric" };
  return `${start.toLocaleDateString("it-IT", opts)} — ${end.toLocaleDateString("it-IT", opts)}`;
}

function isSameDay(a: Date, b: Date): boolean {
  return a.getFullYear() === b.getFullYear() && a.getMonth() === b.getMonth() && a.getDate() === b.getDate();
}

// ── Count-up hook ─────────────────────────────────────────────────────────────

function useCountUp(target: number, duration = 800): number {
  const [current, setCurrent] = useState(0);
  useEffect(() => {
    if (target === 0) { setCurrent(0); return; }
    let start: number | null = null;
    const step = (timestamp: number) => {
      if (!start) start = timestamp;
      const progress = Math.min((timestamp - start) / duration, 1);
      const eased = 1 - Math.pow(1 - progress, 3);
      setCurrent(Math.round(eased * target));
      if (progress < 1) requestAnimationFrame(step);
    };
    const raf = requestAnimationFrame(step);
    return () => cancelAnimationFrame(raf);
  }, [target, duration]);
  return current;
}

// ── Date range picker ─────────────────────────────────────────────────────────

type QuickRange = "week" | "month" | "3months" | "custom";

interface DateRange {
  start: Date;
  end: Date;
}

function getQuickRange(key: QuickRange): DateRange {
  const now = new Date();
  const end = new Date(now);
  const start = new Date(now);
  if (key === "week") start.setDate(start.getDate() - 7);
  else if (key === "month") start.setMonth(start.getMonth() - 1);
  else if (key === "3months") start.setMonth(start.getMonth() - 3);
  return { start, end };
}

function DateRangePicker({
  range,
  onChange,
}: {
  range: DateRange;
  onChange: (r: DateRange) => void;
}) {
  const [open, setOpen] = useState(false);
  const [activeQuick, setActiveQuick] = useState<QuickRange>("month");
  const ref = useRef<HTMLDivElement>(null);

  useEffect(() => {
    function handleClick(e: MouseEvent) {
      if (ref.current && !ref.current.contains(e.target as Node)) setOpen(false);
    }
    document.addEventListener("mousedown", handleClick);
    return () => document.removeEventListener("mousedown", handleClick);
  }, []);

  const selectQuick = (key: QuickRange) => {
    if (key !== "custom") {
      setActiveQuick(key);
      onChange(getQuickRange(key));
      setOpen(false);
    }
  };

  const quickOptions: { key: QuickRange; label: string }[] = [
    { key: "week", label: "Ultima settimana" },
    { key: "month", label: "Ultimo mese" },
    { key: "3months", label: "Ultimi 3 mesi" },
  ];

  return (
    <div ref={ref} className="relative">
      <button
        onClick={() => setOpen((v) => !v)}
        className="flex h-9 items-center gap-2 rounded-xl border border-border bg-white dark:bg-[#1C1C1E] px-3 text-sm font-medium shadow-ios-sm hover:bg-accent/30 transition-colors"
      >
        <Calendar className="h-4 w-4 text-[#8E8E93]" />
        <span>{formatDateRange(range.start, range.end)}</span>
        <ChevronDown className="h-3.5 w-3.5 text-[#8E8E93]" />
      </button>

      {open && (
        <div className="absolute right-0 top-11 z-50 w-56 rounded-ios-lg border border-border bg-white dark:bg-[#1C1C1E] shadow-ios-md overflow-hidden">
          <div className="p-1">
            {quickOptions.map((opt) => (
              <button
                key={opt.key}
                onClick={() => selectQuick(opt.key)}
                className={`w-full rounded-lg px-3 py-2 text-left text-sm transition-colors ${
                  activeQuick === opt.key
                    ? "bg-[#007AFF]/10 text-[#007AFF] font-medium"
                    : "hover:bg-accent/40 text-foreground"
                }`}
              >
                {opt.label}
              </button>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}

// ── Export dropdown ───────────────────────────────────────────────────────────

function ExportDropdown({
  onExportCsv,
  onExportPdf,
}: {
  onExportCsv: () => void;
  onExportPdf: () => void;
}) {
  const [open, setOpen] = useState(false);
  const ref = useRef<HTMLDivElement>(null);

  useEffect(() => {
    function handleClick(e: MouseEvent) {
      if (ref.current && !ref.current.contains(e.target as Node)) setOpen(false);
    }
    document.addEventListener("mousedown", handleClick);
    return () => document.removeEventListener("mousedown", handleClick);
  }, []);

  return (
    <div ref={ref} className="relative">
      <button
        onClick={() => setOpen((v) => !v)}
        className="flex h-9 items-center gap-2 rounded-xl border border-border bg-white dark:bg-[#1C1C1E] px-3 text-sm font-medium shadow-ios-sm hover:bg-accent/30 transition-colors"
      >
        <Download className="h-4 w-4 text-[#8E8E93]" />
        <span>Esporta</span>
        <ChevronDown className="h-3.5 w-3.5 text-[#8E8E93]" />
      </button>

      {open && (
        <div className="absolute right-0 top-11 z-50 w-44 rounded-ios-lg border border-border bg-white dark:bg-[#1C1C1E] shadow-ios-md overflow-hidden">
          <div className="p-1">
            <button
              onClick={() => { onExportCsv(); setOpen(false); }}
              className="flex w-full items-center gap-2 rounded-lg px-3 py-2 text-left text-sm hover:bg-accent/40 transition-colors"
            >
              <FileText className="h-4 w-4 text-[#8E8E93]" />
              Esporta CSV
            </button>
            <button
              onClick={() => { onExportPdf(); setOpen(false); }}
              className="flex w-full items-center gap-2 rounded-lg px-3 py-2 text-left text-sm hover:bg-accent/40 transition-colors"
            >
              <Download className="h-4 w-4 text-[#8E8E93]" />
              Esporta PDF
            </button>
          </div>
        </div>
      )}
    </div>
  );
}

// ── Metric card ───────────────────────────────────────────────────────────────

function MetricCard({
  label,
  value,
  icon: Icon,
  iconBg,
  trendPercent,
  trendLabel,
}: {
  label: string;
  value: number;
  icon: React.ElementType;
  iconBg: string;
  trendPercent: number | null;
  trendLabel: string;
}) {
  const animated = useCountUp(value);
  const isPositive = trendPercent !== null && trendPercent >= 0;

  return (
    <div className="rounded-ios-lg shadow-ios-sm bg-white dark:bg-[#1C1C1E] p-5 flex flex-col gap-3">
      <div className="flex items-start justify-between">
        <div
          className="flex h-10 w-10 items-center justify-center rounded-full"
          style={{ background: iconBg }}
        >
          <Icon className="h-5 w-5" style={{ color: iconBg.replace("/10", "").replace("rgba(", "").split(",")[0] }} />
        </div>
        {trendPercent !== null && (
          <div className={`flex items-center gap-1 text-xs font-medium ${isPositive ? "text-[#34C759]" : "text-[#FF3B30]"}`}>
            {isPositive ? <TrendingUp className="h-3.5 w-3.5" /> : <TrendingDown className="h-3.5 w-3.5" />}
            {Math.abs(trendPercent)}%
          </div>
        )}
      </div>
      <div>
        <p className="text-3xl font-bold tabular-nums">{animated}</p>
        <p className="text-sm text-[#8E8E93] mt-0.5">{label}</p>
      </div>
      {trendPercent !== null && (
        <p className="text-xs text-[#8E8E93]">{trendLabel}</p>
      )}
    </div>
  );
}

// ── QualityBar ────────────────────────────────────────────────────────────────

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
  const color = isGood ? "#34C759" : isMedium ? "#FF9500" : "#FF3B30";

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

// ── iOS-styled axis tick ──────────────────────────────────────────────────────

function IosAxisTick(props: Record<string, unknown>) {
  const { x, y, payload } = props as { x: number; y: number; payload: { value: string } };
  return (
    <text x={x} y={y} dy={4} textAnchor="middle" fill="#8E8E93" fontSize={10}>
      {payload.value}
    </text>
  );
}

function IosYAxisTick(props: Record<string, unknown>) {
  const { x, y, payload } = props as { x: number; y: number; payload: { value: string } };
  return (
    <text x={x} y={y} dy={4} textAnchor="end" fill="#8E8E93" fontSize={10}>
      {payload.value}
    </text>
  );
}

// ── iOS chart card wrapper ────────────────────────────────────────────────────

function ChartCard({ title, children, className }: { title: string; children: React.ReactNode; className?: string }) {
  return (
    <section className={`rounded-ios-lg shadow-ios-sm bg-white dark:bg-[#1C1C1E] p-6 ${className ?? ""}`}>
      <h2 className="text-sm font-semibold mb-4">{title}</h2>
      {children}
    </section>
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

  // ── Date range state ──────────────────────────────────────────────────────

  const [dateRange, setDateRange] = useState<DateRange>(() => getQuickRange("month"));

  // ── Toast state ───────────────────────────────────────────────────────────

  const [toast, setToast] = useState<string | null>(null);
  const showToast = (msg: string) => {
    setToast(msg);
    setTimeout(() => setToast(null), 3000);
  };

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

  // Count tasks completed in the last week for trend
  const oneWeekAgo = useMemo(() => { const d = new Date(); d.setDate(d.getDate() - 7); return d; }, []);
  const twoWeeksAgo = useMemo(() => { const d = new Date(); d.setDate(d.getDate() - 14); return d; }, []);

  const completedThisWeek = useMemo(
    () => completedTasks.filter((t) => new Date(t.updated_at) >= oneWeekAgo).length,
    [completedTasks, oneWeekAgo]
  );
  const completedLastWeek = useMemo(
    () => completedTasks.filter((t) => {
      const d = new Date(t.updated_at);
      return d >= twoWeeksAgo && d < oneWeekAgo;
    }).length,
    [completedTasks, oneWeekAgo, twoWeeksAgo]
  );
  const completedTrend = completedLastWeek > 0
    ? Math.round(((completedThisWeek - completedLastWeek) / completedLastWeek) * 100)
    : null;

  // PRs opened this week vs last week (approximated by in_review status changes)
  const inReviewThisWeek = useMemo(
    () => tasks.filter((t) => (t.status === "in_review" || t.status === "review_pending") && new Date(t.updated_at) >= oneWeekAgo).length,
    [tasks, oneWeekAgo]
  );
  const inReviewLastWeek = useMemo(
    () => tasks.filter((t) => {
      const d = new Date(t.updated_at);
      return (t.status === "in_review" || t.status === "review_pending") && d >= twoWeeksAgo && d < oneWeekAgo;
    }).length,
    [tasks, oneWeekAgo, twoWeeksAgo]
  );
  const inReviewTrend = inReviewLastWeek > 0
    ? Math.round(((inReviewThisWeek - inReviewLastWeek) / inReviewLastWeek) * 100)
    : null;

  const activeAgentsCount = agents.length;

  const sprintCycleTimes = completedSprints.filter((s) => s.avg_cycle_time_minutes != null);
  const avgCycleTimeMin =
    sprintCycleTimes.length > 0
      ? Math.round(
          sprintCycleTimes.reduce((acc, s) => acc + s.avg_cycle_time_minutes!, 0) /
            sprintCycleTimes.length
        )
      : 0;

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

  // Line chart — task completate nel tempo (weekly throughput)
  const lineChartData = weeklyThroughput.map((w) => ({
    name: w.label,
    Completate: w.completed,
  }));

  // Bar chart — task per giorno (last 7 days)
  const taskPerDayData = useMemo(() => {
    const days: { name: string; Task: number }[] = [];
    for (let i = 6; i >= 0; i--) {
      const d = new Date();
      d.setDate(d.getDate() - i);
      const label = d.toLocaleDateString("it-IT", { weekday: "short" });
      const count = tasks.filter((t) => isSameDay(new Date(t.updated_at), d)).length;
      days.push({ name: label, Task: count });
    }
    return days;
  }, [tasks]);

  // Donut chart — distribuzione status
  const statusCountMap: Record<string, number> = {};
  tasks.forEach((t) => {
    statusCountMap[t.status] = (statusCountMap[t.status] ?? 0) + 1;
  });
  const statusDonutData = Object.entries(statusCountMap)
    .map(([name, value]) => ({ name, value, label: STATUS_LABELS[name] ?? name }))
    .sort((a, b) => b.value - a.value);

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

  const reworkBucketColors = [IOS_GREEN, IOS_ORANGE, IOS_RED] as const;

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

  // ── Export ────────────────────────────────────────────────────────────────

  const handleExportCsv = () => {
    const rows: string[][] = [
      ["Titolo", "Tipo", "Status", "Priorità", "Sprint", "Agente", "Rework", "Creata il"],
    ];
    filteredTasks.forEach((t) => {
      const sprint = sprints.find((s) => s.id === t.sprint_id);
      const agent = agents.find((a) => a.id === t.assigned_agent_id);
      rows.push([
        t.title,
        t.type ?? "",
        STATUS_LABELS[t.status] ?? t.status,
        t.priority ?? "",
        sprint?.name ?? "Backlog",
        agent?.name ?? "",
        String(t.rework_count),
        new Date(t.created_at).toLocaleDateString("it-IT"),
      ]);
    });
    const csv = rows.map((r) => r.map((c) => `"${c.replace(/"/g, '""')}"`).join(",")).join("\n");
    const blob = new Blob([csv], { type: "text/csv;charset=utf-8;" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `reports-${new Date().toISOString().slice(0, 10)}.csv`;
    a.click();
    URL.revokeObjectURL(url);
  };

  const handleExportPdf = () => {
    showToast("Funzionalità in arrivo");
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
        <div className="flex flex-wrap items-center justify-between gap-3">
          <h1 className="text-2xl font-bold">Reports</h1>
        </div>
        <div className="rounded-ios-lg border border-dashed border-border p-16 text-center">
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
      <div className="flex flex-wrap items-center justify-between gap-3">
        <h1 className="text-2xl font-bold">Reports</h1>
        <div className="flex items-center gap-2">
          <DateRangePicker range={dateRange} onChange={setDateRange} />
          <ExportDropdown onExportCsv={handleExportCsv} onExportPdf={handleExportPdf} />
        </div>
      </div>

      {/* ── Metric cards ─────────────────────────────────────────────────── */}
      <div className="grid gap-4 grid-cols-1 sm:grid-cols-2 lg:grid-cols-4">
        <MetricCard
          label="Task completate"
          value={totalCompleted}
          icon={CheckSquare}
          iconBg={`${IOS_GREEN}1A`}
          trendPercent={completedTrend}
          trendLabel="vs settimana scorsa"
        />
        <MetricCard
          label="PR aperte"
          value={inReviewThisWeek + tasks.filter((t) => t.status === "in_review" || t.status === "review_pending").length}
          icon={GitPullRequest}
          iconBg={`${IOS_BLUE}1A`}
          trendPercent={inReviewTrend}
          trendLabel="vs settimana scorsa"
        />
        <MetricCard
          label="Tempo medio (min)"
          value={avgCycleTimeMin}
          icon={Clock}
          iconBg={`${IOS_ORANGE}1A`}
          trendPercent={null}
          trendLabel="vs settimana scorsa"
        />
        <MetricCard
          label="Agenti attivi"
          value={activeAgentsCount}
          icon={Bot}
          iconBg={`#8E8E931A`}
          trendPercent={null}
          trendLabel="vs settimana scorsa"
        />
      </div>

      {/* ── Line chart (full width) ──────────────────────────────────────── */}
      <ChartCard title="Task completate nel tempo">
        <ResponsiveContainer width="100%" height={220}>
          <AreaChart data={lineChartData} margin={{ top: 4, right: 4, bottom: 0, left: -20 }}>
            <defs>
              <linearGradient id="areaGradient" x1="0" y1="0" x2="0" y2="1">
                <stop offset="0%" stopColor={IOS_BLUE} stopOpacity={0.15} />
                <stop offset="100%" stopColor={IOS_BLUE} stopOpacity={0} />
              </linearGradient>
            </defs>
            <CartesianGrid strokeDasharray="" stroke={IOS_GRID_COLOR} vertical={false} />
            <XAxis dataKey="name" tick={<IosAxisTick />} axisLine={false} tickLine={false} interval={2} />
            <YAxis tick={<IosYAxisTick />} axisLine={false} tickLine={false} allowDecimals={false} />
            <Tooltip
              contentStyle={TOOLTIP_STYLE}
              cursor={{ stroke: IOS_BLUE, strokeWidth: 1, strokeDasharray: "4 2" }}
            />
            <Area
              type="monotone"
              dataKey="Completate"
              stroke={IOS_BLUE}
              strokeWidth={2}
              fill="url(#areaGradient)"
              dot={false}
              activeDot={{ r: 5, fill: IOS_BLUE, stroke: "white", strokeWidth: 2 }}
            />
          </AreaChart>
        </ResponsiveContainer>
      </ChartCard>

      {/* ── Bar + Donut charts (half width each) ─────────────────────────── */}
      <div className="grid gap-6 lg:grid-cols-2">
        <ChartCard title="Task per giorno">
          <ResponsiveContainer width="100%" height={220}>
            <BarChart data={taskPerDayData} margin={{ top: 4, right: 4, bottom: 0, left: -20 }}>
              <CartesianGrid strokeDasharray="" stroke={IOS_GRID_COLOR} vertical={false} />
              <XAxis dataKey="name" tick={<IosAxisTick />} axisLine={false} tickLine={false} />
              <YAxis tick={<IosYAxisTick />} axisLine={false} tickLine={false} allowDecimals={false} />
              <Tooltip contentStyle={TOOLTIP_STYLE} />
              <Bar dataKey="Task" fill={IOS_BLUE} radius={[4, 4, 0, 0]} />
            </BarChart>
          </ResponsiveContainer>
        </ChartCard>

        <ChartCard title="Distribuzione status">
          {statusDonutData.length > 0 ? (
            <div className="flex flex-col items-center gap-4">
              <ResponsiveContainer width="100%" height={180}>
                <PieChart>
                  <Pie
                    data={statusDonutData}
                    cx="50%"
                    cy="50%"
                    innerRadius={52}
                    outerRadius={80}
                    paddingAngle={2}
                    dataKey="value"
                    stroke="none"
                  >
                    {statusDonutData.map((entry) => (
                      <Cell key={entry.name} fill={STATUS_DONUT_COLORS[entry.name] ?? "#8E8E93"} />
                    ))}
                  </Pie>
                  <Tooltip contentStyle={TOOLTIP_STYLE} />
                </PieChart>
              </ResponsiveContainer>
              <div className="flex flex-wrap justify-center gap-x-4 gap-y-2">
                {statusDonutData.slice(0, 6).map((entry) => {
                  const total = statusDonutData.reduce((acc, e) => acc + e.value, 0);
                  const pct = total > 0 ? Math.round((entry.value / total) * 100) : 0;
                  return (
                    <div key={entry.name} className="flex items-center gap-1.5 text-xs">
                      <span
                        className="h-2.5 w-2.5 shrink-0 rounded-full"
                        style={{ background: STATUS_DONUT_COLORS[entry.name] ?? "#8E8E93" }}
                      />
                      <span className="text-[#8E8E93]">{entry.label}</span>
                      <span className="font-medium tabular-nums">{pct}%</span>
                    </div>
                  );
                })}
              </div>
            </div>
          ) : (
            <div className="flex h-40 items-center justify-center text-sm text-muted-foreground">
              Nessun dato.
            </div>
          )}
        </ChartCard>
      </div>

      {/* ── Throughput + Cycle time ──────────────────────────────────────── */}
      <div className="grid gap-6 lg:grid-cols-2">
        <ChartCard title="Throughput settimanale">
          <p className="mt-0.5 mb-5 text-xs text-[#8E8E93]">
            Task completate e fallite nelle ultime 12 settimane
          </p>
          <ResponsiveContainer width="100%" height={220}>
            <BarChart data={weeklyThroughput} margin={{ top: 0, right: 4, bottom: 0, left: -20 }}>
              <CartesianGrid strokeDasharray="" stroke={IOS_GRID_COLOR} vertical={false} />
              <XAxis dataKey="label" tick={<IosAxisTick />} axisLine={false} tickLine={false} interval={2} />
              <YAxis tick={<IosYAxisTick />} axisLine={false} tickLine={false} allowDecimals={false} />
              <Tooltip contentStyle={TOOLTIP_STYLE} />
              <Legend iconType="circle" iconSize={8} wrapperStyle={{ fontSize: 12 }} />
              <Bar dataKey="completed" name="Completate" fill={IOS_GREEN} radius={[4, 4, 0, 0]} />
              <Bar dataKey="failed" name="Fallite" fill={IOS_RED} radius={[4, 4, 0, 0]} />
            </BarChart>
          </ResponsiveContainer>
        </ChartCard>

        {cycleTimeData.length > 0 ? (
          <ChartCard title="Cycle time per sprint">
            <p className="mt-0.5 mb-5 text-xs text-[#8E8E93]">
              Minuti medi dall&apos;inizio alla fine di una task
            </p>
            <ResponsiveContainer width="100%" height={220}>
              <LineChart data={cycleTimeData} margin={{ top: 0, right: 4, bottom: 0, left: -20 }}>
                <CartesianGrid strokeDasharray="" stroke={IOS_GRID_COLOR} vertical={false} />
                <XAxis dataKey="name" tick={<IosAxisTick />} axisLine={false} tickLine={false} />
                <YAxis tick={<IosYAxisTick />} axisLine={false} tickLine={false} allowDecimals={false} />
                <Tooltip contentStyle={TOOLTIP_STYLE} />
                <Line
                  type="monotone"
                  dataKey="Cycle time (min)"
                  stroke={IOS_BLUE}
                  strokeWidth={2}
                  dot={false}
                  activeDot={{ r: 5, fill: IOS_BLUE, stroke: "white", strokeWidth: 2 }}
                />
              </LineChart>
            </ResponsiveContainer>
          </ChartCard>
        ) : (
          <ChartCard title="Cycle time per sprint">
            <div className="flex h-40 items-center justify-center text-sm text-muted-foreground">
              Disponibile dopo il primo sprint completato.
            </div>
          </ChartCard>
        )}
      </div>

      {/* ── Sprint Velocity ──────────────────────────────────────────────── */}
      {velocityData.length > 0 && (
        <ChartCard title="Velocità per sprint">
          <p className="mt-0.5 mb-5 text-xs text-[#8E8E93]">
            Task totali, completate e fallite per ogni sprint completato
          </p>
          <ResponsiveContainer width="100%" height={260}>
            <BarChart data={velocityData} margin={{ top: 0, right: 4, bottom: 0, left: -20 }}>
              <CartesianGrid strokeDasharray="" stroke={IOS_GRID_COLOR} vertical={false} />
              <XAxis dataKey="name" tick={<IosAxisTick />} axisLine={false} tickLine={false} />
              <YAxis tick={<IosYAxisTick />} axisLine={false} tickLine={false} allowDecimals={false} />
              <Tooltip contentStyle={TOOLTIP_STYLE} />
              <Legend iconType="circle" iconSize={8} wrapperStyle={{ fontSize: 12 }} />
              <Bar dataKey="Totali" fill="#8E8E93" radius={[4, 4, 0, 0]} />
              <Bar dataKey="Completate" fill={IOS_GREEN} radius={[4, 4, 0, 0]} />
              <Bar dataKey="Fallite" fill={IOS_RED} radius={[4, 4, 0, 0]} />
            </BarChart>
          </ResponsiveContainer>
        </ChartCard>
      )}

      {/* ── Quality signals + Type distribution ─────────────────────────── */}
      <div className="grid gap-6 lg:grid-cols-2">
        <ChartCard title="Segnali di qualità">
          <p className="mt-0.5 mb-6 text-xs text-[#8E8E93]">
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
        </ChartCard>

        {typeData.length > 0 && (
          <ChartCard title="Distribuzione per tipo">
            <p className="mt-0.5 mb-5 text-xs text-[#8E8E93]">
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
                    stroke="none"
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
                    <span className="capitalize text-[#8E8E93]">{entry.name}</span>
                    <span className="ml-auto font-medium tabular-nums">{entry.value}</span>
                  </div>
                ))}
              </div>
            </div>
          </ChartCard>
        )}
      </div>

      {/* ── Priority + Rework distribution ──────────────────────────────── */}
      <div className="grid gap-6 lg:grid-cols-2">
        {priorityData.length > 0 && (
          <ChartCard title="Distribuzione priorità">
            <p className="mt-0.5 mb-5 text-xs text-[#8E8E93]">Task per livello di priorità</p>
            <ResponsiveContainer width="100%" height={Math.max(120, priorityData.length * 44)}>
              <BarChart
                data={priorityData}
                layout="vertical"
                margin={{ top: 0, right: 8, bottom: 0, left: 8 }}
              >
                <CartesianGrid strokeDasharray="" stroke={IOS_GRID_COLOR} horizontal={false} />
                <XAxis type="number" tick={{ fontSize: 10, fill: "#8E8E93" }} axisLine={false} tickLine={false} allowDecimals={false} />
                <YAxis dataKey="name" type="category" tick={{ fontSize: 10, fill: "#8E8E93" }} axisLine={false} tickLine={false} width={64} />
                <Tooltip contentStyle={TOOLTIP_STYLE} />
                <Bar dataKey="count" name="Task" radius={[0, 4, 4, 0]}>
                  {priorityData.map((entry) => (
                    <Cell key={entry.name} fill={PRIORITY_COLORS[entry.name] ?? "#6b7280"} />
                  ))}
                </Bar>
              </BarChart>
            </ResponsiveContainer>
          </ChartCard>
        )}

        {reworkBuckets.length > 0 && (
          <ChartCard title="Distribuzione cicli rework">
            <p className="mt-0.5 mb-5 text-xs text-[#8E8E93]">
              Quante task hanno richiesto rework (su task completate)
            </p>
            <ResponsiveContainer width="100%" height={Math.max(120, reworkBuckets.length * 44)}>
              <BarChart
                data={reworkBuckets}
                layout="vertical"
                margin={{ top: 0, right: 8, bottom: 0, left: 8 }}
              >
                <CartesianGrid strokeDasharray="" stroke={IOS_GRID_COLOR} horizontal={false} />
                <XAxis type="number" tick={{ fontSize: 10, fill: "#8E8E93" }} axisLine={false} tickLine={false} allowDecimals={false} />
                <YAxis dataKey="name" type="category" tick={{ fontSize: 10, fill: "#8E8E93" }} axisLine={false} tickLine={false} width={72} />
                <Tooltip contentStyle={TOOLTIP_STYLE} />
                <Bar dataKey="count" name="Task" radius={[0, 4, 4, 0]}>
                  {reworkBuckets.map((_, i) => (
                    <Cell key={i} fill={reworkBucketColors[i] ?? "#6b7280"} />
                  ))}
                </Bar>
              </BarChart>
            </ResponsiveContainer>
          </ChartCard>
        )}
      </div>

      {/* ── Repository distribution ──────────────────────────────────────── */}
      {repoData.length > 0 && (
        <ChartCard title="Task per repository">
          <p className="mt-0.5 mb-5 text-xs text-[#8E8E93]">
            Distribuzione del carico tra i repository abilitati
          </p>
          <ResponsiveContainer width="100%" height={Math.max(180, repoData.length * 44)}>
            <BarChart
              data={repoData}
              layout="vertical"
              margin={{ top: 0, right: 8, bottom: 0, left: 8 }}
            >
              <CartesianGrid strokeDasharray="" stroke={IOS_GRID_COLOR} horizontal={false} />
              <XAxis type="number" tick={{ fontSize: 10, fill: "#8E8E93" }} axisLine={false} tickLine={false} allowDecimals={false} />
              <YAxis dataKey="name" type="category" tick={{ fontSize: 10, fill: "#8E8E93" }} axisLine={false} tickLine={false} width={120} />
              <Tooltip
                contentStyle={TOOLTIP_STYLE}
                formatter={(value) => [value, "Task"]}
                labelFormatter={(label) => {
                  const repo = repoData.find((r) => r.name === label);
                  return repo?.full_name ?? label;
                }}
              />
              <Bar dataKey="Task" fill={IOS_BLUE} radius={[0, 4, 4, 0]} />
            </BarChart>
          </ResponsiveContainer>
        </ChartCard>
      )}

      {/* ── Agent performance table ──────────────────────────────────────── */}
      {agentStats.length > 0 && (
        <section className="rounded-ios-lg shadow-ios-sm bg-white dark:bg-[#1C1C1E]">
          <div className="px-5 py-4 border-b border-border">
            <h2 className="text-sm font-semibold">Performance agenti</h2>
            <p className="mt-0.5 text-xs text-[#8E8E93]">Metriche aggregate per agente</p>
          </div>
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-border bg-muted/30">
                  <th className="px-5 py-2.5 text-left font-medium text-[#8E8E93]">Agente</th>
                  <th className="px-5 py-2.5 text-right font-medium text-[#8E8E93]">Totale</th>
                  <th className="px-5 py-2.5 text-right font-medium text-[#8E8E93]">Completate</th>
                  <th className="px-5 py-2.5 text-right font-medium text-[#8E8E93]">Tasso successo</th>
                  <th className="px-5 py-2.5 text-right font-medium text-[#8E8E93]">Rework %</th>
                  <th className="px-5 py-2.5 text-right font-medium text-[#8E8E93] hidden lg:table-cell">Cicli medi</th>
                  <th className="px-5 py-2.5 text-right font-medium text-[#8E8E93] hidden lg:table-cell">Fallite</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-border">
                {[...agentStats]
                  .sort((a, b) => b.completed - a.completed)
                  .map((stat) => {
                    const agent = agents.find((a) => a.id === stat.agent_id);
                    return (
                      <tr key={stat.agent_id} className="hover:bg-accent/30 transition-colors">
                        <td className="px-5 py-3 font-medium">
                          {agent?.name ?? <span className="italic text-muted-foreground">Agente sconosciuto</span>}
                        </td>
                        <td className="px-5 py-3 text-right tabular-nums text-muted-foreground">{stat.total}</td>
                        <td className="px-5 py-3 text-right tabular-nums font-medium">{stat.completed}</td>
                        <td className="px-5 py-3 text-right tabular-nums">
                          {stat.success_rate !== null ? (
                            <span className="font-medium" style={{ color: stat.success_rate >= 70 ? IOS_GREEN : stat.success_rate >= 50 ? IOS_ORANGE : IOS_RED }}>
                              {stat.success_rate}%
                            </span>
                          ) : "—"}
                        </td>
                        <td className="px-5 py-3 text-right tabular-nums">
                          {stat.rework_rate !== null ? (
                            <span className="font-medium" style={{ color: stat.rework_rate <= 20 ? IOS_GREEN : stat.rework_rate <= 40 ? IOS_ORANGE : IOS_RED }}>
                              {stat.rework_rate}%
                            </span>
                          ) : "—"}
                        </td>
                        <td className="px-5 py-3 text-right tabular-nums text-muted-foreground hidden lg:table-cell">{stat.avg_rework}</td>
                        <td className="px-5 py-3 text-right tabular-nums text-muted-foreground hidden lg:table-cell">{stat.failed}</td>
                      </tr>
                    );
                  })}
              </tbody>
            </table>
          </div>
        </section>
      )}

      {/* ── Task table ───────────────────────────────────────────────────── */}
      <section className="rounded-ios-lg shadow-ios-sm bg-white dark:bg-[#1C1C1E]">
        <div className="flex flex-wrap items-center justify-between gap-3 px-5 py-4 border-b border-border">
          <h2 className="text-sm font-semibold">Lista task ({filteredTasks.length})</h2>
          <div className="flex flex-wrap items-center gap-2">
            <CustomSelect value={filterType} onChange={setFilterType} options={typeOptions} className="w-40" />
            <CustomSelect value={filterSprint} onChange={setFilterSprint} options={sprintOptions} className="w-48" />
            {agents.length > 0 && (
              <CustomSelect value={filterAgent} onChange={setFilterAgent} options={agentOptions} className="w-44" />
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
                  <th className="w-10 px-4 py-2.5">
                    <input type="checkbox" checked={allFilteredSelected} onChange={toggleSelectAll} className="cursor-pointer accent-primary" aria-label="Seleziona tutte" />
                  </th>
                  <th className="px-4 py-2.5 text-left font-medium text-[#8E8E93]">Titolo</th>
                  <th className="px-4 py-2.5 text-left font-medium text-[#8E8E93] hidden sm:table-cell">Tipo</th>
                  <th className="px-4 py-2.5 text-left font-medium text-[#8E8E93] hidden md:table-cell">Status</th>
                  <th className="px-4 py-2.5 text-left font-medium text-[#8E8E93] hidden lg:table-cell">Sprint</th>
                  <th className="px-4 py-2.5 text-right font-medium text-[#8E8E93] hidden lg:table-cell">Rework</th>
                  <th className="px-4 py-2.5 text-left font-medium text-[#8E8E93] hidden xl:table-cell">Agente</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-border">
                {filteredTasks.map((task) => {
                  const sprint = sprints.find((s) => s.id === task.sprint_id);
                  const agent = agents.find((a) => a.id === task.assigned_agent_id);
                  return (
                    <tr key={task.id} className="hover:bg-accent/30 transition-colors">
                      <td className="w-10 px-4 py-2.5">
                        <input type="checkbox" checked={selectedIds.has(task.id)} onChange={() => toggleSelect(task.id)} className="cursor-pointer accent-primary" aria-label={`Seleziona ${task.title}`} />
                      </td>
                      <td className="px-4 py-2.5 font-medium text-foreground max-w-xs truncate">
                        <Link href={`/tasks/${task.id}`} className="hover:underline">{task.title}</Link>
                      </td>
                      <td className="px-4 py-2.5 hidden sm:table-cell">
                        {task.type ? (
                          <span className="inline-flex items-center rounded-full px-2 py-0.5 text-xs font-medium text-white" style={{ background: TYPE_COLORS[task.type] ?? "#6b7280" }}>
                            {task.type}
                          </span>
                        ) : <span className="text-muted-foreground">—</span>}
                      </td>
                      <td className="px-4 py-2.5 text-muted-foreground hidden md:table-cell">{STATUS_LABELS[task.status] ?? task.status}</td>
                      <td className="px-4 py-2.5 text-muted-foreground hidden lg:table-cell">{sprint?.name ?? <span className="italic text-xs">Backlog</span>}</td>
                      <td className="px-4 py-2.5 text-right tabular-nums hidden lg:table-cell">
                        {task.rework_count > 0 ? <span className="text-orange-500 font-medium">{task.rework_count}</span> : <span className="text-muted-foreground">0</span>}
                      </td>
                      <td className="px-4 py-2.5 text-muted-foreground hidden xl:table-cell">{agent?.name ?? <span className="italic text-xs">—</span>}</td>
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
          <div className="flex items-center gap-3 rounded-ios-lg border border-border bg-white dark:bg-[#1C1C1E] px-4 py-3 shadow-ios-md">
            <span className="text-sm font-medium text-foreground inline-flex items-center gap-2">
              {isSendingToBacklog && <span className="h-3.5 w-3.5 animate-spin rounded-full border-2 border-current border-t-transparent" />}
              {selectedIds.size} task {selectedIds.size === 1 ? "selezionata" : "selezionate"}
            </span>
            <div className="flex flex-1 items-center justify-end gap-2">
              <button onClick={() => setSelectedIds(new Set())} disabled={isSendingToBacklog} className="text-xs text-muted-foreground underline hover:text-foreground disabled:opacity-50">
                Deseleziona
              </button>
              <button onClick={() => void moveToBacklog()} disabled={isSendingToBacklog} className="rounded-ios-sm bg-primary px-3 py-1.5 text-xs font-medium text-primary-foreground hover:bg-primary/90 disabled:opacity-50">
                {isSendingToBacklog ? "Spostando..." : "Riporta in backlog"}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* ── Toast ────────────────────────────────────────────────────────── */}
      {toast !== null && (
        <div className="fixed bottom-6 left-1/2 -translate-x-1/2 z-50 rounded-ios-lg bg-[#1C1C1E] dark:bg-white px-4 py-2.5 text-sm font-medium text-white dark:text-[#1C1C1E] shadow-ios-md">
          {toast}
        </div>
      )}
    </div>
  );
}
