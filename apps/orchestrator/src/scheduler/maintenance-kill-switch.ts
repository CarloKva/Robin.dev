import type { MaintenanceCapabilityId } from "@robin/shared-types";
import { getSupabaseClient } from "../db/supabase.client";
import { log } from "../utils/logger";

const DEFAULT_INTERVAL_MS = parseInt(
  process.env["MAINTENANCE_KILL_SWITCH_INTERVAL_MS"] ?? String(60 * 60 * 1000), // hourly check
  10
);

// Thresholds from the spec (sec 11 Kill Switch Criteria).
const FP_RATE_THRESHOLD = 0.30; // false-positive rate > 30%
const PR_MERGE_RATE_THRESHOLD = 0.50; // PR merge rate < 50%
const COST_PER_MERGED_PR_USD_THRESHOLD = 20.0; // cost per merged PR > $20

// "Any threshold breach for two consecutive weeks disables the capability
// definition globally until review."
const CONSECUTIVE_BREACH_WEEKS = 2;

/**
 * Weekly health review + kill switch for maintenance capabilities.
 *
 * Runs in the control-plane orchestrator alongside the maintenance scheduler.
 * The interval is hourly by default — the actual review writes one row per
 * `(capability, week_starting)` with ON CONFLICT DO UPDATE, so frequent runs
 * are cheap. When a capability breaches a threshold for two consecutive weeks
 * we flip `capability_definitions.is_globally_disabled = true` and the
 * scheduler stops queuing it for every workspace until a human flips it back.
 *
 * Dry-run mode: set MAINTENANCE_KILL_SWITCH_DRY_RUN=true to log breaches
 * without writing the global disable flag. We default to true so a freshly
 * deployed kill switch doesn't accidentally silence a capability during
 * onboarding when the dataset is small. Operators turn dry-run off
 * deliberately.
 */
export class MaintenanceKillSwitch {
  private timer: ReturnType<typeof setTimeout> | null = null;
  private running = false;
  private readonly dryRun =
    process.env["MAINTENANCE_KILL_SWITCH_DRY_RUN"] !== "false";
  private readonly intervalMs: number;

  constructor(intervalMs: number = DEFAULT_INTERVAL_MS) {
    this.intervalMs = intervalMs;
  }

  start(): void {
    if (this.running) return;
    this.running = true;
    log.info({ dryRun: this.dryRun, intervalMs: this.intervalMs }, "MaintenanceKillSwitch started");
    this.schedule(0);
  }

  stop(): void {
    this.running = false;
    if (this.timer) {
      clearTimeout(this.timer);
      this.timer = null;
    }
    log.info({}, "MaintenanceKillSwitch stopped");
  }

  private schedule(delayMs = this.intervalMs): void {
    this.timer = setTimeout(() => {
      this.tick()
        .catch((err) => log.error({ error: String(err) }, "MaintenanceKillSwitch tick failed"))
        .finally(() => {
          if (this.running) this.schedule();
        });
    }, delayMs);
  }

  private async tick(): Promise<void> {
    const capabilities = await this.listDiscoveryCapabilities();
    for (const cap of capabilities) {
      await this.reviewCapability(cap);
    }
  }

  private async listDiscoveryCapabilities(): Promise<MaintenanceCapabilityId[]> {
    // Kill switch tracks the discovery capabilities (they produce findings)
    // and the implementation capabilities separately. For Phase 4 we focus on
    // the four that exist; future capabilities will follow the same shape.
    return ["spec_discovery", "spec_impl", "bug_discovery", "bug_impl"];
  }

  private async reviewCapability(capabilityId: MaintenanceCapabilityId): Promise<void> {
    const weekStart = startOfWeekUtc(new Date());
    const lastWeekStart = new Date(weekStart);
    lastWeekStart.setUTCDate(weekStart.getUTCDate() - 7);

    const thisWeek = await this.computeWeek(capabilityId, weekStart);
    await this.persistReview(capabilityId, weekStart, thisWeek);

    // Look up the last two persisted weeks (this one + the previous one) to
    // check for consecutive breaches.
    const recent = await this.recentReviews(capabilityId, CONSECUTIVE_BREACH_WEEKS);
    const consecutiveBreach =
      recent.length === CONSECUTIVE_BREACH_WEEKS && recent.every((r) => r.any_breach);

    if (consecutiveBreach) {
      log.warn(
        {
          capabilityId,
          weeks: recent.map((r) => r.week_starting),
        },
        "MaintenanceKillSwitch consecutive-week breach detected"
      );
      if (!this.dryRun) {
        await this.disableCapability(
          capabilityId,
          `kill-switch: ${recent.length} consecutive weekly breaches as of ${weekStart.toISOString().slice(0, 10)}`
        );
      }
    }
  }

  private async computeWeek(
    capabilityId: MaintenanceCapabilityId,
    weekStart: Date
  ): Promise<WeekStats> {
    const weekEnd = new Date(weekStart);
    weekEnd.setUTCDate(weekStart.getUTCDate() + 7);

    const supabase = getSupabaseClient();

    // 1. Findings produced in the week, with rejected count.
    const findingsTable = capabilityId.startsWith("spec_") ? "spec_findings" : "bug_findings";
    const { data: findingsData } = await supabase
      .from(findingsTable)
      .select("id, triage_state, created_at, task_id")
      .gte("created_at", weekStart.toISOString())
      .lt("created_at", weekEnd.toISOString());
    const findings = (findingsData ?? []) as Array<{
      triage_state: string;
      task_id: string | null;
    }>;
    const total_findings = findings.length;
    const rejected_findings = findings.filter((f) => f.triage_state === "rejected").length;

    // 2. Cost from agent_runs in the week.
    const { data: runs } = await supabase
      .from("agent_runs")
      .select("cost_usd")
      .eq("capability_definition_id", capabilityId)
      .gte("created_at", weekStart.toISOString())
      .lt("created_at", weekEnd.toISOString());
    const total_cost_usd = (runs ?? []).reduce(
      (acc: number, row: { cost_usd?: number | null }) => acc + Number(row.cost_usd ?? 0),
      0
    );

    // 3. PRs opened/merged: implementation runs link a task via the finding;
    // we approximate "opened" by counting findings with task_id and "merged"
    // by counting tasks for those findings whose status reached 'done'.
    const findingTaskIds = findings
      .map((f) => f.task_id)
      .filter((t): t is string => typeof t === "string");
    let prs_opened = 0;
    let prs_merged = 0;
    if (findingTaskIds.length > 0) {
      const { data: tasks } = await supabase
        .from("tasks")
        .select("id, status")
        .in("id", findingTaskIds);
      const taskRows = (tasks ?? []) as Array<{ id: string; status: string }>;
      prs_opened = taskRows.filter((t) =>
        ["in_review", "done"].includes(t.status)
      ).length;
      prs_merged = taskRows.filter((t) => t.status === "done").length;
    }

    const fp_rate = total_findings > 0 ? rejected_findings / total_findings : null;
    const merge_rate = prs_opened > 0 ? prs_merged / prs_opened : null;
    const cost_per_merged =
      prs_merged > 0 ? total_cost_usd / prs_merged : null;

    return {
      total_findings,
      rejected_findings,
      prs_opened,
      prs_merged,
      total_cost_usd,
      false_positive_rate: fp_rate,
      pr_merge_rate: merge_rate,
      cost_per_merged_pr_usd: cost_per_merged,
      fp_rate_breach: fp_rate !== null && fp_rate > FP_RATE_THRESHOLD,
      merge_rate_breach:
        merge_rate !== null && prs_opened >= 4 && merge_rate < PR_MERGE_RATE_THRESHOLD,
      cost_breach:
        cost_per_merged !== null && cost_per_merged > COST_PER_MERGED_PR_USD_THRESHOLD,
    };
  }

  private async persistReview(
    capabilityId: MaintenanceCapabilityId,
    weekStart: Date,
    stats: WeekStats
  ): Promise<void> {
    const supabase = getSupabaseClient();
    const anyBreach = stats.fp_rate_breach || stats.merge_rate_breach || stats.cost_breach;
    const row = {
      capability_definition_id: capabilityId,
      week_starting: weekStart.toISOString().slice(0, 10),
      total_findings: stats.total_findings,
      rejected_findings: stats.rejected_findings,
      prs_opened: stats.prs_opened,
      prs_merged: stats.prs_merged,
      total_cost_usd: stats.total_cost_usd,
      false_positive_rate: stats.false_positive_rate,
      pr_merge_rate: stats.pr_merge_rate,
      cost_per_merged_pr_usd: stats.cost_per_merged_pr_usd,
      fp_rate_breach: stats.fp_rate_breach,
      merge_rate_breach: stats.merge_rate_breach,
      cost_breach: stats.cost_breach,
      any_breach: anyBreach,
    };
    const { error } = await supabase
      .from("capability_health_reviews")
      .upsert(row, { onConflict: "capability_definition_id,week_starting" });
    if (error) {
      log.warn(
        { capabilityId, weekStart, error: error.message },
        "MaintenanceKillSwitch persistReview failed"
      );
    }
  }

  private async recentReviews(
    capabilityId: MaintenanceCapabilityId,
    n: number
  ): Promise<Array<{ week_starting: string; any_breach: boolean }>> {
    const supabase = getSupabaseClient();
    const { data, error } = await supabase
      .from("capability_health_reviews")
      .select("week_starting, any_breach")
      .eq("capability_definition_id", capabilityId)
      .order("week_starting", { ascending: false })
      .limit(n);
    if (error) {
      log.warn(
        { capabilityId, error: error.message },
        "MaintenanceKillSwitch recentReviews failed"
      );
      return [];
    }
    return (data ?? []) as Array<{ week_starting: string; any_breach: boolean }>;
  }

  private async disableCapability(
    capabilityId: MaintenanceCapabilityId,
    reason: string
  ): Promise<void> {
    const supabase = getSupabaseClient();
    const { error } = await supabase
      .from("capability_definitions")
      .update({
        is_globally_disabled: true,
        globally_disabled_at: new Date().toISOString(),
        globally_disabled_reason: reason.slice(0, 500),
      })
      .eq("id", capabilityId)
      .eq("is_globally_disabled", false);
    if (error) {
      log.error(
        { capabilityId, error: error.message },
        "MaintenanceKillSwitch disableCapability failed"
      );
      return;
    }
    log.warn({ capabilityId, reason }, "MaintenanceKillSwitch DISABLED capability globally");
  }
}

type WeekStats = {
  total_findings: number;
  rejected_findings: number;
  prs_opened: number;
  prs_merged: number;
  total_cost_usd: number;
  false_positive_rate: number | null;
  pr_merge_rate: number | null;
  cost_per_merged_pr_usd: number | null;
  fp_rate_breach: boolean;
  merge_rate_breach: boolean;
  cost_breach: boolean;
};

/** ISO week start (Monday 00:00 UTC) of the date. */
export function startOfWeekUtc(date: Date): Date {
  const d = new Date(Date.UTC(date.getUTCFullYear(), date.getUTCMonth(), date.getUTCDate()));
  const day = d.getUTCDay(); // 0=Sun,1=Mon,...,6=Sat
  const offset = day === 0 ? 6 : day - 1;
  d.setUTCDate(d.getUTCDate() - offset);
  return d;
}

export const maintenanceKillSwitch = new MaintenanceKillSwitch();

// Threshold constants exported for tests.
export const KILL_SWITCH_THRESHOLDS = {
  FP_RATE: FP_RATE_THRESHOLD,
  PR_MERGE_RATE: PR_MERGE_RATE_THRESHOLD,
  COST_PER_MERGED_PR_USD: COST_PER_MERGED_PR_USD_THRESHOLD,
  CONSECUTIVE_BREACH_WEEKS,
};
