/**
 * POST /api/agents
 * Creates a new agent and enqueues the VPS provisioning job.
 */

import { NextResponse } from "next/server";
import { z } from "zod";
import { createSupabaseServerClient } from "@/lib/supabase/server";
import { requireWorkspace } from "@/lib/api/requireWorkspace";
import { getGitHubConnection } from "@/lib/db/github";
import { getProvisioningQueue } from "@/lib/queue/provisioning.queue";
import type { AgentProvisioningJobPayload } from "@robin/shared-types";

const createAgentSchema = z.object({
  name: z.string().min(1, "Il nome è obbligatorio").max(100),
  repository_ids: z
    .array(z.string().uuid())
    .min(1, "Seleziona almeno un repository"),
  avatar_url: z.string().url().nullable().optional(),
});

export async function POST(request: Request) {
  const result = await requireWorkspace();
  if (result instanceof NextResponse) return result;
  const { workspace } = result;

  const body = await request.json().catch(() => null);
  const parsed = createAgentSchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json(
      { error: "Dati non validi", details: parsed.error.flatten() },
      { status: 400 }
    );
  }

  const { name, repository_ids, avatar_url } = parsed.data;

  // GitHub connection must be active before creating an agent
  const connection = await getGitHubConnection(workspace.id);
  if (!connection) {
    return NextResponse.json(
      {
        error: "Connetti prima GitHub prima di creare un agente",
        code: "GITHUB_NOT_CONNECTED",
      },
      { status: 400 }
    );
  }

  const supabase = await createSupabaseServerClient();

  // Create the agent record
  const { data: agent, error: agentError } = await supabase
    .from("agents")
    .insert({
      workspace_id: workspace.id,
      name,
      type: "claude-code",
      provisioning_status: "pending",
      ...(avatar_url != null ? { avatar_url } : {}),
    })
    .select()
    .single();

  if (agentError || !agent) {
    console.error("[POST /api/agents] insert error:", agentError?.message);
    return NextResponse.json({ error: "Impossibile creare l'agente" }, { status: 500 });
  }

  // Create agent_repositories associations
  const agentRepoInserts = repository_ids.map((repoId) => ({
    agent_id: agent.id,
    repository_id: repoId,
  }));

  const { error: repoLinkError } = await supabase
    .from("agent_repositories")
    .insert(agentRepoInserts);

  if (repoLinkError) {
    // Rollback agent creation
    await supabase.from("agents").delete().eq("id", agent.id);
    return NextResponse.json(
      { error: "Impossibile associare i repository all'agente" },
      { status: 500 }
    );
  }

  // Enqueue provisioning job (best-effort — agent record exists regardless).
  // Wrapped in a timeout because ioredis retries forever when Redis is unreachable,
  // which would hang the API response indefinitely.
  try {
    const queue = getProvisioningQueue();
    const payload: AgentProvisioningJobPayload = {
      agentId: agent.id,
      workspaceId: workspace.id,
    };
    await Promise.race([
      queue.add(`provision-${agent.id}`, payload, {
        jobId: `provision-${agent.id}`,
      }),
      new Promise((_, reject) =>
        setTimeout(() => reject(new Error("Redis enqueue timeout")), 5000)
      ),
    ]);
  } catch (err) {
    console.error("[POST /api/agents] provisioning enqueue error:", err);
  }

  return NextResponse.json({ agent }, { status: 201 });
}
