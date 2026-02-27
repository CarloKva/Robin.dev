import { createSupabaseServerClient } from "@/lib/supabase/server";

export type MetricsPeriod = "7d" | "30d" | "90d";

export type WorkspaceMetrics = {
  period: MetricsPeriod;
  periodStart: string;
  periodEnd: string;
  /** Average cycle time in minutes (task.created → task.completed) */
  avgCycleTimeMinutes: number | null;
  /** % of tasks completed without a fix(review): commit after PR opened */
  prApprovalRate: number | null;
  /** % of completed tasks that were blocked at least once */
  escalationRate: number | null;
  /**
   * % of tasks completed without rework (agent.commit.pushed after human.approved).
   * Only counts tasks that have a PR.
   */
  accuracyRate: number | null;
  completedCount: number;
  completedByType: Record<string, number>;
  failedCount: number;
  /** Cycle time of previous period, used for trend display */
  prevAvgCycleTimeMinutes: number | null;
  completedTasks: CompletedTaskMetric[];
  blockedTasks: BlockedTaskMetric[];
};

export type CompletedTaskMetric = {
  id: string;
  title: string;
  type: string;
  cycleTimeMinutes: number;
  completedAt: string;
};

export type BlockedTaskMetric = {
  id: string;
  title: string;
  type: string;
  blockedReason: string;
};

// ── Internal types ───────────────────────────────────────────────────────────

type TaskBucket = {
  createdAt: string | null;
  completedAt: string | null;
  failedAt: string | null;
  prOpenedAt: string | null;
  approvedAt: string | null;
  hasReviewFix: boolean;
  hasPostApprovalCommit: boolean;
  wasBlocked: boolean;
  blockedReason: string | null;
};

// ── Helpers ──────────────────────────────────────────────────────────────────

function periodStartDate(period: MetricsPeriod, from?: Date): Date {
  const base = from ?? new Date();
  const days = period === "7d" ? 7 : period === "30d" ? 30 : 90;
  const d = new Date(base);
  d.setDate(d.getDate() - days);
  return d;
}

function inPeriod(isoDate: string | null, start: Date, end: Date): boolean {
  if (!isoDate) return false;
  const d = new Date(isoDate);
  return d >= start && d <= end;
}

function cycleMins(b: TaskBucket): number | null {
  if (!b.createdAt || !b.completedAt) return null;
  return (new Date(b.completedAt).getTime() - new Date(b.createdAt).getTime()) / 60_000;
}

function filteredMean(values: number[]): number | null {
  if (values.length === 0) return null;
  const mean = values.reduce((a, b) => a + b, 0) / values.length;
  if (values.length < 2) return mean;
  const sd = Math.sqrt(values.reduce((a, v) => a + (v - mean) ** 2, 0) / values.length);
  const filtered = values.filter((v) => Math.abs(v - mean) <= 3 * sd);
  if (filtered.length === 0) return null;
  return filtered.reduce((a, b) => a + b, 0) / filtered.length;
}

// ── Core fetch + bucket ──────────────────────────────────────────────────────

async function fetchEventsAndBucket(
  workspaceId: string,
  from: Date,
  to: Date
): Promise<{
  buckets: Record<string, TaskBucket>;
  taskMeta: Record<string, { title: string; type: string }>;
}> {
  const supabase = await createSupabaseServerClient();

  const { data: events, error } = await supabase
    .from("task_events")
    .select("task_id, event_type, payload, created_at")
    .eq("workspace_id", workspaceId)
    .gte("created_at", from.toISOString())
    .lte("created_at", to.toISOString())
    .order("created_at", { ascending: true });

  if (error) throw new Error(`fetchEventsAndBucket failed: ${error.message}`);

  const taskIds = [...new Set((events ?? []).map((e) => e.task_id as string))];
  const taskMeta: Record<string, { title: string; type: string }> = {};

  if (taskIds.length > 0) {
    const { data: tasks } = await supabase
      .from("tasks")
      .select("id, title, type")
      .in("id", taskIds);
    for (const t of tasks ?? []) {
      taskMeta[t.id as string] = {
        title: t.title as string,
        type: (t.type ?? "feature") as string,
      };
    }
  }

  const buckets: Record<string, TaskBucket> = {};

  function getBucket(taskId: string): TaskBucket {
    if (!buckets[taskId]) {
      buckets[taskId] = {
        createdAt: null,
        completedAt: null,
        failedAt: null,
        prOpenedAt: null,
        approvedAt: null,
        hasReviewFix: false,
        hasPostApprovalCommit: false,
        wasBlocked: false,
        blockedReason: null,
      };
    }
    return buckets[taskId]!;
  }

  for (const e of events ?? []) {
    const taskId = e.task_id as string;
    const b = getBucket(taskId);
    const payload = e.payload as Record<string, unknown>;
    const eventTime = e.created_at as string;

    switch (e.event_type as string) {
      case "task.created":
        b.createdAt = eventTime;
        break;
      case "task.completed":
        b.completedAt = eventTime;
        break;
      case "task.failed":
        b.failedAt = eventTime;
        break;
      case "agent.pr.opened":
        b.prOpenedAt = eventTime;
        break;
      case "human.approved":
        // Record when PR was approved (last approved event wins)
        b.approvedAt = eventTime;
        break;
      case "agent.commit.pushed": {
        const msg = (payload["message"] as string | undefined) ?? "";
        // Review-fix: commit with fix(review): after PR was opened
        if (b.prOpenedAt && /^fix\(review\):/i.test(msg)) {
          b.hasReviewFix = true;
        }
        // Rework: any commit after human.approved
        if (b.approvedAt && eventTime > b.approvedAt) {
          b.hasPostApprovalCommit = true;
        }
        break;
      }
      case "agent.blocked":
        b.wasBlocked = true;
        b.blockedReason = (payload["question"] as string | undefined) ?? null;
        break;
    }
  }

  return { buckets, taskMeta };
}

// ── Core computation ─────────────────────────────────────────────────────────

function computeForPeriod(
  buckets: Record<string, TaskBucket>,
  taskMeta: Record<string, { title: string; type: string }>,
  periodStart: Date,
  periodEnd: Date
): {
  completedCount: number;
  failedCount: number;
  completedByType: Record<string, number>;
  cycleTimes: number[];
  completedTasks: CompletedTaskMetric[];
  blockedTasks: BlockedTaskMetric[];
  prApprovalNum: number;
  prApprovalDenom: number;
  escalationNum: number;
  accuracyNum: number;
  accuracyDenom: number;
} {
  let completedCount = 0;
  let failedCount = 0;
  let prApprovalNum = 0;
  let prApprovalDenom = 0;
  let escalationNum = 0;
  let accuracyNum = 0;
  let accuracyDenom = 0;
  const completedByType: Record<string, number> = {};
  const cycleTimes: number[] = [];
  const completedTasks: CompletedTaskMetric[] = [];
  const blockedTasks: BlockedTaskMetric[] = [];

  for (const [taskId, b] of Object.entries(buckets)) {
    const meta = taskMeta[taskId] ?? { title: "Unknown", type: "feature" };

    if (inPeriod(b.completedAt, periodStart, periodEnd)) {
      completedCount++;
      completedByType[meta.type] = (completedByType[meta.type] ?? 0) + 1;

      const ct = cycleMins(b);
      if (ct !== null) {
        cycleTimes.push(ct);
        completedTasks.push({
          id: taskId,
          title: meta.title,
          type: meta.type,
          cycleTimeMinutes: Math.round(ct),
          completedAt: b.completedAt!,
        });
      }

      if (b.prOpenedAt) {
        // PR approval rate
        prApprovalDenom++;
        if (!b.hasReviewFix) prApprovalNum++;

        // Accuracy rate (no post-approval rework)
        accuracyDenom++;
        if (!b.hasPostApprovalCommit) accuracyNum++;
      }

      if (b.wasBlocked) {
        escalationNum++;
        if (b.blockedReason) {
          blockedTasks.push({
            id: taskId,
            title: meta.title,
            type: meta.type,
            blockedReason: b.blockedReason,
          });
        }
      }
    }

    if (inPeriod(b.failedAt, periodStart, periodEnd)) {
      failedCount++;
    }
  }

  return {
    completedCount,
    failedCount,
    completedByType,
    cycleTimes,
    completedTasks: completedTasks.sort(
      (a, b) => new Date(b.completedAt).getTime() - new Date(a.completedAt).getTime()
    ),
    blockedTasks,
    prApprovalNum,
    prApprovalDenom,
    escalationNum,
    accuracyNum,
    accuracyDenom,
  };
}

// ── Public API ───────────────────────────────────────────────────────────────

export async function getWorkspaceMetrics(
  workspaceId: string,
  period: MetricsPeriod
): Promise<WorkspaceMetrics> {
  const now = new Date();
  const periodStart = periodStartDate(period);
  const prevPeriodStart = periodStartDate(period, periodStart);

  // Fetch events covering both current and previous period (for trend)
  const { buckets, taskMeta } = await fetchEventsAndBucket(workspaceId, prevPeriodStart, now);

  const curr = computeForPeriod(buckets, taskMeta, periodStart, now);
  const prev = computeForPeriod(buckets, taskMeta, prevPeriodStart, periodStart);

  const avgCycleTimeMinutes = filteredMean(curr.cycleTimes);
  const prevAvgCycleTimeMinutes = filteredMean(prev.cycleTimes);

  return {
    period,
    periodStart: periodStart.toISOString(),
    periodEnd: now.toISOString(),
    avgCycleTimeMinutes: avgCycleTimeMinutes !== null ? Math.round(avgCycleTimeMinutes) : null,
    prevAvgCycleTimeMinutes:
      prevAvgCycleTimeMinutes !== null ? Math.round(prevAvgCycleTimeMinutes) : null,
    prApprovalRate:
      curr.prApprovalDenom > 0
        ? Math.round((curr.prApprovalNum / curr.prApprovalDenom) * 100)
        : null,
    escalationRate:
      curr.completedCount > 0
        ? Math.round((curr.escalationNum / curr.completedCount) * 100)
        : null,
    accuracyRate:
      curr.accuracyDenom > 0
        ? Math.round((curr.accuracyNum / curr.accuracyDenom) * 100)
        : null,
    completedCount: curr.completedCount,
    completedByType: curr.completedByType,
    failedCount: curr.failedCount,
    completedTasks: curr.completedTasks,
    blockedTasks: curr.blockedTasks,
  };
}

// ── Monthly report ───────────────────────────────────────────────────────────

export async function generateMonthlyReport(
  workspaceId: string,
  month: string // "YYYY-MM"
): Promise<string> {
  const [yearStr, monthStr] = month.split("-");
  const year = parseInt(yearStr ?? "2026");
  const mo = parseInt(monthStr ?? "1");

  // Exact calendar month boundaries
  const periodStart = new Date(year, mo - 1, 1);
  const periodEnd = new Date(year, mo, 0, 23, 59, 59); // last day of month

  // Look back 90 days before month start to capture task.created events
  // for tasks completed within the month
  const lookbackStart = new Date(periodStart);
  lookbackStart.setDate(lookbackStart.getDate() - 90);

  const { buckets, taskMeta } = await fetchEventsAndBucket(
    workspaceId,
    lookbackStart,
    periodEnd
  );

  const curr = computeForPeriod(buckets, taskMeta, periodStart, periodEnd);
  const avgCycleTimeMinutes = filteredMean(curr.cycleTimes);
  const prApprovalRate =
    curr.prApprovalDenom > 0
      ? Math.round((curr.prApprovalNum / curr.prApprovalDenom) * 100)
      : null;
  const escalationRate =
    curr.completedCount > 0
      ? Math.round((curr.escalationNum / curr.completedCount) * 100)
      : null;
  const accuracyRate =
    curr.accuracyDenom > 0
      ? Math.round((curr.accuracyNum / curr.accuracyDenom) * 100)
      : null;

  const lines: string[] = [];
  lines.push(`# Robin.dev — Report ${month}`);
  lines.push("");
  lines.push(
    `Periodo: ${periodStart.toLocaleDateString("it-IT")} – ${periodEnd.toLocaleDateString("it-IT")}`
  );
  lines.push("");
  lines.push("---");
  lines.push("");
  lines.push("## Riepilogo");
  lines.push("");
  lines.push("| Metrica | Valore |");
  lines.push("|---|---|");
  lines.push(`| Task completate | ${curr.completedCount} |`);
  lines.push(`| Task fallite | ${curr.failedCount} |`);
  lines.push(
    `| Cycle time medio | ${avgCycleTimeMinutes !== null ? formatMinutes(Math.round(avgCycleTimeMinutes)) : "—"} |`
  );
  lines.push(`| PR approval rate | ${prApprovalRate !== null ? `${prApprovalRate}%` : "—"} |`);
  lines.push(`| Escalation rate | ${escalationRate !== null ? `${escalationRate}%` : "—"} |`);
  lines.push(`| Accuracy rate | ${accuracyRate !== null ? `${accuracyRate}%` : "—"} |`);
  lines.push("");

  if (Object.keys(curr.completedByType).length > 0) {
    lines.push("## Task completate per tipo");
    lines.push("");
    lines.push("| Tipo | Count |");
    lines.push("|---|---|");
    for (const [type, count] of Object.entries(curr.completedByType)) {
      lines.push(`| ${type} | ${count} |`);
    }
    lines.push("");
  }

  if (curr.completedTasks.length > 0) {
    lines.push("## Task completate");
    lines.push("");
    lines.push("| Titolo | Tipo | Cycle time | Completata il |");
    lines.push("|---|---|---|---|");
    for (const t of curr.completedTasks) {
      const dateStr = new Date(t.completedAt).toLocaleDateString("it-IT");
      lines.push(`| ${t.title} | ${t.type} | ${formatMinutes(t.cycleTimeMinutes)} | ${dateStr} |`);
    }
    lines.push("");
  }

  if (curr.blockedTasks.length > 0) {
    lines.push("## Task bloccate");
    lines.push("");
    lines.push("| Titolo | Tipo | Motivo blocco |");
    lines.push("|---|---|---|");
    for (const t of curr.blockedTasks) {
      lines.push(`| ${t.title} | ${t.type} | ${t.blockedReason} |`);
    }
    lines.push("");
  }

  lines.push("---");
  lines.push("");
  lines.push(`*Report generato da Robin.dev · ${new Date().toISOString()}*`);

  return lines.join("\n");
}

function formatMinutes(mins: number): string {
  if (mins < 60) return `${mins}m`;
  const h = Math.floor(mins / 60);
  const m = mins % 60;
  return m > 0 ? `${h}h ${m}m` : `${h}h`;
}
