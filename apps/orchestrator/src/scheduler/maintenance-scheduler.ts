import type {
  AgentRunTrigger,
  MaintenanceCapabilityId,
  MaintenanceJobPayload,
  MaintenanceSchedule,
} from "@robin/shared-types";
import { getSupabaseClient } from "../db/supabase.client";
import { maintenanceQueue } from "../queues/maintenance.queue";
import { log } from "../utils/logger";
import { isInsideWindow, localDayBoundsUtc, nextRunAt } from "./window";

const DEFAULT_POLL_INTERVAL_MS = 60_000;
const NO_AGENT_RETRY_MINUTES = 30;

type DueConfigRow = {
  id: string;
  workspace_id: string;
  repository_id: string;
  capability_definition_id: MaintenanceCapabilityId;
  enabled: boolean;
  schedule: MaintenanceSchedule;
  daily_token_budget: number;
  next_run_at: string | null;
  workspaces?: { timezone?: string | null } | Array<{ timezone?: string | null }> | null;
  repositories?:
    | { id?: string; full_name?: string; is_enabled?: boolean }
    | Array<{ id?: string; full_name?: string; is_enabled?: boolean }>
    | null;
  capability_definitions?:
    | { id?: string; display_name?: string; kind?: string }
    | Array<{ id?: string; display_name?: string; kind?: string }>
    | null;
};

function related<T>(value: T | T[] | null | undefined): T | null {
  if (Array.isArray(value)) return value[0] ?? null;
  return value ?? null;
}

function parseDryRunFlag(): boolean {
  return process.env["MAINTENANCE_SCHEDULER_DRY_RUN"] !== "false";
}

export class MaintenanceScheduler {
  private timer: ReturnType<typeof setTimeout> | null = null;
  private running = false;
  private readonly dryRun = parseDryRunFlag();

  start(): void {
    if (this.running) return;
    this.running = true;
    log.info({ dryRun: this.dryRun }, "MaintenanceScheduler started");
    this.schedule(0);
  }

  stop(): void {
    this.running = false;
    if (this.timer) {
      clearTimeout(this.timer);
      this.timer = null;
    }
    log.info({}, "MaintenanceScheduler stopped");
  }

  private schedule(delayMs = DEFAULT_POLL_INTERVAL_MS): void {
    this.timer = setTimeout(() => {
      this.tick()
        .catch((err) => log.error({ error: String(err) }, "MaintenanceScheduler tick failed"))
        .finally(() => {
          if (this.running) this.schedule();
        });
    }, delayMs);
  }

  private async tick(): Promise<void> {
    const supabase = getSupabaseClient();
    const now = new Date();

    const { data, error } = await supabase
      .from("workspace_capability_configs")
      .select(`
        id,
        workspace_id,
        repository_id,
        capability_definition_id,
        enabled,
        schedule,
        daily_token_budget,
        next_run_at,
        workspaces(timezone),
        repositories(id, full_name, is_enabled),
        capability_definitions(id, display_name, kind)
      `)
      .eq("enabled", true)
      .not("next_run_at", "is", null)
      .lte("next_run_at", now.toISOString())
      .limit(50);

    if (error) {
      log.error({ error: error.message }, "MaintenanceScheduler due-config query failed");
      return;
    }

    const rows = (data ?? []) as DueConfigRow[];
    if (rows.length === 0) return;

    log.info({ count: rows.length, dryRun: this.dryRun }, "MaintenanceScheduler found due configs");

    for (const row of rows) {
      await this.processDueConfig(row, now);
    }
  }

  private async processDueConfig(row: DueConfigRow, now: Date): Promise<void> {
    const workspace = related(row.workspaces);
    const repository = related(row.repositories);
    const capability = related(row.capability_definitions);
    const timezone = workspace?.timezone ?? "UTC";

    if (repository?.is_enabled === false) {
      await this.advanceConfig(row, now, timezone);
      return;
    }

    if (!isInsideWindow(row.schedule, now, timezone)) {
      await this.advanceConfig(row, now, timezone);
      return;
    }

    if (this.dryRun) {
      log.info(
        {
          workspaceId: row.workspace_id,
          repositoryId: row.repository_id,
          repository: repository?.full_name,
          capabilityDefinitionId: row.capability_definition_id,
          capability: capability?.display_name,
          nextRunAt: row.next_run_at,
        },
        "MaintenanceScheduler dry run: would enqueue capability run"
      );
      return;
    }

    const budgetUsed = await this.getBudgetUsed(row, now, timezone);
    if (budgetUsed >= row.daily_token_budget) {
      await this.insertRunAndEvent(row, {
        status: "budget_exceeded",
        trigger: "schedule",
        payload: { budget: row.daily_token_budget, used: budgetUsed },
      });
      await this.advanceConfig(row, now, timezone);
      return;
    }

    const runnerAgentId = await this.selectRunnerAgent(row.workspace_id, row.repository_id);
    if (!runnerAgentId) {
      await this.insertRunAndEvent(row, {
        status: "no_agent",
        trigger: "schedule",
        payload: { retry_minutes: NO_AGENT_RETRY_MINUTES },
      });
      await this.advanceConfig(row, now, timezone, NO_AGENT_RETRY_MINUTES);
      return;
    }

    const agentRunId = await this.createQueuedRun(row, runnerAgentId, "schedule");
    const payload: MaintenanceJobPayload = {
      agentRunId,
      workspaceId: row.workspace_id,
      repositoryId: row.repository_id,
      runnerAgentId,
      capabilityDefinitionId: row.capability_definition_id,
      workspaceCapabilityConfigId: row.id,
      trigger: "schedule",
    };

    await maintenanceQueue.addJob(payload);
    await this.insertMaintenanceEvent({
      workspaceId: row.workspace_id,
      repositoryId: row.repository_id,
      agentRunId,
      eventType: "agent.run.scheduled",
      actorType: "system",
      actorId: "maintenance-scheduler",
      payload: {
        capability_definition_id: row.capability_definition_id,
        runner_agent_id: runnerAgentId,
      },
    });
    await this.advanceConfig(row, now, timezone);
  }

  private async getBudgetUsed(row: DueConfigRow, now: Date, timezone: string): Promise<number> {
    const supabase = getSupabaseClient();
    const bounds = localDayBoundsUtc(now, timezone);
    const { data, error } = await supabase
      .from("agent_runs")
      .select("tokens_used")
      .eq("workspace_id", row.workspace_id)
      .eq("repository_id", row.repository_id)
      .eq("capability_definition_id", row.capability_definition_id)
      .gte("created_at", bounds.startUtc.toISOString())
      .lt("created_at", bounds.endUtc.toISOString());

    if (error) {
      log.warn({ configId: row.id, error: error.message }, "MaintenanceScheduler budget lookup failed");
      return 0;
    }

    return (data ?? []).reduce((sum: number, item: { tokens_used?: number | null }) => {
      return sum + (item.tokens_used ?? 0);
    }, 0);
  }

  private async selectRunnerAgent(workspaceId: string, repositoryId: string): Promise<string | null> {
    const supabase = getSupabaseClient();
    const { data: agentRepos, error: repoError } = await supabase
      .from("agent_repositories")
      .select("agent_id")
      .eq("repository_id", repositoryId);

    if (repoError || !agentRepos?.length) {
      if (repoError) {
        log.warn({ repositoryId, error: repoError.message }, "MaintenanceScheduler agent repo lookup failed");
      }
      return null;
    }

    const assignedIds = agentRepos.map((row: { agent_id: string }) => row.agent_id);
    const { data: agents, error: agentError } = await supabase
      .from("agents_with_status")
      .select("id, last_seen_at")
      .eq("workspace_id", workspaceId)
      .in("id", assignedIds)
      .eq("effective_status", "idle")
      .order("last_seen_at", { ascending: false })
      .limit(1);

    if (agentError || !agents?.length) {
      if (agentError) {
        log.warn({ repositoryId, error: agentError.message }, "MaintenanceScheduler online agent lookup failed");
      }
      return null;
    }

    return (agents[0] as { id: string }).id;
  }

  private async createQueuedRun(
    row: DueConfigRow,
    runnerAgentId: string,
    trigger: AgentRunTrigger
  ): Promise<string> {
    const supabase = getSupabaseClient();
    const { data, error } = await supabase
      .from("agent_runs")
      .insert({
        workspace_id: row.workspace_id,
        repository_id: row.repository_id,
        workspace_capability_config_id: row.id,
        capability_definition_id: row.capability_definition_id,
        runner_agent_id: runnerAgentId,
        status: "queued",
        trigger,
      })
      .select("id")
      .single();

    if (error || !data) {
      throw new Error(`MaintenanceScheduler createQueuedRun failed: ${error?.message ?? "no row returned"}`);
    }

    return (data as { id: string }).id;
  }

  private async insertRunAndEvent(
    row: DueConfigRow,
    params: {
      status: "budget_exceeded" | "no_agent";
      trigger: AgentRunTrigger;
      payload: Record<string, unknown>;
    }
  ): Promise<void> {
    const supabase = getSupabaseClient();
    const { data, error } = await supabase
      .from("agent_runs")
      .insert({
        workspace_id: row.workspace_id,
        repository_id: row.repository_id,
        workspace_capability_config_id: row.id,
        capability_definition_id: row.capability_definition_id,
        status: params.status,
        trigger: params.trigger,
        error_message: params.status,
      })
      .select("id")
      .single();

    if (error || !data) {
      log.warn({ configId: row.id, error: error?.message }, "MaintenanceScheduler could not insert skipped run");
      return;
    }

    await this.insertMaintenanceEvent({
      workspaceId: row.workspace_id,
      repositoryId: row.repository_id,
      agentRunId: (data as { id: string }).id,
      eventType: params.status === "budget_exceeded" ? "agent.run.budget_exceeded" : "agent.run.failed",
      actorType: "system",
      actorId: "maintenance-scheduler",
      payload: params.payload,
    });
  }

  private async insertMaintenanceEvent(params: {
    workspaceId: string;
    repositoryId: string;
    agentRunId: string;
    eventType: string;
    actorType: "agent" | "human" | "system";
    actorId: string;
    payload: Record<string, unknown>;
  }): Promise<void> {
    const { error } = await getSupabaseClient().from("maintenance_events").insert({
      workspace_id: params.workspaceId,
      repository_id: params.repositoryId,
      agent_run_id: params.agentRunId,
      event_type: params.eventType,
      actor_type: params.actorType,
      actor_id: params.actorId,
      payload: params.payload,
    });

    if (error) {
      log.warn({ agentRunId: params.agentRunId, error: error.message }, "MaintenanceScheduler event insert failed");
    }
  }

  private async advanceConfig(
    row: DueConfigRow,
    now: Date,
    timezone: string,
    overrideMinutes?: number
  ): Promise<void> {
    if (this.dryRun) return;

    const next = overrideMinutes
      ? new Date(now.getTime() + overrideMinutes * 60_000)
      : nextRunAt(row.schedule, now, timezone);

    const { error } = await getSupabaseClient()
      .from("workspace_capability_configs")
      .update({
        last_run_at: now.toISOString(),
        next_run_at: next?.toISOString() ?? null,
        updated_at: new Date().toISOString(),
      })
      .eq("id", row.id);

    if (error) {
      log.warn({ configId: row.id, error: error.message }, "MaintenanceScheduler advanceConfig failed");
    }
  }
}

export const maintenanceScheduler = new MaintenanceScheduler();
