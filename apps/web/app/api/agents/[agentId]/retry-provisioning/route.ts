/**
 * POST /api/agents/[agentId]/retry-provisioning
 * Re-enqueues the provisioning job for an agent stuck in "pending" or "error".
 */

import { NextResponse } from "next/server";
import { createSupabaseServerClient } from "@/lib/supabase/server";
import { requireWorkspace } from "@/lib/api/requireWorkspace";
import { getProvisioningQueue } from "@/lib/queue/provisioning.queue";
import type { AgentProvisioningJobPayload } from "@robin/shared-types";

const RETRIABLE_STATUSES = ["pending", "error"];

export async function POST(
  _request: Request,
  { params }: { params: Promise<{ agentId: string }> }
) {
  const result = await requireWorkspace();
  if (result instanceof NextResponse) return result;
  const { workspace } = result;

  const { agentId } = await params;

  const supabase = await createSupabaseServerClient();

  const { data: agent, error: agentError } = await supabase
    .from("agents")
    .select("id, workspace_id, provisioning_status, vps_id")
    .eq("id", agentId)
    .eq("workspace_id", workspace.id)
    .maybeSingle();

  if (agentError || !agent) {
    return NextResponse.json({ error: "Agente non trovato" }, { status: 404 });
  }

  if (!RETRIABLE_STATUSES.includes(agent.provisioning_status)) {
    return NextResponse.json(
      { error: `Impossibile riprovare: stato attuale "${agent.provisioning_status}"` },
      { status: 409 }
    );
  }

  // Reset to pending and clear all VPS fields so provisioning starts fresh
  await supabase
    .from("agents")
    .update({
      provisioning_status: "pending",
      provisioning_error: null,
      vps_id: null,
      vps_ip: null,
      vps_region: null,
      vps_created_at: null,
      vps_online_at: null,
      provisioned_at: null,
    })
    .eq("id", agentId);

  try {
    const queue = getProvisioningQueue();
    const jobId = `provision-${agentId}`;

    // Remove stale failed job if present so we can re-use the jobId
    const existing = await queue.getJob(jobId);
    if (existing) {
      const state = await existing.getState();
      if (state === "failed" || state === "completed") {
        await existing.remove();
      }
    }

    const payload: AgentProvisioningJobPayload = {
      agentId: agent.id,
      workspaceId: workspace.id,
    };

    await Promise.race([
      queue.add(`provision-${agentId}`, payload, { jobId }),
      new Promise((_, reject) =>
        setTimeout(() => reject(new Error("Redis enqueue timeout")), 5000)
      ),
    ]);

    return NextResponse.json({ ok: true, agentId, message: "Provisioning re-enqueued" });
  } catch (err) {
    console.error("[POST retry-provisioning] enqueue error:", err);
    return NextResponse.json(
      { error: "Impossibile connettersi alla coda Redis" },
      { status: 502 }
    );
  }
}
