/**
 * Agent Deprovisioning Worker
 * Processes jobs from the "agent-deprovisioning" queue.
 *
 * Flow:
 *  1. Delete the Hetzner VPS (if vpsId is set)
 *  2. Update agents: provisioning_status = 'deprovisioned', vps_id = null, vps_ip = null
 *  3. On failure: log error (best-effort — agent can be cleaned up manually)
 */

import { Worker } from "bullmq";
import type { Job } from "bullmq";
import type { AgentDeprovisioningJobPayload } from "@robin/shared-types";
import { getRedisConnection } from "../db/redis.client";
import { getSupabaseClient } from "../db/supabase.client";
import { deleteServer } from "../services/hetzner.service";
import { log } from "../utils/logger";

export const DEPROVISIONING_QUEUE_NAME = "agent-deprovisioning";

// ─── Main job processor ───────────────────────────────────────────────────────

async function processDeprovisioningJob(
  job: Job<AgentDeprovisioningJobPayload>
): Promise<void> {
  const { agentId, workspaceId, vpsId } = job.data;
  const supabase = getSupabaseClient();

  log.info({ jobId: job.id, agentId, vpsId }, "Starting agent deprovisioning");

  // ── 1. Verify agent belongs to workspace ──────────────────────────────────
  const { data: agent, error: agentErr } = await supabase
    .from("agents")
    .select("id, vps_id, provisioning_status")
    .eq("id", agentId)
    .eq("workspace_id", workspaceId)
    .maybeSingle();

  if (agentErr || !agent) {
    log.warn({ agentId }, "Agent not found — skipping deprovisioning");
    return; // Already deleted from DB, nothing to clean up
  }

  // Use vpsId from job payload (set at time of DELETE request) or from DB
  const serverIdToDelete = vpsId ?? (agent.vps_id as number | null);

  // ── 2. Delete Hetzner VPS ─────────────────────────────────────────────────
  if (serverIdToDelete) {
    log.info({ agentId, vpsId: serverIdToDelete }, "Deleting Hetzner server");
    const deleted = await deleteServer(serverIdToDelete);

    if (deleted) {
      log.info({ agentId, vpsId: serverIdToDelete }, "Hetzner server deleted");
    } else {
      log.info({ agentId, vpsId: serverIdToDelete }, "Hetzner server was already gone (404)");
    }
  } else {
    log.info({ agentId }, "No VPS ID — skipping Hetzner deletion");
  }

  // ── 3. Mark agent deprovisioned ───────────────────────────────────────────
  const { error: updateErr } = await supabase
    .from("agents")
    .update({
      provisioning_status: "deprovisioned",
      vps_id: null,
      vps_ip: null,
      provisioning_error: null,
    })
    .eq("id", agentId);

  if (updateErr) {
    throw new Error(`Failed to mark agent deprovisioned: ${updateErr.message}`);
  }

  log.info({ agentId }, "Agent deprovisioned successfully");
}

// ─── Worker factory ───────────────────────────────────────────────────────────

export function createDeprovisioningWorker(): Worker<AgentDeprovisioningJobPayload> {
  const worker = new Worker<AgentDeprovisioningJobPayload>(
    DEPROVISIONING_QUEUE_NAME,
    async (job) => {
      try {
        await processDeprovisioningJob(job);
      } catch (err) {
        const message = err instanceof Error ? err.message : String(err);
        log.error(
          { jobId: job.id, agentId: job.data.agentId, error: message },
          "Deprovisioning job failed"
        );
        throw err;
      }
    },
    {
      connection: getRedisConnection(),
      concurrency: 5,
      stalledInterval: 60_000,
      maxStalledCount: 2,
    }
  );

  worker.on("completed", (job) => {
    log.info({ jobId: job.id, agentId: job.data.agentId }, "Deprovisioning job completed");
  });

  worker.on("failed", (job, err) => {
    if (!job) return;
    log.error(
      { jobId: job.id, agentId: job.data.agentId, error: err.message },
      "Deprovisioning job permanently failed — manual VPS cleanup may be required"
    );
  });

  worker.on("error", (err) => {
    log.error({ error: err.message }, "Deprovisioning worker error");
  });

  return worker;
}
