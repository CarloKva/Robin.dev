import { query } from "@anthropic-ai/claude-agent-sdk";
import type {
  MaintenanceCapabilityId,
  MaintenanceJobPayload,
} from "@robin/shared-types";
import { getSupabaseClient } from "../db/supabase.client";
import { log } from "../utils/logger";
import { setupRepoForRead } from "../services/repo-setup";
import { loadProfileBundle } from "../services/profile-loader";
import {
  computeSpecFindingDedupHash,
} from "../services/dedup";
import {
  validateSpecDiscoveryOutput,
  type SpecDiscoveryRawOutput,
  type ValidatedSpecFinding,
} from "../services/spec-discovery.validator";

const AGENT_ID = process.env["AGENT_ID"] ?? "b0000000-0000-0000-0000-000000000001";
const DEFAULT_MODEL = process.env["MAINTENANCE_MODEL"] ?? "claude-sonnet-4-6";
const DEFAULT_MAX_TURNS = parseInt(process.env["MAINTENANCE_MAX_TURNS"] ?? "60", 10);

export type MaintenanceRunOutcome = {
  status:
    | "completed"
    | "failed"
    | "validation_failed"
    | "budget_exceeded"
    | "skipped";
  findingsCreated: number;
  tokensUsed: number;
  costUsd: number;
  errorMessage?: string;
};

type RunContext = {
  agentRunId: string;
  workspaceId: string;
  repositoryId: string;
  capabilityDefinitionId: MaintenanceCapabilityId;
  workspaceCapabilityConfigId: string;
};

type LoadedConfig = {
  repository: {
    id: string;
    full_name: string;
    default_branch: string;
    is_enabled: boolean;
  };
  workspace: {
    id: string;
    timezone: string | null;
  };
  capability: {
    id: MaintenanceCapabilityId;
    profile_path: string;
    per_run_token_cap: number;
  };
  config: {
    spec_paths: string[];
    protected_paths: string[];
    per_run_token_cap: number;
  };
};

export async function runMaintenanceAgent(
  payload: MaintenanceJobPayload
): Promise<MaintenanceRunOutcome> {
  const ctx: RunContext = {
    agentRunId: payload.agentRunId,
    workspaceId: payload.workspaceId,
    repositoryId: payload.repositoryId,
    capabilityDefinitionId: payload.capabilityDefinitionId,
    workspaceCapabilityConfigId: payload.workspaceCapabilityConfigId,
  };

  // Phase 1 only ships spec_discovery. Anything else is rejected explicitly so
  // a misconfigured config doesn't silently no-op against a real workspace.
  if (payload.capabilityDefinitionId !== "spec_discovery") {
    const reason = `Capability ${payload.capabilityDefinitionId} not implemented in Phase 1`;
    await markRun(ctx, "skipped", { errorMessage: reason });
    await insertEvent(ctx, "agent.run.failed", { reason });
    return {
      status: "skipped",
      findingsCreated: 0,
      tokensUsed: 0,
      costUsd: 0,
      errorMessage: reason,
    };
  }

  if (payload.runnerAgentId !== AGENT_ID) {
    const reason = `Runner mismatch: payload=${payload.runnerAgentId} self=${AGENT_ID}`;
    log.warn({ ...payload }, reason);
    await markRun(ctx, "skipped", {
      errorMessage: reason,
      completedAt: new Date().toISOString(),
    });
    await insertEvent(ctx, "agent.run.failed", { reason });
    return {
      status: "skipped",
      findingsCreated: 0,
      tokensUsed: 0,
      costUsd: 0,
      errorMessage: reason,
    };
  }

  const config = await loadConfig(ctx);
  if (!config) {
    const reason = "Could not load config/repository/workspace for run";
    await markRun(ctx, "failed", { errorMessage: reason });
    await insertEvent(ctx, "agent.run.failed", { reason });
    return {
      status: "failed",
      findingsCreated: 0,
      tokensUsed: 0,
      costUsd: 0,
      errorMessage: reason,
    };
  }

  if (!config.repository.is_enabled) {
    const reason = "Repository is disabled";
    await markRun(ctx, "skipped", { errorMessage: reason });
    await insertEvent(ctx, "agent.run.failed", { reason });
    return {
      status: "skipped",
      findingsCreated: 0,
      tokensUsed: 0,
      costUsd: 0,
      errorMessage: reason,
    };
  }

  await markRun(ctx, "running", { startedAt: new Date().toISOString() });
  await insertEvent(ctx, "agent.run.started", {
    capability_definition_id: ctx.capabilityDefinitionId,
    runner_agent_id: AGENT_ID,
  });

  try {
    return await runSpecDiscovery(ctx, config);
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err);
    log.error({ agentRunId: ctx.agentRunId, error: message }, "maintenance-agent: run failed");
    await markRun(ctx, "failed", {
      errorMessage: message,
      completedAt: new Date().toISOString(),
    });
    await insertEvent(ctx, "agent.run.failed", { error: message });
    return {
      status: "failed",
      findingsCreated: 0,
      tokensUsed: 0,
      costUsd: 0,
      errorMessage: message,
    };
  }
}

async function runSpecDiscovery(
  ctx: RunContext,
  config: LoadedConfig
): Promise<MaintenanceRunOutcome> {
  // 1. Resolve repo on disk.
  const repoUrl = `https://github.com/${config.repository.full_name}.git`;
  const { repoPath } = await setupRepoForRead({
    repositoryId: config.repository.id,
    repoUrl,
    defaultBranch: config.repository.default_branch,
  });

  // 2. Load profile + filter spec_paths down to files that actually exist.
  const profile = loadProfileBundle("spec_discovery", "apps/orchestrator/profiles/spec-discovery");
  const liveSpecPaths = filterExistingPaths(repoPath, config.config.spec_paths);
  if (liveSpecPaths.length === 0) {
    const reason = "No configured spec_paths exist in the repository working tree";
    await markRun(ctx, "validation_failed", {
      errorMessage: reason,
      completedAt: new Date().toISOString(),
    });
    await insertEvent(ctx, "agent.run.failed", { reason });
    return {
      status: "validation_failed",
      findingsCreated: 0,
      tokensUsed: 0,
      costUsd: 0,
      errorMessage: reason,
    };
  }

  // 3. Fetch existing dedup_hashes so the model can skip them.
  const existingHashes = await loadExistingDedupHashes(ctx.repositoryId);

  // 4. Build the prompt + invoke Claude.
  const prompt = buildSpecDiscoveryPrompt({
    specPaths: liveSpecPaths,
    protectedPaths: config.config.protected_paths,
    existingHashes,
  });

  const claudeOutput = await invokeClaude({
    cwd: repoPath,
    systemPrompt: profile.systemPrompt,
    prompt,
    allowedTools: profile.allowedTools,
  });

  if (!claudeOutput.parsed) {
    const reason = "Claude output did not contain a valid JSON object";
    await markRun(ctx, "validation_failed", {
      errorMessage: reason,
      tokensUsed: claudeOutput.tokensUsed,
      costUsd: claudeOutput.costUsd,
      completedAt: new Date().toISOString(),
    });
    await insertEvent(ctx, "agent.run.failed", { reason });
    return {
      status: "validation_failed",
      findingsCreated: 0,
      tokensUsed: claudeOutput.tokensUsed,
      costUsd: claudeOutput.costUsd,
      errorMessage: reason,
    };
  }

  // 5. Validate findings against runner-enforced rules.
  let validation;
  try {
    validation = validateSpecDiscoveryOutput(claudeOutput.parsed as SpecDiscoveryRawOutput, {
      repoPath,
      specPaths: liveSpecPaths,
      protectedPaths: config.config.protected_paths,
    });
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err);
    await markRun(ctx, "validation_failed", {
      errorMessage: message,
      tokensUsed: claudeOutput.tokensUsed,
      costUsd: claudeOutput.costUsd,
      completedAt: new Date().toISOString(),
    });
    await insertEvent(ctx, "agent.run.failed", { reason: message });
    return {
      status: "validation_failed",
      findingsCreated: 0,
      tokensUsed: claudeOutput.tokensUsed,
      costUsd: claudeOutput.costUsd,
      errorMessage: message,
    };
  }

  // 6. Insert findings, honoring the unique (repository_id, dedup_hash).
  const inserted = await insertSpecFindings({
    ctx,
    findings: validation.output.findings,
  });

  // 7. Use cost/token totals from validated output if Claude reported them,
  // otherwise fall back to SDK-reported numbers.
  const tokensUsed = validation.output.tokens_used || claudeOutput.tokensUsed;
  const costUsd = validation.output.cost_usd || claudeOutput.costUsd;

  await markRun(ctx, "completed", {
    completedAt: new Date().toISOString(),
    tokensUsed,
    costUsd,
    findingsCreated: inserted.length,
  });

  await insertEvent(ctx, "agent.run.completed", {
    findings_created: inserted.length,
    tokens_used: tokensUsed,
    cost_usd: costUsd,
    dropped: validation.dropped.length,
    summary: validation.output.summary,
  });

  for (const finding of inserted) {
    await insertEvent(ctx, "finding.created", {
      finding_id: finding.id,
      type: "spec",
      repository_id: ctx.repositoryId,
      confidence: finding.confidence,
      status: finding.status,
    });
  }

  return {
    status: "completed",
    findingsCreated: inserted.length,
    tokensUsed,
    costUsd,
  };
}

// ─── DB access ──────────────────────────────────────────────────────────────

async function loadConfig(ctx: RunContext): Promise<LoadedConfig | null> {
  const supabase = getSupabaseClient();
  const { data, error } = await supabase
    .from("workspace_capability_configs")
    .select(`
      spec_paths,
      protected_paths,
      per_run_token_cap,
      workspaces:workspace_id(id, timezone),
      repositories:repository_id(id, full_name, default_branch, is_enabled),
      capability_definitions:capability_definition_id(id, profile_path, per_run_token_cap_default)
    `)
    .eq("id", ctx.workspaceCapabilityConfigId)
    .single();

  if (error || !data) {
    log.warn({ agentRunId: ctx.agentRunId, error: error?.message }, "maintenance-agent: loadConfig failed");
    return null;
  }

  const workspace = unwrapRelated<{ id: string; timezone: string | null }>(data["workspaces"]);
  const repository = unwrapRelated<{
    id: string;
    full_name: string;
    default_branch: string;
    is_enabled: boolean;
  }>(data["repositories"]);
  const capability = unwrapRelated<{
    id: MaintenanceCapabilityId;
    profile_path: string;
    per_run_token_cap_default: number;
  }>(data["capability_definitions"]);

  if (!workspace || !repository || !capability) {
    log.warn({ agentRunId: ctx.agentRunId }, "maintenance-agent: loadConfig missing related rows");
    return null;
  }

  return {
    repository,
    workspace,
    capability: {
      id: capability.id,
      profile_path: capability.profile_path,
      per_run_token_cap: capability.per_run_token_cap_default,
    },
    config: {
      spec_paths: (data["spec_paths"] as string[] | null) ?? [],
      protected_paths: (data["protected_paths"] as string[] | null) ?? [],
      per_run_token_cap: (data["per_run_token_cap"] as number | null) ?? capability.per_run_token_cap_default,
    },
  };
}

async function loadExistingDedupHashes(repositoryId: string): Promise<string[]> {
  const supabase = getSupabaseClient();
  const { data, error } = await supabase
    .from("spec_findings")
    .select("dedup_hash")
    .eq("repository_id", repositoryId)
    .in("triage_state", ["pending", "approved", "implemented", "snoozed"])
    .limit(2000);

  if (error) {
    log.warn({ repositoryId, error: error.message }, "maintenance-agent: dedup hash lookup failed");
    return [];
  }

  return (data ?? []).map((row: { dedup_hash: string }) => row.dedup_hash);
}

async function insertSpecFindings(args: {
  ctx: RunContext;
  findings: ValidatedSpecFinding[];
}): Promise<Array<{ id: string; status: string; confidence: number }>> {
  if (args.findings.length === 0) return [];

  const supabase = getSupabaseClient();
  const inserted: Array<{ id: string; status: string; confidence: number }> = [];

  for (const finding of args.findings) {
    const dedupHash = computeSpecFindingDedupHash({
      repositoryId: args.ctx.repositoryId,
      sourcePath: finding.requirement_source_path,
      sourceLine: finding.requirement_source_line,
      requirementText: finding.requirement_text,
      status: finding.status,
    });

    const { data, error } = await supabase
      .from("spec_findings")
      .insert({
        workspace_id: args.ctx.workspaceId,
        repository_id: args.ctx.repositoryId,
        agent_run_id: args.ctx.agentRunId,
        requirement_text: finding.requirement_text,
        requirement_source_path: finding.requirement_source_path,
        requirement_source_line: finding.requirement_source_line,
        requirement_source_end_line: finding.requirement_source_end_line,
        status: finding.status,
        evidence_paths: finding.evidence_paths,
        suggested_action: finding.suggested_action,
        confidence: finding.confidence,
        dedup_hash: dedupHash,
      })
      .select("id, status, confidence")
      .single();

    if (error) {
      // 23505 = unique violation = already in DB (dedup hit). Skip without
      // failing the run.
      const code = (error as { code?: string }).code;
      if (code === "23505") continue;
      log.warn(
        { agentRunId: args.ctx.agentRunId, error: error.message },
        "maintenance-agent: spec_findings insert failed"
      );
      continue;
    }

    if (data) inserted.push(data as { id: string; status: string; confidence: number });
  }

  return inserted;
}

async function markRun(
  ctx: RunContext,
  status:
    | "running"
    | "completed"
    | "failed"
    | "validation_failed"
    | "budget_exceeded"
    | "skipped",
  patch: {
    startedAt?: string;
    completedAt?: string;
    tokensUsed?: number;
    costUsd?: number;
    findingsCreated?: number;
    errorMessage?: string;
  } = {}
): Promise<void> {
  const supabase = getSupabaseClient();
  const update: Record<string, unknown> = { status };
  if (patch.startedAt) update["started_at"] = patch.startedAt;
  if (patch.completedAt) update["completed_at"] = patch.completedAt;
  if (patch.tokensUsed !== undefined) update["tokens_used"] = patch.tokensUsed;
  if (patch.costUsd !== undefined) update["cost_usd"] = patch.costUsd;
  if (patch.findingsCreated !== undefined) update["findings_created"] = patch.findingsCreated;
  if (patch.errorMessage) update["error_message"] = patch.errorMessage;

  const { error } = await supabase.from("agent_runs").update(update).eq("id", ctx.agentRunId);
  if (error) {
    log.warn(
      { agentRunId: ctx.agentRunId, status, error: error.message },
      "maintenance-agent: markRun update failed"
    );
  }
}

async function insertEvent(
  ctx: RunContext,
  eventType: string,
  payload: Record<string, unknown>
): Promise<void> {
  const supabase = getSupabaseClient();
  const { error } = await supabase.from("maintenance_events").insert({
    workspace_id: ctx.workspaceId,
    repository_id: ctx.repositoryId,
    agent_run_id: ctx.agentRunId,
    event_type: eventType,
    actor_type: "agent",
    actor_id: AGENT_ID,
    payload,
  });
  if (error) {
    log.warn(
      { agentRunId: ctx.agentRunId, eventType, error: error.message },
      "maintenance-agent: insertEvent failed"
    );
  }
}

// ─── Claude invocation ──────────────────────────────────────────────────────

async function invokeClaude(args: {
  cwd: string;
  systemPrompt: string;
  prompt: string;
  allowedTools: string[];
}): Promise<{
  parsed: unknown;
  tokensUsed: number;
  costUsd: number;
  rawText: string;
}> {
  const fullPrompt = `${args.systemPrompt}\n\n---\n\n${args.prompt}`;

  const agentQuery = query({
    prompt: fullPrompt,
    options: {
      cwd: args.cwd,
      model: DEFAULT_MODEL,
      maxTurns: DEFAULT_MAX_TURNS,
      permissionMode: "bypassPermissions",
      allowDangerouslySkipPermissions: true,
      allowedTools: args.allowedTools,
      settingSources: ["project"],
      env: buildClaudeEnv(),
    },
  });

  const collected: string[] = [];
  let tokensUsed = 0;
  let costUsd = 0;

  for await (const message of agentQuery) {
    if (message.type === "assistant") {
      const content = (message as { message?: { content?: Array<{ text?: string }> } }).message?.content;
      if (content) {
        for (const block of content) {
          if (block.text) collected.push(block.text);
        }
      }
    }

    if (message.type === "result") {
      const msg = message as unknown as Record<string, unknown>;
      const resultText = typeof msg["result"] === "string" ? (msg["result"] as string) : "";
      if (resultText) collected.push(resultText);
      costUsd = (msg["total_cost_usd"] as number) ?? 0;
      const usage = msg["usage"] as { input_tokens?: number; output_tokens?: number } | undefined;
      if (usage) {
        tokensUsed = (usage.input_tokens ?? 0) + (usage.output_tokens ?? 0);
      }
    }
  }

  const rawText = collected.join("\n\n");
  return {
    parsed: extractFinalJsonObject(rawText),
    tokensUsed,
    costUsd,
    rawText,
  };
}

function extractFinalJsonObject(text: string): unknown {
  if (!text) return null;

  // Try fenced ```json blocks first — the model usually uses them when asked
  // to return JSON.
  const fenceMatches = [...text.matchAll(/```(?:json)?\s*([\s\S]*?)```/g)];
  for (let i = fenceMatches.length - 1; i >= 0; i--) {
    const candidate = (fenceMatches[i]?.[1] ?? "").trim();
    const parsed = tryParseJson(candidate);
    if (parsed && typeof parsed === "object") return parsed;
  }

  // Otherwise scan for the last balanced top-level `{ ... }` substring.
  let depth = 0;
  let start = -1;
  let lastObject: string | null = null;
  for (let i = 0; i < text.length; i++) {
    const ch = text[i];
    if (ch === "{") {
      if (depth === 0) start = i;
      depth++;
    } else if (ch === "}") {
      depth--;
      if (depth === 0 && start >= 0) {
        lastObject = text.slice(start, i + 1);
        start = -1;
      }
    }
  }

  if (!lastObject) return null;
  return tryParseJson(lastObject);
}

function tryParseJson(value: string): unknown | null {
  try {
    return JSON.parse(value);
  } catch {
    return null;
  }
}

// ─── Helpers ────────────────────────────────────────────────────────────────

function buildSpecDiscoveryPrompt(args: {
  specPaths: string[];
  protectedPaths: string[];
  existingHashes: string[];
}): string {
  const sections: string[] = [];

  sections.push("# Spec Discovery Run");
  sections.push("");
  sections.push(`Audit the spec files below against the repository working tree.`);
  sections.push("");
  sections.push("## spec_paths");
  for (const p of args.specPaths) sections.push(`- ${p}`);
  sections.push("");
  sections.push("## protected_paths (never cite as evidence, never as source)");
  for (const p of args.protectedPaths) sections.push(`- ${p}`);
  sections.push("");
  if (args.existingHashes.length > 0) {
    sections.push("## existing_dedup_hashes (skip findings that would match these)");
    sections.push("```");
    for (const h of args.existingHashes.slice(0, 200)) sections.push(h);
    sections.push("```");
    sections.push("");
  }
  sections.push("Return exactly one JSON object matching the output contract.");

  return sections.join("\n");
}

function filterExistingPaths(repoPath: string, paths: string[]): string[] {
  const fs = require("fs") as typeof import("fs");
  const path = require("path") as typeof import("path");
  return paths.filter((p) => {
    try {
      const full = path.join(repoPath, p);
      return fs.existsSync(full) && fs.statSync(full).isFile();
    } catch {
      return false;
    }
  });
}

/**
 * Build the env handed to the Claude Agent SDK subprocess.
 *
 * The runner intentionally does NOT spread `process.env`. That would forward
 * the Supabase service-role key, GitHub App private key, Redis URL, etc. into
 * the model subprocess. Today the spec-discovery profile only allows read-only
 * tools so leakage is gated by the tool allowlist — but any future tool
 * addition or prompt-injection path through the spec files would surface those
 * secrets. We only pass what Claude actually needs.
 */
export function buildClaudeEnv(
  source: NodeJS.ProcessEnv = process.env
): Record<string, string> {
  const ALLOWED_KEYS = new Set([
    "ANTHROPIC_API_KEY",
    "PATH",
    "HOME",
    "USER",
    "LANG",
    "LC_ALL",
    "TZ",
    "TMPDIR",
    "TMP",
    "TEMP",
    "NODE_OPTIONS",
  ]);
  const ALLOWED_PREFIXES = ["CLAUDE_", "ANTHROPIC_"];

  const env: Record<string, string> = {};
  for (const [key, value] of Object.entries(source)) {
    if (value === undefined) continue;
    const allowed =
      ALLOWED_KEYS.has(key) ||
      ALLOWED_PREFIXES.some((prefix) => key.startsWith(prefix));
    if (allowed) env[key] = value;
  }
  // Make sure ANTHROPIC_API_KEY is always set (empty string surfaces a clearer
  // error from the SDK than a missing key).
  if (env["ANTHROPIC_API_KEY"] === undefined) env["ANTHROPIC_API_KEY"] = "";
  return env;
}

function unwrapRelated<T>(value: unknown): T | null {
  if (!value) return null;
  if (Array.isArray(value)) return (value[0] as T) ?? null;
  return value as T;
}
