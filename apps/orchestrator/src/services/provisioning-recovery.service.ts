/**
 * Startup recovery for lost provisioning jobs.
 *
 * When the web app enqueues a provisioning job but Redis is unreachable
 * (e.g. firewall, cold start), the agent row is created in "pending" status
 * but no BullMQ job exists. This service detects that gap and re-enqueues.
 */

import { Queue } from "bullmq";
import type { AgentProvisioningJobPayload } from "@robin/shared-types";
import { PROVISIONING_QUEUE_NAME } from "../workers/agent.provisioning.worker";
import { getRedisConnection } from "../db/redis.client";
import { getSupabaseClient } from "../db/supabase.client";
import { log } from "../utils/logger";

export async function recoverPendingAgents(): Promise<void> {
  const supabase = getSupabaseClient();

  const { data: pendingAgents, error } = await supabase
    .from("agents")
    .select("id, workspace_id, vps_id")
    .in("provisioning_status", ["pending", "error"]);

  if (error) {
    log.warn({ error: error.message }, "Failed to query pending agents for recovery");
    return;
  }

  if (!pendingAgents?.length) return;

  log.info(
    { count: pendingAgents.length },
    "Found pending/error agents — checking for missing provisioning jobs"
  );

  const queue = new Queue<AgentProvisioningJobPayload>(PROVISIONING_QUEUE_NAME, {
    connection: getRedisConnection(),
  });

  try {
    for (const agent of pendingAgents) {
      const jobId = `provision-${agent.id}`;

      // Skip agents that already have a VPS — they need manual cleanup first
      if (agent.vps_id) {
        log.info({ agentId: agent.id, vpsId: agent.vps_id }, "Agent has existing VPS — skipping auto-recovery");
        continue;
      }

      const existingJob = await queue.getJob(jobId);

      if (existingJob) {
        const state = await existingJob.getState();
        if (state === "failed" || state === "completed") {
          await existingJob.remove();
          log.info({ agentId: agent.id, jobState: state }, "Removed stale provisioning job");
        } else {
          log.info({ agentId: agent.id, jobState: state }, "Provisioning job already exists");
          continue;
        }
      }

      // Reset to pending before re-enqueuing
      await supabase
        .from("agents")
        .update({ provisioning_status: "pending", provisioning_error: null })
        .eq("id", agent.id);

      log.info({ agentId: agent.id }, "Re-enqueuing lost provisioning job");
      await queue.add(
        `provision-${agent.id}`,
        { agentId: agent.id, workspaceId: agent.workspace_id },
        { jobId }
      );
    }
  } finally {
    await queue.close();
  }
}
