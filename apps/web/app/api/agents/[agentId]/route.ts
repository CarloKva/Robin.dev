/**
 * DELETE /api/agents/[agentId]
 * Deletes an agent and enqueues the VPS deprovisioning job.
 */
import { auth } from "@clerk/nextjs/server";
import { NextResponse } from "next/server";
import { createSupabaseServerClient } from "@/lib/supabase/server";
import { getWorkspaceForUser } from "@/lib/db/workspace";
import { getDeprovisioningQueue } from "@/lib/queue/provisioning.queue";
import type { AgentDeprovisioningJobPayload } from "@robin/shared-types";

export async function DELETE(
  _request: Request,
  { params }: { params: Promise<{ agentId: string }> }
) {
  const { userId } = await auth();
  if (!userId) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const { agentId } = await params;

  const workspace = await getWorkspaceForUser(userId);
  if (!workspace) return NextResponse.json({ error: "Workspace non trovato" }, { status: 404 });

  const supabase = await createSupabaseServerClient();

  // Verify agent belongs to workspace
  const { data: agent, error: agentError } = await supabase
    .from("agents")
    .select("id, name, vps_id, provisioning_status")
    .eq("id", agentId)
    .eq("workspace_id", workspace.id)
    .maybeSingle();

  if (agentError || !agent) {
    return NextResponse.json({ error: "Agente non trovato" }, { status: 404 });
  }

  // Block deletion if agent is executing a task
  const { count: activeTaskCount } = await supabase
    .from("tasks")
    .select("id", { count: "exact", head: true })
    .eq("assigned_agent_id", agentId)
    .in("status", ["in_progress", "queued"]);

  if ((activeTaskCount ?? 0) > 0) {
    return NextResponse.json(
      {
        error: "Impossibile eliminare l'agente: ci sono task in corso",
        active_tasks: activeTaskCount,
      },
      { status: 409 }
    );
  }

  // Mark as deprovisioning
  await supabase
    .from("agents")
    .update({ provisioning_status: "deprovisioning" })
    .eq("id", agentId);

  // Enqueue deprovisioning job
  try {
    const queue = getDeprovisioningQueue();
    const payload: AgentDeprovisioningJobPayload = {
      agentId: agent.id,
      workspaceId: workspace.id,
      vpsId: (agent.vps_id as number | null) ?? null,
    };
    await queue.add(`deprovision-${agentId}`, payload, {
      jobId: `deprovision-${agentId}`,
    });
  } catch (err) {
    console.error("[DELETE /api/agents/[agentId]] deprovisioning enqueue error:", err);
  }

  return NextResponse.json({ ok: true, agentId });
}
