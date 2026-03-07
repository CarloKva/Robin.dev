/**
 * Ops Diagnostics Worker
 * Control-plane only. Processes jobs from the "ops-diagnostics" queue.
 *
 * Flow:
 *  1. Mark run as started, log entry emitted
 *  2. Phase collection (0→60%): Supabase cross-tenant query + Hetzner API + SSH diagnostics
 *  3. Phase AI (60→90%): Claude API analysis + structured recommendations
 *  4. Phase save (90→100%): persist all results, mark completed
 *  5. On error: mark failed, append error log entry
 *
 * "ops-execute" queue is also handled in this file (separate worker).
 */

import { Worker } from "bullmq";
import type { Job } from "bullmq";
import type {
  OpsDiagnosticsJobPayload,
  OpsExecuteJobPayload,
  OpsLogEntry,
  OpsRawDiagnostics,
  SupabaseDiagnostics,
  HetznerServerStatus,
  OpsRecommendation,
} from "@robin/shared-types";
import { getRedisConnection } from "../db/redis.client";
import { getSupabaseClient } from "../db/supabase.client";
import { collectAllVpsDiagnostics, sshExec } from "../services/ops-ssh.service";
import { log } from "../utils/logger";

export const OPS_DIAGNOSTICS_QUEUE = "ops-diagnostics";
export const OPS_EXECUTE_QUEUE = "ops-execute";

const HETZNER_API = "https://api.hetzner.cloud/v1";

// ─── Helpers ──────────────────────────────────────────────────────────────────

type OpsRunRow = {
  log: OpsLogEntry[];
};

async function appendLog(
  opsRunId: string,
  entry: OpsLogEntry,
  progress?: number
): Promise<void> {
  const db = getSupabaseClient();
  const { data } = await db
    .from("ops_runs")
    .select("log")
    .eq("id", opsRunId)
    .single<OpsRunRow>();

  const currentLog: OpsLogEntry[] = Array.isArray(data?.log) ? (data.log as OpsLogEntry[]) : [];
  const updateData: Record<string, unknown> = { log: [...currentLog, entry] };
  if (progress !== undefined) updateData["progress"] = progress;

  await db.from("ops_runs").update(updateData).eq("id", opsRunId);
}

function makeEntry(
  level: OpsLogEntry["level"],
  source: OpsLogEntry["source"],
  message: string,
  workspace?: string
): OpsLogEntry {
  if (workspace !== undefined) {
    return { level, source, message, workspace };
  }
  return { level, source, message };
}

// ─── Collection phases ────────────────────────────────────────────────────────

async function collectSupabaseDiagnostics(): Promise<SupabaseDiagnostics> {
  const db = getSupabaseClient();

  // Stuck tasks: in_progress or queued for >4 hours
  const { data: stuckRaw } = await db
    .from("tasks")
    .select("id, title, status, updated_at, workspace_id")
    .in("status", ["in_progress", "queued"])
    .lt("updated_at", new Date(Date.now() - 4 * 60 * 60 * 1000).toISOString());

  // Get workspace slugs for stuck tasks
  const stuckTasks = [];
  if (stuckRaw && stuckRaw.length > 0) {
    const workspaceIds = [...new Set(stuckRaw.map((t) => t.workspace_id as string))];
    const { data: workspaces } = await db
      .from("workspaces")
      .select("id, slug")
      .in("id", workspaceIds);

    const wsMap = new Map<string, string>(
      (workspaces ?? []).map((w) => [w.id as string, w.slug as string])
    );

    for (const t of stuckRaw) {
      const hoursStuck =
        (Date.now() - new Date(t.updated_at as string).getTime()) /
        (1000 * 60 * 60);
      stuckTasks.push({
        workspaceSlug: wsMap.get(t.workspace_id as string) ?? t.workspace_id as string,
        taskId: t.id as string,
        taskTitle: t.title as string,
        status: t.status as string,
        hoursStuck: Math.round(hoursStuck * 10) / 10,
      });
    }
  }

  // Offline agents: provisioning_status=online but last_seen_at > 2 min ago
  const { data: offlineRaw } = await db
    .from("agents")
    .select("id, name, vps_ip, workspace_id, last_seen_at")
    .eq("provisioning_status", "online")
    .not("last_seen_at", "is", null)
    .lt(
      "last_seen_at",
      new Date(Date.now() - 2 * 60 * 1000).toISOString()
    );

  const offlineAgents = [];
  if (offlineRaw && offlineRaw.length > 0) {
    const workspaceIds = [...new Set(offlineRaw.map((a) => a.workspace_id as string))];
    const { data: workspaces } = await db
      .from("workspaces")
      .select("id, slug")
      .in("id", workspaceIds);

    const wsMap = new Map<string, string>(
      (workspaces ?? []).map((w) => [w.id as string, w.slug as string])
    );

    for (const a of offlineRaw) {
      const minutesOffline =
        (Date.now() - new Date(a.last_seen_at as string).getTime()) /
        (1000 * 60);
      offlineAgents.push({
        workspaceSlug: wsMap.get(a.workspace_id as string) ?? a.workspace_id as string,
        agentName: a.name as string,
        vpsIp: (a.vps_ip as string) ?? "unknown",
        minutesOffline: Math.round(minutesOffline),
      });
    }
  }

  return { stuckTasks, offlineAgents };
}

async function collectHetznerStatus(): Promise<HetznerServerStatus[]> {
  const token = process.env["HETZNER_API_TOKEN"];
  if (!token) {
    log.warn({}, "HETZNER_API_TOKEN not set — skipping Hetzner diagnostics");
    return [];
  }

  const res = await fetch(`${HETZNER_API}/servers?per_page=50`, {
    headers: { Authorization: `Bearer ${token}` },
  });

  if (!res.ok) {
    log.warn({ status: res.status }, "Hetzner API error");
    return [];
  }

  const body = (await res.json()) as {
    servers: Array<{
      id: number;
      name: string;
      status: string;
      public_net: { ipv4: { ip: string } | null };
      server_type: { name: string };
      datacenter: { name: string };
      labels: Record<string, string>;
    }>;
  };

  return (body.servers ?? []).map((s) => ({
    id: s.id,
    name: s.name,
    status: s.status,
    publicIp: s.public_net?.ipv4?.ip ?? "",
    serverType: s.server_type?.name ?? "",
    datacenter: s.datacenter?.name ?? "",
    labels: s.labels ?? {},
  }));
}

// ─── AI analysis ──────────────────────────────────────────────────────────────

function buildAiPrompt(raw: OpsRawDiagnostics): string {
  return `You are an SRE expert analyzing a Robin.dev multi-tenant system.
Robin.dev runs AI coding agents on Hetzner VPS instances, one per workspace/client.
Each VPS runs: robin-orchestrator-<slug> (systemd), Redis (local), Claude Code CLI.

Diagnostics collected at: ${raw.collectedAt}

## Stuck Tasks (>4h without progress)
${JSON.stringify(raw.supabase.stuckTasks, null, 2)}

## Offline Agents (last_seen_at > 2min ago, provisioning_status=online)
${JSON.stringify(raw.supabase.offlineAgents, null, 2)}

## Hetzner VPS Status
${JSON.stringify(raw.hetzner, null, 2)}

## SSH Diagnostics per VPS
${JSON.stringify(raw.vps, null, 2)}

Based on this data, respond with VALID JSON ONLY (no markdown, no commentary outside JSON):
{
  "analysis": "<markdown string: 2-4 paragraphs summarizing system health, issues found, root causes>",
  "recommendations": [
    {
      "severity": "safe" | "destructive",
      "title": "<short title>",
      "description": "<what this does and why>",
      "actionType": "restart_orchestrator" | "restart_redis" | "reset_stuck_task" | "clear_bullmq_stalled" | "pull_and_rebuild" | "manual_only",
      "params": { "<key>": "<value>" },
      "workspace": "<workspace_slug or omit if global>"
    }
  ]
}

Action type params:
- restart_orchestrator: { "slug": "<workspace_slug>", "vpsIp": "<ip>" }
- restart_redis: { "vpsIp": "<ip>" }
- reset_stuck_task: { "taskId": "<uuid>", "workspaceId": "<uuid>" }
- clear_bullmq_stalled: { "vpsIp": "<ip>", "jobId": "<bullmq_job_id>" }
- pull_and_rebuild: { "vpsIp": "<ip>", "slug": "<workspace_slug>" }
- manual_only: {} (AI suggests but cannot automate)`;
}

async function runAiAnalysis(
  raw: OpsRawDiagnostics
): Promise<{ analysis: string; recommendations: OpsRecommendation[] }> {
  const apiKey = process.env["ANTHROPIC_API_KEY"];
  if (!apiKey) {
    log.warn({}, "ANTHROPIC_API_KEY not set — skipping AI analysis");
    return {
      analysis: "AI analysis skipped: ANTHROPIC_API_KEY not configured.",
      recommendations: [],
    };
  }

  const Anthropic = (await import("@anthropic-ai/sdk")).default;
  const client = new Anthropic({ apiKey });

  const response = await client.messages.create({
    model: "claude-opus-4-6",
    max_tokens: 4096,
    system:
      "You are a senior SRE expert. Analyze system diagnostics and respond with valid JSON only. No markdown code blocks, no commentary — just the raw JSON object.",
    messages: [{ role: "user", content: buildAiPrompt(raw) }],
  });

  const textBlock = response.content.find((b) => b.type === "text");
  if (!textBlock || textBlock.type !== "text") {
    return {
      analysis: "AI analysis returned no text content.",
      recommendations: [],
    };
  }

  try {
    const parsed = JSON.parse(textBlock.text) as {
      analysis?: string;
      recommendations?: OpsRecommendation[];
    };
    return {
      analysis: parsed.analysis ?? "No analysis returned.",
      recommendations: Array.isArray(parsed.recommendations)
        ? parsed.recommendations
        : [],
    };
  } catch {
    log.warn({ rawText: textBlock.text.slice(0, 200) }, "AI response JSON parse failed");
    return {
      analysis: textBlock.text,
      recommendations: [],
    };
  }
}

// ─── Main job processor ───────────────────────────────────────────────────────

async function processOpsDiagnosticsJob(
  job: Job<OpsDiagnosticsJobPayload>
): Promise<void> {
  const { opsRunId } = job.data;
  const db = getSupabaseClient();

  log.info({ jobId: job.id, opsRunId }, "ops-diagnostics: job started");

  // Mark started
  await db
    .from("ops_runs")
    .update({ status: "running", progress: 0 })
    .eq("id", opsRunId);
  await appendLog(
    opsRunId,
    makeEntry("info", "system", "Diagnostics run started"),
    0
  );

  // ── Phase 1: Collection (0→60%) ─────────────────────────────────────────────

  // Supabase cross-tenant query
  await appendLog(
    opsRunId,
    makeEntry("info", "supabase", "Querying Supabase for stuck tasks and offline agents"),
    5
  );
  let supabaseDiag: SupabaseDiagnostics;
  try {
    supabaseDiag = await collectSupabaseDiagnostics();
    await appendLog(
      opsRunId,
      makeEntry(
        "info",
        "supabase",
        `Found ${supabaseDiag.stuckTasks.length} stuck tasks, ${supabaseDiag.offlineAgents.length} offline agents`
      ),
      15
    );
  } catch (err) {
    log.warn({ error: String(err) }, "Supabase diagnostics failed");
    supabaseDiag = { stuckTasks: [], offlineAgents: [] };
    await appendLog(
      opsRunId,
      makeEntry("warn", "supabase", `Supabase query failed: ${String(err)}`),
      15
    );
  }

  // Hetzner API
  await appendLog(
    opsRunId,
    makeEntry("info", "hetzner", "Querying Hetzner API for VPS status"),
    16
  );
  let hetznerStatus: HetznerServerStatus[];
  try {
    hetznerStatus = await collectHetznerStatus();
    await appendLog(
      opsRunId,
      makeEntry("info", "hetzner", `Retrieved ${hetznerStatus.length} Hetzner servers`),
      30
    );
  } catch (err) {
    log.warn({ error: String(err) }, "Hetzner diagnostics failed");
    hetznerStatus = [];
    await appendLog(
      opsRunId,
      makeEntry("warn", "hetzner", `Hetzner API failed: ${String(err)}`),
      30
    );
  }

  // SSH diagnostics — fetch online agents from DB
  const { data: onlineAgents } = await db
    .from("agents")
    .select("id, workspace_id, vps_ip")
    .eq("provisioning_status", "online")
    .not("vps_ip", "is", null);

  let agentsForSsh: Array<{ workspaceSlug: string; vpsIp: string }> = [];

  if (onlineAgents && onlineAgents.length > 0) {
    const workspaceIds = [
      ...new Set(onlineAgents.map((a) => a.workspace_id as string)),
    ];
    const { data: workspaces } = await db
      .from("workspaces")
      .select("id, slug")
      .in("id", workspaceIds);

    const wsMap = new Map<string, string>(
      (workspaces ?? []).map((w) => [w.id as string, w.slug as string])
    );

    agentsForSsh = onlineAgents.map((a) => ({
      workspaceSlug: wsMap.get(a.workspace_id as string) ?? (a.workspace_id as string),
      vpsIp: a.vps_ip as string,
    }));
  }

  await appendLog(
    opsRunId,
    makeEntry("info", "ssh", `Connecting to ${agentsForSsh.length} agent VPS`),
    31
  );

  const vpsDiag = await collectAllVpsDiagnostics(agentsForSsh);
  const sshFailed = vpsDiag.filter((v) => !v.sshReachable).length;

  await appendLog(
    opsRunId,
    makeEntry(
      sshFailed > 0 ? "warn" : "info",
      "ssh",
      `SSH complete: ${vpsDiag.length - sshFailed} reached, ${sshFailed} failed`
    ),
    60
  );

  const rawDiagnostics: OpsRawDiagnostics = {
    collectedAt: new Date().toISOString(),
    supabase: supabaseDiag,
    hetzner: hetznerStatus,
    vps: vpsDiag,
  };

  // ── Phase 2: AI analysis (60→90%) ───────────────────────────────────────────

  await appendLog(
    opsRunId,
    makeEntry("info", "ai", "Sending diagnostics to Claude for analysis"),
    61
  );

  let aiAnalysis: string | null = null;
  let aiRecommendations: OpsRecommendation[] | null = null;

  try {
    const result = await runAiAnalysis(rawDiagnostics);
    aiAnalysis = result.analysis;
    aiRecommendations = result.recommendations;
    await appendLog(
      opsRunId,
      makeEntry(
        "info",
        "ai",
        `AI analysis complete — ${result.recommendations.length} recommendations`
      ),
      90
    );
  } catch (err) {
    log.warn({ error: String(err) }, "AI analysis failed — completing without AI");
    await appendLog(
      opsRunId,
      makeEntry("warn", "ai", `AI analysis failed: ${String(err)} — run completed without AI`),
      90
    );
  }

  // ── Phase 3: Save results (90→100%) ─────────────────────────────────────────

  const { error: saveErr } = await db
    .from("ops_runs")
    .update({
      status: "completed",
      progress: 100,
      raw_diagnostics: rawDiagnostics as unknown as Record<string, unknown>,
      ai_analysis: aiAnalysis,
      ai_recommendations: aiRecommendations as unknown as Record<string, unknown>[],
      completed_at: new Date().toISOString(),
    })
    .eq("id", opsRunId);

  if (saveErr) {
    throw new Error(`Failed to save ops run results: ${saveErr.message}`);
  }

  await appendLog(
    opsRunId,
    makeEntry("info", "system", "Diagnostics run completed"),
    100
  );

  log.info({ jobId: job.id, opsRunId }, "ops-diagnostics: job completed");
}

// ─── Execute job processor ────────────────────────────────────────────────────

const SAFE_ACTION_WHITELIST = new Set([
  "restart_orchestrator",
  "restart_redis",
  "reset_stuck_task",
  "clear_bullmq_stalled",
]);

async function processOpsExecuteJob(
  job: Job<OpsExecuteJobPayload>
): Promise<void> {
  const { opsRunId, actionType, params, triggeredBy } = job.data;
  const db = getSupabaseClient();

  log.info({ jobId: job.id, opsRunId, actionType }, "ops-execute: job started");

  if (!SAFE_ACTION_WHITELIST.has(actionType)) {
    throw new Error(`Action type "${actionType}" is not in the safe whitelist`);
  }

  let result: { success: boolean; output: string };

  switch (actionType) {
    case "restart_orchestrator": {
      const { slug, vpsIp } = params as { slug: string; vpsIp: string };
      if (!slug || !vpsIp) throw new Error("restart_orchestrator requires slug and vpsIp");
      const safeSlug = slug.replace(/[^a-z0-9-]/gi, "");
      result = await sshExec(
        vpsIp,
        `sudo systemctl restart robin-orchestrator-${safeSlug}`
      );
      break;
    }
    case "restart_redis": {
      const { vpsIp } = params as { vpsIp: string };
      if (!vpsIp) throw new Error("restart_redis requires vpsIp");
      result = await sshExec(vpsIp, "sudo systemctl restart redis-server");
      break;
    }
    case "reset_stuck_task": {
      const { taskId } = params as { taskId: string };
      if (!taskId) throw new Error("reset_stuck_task requires taskId");

      const { data: task, error: fetchErr } = await db
        .from("tasks")
        .select("id, workspace_id, status")
        .eq("id", taskId)
        .maybeSingle();

      if (fetchErr || !task) {
        result = { success: false, output: `Task ${taskId} not found` };
        break;
      }

      if (!["in_progress", "queued"].includes(task.status as string)) {
        result = {
          success: false,
          output: `Task status is "${task.status}" — only in_progress/queued can be reset`,
        };
        break;
      }

      const { error: updateErr } = await db
        .from("tasks")
        .update({ status: "queued", queued_at: null, updated_at: new Date().toISOString() })
        .eq("id", taskId)
        .in("status", ["in_progress", "queued"]);

      if (!updateErr) {
        await db.from("task_events").insert({
          task_id: taskId,
          workspace_id: task.workspace_id,
          event_type: "task.state.changed",
          actor_type: "human",
          actor_id: triggeredBy,
          payload: {
            from: task.status,
            to: "queued",
            note: "Manual reset via Ops Diagnostics Panel",
          },
        });
        result = { success: true, output: "Task reset to queued" };
      } else {
        result = { success: false, output: `DB update failed: ${updateErr.message}` };
      }
      break;
    }
    case "clear_bullmq_stalled": {
      const { vpsIp, jobId } = params as { vpsIp: string; jobId: string };
      if (!vpsIp || !jobId) throw new Error("clear_bullmq_stalled requires vpsIp and jobId");
      // Sanitize jobId to prevent injection
      const safeJobId = jobId.replace(/[^a-z0-9:-]/gi, "");
      result = await sshExec(vpsIp, `redis-cli lrem bull:tasks:active 0 ${safeJobId}`);
      break;
    }
    default:
      throw new Error(`Unhandled action type: ${actionType}`);
  }

  // Append action result to ops_run
  const { data: runData } = await db
    .from("ops_runs")
    .select("actions_taken")
    .eq("id", opsRunId)
    .single<{ actions_taken: unknown[] }>();

  const actionsTaken = Array.isArray(runData?.actions_taken)
    ? runData.actions_taken
    : [];

  await db
    .from("ops_runs")
    .update({
      actions_taken: [
        ...actionsTaken,
        {
          actionType,
          params,
          triggeredBy,
          result,
          executedAt: new Date().toISOString(),
        },
      ],
    })
    .eq("id", opsRunId);

  log.info(
    { jobId: job.id, opsRunId, actionType, success: result.success },
    "ops-execute: job completed"
  );

  if (!result.success) {
    throw new Error(`Action "${actionType}" failed: ${result.output}`);
  }
}

// ─── Worker factories ─────────────────────────────────────────────────────────

export function createOpsDiagnosticsWorker(): Worker<OpsDiagnosticsJobPayload> {
  const worker = new Worker<OpsDiagnosticsJobPayload>(
    OPS_DIAGNOSTICS_QUEUE,
    async (job) => {
      try {
        await processOpsDiagnosticsJob(job);
      } catch (err) {
        const message = err instanceof Error ? err.message : String(err);
        log.error({ jobId: job.id, opsRunId: job.data.opsRunId, error: message }, "ops-diagnostics: job failed");

        try {
          const db = getSupabaseClient();
          const { data } = await db
            .from("ops_runs")
            .select("log")
            .eq("id", job.data.opsRunId)
            .single<OpsRunRow>();

          const currentLog: OpsLogEntry[] = Array.isArray(data?.log) ? (data.log as OpsLogEntry[]) : [];
          await db.from("ops_runs").update({
            status: "failed",
            log: [...currentLog, makeEntry("error", "system", `Fatal error: ${message}`)],
            completed_at: new Date().toISOString(),
          }).eq("id", job.data.opsRunId);
        } catch (dbErr) {
          log.error({ dbError: String(dbErr) }, "Failed to mark ops run as failed");
        }

        throw err;
      }
    },
    {
      connection: getRedisConnection(),
      concurrency: 2,
      stalledInterval: 60_000,
      maxStalledCount: 1,
    }
  );

  worker.on("completed", (job) => {
    log.info({ jobId: job.id }, "ops-diagnostics worker: job completed");
  });

  worker.on("failed", (job, err) => {
    if (!job) return;
    log.error({ jobId: job.id, error: err.message }, "ops-diagnostics worker: job permanently failed");
  });

  worker.on("error", (err) => {
    log.error({ error: err.message }, "ops-diagnostics worker error");
  });

  return worker;
}

export function createOpsExecuteWorker(): Worker<OpsExecuteJobPayload> {
  const worker = new Worker<OpsExecuteJobPayload>(
    OPS_EXECUTE_QUEUE,
    async (job) => {
      await processOpsExecuteJob(job);
    },
    {
      connection: getRedisConnection(),
      concurrency: 3,
      stalledInterval: 30_000,
      maxStalledCount: 1,
    }
  );

  worker.on("completed", (job) => {
    log.info({ jobId: job.id, actionType: job.data.actionType }, "ops-execute worker: job completed");
  });

  worker.on("failed", (job, err) => {
    if (!job) return;
    log.error(
      { jobId: job.id, actionType: job.data.actionType, error: err.message },
      "ops-execute worker: job permanently failed"
    );
  });

  worker.on("error", (err) => {
    log.error({ error: err.message }, "ops-execute worker error");
  });

  return worker;
}
