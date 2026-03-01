/**
 * Agent Provisioning Worker
 * Processes jobs from the "agent-provisioning" queue.
 *
 * Flow:
 *  1. Fetch agent + workspace config from Supabase
 *  2. Build cloud-init script with workspace credentials
 *  3. Create Hetzner VPS → save vps_id + vps_created_at
 *  4. Update provisioning_status = 'provisioning'
 *  5. Poll until VPS is running → save vps_ip
 *  6. Poll until orchestrator /health responds
 *  7. Update provisioning_status = 'online', provisioned_at = now()
 *  8. On any failure → set provisioning_status = 'error', save provisioning_error
 */

import { Worker } from "bullmq";
import type { Job } from "bullmq";
import type { AgentProvisioningJobPayload } from "@robin/shared-types";
import { getRedisConnection } from "../db/redis.client";
import { getSupabaseClient } from "../db/supabase.client";
import {
  createServer,
  waitForServerRunning,
  buildCloudInitScript,
} from "../services/hetzner.service";
import { getInstallationToken } from "../services/github.service";
import { log } from "../utils/logger";

export const PROVISIONING_QUEUE_NAME = "agent-provisioning";

// ─── Heartbeat-based health check ────────────────────────────────────────────

import type { SupabaseClient } from "@supabase/supabase-js";

async function waitForAgentHeartbeat(
  supabase: SupabaseClient,
  agentId: string,
  timeoutMs = 5 * 60 * 1000
): Promise<void> {
  const start = Date.now();

  while (Date.now() - start < timeoutMs) {
    await new Promise((r) => setTimeout(r, 10_000));

    const { data } = await supabase
      .from("agent_status")
      .select("last_heartbeat")
      .eq("agent_id", agentId)
      .maybeSingle();

    if (data?.last_heartbeat) {
      const hbAge = Date.now() - new Date(data.last_heartbeat).getTime();
      if (hbAge < 60_000) {
        log.info({ agentId, hbAge: Math.round(hbAge / 1000) }, "Agent heartbeat detected");
        return;
      }
    }
  }

  throw new Error(
    `Agent ${agentId} did not send a heartbeat within ${timeoutMs / 1000}s — check cloud-init log via SSH`
  );
}

// ─── Main job processor ───────────────────────────────────────────────────────

async function processProvisioningJob(
  job: Job<AgentProvisioningJobPayload>
): Promise<void> {
  const { agentId, workspaceId } = job.data;
  const supabase = getSupabaseClient();

  log.info({ jobId: job.id, agentId }, "Starting agent provisioning");

  // ── 1. Fetch agent ────────────────────────────────────────────────────────
  const { data: agent, error: agentErr } = await supabase
    .from("agents")
    .select("id, name, workspace_id, vps_id, provisioning_status")
    .eq("id", agentId)
    .eq("workspace_id", workspaceId)
    .maybeSingle();

  if (agentErr || !agent) {
    throw new Error(`Agent ${agentId} not found: ${agentErr?.message ?? "no data"}`);
  }

  // Idempotency check: if VPS already exists, skip creation phase
  if (agent.vps_id) {
    log.info({ agentId, vpsId: agent.vps_id }, "VPS already created — skipping to health check");
  }

  // ── 2. Fetch workspace config ─────────────────────────────────────────────
  const { data: workspace, error: wsErr } = await supabase
    .from("workspaces")
    .select("id")
    .eq("id", workspaceId)
    .maybeSingle();

  if (wsErr || !workspace) {
    throw new Error(`Workspace ${workspaceId} not found: ${wsErr?.message ?? "no data"}`);
  }

  const { data: connection, error: connErr } = await supabase
    .from("github_connections")
    .select("installation_id, github_account_login")
    .eq("workspace_id", workspaceId)
    .eq("status", "connected")
    .maybeSingle();

  if (connErr || !connection) {
    throw new Error(`No active GitHub connection for workspace ${workspaceId}`);
  }

  // ── 3. Build cloud-init script ────────────────────────────────────────────
  const supabaseUrl = process.env["SUPABASE_URL"];
  const supabaseServiceRoleKey = process.env["SUPABASE_SERVICE_ROLE_KEY"];
  const anthropicApiKey = process.env["ANTHROPIC_API_KEY"];
  const githubAppId = process.env["GITHUB_APP_ID"];
  const githubAppPrivateKeyB64 = process.env["GITHUB_APP_PRIVATE_KEY_B64"];
  const orchestratorRepoUrl = process.env["ORCHESTRATOR_REPO_URL"];
  const redisUrl = process.env["REDIS_URL_AGENT"];

  if (!supabaseUrl || !supabaseServiceRoleKey || !anthropicApiKey || !githubAppId || !githubAppPrivateKeyB64) {
    throw new Error("Missing required environment variables for cloud-init script generation");
  }

  let vpsId = agent.vps_id as number | undefined;
  let vpsIp: string | undefined;

  if (!vpsId) {
    // Generate a short-lived GitHub token for git clone in cloud-init
    const githubCloneToken = await getInstallationToken(
      githubAppId,
      githubAppPrivateKeyB64,
      connection.installation_id as number
    );

    const userData = buildCloudInitScript({
      agentId,
      workspaceId,
      supabaseUrl,
      supabaseServiceRoleKey,
      anthropicApiKey,
      githubAppId,
      githubAppPrivateKeyB64,
      githubInstallationId: connection.installation_id as number,
      githubCloneToken,
      ...(redisUrl !== undefined && { redisUrl }),
      ...(orchestratorRepoUrl !== undefined && { orchestratorRepoUrl }),
    });

    // ── 4. Create Hetzner VPS ───────────────────────────────────────────────
    log.info({ agentId }, "Creating Hetzner VPS");
    const server = await createServer({
      name: `robin-agent-${agentId.slice(0, 8)}`,
      userData,
    });

    vpsId = server.id;
    const vpsCreatedAt = server.created;

    // Save vps_id + vps_created_at; transition to 'provisioning'
    const { error: updateErr } = await supabase
      .from("agents")
      .update({
        vps_id: vpsId,
        vps_created_at: vpsCreatedAt,
        provisioning_status: "provisioning",
        provisioning_error: null,
      })
      .eq("id", agentId);

    if (updateErr) {
      log.error({ agentId, error: updateErr.message }, "Failed to save vps_id — VPS was created but DB not updated");
      throw new Error(`DB update after VPS creation failed: ${updateErr.message}`);
    }

    log.info({ agentId, vpsId }, "VPS created; waiting for running status");
  }

  // ── 5. Wait for VPS to reach 'running' ────────────────────────────────────
  log.info({ agentId, vpsId }, "Waiting for VPS to reach running status");
  vpsIp = await waitForServerRunning(vpsId);

  // Save vps_ip
  await supabase
    .from("agents")
    .update({ vps_ip: vpsIp, vps_region: "nbg1" })
    .eq("id", agentId);

  log.info({ agentId, vpsId, vpsIp }, "VPS running; waiting for agent heartbeat");

  // ── 6. Wait for agent heartbeat in DB ──────────────────────────────────────
  // The agent VPS binds its health endpoint to loopback (127.0.0.1) so we
  // can't reach it from the control-plane. Instead, poll Supabase for the
  // agent's heartbeat (last_seen_at) which the HeartbeatService updates.
  await waitForAgentHeartbeat(supabase, agentId);

  // ── 7. Mark agent online ───────────────────────────────────────────────────
  const { error: onlineErr } = await supabase
    .from("agents")
    .update({
      provisioning_status: "online",
      provisioned_at: new Date().toISOString(),
      provisioning_error: null,
    })
    .eq("id", agentId);

  if (onlineErr) {
    throw new Error(`Failed to mark agent online: ${onlineErr.message}`);
  }

  log.info({ agentId, vpsId, vpsIp }, "Agent provisioning complete — status: online");
}

// ─── Worker factory ───────────────────────────────────────────────────────────

export function createProvisioningWorker(): Worker<AgentProvisioningJobPayload> {
  const worker = new Worker<AgentProvisioningJobPayload>(
    PROVISIONING_QUEUE_NAME,
    async (job) => {
      try {
        await processProvisioningJob(job);
      } catch (err) {
        const message = err instanceof Error ? err.message : String(err);
        log.error({ jobId: job.id, agentId: job.data.agentId, error: message }, "Provisioning job failed");

        // Persist error to agents table
        try {
          await getSupabaseClient()
            .from("agents")
            .update({
              provisioning_status: "error",
              provisioning_error: message,
            })
            .eq("id", job.data.agentId);
        } catch (dbErr) {
          log.error(
            { agentId: job.data.agentId, dbError: String(dbErr) },
            "Failed to persist provisioning error to DB"
          );
        }

        throw err; // Re-throw so BullMQ marks the job as failed
      }
    },
    {
      connection: getRedisConnection(),
      concurrency: 3, // provision up to 3 agents concurrently
      stalledInterval: 60_000,
      maxStalledCount: 1,
    }
  );

  worker.on("completed", (job) => {
    log.info({ jobId: job.id, agentId: job.data.agentId }, "Provisioning job completed");
  });

  worker.on("failed", (job, err) => {
    if (!job) return;
    log.error(
      { jobId: job.id, agentId: job.data.agentId, error: err.message },
      "Provisioning job permanently failed"
    );
  });

  worker.on("error", (err) => {
    log.error({ error: err.message }, "Provisioning worker error");
  });

  return worker;
}
