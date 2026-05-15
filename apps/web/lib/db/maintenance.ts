import { createSupabaseServerClient } from "@/lib/supabase/server";
import { createSupabaseAdminClient } from "@/lib/supabase/admin";
import type {
  AgentRun,
  AgentRunTrigger,
  CapabilityDefinition,
  MaintenanceCapabilityId,
  WorkspaceCapabilityConfig,
} from "@robin/shared-types";

// ─── Capability definitions ─────────────────────────────────────────────────

export async function listCapabilityDefinitions(): Promise<CapabilityDefinition[]> {
  const supabase = await createSupabaseServerClient();
  const { data, error } = await supabase
    .from("capability_definitions")
    .select("*")
    .order("kind", { ascending: true })
    .order("id", { ascending: true });
  if (error) {
    console.error("[listCapabilityDefinitions]", error.message);
    return [];
  }
  return (data ?? []) as CapabilityDefinition[];
}

// ─── Workspace capability configs ───────────────────────────────────────────

export type CapabilityConfigWithRelations = WorkspaceCapabilityConfig & {
  repository: { id: string; full_name: string; default_branch: string; is_enabled: boolean } | null;
  capability_definition: CapabilityDefinition | null;
};

export async function listCapabilityConfigs(
  workspaceId: string,
  opts: { repositoryId?: string } = {}
): Promise<CapabilityConfigWithRelations[]> {
  const supabase = await createSupabaseServerClient();
  let query = supabase
    .from("workspace_capability_configs")
    .select(`
      *,
      repository:repository_id(id, full_name, default_branch, is_enabled),
      capability_definition:capability_definition_id(*)
    `)
    .eq("workspace_id", workspaceId);

  if (opts.repositoryId) query = query.eq("repository_id", opts.repositoryId);

  const { data, error } = await query.order("repository_id").order("capability_definition_id");
  if (error) {
    console.error("[listCapabilityConfigs]", error.message);
    return [];
  }
  return (data ?? []) as unknown as CapabilityConfigWithRelations[];
}

export async function getCapabilityConfig(
  workspaceId: string,
  configId: string
): Promise<CapabilityConfigWithRelations | null> {
  const supabase = await createSupabaseServerClient();
  const { data, error } = await supabase
    .from("workspace_capability_configs")
    .select(`
      *,
      repository:repository_id(id, full_name, default_branch, is_enabled),
      capability_definition:capability_definition_id(*)
    `)
    .eq("workspace_id", workspaceId)
    .eq("id", configId)
    .maybeSingle();
  if (error) {
    console.error("[getCapabilityConfig]", error.message);
    return null;
  }
  return (data as unknown as CapabilityConfigWithRelations | null) ?? null;
}

export type CapabilityConfigPatch = {
  enabled?: boolean;
  schedule?: WorkspaceCapabilityConfig["schedule"];
  daily_token_budget?: number;
  per_run_token_cap?: number;
  auto_implement?: boolean;
  auto_implement_min_confidence?: number | null;
  protected_paths?: string[];
  spec_paths?: string[];
  bug_noise_allowlist?: string[];
  bug_source_config?: Record<string, unknown>;
  next_run_at?: string | null;
};

export async function updateCapabilityConfig(
  workspaceId: string,
  configId: string,
  patch: CapabilityConfigPatch
): Promise<CapabilityConfigWithRelations | null> {
  const supabase = await createSupabaseServerClient();
  const { data, error } = await supabase
    .from("workspace_capability_configs")
    .update({ ...patch, updated_at: new Date().toISOString() })
    .eq("workspace_id", workspaceId)
    .eq("id", configId)
    .select(`
      *,
      repository:repository_id(id, full_name, default_branch, is_enabled),
      capability_definition:capability_definition_id(*)
    `)
    .maybeSingle();
  if (error) {
    console.error("[updateCapabilityConfig]", error.message);
    throw new Error(error.message);
  }
  return (data as unknown as CapabilityConfigWithRelations | null) ?? null;
}

// ─── Agent runs / inbox ─────────────────────────────────────────────────────

export type AgentRunWithRelations = AgentRun & {
  repository: { id: string; full_name: string } | null;
  capability_definition: { id: string; display_name: string; kind: string } | null;
  runner_agent: { id: string; name: string | null } | null;
};

export async function listAgentRuns(
  workspaceId: string,
  opts: {
    repositoryId?: string;
    capabilityDefinitionId?: MaintenanceCapabilityId;
    limit?: number;
  } = {}
): Promise<AgentRunWithRelations[]> {
  const supabase = await createSupabaseServerClient();
  let query = supabase
    .from("agent_runs")
    .select(`
      *,
      repository:repository_id(id, full_name),
      capability_definition:capability_definition_id(id, display_name, kind),
      runner_agent:runner_agent_id(id, name)
    `)
    .eq("workspace_id", workspaceId);

  if (opts.repositoryId) query = query.eq("repository_id", opts.repositoryId);
  if (opts.capabilityDefinitionId) {
    query = query.eq("capability_definition_id", opts.capabilityDefinitionId);
  }

  const { data, error } = await query
    .order("created_at", { ascending: false })
    .limit(opts.limit ?? 50);

  if (error) {
    console.error("[listAgentRuns]", error.message);
    return [];
  }
  return (data ?? []) as unknown as AgentRunWithRelations[];
}

export type InboxFinding = {
  id: string;
  type: "spec" | "bug";
  workspace_id: string;
  repository_id: string;
  repository_full_name: string | null;
  title: string;
  description: string | null;
  confidence: number;
  severity: string | null;
  status: string | null;
  triage_state: string;
  created_at: string;
  agent_run_id: string;
  task_id: string | null;
  source_path: string | null;
  source_line: number | null;
};

type InboxFilters = {
  repositoryId?: string;
  type?: "spec" | "bug";
  triageState?: string;
  limit?: number;
};

export async function listInboxFindings(
  workspaceId: string,
  opts: InboxFilters = {}
): Promise<InboxFinding[]> {
  const supabase = await createSupabaseServerClient();
  const limit = opts.limit ?? 50;

  const wantSpec = !opts.type || opts.type === "spec";
  const wantBug = !opts.type || opts.type === "bug";

  const collected: InboxFinding[] = [];

  if (wantSpec) {
    let q = supabase
      .from("spec_findings")
      .select(`
        id, workspace_id, repository_id, agent_run_id, task_id,
        requirement_text, requirement_source_path, requirement_source_line,
        status, confidence, triage_state, created_at,
        repository:repository_id(full_name)
      `)
      .eq("workspace_id", workspaceId);
    if (opts.repositoryId) q = q.eq("repository_id", opts.repositoryId);
    if (opts.triageState) q = q.eq("triage_state", opts.triageState);
    const { data, error } = await q.order("created_at", { ascending: false }).limit(limit);
    if (error) {
      console.error("[listInboxFindings spec]", error.message);
    } else {
      for (const row of (data ?? []) as Array<Record<string, unknown>>) {
        collected.push({
          id: row["id"] as string,
          type: "spec",
          workspace_id: row["workspace_id"] as string,
          repository_id: row["repository_id"] as string,
          repository_full_name: unwrapName(row["repository"]),
          title: row["requirement_text"] as string,
          description: null,
          confidence: row["confidence"] as number,
          severity: null,
          status: row["status"] as string,
          triage_state: row["triage_state"] as string,
          created_at: row["created_at"] as string,
          agent_run_id: row["agent_run_id"] as string,
          task_id: (row["task_id"] as string | null) ?? null,
          source_path: (row["requirement_source_path"] as string | null) ?? null,
          source_line: (row["requirement_source_line"] as number | null) ?? null,
        });
      }
    }
  }

  if (wantBug) {
    let q = supabase
      .from("bug_findings")
      .select(`
        id, workspace_id, repository_id, agent_run_id, task_id,
        title, description, severity, confidence, triage_state, created_at,
        repository:repository_id(full_name)
      `)
      .eq("workspace_id", workspaceId);
    if (opts.repositoryId) q = q.eq("repository_id", opts.repositoryId);
    if (opts.triageState) q = q.eq("triage_state", opts.triageState);
    const { data, error } = await q.order("created_at", { ascending: false }).limit(limit);
    if (error) {
      console.error("[listInboxFindings bug]", error.message);
    } else {
      for (const row of (data ?? []) as Array<Record<string, unknown>>) {
        collected.push({
          id: row["id"] as string,
          type: "bug",
          workspace_id: row["workspace_id"] as string,
          repository_id: row["repository_id"] as string,
          repository_full_name: unwrapName(row["repository"]),
          title: row["title"] as string,
          description: (row["description"] as string | null) ?? null,
          confidence: row["confidence"] as number,
          severity: row["severity"] as string,
          status: null,
          triage_state: row["triage_state"] as string,
          created_at: row["created_at"] as string,
          agent_run_id: row["agent_run_id"] as string,
          task_id: (row["task_id"] as string | null) ?? null,
          source_path: null,
          source_line: null,
        });
      }
    }
  }

  collected.sort((a, b) => b.created_at.localeCompare(a.created_at));
  return collected.slice(0, limit);
}

function unwrapName(value: unknown): string | null {
  if (!value) return null;
  if (Array.isArray(value)) {
    const first = value[0] as { full_name?: string } | undefined;
    return first?.full_name ?? null;
  }
  return (value as { full_name?: string }).full_name ?? null;
}

// ─── Run-now plumbing ───────────────────────────────────────────────────────

export type SelectedRunner = { agentId: string; agentName: string | null };

/**
 * Select an online agent assigned to the repository, idle, and last-seen most
 * recently. Returns null when no eligible agent is available — caller should
 * 503 with a friendly message.
 */
export async function selectRunnerAgentForRepository(
  workspaceId: string,
  repositoryId: string
): Promise<SelectedRunner | null> {
  const supabase = await createSupabaseServerClient();
  const { data: repoAgents, error: repoErr } = await supabase
    .from("agent_repositories")
    .select("agent_id")
    .eq("repository_id", repositoryId);

  if (repoErr || !repoAgents?.length) {
    if (repoErr) console.error("[selectRunnerAgentForRepository agent_repositories]", repoErr.message);
    return null;
  }

  const ids = (repoAgents as Array<{ agent_id: string }>).map((r) => r.agent_id);
  const { data: agents, error: agentErr } = await supabase
    .from("agents_with_status")
    .select("id, name, last_seen_at, effective_status")
    .eq("workspace_id", workspaceId)
    .in("id", ids)
    .eq("effective_status", "idle")
    .order("last_seen_at", { ascending: false })
    .limit(1);

  if (agentErr || !agents?.length) {
    if (agentErr) console.error("[selectRunnerAgentForRepository agents_with_status]", agentErr.message);
    return null;
  }

  const first = agents[0] as { id: string; name: string | null };
  return { agentId: first.id, agentName: first.name };
}

/**
 * Sum tokens already consumed today (workspace-local day) for a given config.
 * Uses the admin client because the aggregation needs to span all rows
 * regardless of which user triggers the manual run.
 */
export async function getDailyTokensUsed(args: {
  workspaceId: string;
  repositoryId: string;
  capabilityDefinitionId: MaintenanceCapabilityId;
  timezone: string;
  now?: Date;
}): Promise<number> {
  const supabase = createSupabaseAdminClient();
  const bounds = localDayBoundsUtc(args.now ?? new Date(), args.timezone);
  const { data, error } = await supabase
    .from("agent_runs")
    .select("tokens_used")
    .eq("workspace_id", args.workspaceId)
    .eq("repository_id", args.repositoryId)
    .eq("capability_definition_id", args.capabilityDefinitionId)
    .gte("created_at", bounds.startUtc.toISOString())
    .lt("created_at", bounds.endUtc.toISOString());
  if (error) {
    console.error("[getDailyTokensUsed]", error.message);
    return 0;
  }
  return (data ?? []).reduce(
    (acc: number, row: { tokens_used?: number | null }) => acc + (row.tokens_used ?? 0),
    0
  );
}

export async function createQueuedAgentRun(args: {
  workspaceId: string;
  repositoryId: string;
  workspaceCapabilityConfigId: string;
  capabilityDefinitionId: MaintenanceCapabilityId;
  runnerAgentId: string;
  trigger: AgentRunTrigger;
  triggeredBy: string;
}): Promise<string> {
  const supabase = createSupabaseAdminClient();
  const { data, error } = await supabase
    .from("agent_runs")
    .insert({
      workspace_id: args.workspaceId,
      repository_id: args.repositoryId,
      workspace_capability_config_id: args.workspaceCapabilityConfigId,
      capability_definition_id: args.capabilityDefinitionId,
      runner_agent_id: args.runnerAgentId,
      status: "queued",
      trigger: args.trigger,
      triggered_by: args.triggeredBy,
    })
    .select("id")
    .single();
  if (error || !data) throw new Error(`createQueuedAgentRun: ${error?.message ?? "no row"}`);
  return (data as { id: string }).id;
}

export async function insertMaintenanceEvent(args: {
  workspaceId: string;
  repositoryId: string;
  agentRunId: string;
  eventType: string;
  actorType: "agent" | "human" | "system";
  actorId: string;
  payload?: Record<string, unknown>;
}): Promise<void> {
  const supabase = createSupabaseAdminClient();
  const { error } = await supabase.from("maintenance_events").insert({
    workspace_id: args.workspaceId,
    repository_id: args.repositoryId,
    agent_run_id: args.agentRunId,
    event_type: args.eventType,
    actor_type: args.actorType,
    actor_id: args.actorId,
    payload: args.payload ?? {},
  });
  if (error) console.error("[insertMaintenanceEvent]", error.message);
}

// ─── Helpers ────────────────────────────────────────────────────────────────

/**
 * Local-day UTC bounds in a given IANA timezone. Mirrors
 * `apps/orchestrator/src/scheduler/window.ts:localDayBoundsUtc` so daily
 * budget aggregation lines up across web + orchestrator. Keep the two in sync.
 */
export function localDayBoundsUtc(
  nowUtc: Date,
  timezone: string
): { startUtc: Date; endUtc: Date } {
  const parts = getZonedParts(nowUtc, timezone);
  const startUtc = zonedTimeToUtc(
    { year: parts.year, month: parts.month, day: parts.day, hour: 0, minute: 0, second: 0 },
    timezone
  );
  const nextLocalDay = new Date(Date.UTC(parts.year, parts.month - 1, parts.day + 1));
  const nextParts = getZonedParts(nextLocalDay, "UTC");
  const endUtc = zonedTimeToUtc(
    { year: nextParts.year, month: nextParts.month, day: nextParts.day, hour: 0, minute: 0, second: 0 },
    timezone
  );
  return { startUtc, endUtc };
}

type ZonedParts = {
  year: number;
  month: number;
  day: number;
  hour: number;
  minute: number;
  second: number;
};

function getZonedParts(date: Date, timezone: string): ZonedParts {
  const formatter = new Intl.DateTimeFormat("en-US", {
    timeZone: timezone,
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
    second: "2-digit",
    hour12: false,
  });
  const parts = Object.fromEntries(
    formatter.formatToParts(date).map((p) => [p.type, p.value])
  );
  return {
    year: Number(parts["year"]),
    month: Number(parts["month"]),
    day: Number(parts["day"]),
    hour: Number(parts["hour"]),
    minute: Number(parts["minute"]),
    second: Number(parts["second"]),
  };
}

function zonedTimeToUtc(parts: ZonedParts, timezone: string): Date {
  const utcGuess = new Date(Date.UTC(
    parts.year, parts.month - 1, parts.day, parts.hour, parts.minute, parts.second
  ));
  const offsetMs = getTimezoneOffsetMs(utcGuess, timezone);
  const firstPass = new Date(utcGuess.getTime() - offsetMs);
  const offsetMs2 = getTimezoneOffsetMs(firstPass, timezone);
  return new Date(utcGuess.getTime() - offsetMs2);
}

function getTimezoneOffsetMs(date: Date, timezone: string): number {
  const parts = getZonedParts(date, timezone);
  const asUtc = Date.UTC(
    parts.year, parts.month - 1, parts.day, parts.hour, parts.minute, parts.second
  );
  return asUtc - date.getTime();
}
