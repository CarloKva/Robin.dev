import { NextResponse } from "next/server";
import { z } from "zod";
import { createSupabaseServerClient } from "@/lib/supabase/server";
import { requireWorkspace } from "@/lib/api/requireWorkspace";
import { getOnlineAgentForWorkspace } from "@/lib/db/agents";
import { getBugfixQueue } from "@/lib/queue/bugfix.queue";
import { trackUserAction } from "@/lib/events/trackUserAction";

const bugfixSchema = z.object({
  taskId: z.string().uuid("Task ID obbligatorio"),
  repositoryId: z.string().uuid("Repository ID obbligatorio"),
  bugDescription: z.string().min(10, "Descrizione troppo breve").max(10000),
  issueNumber: z.string().optional(),
  issueUrl: z.string().url().optional(),
  repoBranch: z.string().optional().default("main"),
  maxTurns: z.number().int().min(5).max(100).optional().default(40),
  model: z.string().optional().default("claude-sonnet-4-6"),
});

/**
 * POST /api/tasks/bugfix
 *
 * Enqueue a bugfix task to the bugfix-pipeline BullMQ queue.
 * The bugfix worker on the agent VPS picks it up and runs the autonomous
 * bugfix agent (Claude Agent SDK) against the client's repository.
 */
export async function POST(request: Request) {
  // 1. Auth guard
  const result = await requireWorkspace();
  if (result instanceof NextResponse) return result;
  const { userId, workspace } = result;

  // 2. Validate input
  const body = await request.json().catch(() => null);
  const parsed = bugfixSchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json(
      { error: "Invalid request body", details: parsed.error.flatten() },
      { status: 400 }
    );
  }

  const { taskId, repositoryId, bugDescription, issueNumber, issueUrl, repoBranch, maxTurns, model } = parsed.data;

  // 3. Verify task belongs to workspace
  const supabase = await createSupabaseServerClient();
  const { data: task, error: taskError } = await supabase
    .from("tasks")
    .select("id, title, status, workspace_id")
    .eq("id", taskId)
    .eq("workspace_id", workspace.id)
    .single();

  if (taskError || !task) {
    return NextResponse.json({ error: "Task not found" }, { status: 404 });
  }

  // 4. Verify repository belongs to workspace
  const { data: repo, error: repoError } = await supabase
    .from("repositories")
    .select("id, clone_url, full_name")
    .eq("id", repositoryId)
    .eq("workspace_id", workspace.id)
    .single();

  if (repoError || !repo) {
    return NextResponse.json({ error: "Repository not found" }, { status: 404 });
  }

  // 5. Verify an agent is online
  const agent = await getOnlineAgentForWorkspace(workspace.id);
  if (!agent) {
    return NextResponse.json(
      {
        error: "Nessun agente online.",
        hint: "Provisiona almeno un agente e attendi che sia online.",
      },
      { status: 422 }
    );
  }

  // 6. Enqueue the bugfix job
  try {
    const bugfixQueue = getBugfixQueue();
    const jobId = await bugfixQueue.add("bugfix-pipeline", {
      taskId,
      workspaceId: workspace.id,
      agentId: agent.id,
      repoUrl: repo.clone_url as string,
      repoBranch,
      repoPath: `/home/agent/repos/${(repo.full_name as string).replace("/", "_")}`,
      bugDescription,
      ...(issueNumber !== undefined && { issueNumber }),
      ...(issueUrl !== undefined && { issueUrl }),
      maxTurns,
      model,
    }, {
      jobId: taskId,
    });

    // 7. Update task status to queued
    await supabase
      .from("tasks")
      .update({
        status: "queued",
        queued_at: new Date().toISOString(),
        assigned_agent_id: agent.id,
        updated_at: new Date().toISOString(),
      })
      .eq("id", taskId);

    // 8. Emit event
    await supabase.from("task_events").insert({
      task_id: taskId,
      workspace_id: workspace.id,
      event_type: "task.state.changed",
      actor_type: "human",
      actor_id: userId,
      payload: {
        from: task.status,
        to: "queued",
        note: "Bugfix pipeline enqueued",
      },
    });

    await trackUserAction(
      supabase,
      taskId,
      workspace.id,
      userId,
      "user.task.updated",
      { action: "bugfix_enqueued", agent_id: agent.id }
    );

    return NextResponse.json(
      { jobId, taskId, agentId: agent.id, status: "queued" },
      { status: 201 }
    );
  } catch (err) {
    console.error("[POST /api/tasks/bugfix] enqueue error:", err);
    return NextResponse.json(
      { error: "Failed to enqueue bugfix task" },
      { status: 500 }
    );
  }
}
