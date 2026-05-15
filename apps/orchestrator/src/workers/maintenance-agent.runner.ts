import { execFileSync } from "child_process";
import * as fs from "fs";
import * as path from "path";
import { query } from "@anthropic-ai/claude-agent-sdk";
import type {
  MaintenanceCapabilityId,
  MaintenanceJobPayload,
} from "@robin/shared-types";
import { getSupabaseClient } from "../db/supabase.client";
import { log } from "../utils/logger";
import { setupRepoForRead, buildAuthenticatedCloneUrl } from "../services/repo-setup";
import { loadProfileBundle } from "../services/profile-loader";
import {
  computeBugFindingDedupHash,
  computeSpecFindingDedupHash,
} from "../services/dedup";
import {
  validateSpecDiscoveryOutput,
  type SpecDiscoveryRawOutput,
  type ValidatedSpecFinding,
} from "../services/spec-discovery.validator";
import {
  validateBugDiscoveryOutput,
  type BugDiscoveryRawOutput,
  type ValidatedBugFinding,
} from "../services/bug-discovery.validator";
import {
  validateSpecImplPlan,
  validateSpecImplResult,
  type SpecImplPlan,
} from "../services/spec-impl.validator";
import {
  findMatchingIssue,
  listOpenIssues,
  type OpenIssue,
} from "../services/github-issues.service";
import { getInstallationToken } from "../services/github.service";
import { withRepoImplLock } from "../services/repo-lock";

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
  findingId: string | null;
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
    mcp_config: { mcpServers?: Record<string, unknown> } | null;
  };
  capability: {
    id: MaintenanceCapabilityId;
    profile_path: string;
    per_run_token_cap: number;
  };
  config: {
    spec_paths: string[];
    protected_paths: string[];
    bug_noise_allowlist: string[];
    bug_source_config: Record<string, unknown>;
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
    findingId: payload.findingId ?? null,
  };

  // bug_impl ships in Phase 3 step D. For now only the three implemented
  // capabilities pass the whitelist.
  if (
    payload.capabilityDefinitionId !== "spec_discovery" &&
    payload.capabilityDefinitionId !== "bug_discovery" &&
    payload.capabilityDefinitionId !== "spec_impl"
  ) {
    const reason = `Capability ${payload.capabilityDefinitionId} not implemented yet`;
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
    if (ctx.capabilityDefinitionId === "spec_impl") {
      return await runSpecImpl(ctx, config);
    }
    if (ctx.capabilityDefinitionId === "bug_discovery") {
      return await runBugDiscovery(ctx, config);
    }
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

// ─── Bug discovery ──────────────────────────────────────────────────────────

async function runBugDiscovery(
  ctx: RunContext,
  config: LoadedConfig
): Promise<MaintenanceRunOutcome> {
  // 1. Resolve repo on disk + capture recent commits as commit-correlation context.
  const repoUrl = `https://github.com/${config.repository.full_name}.git`;
  const { repoPath } = await setupRepoForRead({
    repositoryId: config.repository.id,
    repoUrl,
    defaultBranch: config.repository.default_branch,
  });

  const recentCommits = collectRecentCommits(repoPath, 30);

  // 2. Open GitHub issues for dedup if the installation has issues:read.
  const openIssues = await loadOpenIssuesIfPermitted(config.repository.full_name);

  // 3. Existing bug_findings hashes (so the model self-dedups upstream).
  const existingHashes = await loadExistingBugDedupHashes(ctx.repositoryId);

  // 4. Profile + MCP resolution (Sentry comes from workspace.mcp_config or
  // bug_source_config.mcpServers).
  const profile = loadProfileBundle("bug_discovery", "apps/orchestrator/profiles/bug-discovery");
  const mcpServers = resolveBugDiscoveryMcpServers(config);

  // 5. Build prompt + invoke Claude.
  const prompt = buildBugDiscoveryPrompt({
    protectedPaths: config.config.protected_paths,
    noiseAllowlist: config.config.bug_noise_allowlist,
    existingHashes,
    openIssues: openIssues ?? [],
    recentCommits,
    sentryConfigured: Object.keys(mcpServers).length > 0,
  });

  const claudeOutput = await invokeClaude({
    cwd: repoPath,
    systemPrompt: profile.systemPrompt,
    prompt,
    allowedTools: profile.allowedTools,
    ...(Object.keys(mcpServers).length > 0 ? { mcpServers } : {}),
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

  // 6. Validate.
  let validation;
  try {
    validation = validateBugDiscoveryOutput(claudeOutput.parsed as BugDiscoveryRawOutput, {
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

  // 7. Server-side noise filter (bug_noise_allowlist) + GitHub issue dedup.
  const filtered = validation.output.findings.filter((finding) => {
    if (config.config.bug_noise_allowlist.includes(finding.source_ref ?? "")) return false;
    if (
      openIssues &&
      findMatchingIssue({
        finding: { title: finding.title, source_ref: finding.source_ref },
        issues: openIssues,
      })
    ) {
      return false;
    }
    return true;
  });

  // 8. Insert into bug_findings (unique on repository_id + dedup_hash).
  const inserted = await insertBugFindings({ ctx, findings: filtered });

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
    github_issue_dedup_skipped: openIssues === null,
  });
  for (const finding of inserted) {
    await insertEvent(ctx, "finding.created", {
      finding_id: finding.id,
      type: "bug",
      repository_id: ctx.repositoryId,
      severity: finding.severity,
      confidence: finding.confidence,
    });
  }

  return {
    status: "completed",
    findingsCreated: inserted.length,
    tokensUsed,
    costUsd,
  };
}

// ─── Spec implementation ───────────────────────────────────────────────────

async function runSpecImpl(
  ctx: RunContext,
  config: LoadedConfig
): Promise<MaintenanceRunOutcome> {
  if (!ctx.findingId) {
    const reason = "spec_impl run requires findingId in payload";
    await markRun(ctx, "validation_failed", { errorMessage: reason });
    await insertEvent(ctx, "agent.run.failed", { reason });
    return { status: "validation_failed", findingsCreated: 0, tokensUsed: 0, costUsd: 0, errorMessage: reason };
  }

  // 1. Load the approved finding + linked task (or create one).
  const finding = await loadSpecFinding(ctx.findingId, ctx.workspaceId);
  if (!finding) {
    const reason = "spec_finding not found for workspace";
    await markRun(ctx, "failed", { errorMessage: reason });
    await insertEvent(ctx, "agent.run.failed", { reason });
    return { status: "failed", findingsCreated: 0, tokensUsed: 0, costUsd: 0, errorMessage: reason };
  }
  if (finding.triage_state !== "approved") {
    const reason = `finding is not approved (state=${finding.triage_state})`;
    await markRun(ctx, "validation_failed", { errorMessage: reason });
    await insertEvent(ctx, "agent.run.failed", { reason });
    return { status: "validation_failed", findingsCreated: 0, tokensUsed: 0, costUsd: 0, errorMessage: reason };
  }

  // 2. Acquire per-repository implementation lock — serializes against task,
  // sprint, and other impl runs touching the same working tree.
  const locked = await withRepoImplLock(ctx.repositoryId, async () => {
    return runSpecImplLocked(ctx, config, finding);
  });

  if (!locked.acquired) {
    const reason = "repository impl lock is held by another job";
    await markRun(ctx, "failed", { errorMessage: reason });
    await insertEvent(ctx, "agent.run.failed", { reason });
    return { status: "failed", findingsCreated: 0, tokensUsed: 0, costUsd: 0, errorMessage: reason };
  }

  return locked.value;
}

async function runSpecImplLocked(
  ctx: RunContext,
  config: LoadedConfig,
  finding: LoadedSpecFinding
): Promise<MaintenanceRunOutcome> {
  // 3. Resolve task (create if missing) — wires findings into the task flow.
  const task = await ensureSpecImplTask(ctx, finding);

  // 4. Setup repo at default branch, then create the impl branch.
  const repoUrl = `https://github.com/${config.repository.full_name}.git`;
  const { repoPath } = await setupRepoForRead({
    repositoryId: config.repository.id,
    repoUrl,
    defaultBranch: config.repository.default_branch,
  });
  const branchName = `feat/spec-${finding.id.slice(0, 8)}-${slugify(finding.requirement_text).slice(0, 40)}`;
  prepareImplBranch(repoPath, config.repository.default_branch, branchName);

  // 5. Load profile + run planning pass (read-only).
  const profile = loadProfileBundle("spec_impl", "apps/orchestrator/profiles/spec-impl");
  const planPrompt = buildSpecImplPlanPrompt({
    finding,
    branch: branchName,
    protectedPaths: config.config.protected_paths,
  });
  const planOutput = await invokeClaude({
    cwd: repoPath,
    systemPrompt: profile.systemPrompt,
    prompt: `## Phase 1 — Planning (read-only)\n\n${planPrompt}`,
    allowedTools: ["Read", "Grep", "Glob"],
  });

  if (!planOutput.parsed) {
    return abortRun(ctx, "validation_failed", "plan output not parseable", planOutput);
  }

  let plan: SpecImplPlan;
  try {
    plan = validateSpecImplPlan(planOutput.parsed, {
      protectedPaths: config.config.protected_paths,
    });
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err);
    return abortRun(ctx, "validation_failed", message, planOutput);
  }

  if (plan.needs_decomposition) {
    await unapproveFinding(finding.id, "needs_decomposition: " + (plan.decomposition_reason ?? ""));
    return abortRun(ctx, "validation_failed", "needs_decomposition", planOutput);
  }

  // 6. Persist plan to tasks.plan_json for audit.
  await persistPlan(task.id, plan);

  // 7. Implementation pass with write tools.
  const implPrompt = buildSpecImplImplementationPrompt({
    finding,
    branch: branchName,
    plan,
    protectedPaths: config.config.protected_paths,
    defaultBranch: config.repository.default_branch,
    repoFullName: config.repository.full_name,
  });
  const implOutput = await invokeClaude({
    cwd: repoPath,
    systemPrompt: profile.systemPrompt,
    prompt: `## Phase 2 — Implementation\n\n${implPrompt}`,
    allowedTools: ["Read", "Grep", "Glob", "Edit", "Write", "Bash"],
  });

  if (!implOutput.parsed) {
    return abortRun(ctx, "validation_failed", "impl output not parseable", implOutput, planOutput);
  }

  let validated;
  try {
    validated = validateSpecImplResult(implOutput.parsed, {
      protectedPaths: config.config.protected_paths,
      allowlist: plan.file_allowlist,
      expectedBranch: branchName,
    });
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err);
    return abortRun(ctx, "validation_failed", message, implOutput, planOutput);
  }

  const totalTokens =
    (plan.tokens_used || planOutput.tokensUsed) +
    (validated.result.tokens_used || implOutput.tokensUsed);
  const totalCost =
    (plan.cost_usd || planOutput.costUsd) +
    (validated.result.cost_usd || implOutput.costUsd);

  if (validated.result.outcome === "abandoned") {
    await unapproveFinding(finding.id, "agent_abandoned: " + (validated.result.reason ?? ""));
    await markRun(ctx, "failed", {
      completedAt: new Date().toISOString(),
      errorMessage: validated.result.reason ?? "abandoned",
      tokensUsed: totalTokens,
      costUsd: totalCost,
    });
    await insertEvent(ctx, "agent.run.failed", {
      reason: "abandoned",
      detail: validated.result.reason,
    });
    return {
      status: "failed",
      findingsCreated: 0,
      tokensUsed: totalTokens,
      costUsd: totalCost,
      errorMessage: validated.result.reason ?? "abandoned",
    };
  }

  // 8. Wire the PR + close the task loop.
  if (validated.result.pr_url) {
    await addTaskArtifact(task.id, ctx.workspaceId, {
      type: "pr",
      url: validated.result.pr_url,
      title: `spec_impl: ${finding.requirement_text.slice(0, 80)}`,
    });
  }
  await markTaskInReview(task.id, ctx.workspaceId);
  await markFindingImplemented(finding.id, task.id);

  await markRun(ctx, "completed", {
    completedAt: new Date().toISOString(),
    tokensUsed: totalTokens,
    costUsd: totalCost,
    findingsCreated: 0,
  });
  await insertEvent(ctx, "agent.run.completed", {
    finding_id: finding.id,
    task_id: task.id,
    pr_url: validated.result.pr_url,
    files_changed: validated.result.files_changed.length,
    tests_added: validated.result.tests_added.length,
    tokens_used: totalTokens,
    cost_usd: totalCost,
    warnings: validated.warnings,
  });

  return {
    status: "completed",
    findingsCreated: 0,
    tokensUsed: totalTokens,
    costUsd: totalCost,
  };
}

// ─── Spec impl helpers ──────────────────────────────────────────────────────

type LoadedSpecFinding = {
  id: string;
  workspace_id: string;
  repository_id: string;
  requirement_text: string;
  requirement_source_path: string;
  requirement_source_line: number | null;
  status: string;
  triage_state: string;
  task_id: string | null;
  suggested_action: string | null;
  confidence: number;
};

async function loadSpecFinding(
  findingId: string,
  workspaceId: string
): Promise<LoadedSpecFinding | null> {
  const supabase = getSupabaseClient();
  const { data, error } = await supabase
    .from("spec_findings")
    .select(
      "id, workspace_id, repository_id, requirement_text, requirement_source_path, requirement_source_line, status, triage_state, task_id, suggested_action, confidence"
    )
    .eq("id", findingId)
    .eq("workspace_id", workspaceId)
    .maybeSingle();
  if (error) {
    log.warn({ findingId, error: error.message }, "spec_impl: loadSpecFinding failed");
    return null;
  }
  return (data as LoadedSpecFinding | null) ?? null;
}

async function ensureSpecImplTask(
  ctx: RunContext,
  finding: LoadedSpecFinding
): Promise<{ id: string }> {
  const supabase = getSupabaseClient();
  if (finding.task_id) return { id: finding.task_id };

  const { data, error } = await supabase
    .from("tasks")
    .insert({
      workspace_id: ctx.workspaceId,
      repository_id: ctx.repositoryId,
      title: `[spec] ${finding.requirement_text.slice(0, 200)}`,
      description:
        (finding.suggested_action ?? "") +
        `\n\nSource: ${finding.requirement_source_path}${
          finding.requirement_source_line ? `:${finding.requirement_source_line}` : ""
        }`,
      type: "feature",
      priority: "medium",
      status: "in_progress",
      source_finding_type: "spec",
      source_finding_id: finding.id,
    })
    .select("id")
    .single();
  if (error || !data) {
    throw new Error(`spec_impl: could not create task — ${error?.message ?? "no row"}`);
  }
  await supabase
    .from("spec_findings")
    .update({ task_id: (data as { id: string }).id })
    .eq("id", finding.id);
  return data as { id: string };
}

async function persistPlan(taskId: string, plan: SpecImplPlan): Promise<void> {
  const supabase = getSupabaseClient();
  const { error } = await supabase
    .from("tasks")
    .update({
      plan_json: plan as unknown as Record<string, unknown>,
      updated_at: new Date().toISOString(),
    })
    .eq("id", taskId);
  if (error) {
    log.warn({ taskId, error: error.message }, "spec_impl: plan persist failed");
  }
}

async function markTaskInReview(taskId: string, workspaceId: string): Promise<void> {
  const supabase = getSupabaseClient();
  const { error } = await supabase
    .from("tasks")
    .update({ status: "in_review", updated_at: new Date().toISOString() })
    .eq("id", taskId)
    .eq("workspace_id", workspaceId);
  if (error) log.warn({ taskId, error: error.message }, "spec_impl: markTaskInReview failed");
}

async function markFindingImplemented(findingId: string, taskId: string): Promise<void> {
  const supabase = getSupabaseClient();
  const { error } = await supabase
    .from("spec_findings")
    .update({
      triage_state: "implemented",
      task_id: taskId,
      updated_at: new Date().toISOString(),
    })
    .eq("id", findingId);
  if (error) log.warn({ findingId, error: error.message }, "spec_impl: markFindingImplemented failed");
}

async function unapproveFinding(findingId: string, note: string): Promise<void> {
  const supabase = getSupabaseClient();
  const { error } = await supabase
    .from("spec_findings")
    .update({
      triage_state: "pending",
      triage_note: note.slice(0, 1500),
      updated_at: new Date().toISOString(),
    })
    .eq("id", findingId);
  if (error) log.warn({ findingId, error: error.message }, "spec_impl: unapproveFinding failed");
}

async function addTaskArtifact(
  taskId: string,
  workspaceId: string,
  artifact: { type: string; url: string; title?: string }
): Promise<void> {
  const supabase = getSupabaseClient();
  const { error } = await supabase.from("task_artifacts").insert({
    task_id: taskId,
    workspace_id: workspaceId,
    type: artifact.type,
    url: artifact.url,
    title: artifact.title ?? null,
  });
  if (error) log.warn({ taskId, error: error.message }, "spec_impl: addTaskArtifact failed");
}

async function abortRun(
  ctx: RunContext,
  status: "validation_failed" | "failed",
  reason: string,
  output: { tokensUsed: number; costUsd: number },
  planOutput?: { tokensUsed: number; costUsd: number }
): Promise<MaintenanceRunOutcome> {
  const totalTokens = (planOutput?.tokensUsed ?? 0) + output.tokensUsed;
  const totalCost = (planOutput?.costUsd ?? 0) + output.costUsd;
  await markRun(ctx, status, {
    errorMessage: reason,
    tokensUsed: totalTokens,
    costUsd: totalCost,
    completedAt: new Date().toISOString(),
  });
  await insertEvent(ctx, "agent.run.failed", { reason });
  return {
    status,
    findingsCreated: 0,
    tokensUsed: totalTokens,
    costUsd: totalCost,
    errorMessage: reason,
  };
}

function prepareImplBranch(
  repoPath: string,
  defaultBranch: string,
  branchName: string
): void {
  // Branch must be safe per git check-ref-format. assertSafeBranch already
  // validated defaultBranch via setupRepoForRead. Validate the derived branch.
  if (!/^[A-Za-z0-9._/\-]{1,200}$/.test(branchName) || branchName.startsWith("-")) {
    throw new Error(`spec_impl: unsafe branch name ${JSON.stringify(branchName)}`);
  }
  // Try to checkout existing branch (rebase across retries); fall back to new.
  try {
    execFileSync("git", ["checkout", branchName], {
      cwd: repoPath,
      encoding: "utf-8",
      stdio: ["ignore", "pipe", "pipe"],
    });
    execFileSync("git", ["reset", "--hard", `origin/${defaultBranch}`], {
      cwd: repoPath,
      encoding: "utf-8",
      stdio: ["ignore", "pipe", "pipe"],
    });
  } catch {
    execFileSync("git", ["checkout", "-b", branchName, `origin/${defaultBranch}`], {
      cwd: repoPath,
      encoding: "utf-8",
      stdio: ["ignore", "pipe", "pipe"],
    });
  }
}

function slugify(text: string): string {
  return text
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "")
    .slice(0, 60);
}

function buildSpecImplPlanPrompt(args: {
  finding: LoadedSpecFinding;
  branch: string;
  protectedPaths: string[];
}): string {
  const lines: string[] = [];
  lines.push("# Approved spec finding to implement");
  lines.push(`Branch: \`${args.branch}\` (checked out already; do not change it).`);
  lines.push("");
  lines.push("## Finding");
  lines.push(`- requirement: ${args.finding.requirement_text}`);
  lines.push(
    `- source: ${args.finding.requirement_source_path}${
      args.finding.requirement_source_line ? `:${args.finding.requirement_source_line}` : ""
    }`
  );
  lines.push(`- status: ${args.finding.status}`);
  if (args.finding.suggested_action) {
    lines.push(`- suggested_action: ${args.finding.suggested_action}`);
  }
  lines.push("");
  lines.push("## protected_paths (never include in file_allowlist)");
  for (const p of args.protectedPaths) lines.push(`- ${p}`);
  lines.push("");
  lines.push(
    "Return exactly one JSON object with `phase: \"plan\"` matching the spec-impl output contract."
  );
  return lines.join("\n");
}

function buildSpecImplImplementationPrompt(args: {
  finding: LoadedSpecFinding;
  branch: string;
  plan: SpecImplPlan;
  protectedPaths: string[];
  defaultBranch: string;
  repoFullName: string;
}): string {
  const lines: string[] = [];
  lines.push("# Approved plan — implement now");
  lines.push("");
  lines.push("## Branch");
  lines.push(`\`${args.branch}\` targeting \`${args.defaultBranch}\` on \`${args.repoFullName}\`.`);
  lines.push("");
  lines.push("## Allowlist (only these files may be written)");
  for (const f of args.plan.file_allowlist) lines.push(`- ${f}`);
  lines.push("");
  lines.push("## Test strategy (must execute)");
  lines.push(args.plan.test_strategy);
  lines.push("");
  lines.push("## Protected (must NOT be written)");
  for (const p of args.protectedPaths) lines.push(`- ${p}`);
  lines.push("");
  lines.push(
    "Implement, commit, push, and open a PR. Emit one JSON object with `phase: \"impl\"`."
  );
  return lines.join("\n");
}

// ─── DB access ──────────────────────────────────────────────────────────────

async function loadConfig(ctx: RunContext): Promise<LoadedConfig | null> {
  const supabase = getSupabaseClient();
  const { data, error } = await supabase
    .from("workspace_capability_configs")
    .select(`
      spec_paths,
      protected_paths,
      bug_noise_allowlist,
      bug_source_config,
      per_run_token_cap,
      workspaces:workspace_id(id, timezone, mcp_config),
      repositories:repository_id(id, full_name, default_branch, is_enabled),
      capability_definitions:capability_definition_id(id, profile_path, per_run_token_cap_default)
    `)
    .eq("id", ctx.workspaceCapabilityConfigId)
    .single();

  if (error || !data) {
    log.warn({ agentRunId: ctx.agentRunId, error: error?.message }, "maintenance-agent: loadConfig failed");
    return null;
  }

  const workspace = unwrapRelated<{
    id: string;
    timezone: string | null;
    mcp_config: { mcpServers?: Record<string, unknown> } | null;
  }>(data["workspaces"]);
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
      bug_noise_allowlist: (data["bug_noise_allowlist"] as string[] | null) ?? [],
      bug_source_config:
        (data["bug_source_config"] as Record<string, unknown> | null) ?? {},
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

async function loadExistingBugDedupHashes(repositoryId: string): Promise<string[]> {
  const supabase = getSupabaseClient();
  const { data, error } = await supabase
    .from("bug_findings")
    .select("dedup_hash")
    .eq("repository_id", repositoryId)
    .in("triage_state", ["pending", "approved", "implemented", "snoozed"])
    .limit(2000);

  if (error) {
    log.warn({ repositoryId, error: error.message }, "maintenance-agent: bug dedup hash lookup failed");
    return [];
  }
  return (data ?? []).map((row: { dedup_hash: string }) => row.dedup_hash);
}

async function insertBugFindings(args: {
  ctx: RunContext;
  findings: ValidatedBugFinding[];
}): Promise<Array<{ id: string; severity: string; confidence: number }>> {
  if (args.findings.length === 0) return [];
  const supabase = getSupabaseClient();
  const inserted: Array<{ id: string; severity: string; confidence: number }> = [];

  for (const finding of args.findings) {
    const dedupHash = computeBugFindingDedupHash({
      repositoryId: args.ctx.repositoryId,
      title: finding.title,
      source: finding.source,
      sourceRef: finding.source_ref,
      severity: finding.severity,
    });

    const { data, error } = await supabase
      .from("bug_findings")
      .insert({
        workspace_id: args.ctx.workspaceId,
        repository_id: args.ctx.repositoryId,
        agent_run_id: args.ctx.agentRunId,
        title: finding.title,
        description: finding.description,
        severity: finding.severity,
        hypothesis: finding.hypothesis,
        repro_steps: finding.repro_steps,
        evidence: finding.evidence,
        affected_paths: finding.affected_paths,
        suggested_fix_outline: finding.suggested_fix_outline,
        confidence: finding.confidence,
        source: finding.source,
        source_ref: finding.source_ref,
        external_issue_url: finding.external_issue_url,
        dedup_hash: dedupHash,
      })
      .select("id, severity, confidence")
      .single();

    if (error) {
      const code = (error as { code?: string }).code;
      if (code === "23505") continue;
      log.warn(
        { agentRunId: args.ctx.agentRunId, error: error.message },
        "maintenance-agent: bug_findings insert failed"
      );
      continue;
    }

    if (data) inserted.push(data as { id: string; severity: string; confidence: number });
  }

  return inserted;
}

function collectRecentCommits(
  repoPath: string,
  count: number
): Array<{ sha: string; subject: string; date: string; files: string[] }> {
  try {
    const log = execFileSync(
      "git",
      [
        "log",
        `-n${count}`,
        "--no-merges",
        "--pretty=format:%H%x09%cI%x09%s",
        "--name-only",
      ],
      { cwd: repoPath, encoding: "utf-8", stdio: ["ignore", "pipe", "pipe"] }
    );
    const blocks = log.split(/\n(?=[0-9a-f]{40}\t)/);
    return blocks
      .map((block) => {
        const [header, ...fileLines] = block.split("\n");
        if (!header) return null;
        const [sha, date, subject] = header.split("\t");
        if (!sha || !date || !subject) return null;
        return {
          sha,
          date,
          subject,
          files: fileLines.filter((line) => line.trim().length > 0),
        };
      })
      .filter((c): c is { sha: string; subject: string; date: string; files: string[] } => c !== null);
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err);
    log.warn({ repoPath, error: message }, "maintenance-agent: collectRecentCommits failed");
    return [];
  }
}

async function loadOpenIssuesIfPermitted(fullName: string): Promise<OpenIssue[] | null> {
  const appId = process.env["GITHUB_APP_ID"];
  const privateKeyB64 = process.env["GITHUB_APP_PRIVATE_KEY_B64"];
  const installationIdStr = process.env["GITHUB_INSTALLATION_ID"];
  if (!appId || !privateKeyB64 || !installationIdStr) {
    log.warn({ fullName }, "maintenance-agent: GitHub credentials missing, skipping issue dedup");
    return null;
  }
  try {
    const token = await getInstallationToken(
      appId,
      privateKeyB64,
      parseInt(installationIdStr, 10)
    );
    return listOpenIssues({ token, fullName });
  } catch (err) {
    log.warn(
      { fullName, error: err instanceof Error ? err.message : String(err) },
      "maintenance-agent: installation token / issue list failed"
    );
    return null;
  }
}

function resolveBugDiscoveryMcpServers(config: LoadedConfig): Record<string, unknown> {
  // bug_source_config.mcpServers wins when present (capability-scoped), else
  // fall back to workspaces.mcp_config.mcpServers. Sentry is the typical case.
  const fromConfig = (config.config.bug_source_config?.["mcpServers"] ?? null) as
    | Record<string, unknown>
    | null;
  if (fromConfig && typeof fromConfig === "object") return fromConfig;

  const workspaceServers = config.workspace.mcp_config?.mcpServers;
  if (workspaceServers && typeof workspaceServers === "object") return workspaceServers;
  return {};
}

function buildBugDiscoveryPrompt(args: {
  protectedPaths: string[];
  noiseAllowlist: string[];
  existingHashes: string[];
  openIssues: OpenIssue[];
  recentCommits: Array<{ sha: string; subject: string; date: string; files: string[] }>;
  sentryConfigured: boolean;
}): string {
  const lines: string[] = [];
  lines.push("# Bug Discovery Run");
  lines.push("");
  if (args.sentryConfigured) {
    lines.push(
      "A Sentry MCP server is configured. Prefer Sentry evidence when classifying severity P0/P1."
    );
  } else {
    lines.push(
      "No Sentry MCP server is configured. Static analysis findings only — cap severity at P2 and require confidence ≥ 0.75."
    );
  }
  lines.push("");
  lines.push("## protected_paths (do not cite as affected_paths)");
  for (const p of args.protectedPaths) lines.push(`- ${p}`);
  lines.push("");
  if (args.noiseAllowlist.length > 0) {
    lines.push("## bug_noise_allowlist (Sentry source_refs to ignore)");
    for (const ref of args.noiseAllowlist) lines.push(`- ${ref}`);
    lines.push("");
  }
  if (args.openIssues.length > 0) {
    lines.push("## open_github_issues (do not re-emit duplicates)");
    for (const issue of args.openIssues.slice(0, 50)) {
      lines.push(`- #${issue.number} — ${issue.title}`);
    }
    lines.push("");
  }
  if (args.recentCommits.length > 0) {
    lines.push("## recent_commits (last 30)");
    for (const commit of args.recentCommits) {
      lines.push(
        `- ${commit.sha.slice(0, 7)} ${commit.date} ${commit.subject} (files: ${commit.files.slice(0, 5).join(", ")}${commit.files.length > 5 ? `, +${commit.files.length - 5}` : ""})`
      );
    }
    lines.push("");
  }
  if (args.existingHashes.length > 0) {
    lines.push("## existing_dedup_hashes");
    lines.push("```");
    for (const h of args.existingHashes.slice(0, 200)) lines.push(h);
    lines.push("```");
    lines.push("");
  }
  lines.push("Return exactly one JSON object matching the output contract.");
  return lines.join("\n");
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
  mcpServers?: Record<string, unknown>;
}): Promise<{
  parsed: unknown;
  tokensUsed: number;
  costUsd: number;
  rawText: string;
}> {
  const fullPrompt = `${args.systemPrompt}\n\n---\n\n${args.prompt}`;

  const options: Record<string, unknown> = {
    cwd: args.cwd,
    model: DEFAULT_MODEL,
    maxTurns: DEFAULT_MAX_TURNS,
    permissionMode: "bypassPermissions",
    allowDangerouslySkipPermissions: true,
    allowedTools: args.allowedTools,
    settingSources: ["project"],
    env: buildClaudeEnv(),
  };
  if (args.mcpServers && Object.keys(args.mcpServers).length > 0) {
    options["mcpServers"] = args.mcpServers;
  }

  const agentQuery = query({
    prompt: fullPrompt,
    options: options as NonNullable<Parameters<typeof query>[0]["options"]>,
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
