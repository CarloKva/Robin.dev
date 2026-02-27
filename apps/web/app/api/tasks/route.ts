import { auth } from "@clerk/nextjs/server";
import { NextResponse } from "next/server";
import { z } from "zod";
import { createSupabaseServerClient } from "@/lib/supabase/server";
import { getWorkspaceForUser } from "@/lib/db/workspace";
import { getOnlineAgentForWorkspace } from "@/lib/db/agents";
import { getTaskQueue, priorityToNumber, defaultTimeoutByType } from "@/lib/queue/tasks.queue";
import type { JobPayload } from "@robin/shared-types";

const createTaskSchema = z.object({
  title: z.string().min(5, "Titolo troppo corto").max(200),
  description: z.string().min(20, "Descrizione troppo corta").max(5000),
  type: z.enum(["bug", "feature", "docs", "refactor", "chore"]),
  priority: z.enum(["low", "medium", "high", "urgent"]),
});

export async function POST(request: Request) {
  const { userId } = await auth();
  if (!userId) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const body = await request.json().catch(() => null);
  const parsed = createTaskSchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json(
      { error: "Invalid request body", details: parsed.error.flatten() },
      { status: 400 }
    );
  }

  const { title, description, type, priority } = parsed.data;

  const supabase = await createSupabaseServerClient();
  const workspace = await getWorkspaceForUser(userId);
  if (!workspace) {
    return NextResponse.json({ error: "Workspace not found" }, { status: 404 });
  }

  // Auto-routing: find online agent for workspace
  const onlineAgent = await getOnlineAgentForWorkspace(workspace.id);
  const assignedAgentId = onlineAgent?.id ?? null;
  // If no agent is online, task lands in 'backlog' and will be picked up when agent comes online
  const taskStatus = assignedAgentId ? "queued" : "backlog";

  // Insert task in Supabase
  const { data: task, error: taskError } = await supabase
    .from("tasks")
    .insert({
      workspace_id: workspace.id,
      title,
      description,
      type,
      priority,
      status: taskStatus,
      assigned_agent_id: assignedAgentId,
      created_by_user_id: userId,
    })
    .select()
    .single();

  if (taskError || !task) {
    console.error("[POST /api/tasks] insert error:", taskError?.message);
    return NextResponse.json(
      { error: taskError?.message ?? "Failed to create task" },
      { status: 500 }
    );
  }

  // Emit task.created event
  await supabase.from("task_events").insert({
    task_id: task.id,
    workspace_id: workspace.id,
    event_type: "task.created",
    actor_type: "human",
    actor_id: userId,
    payload: { title, description, priority },
  });

  // Emit task.state.changed event
  await supabase.from("task_events").insert({
    task_id: task.id,
    workspace_id: workspace.id,
    event_type: "task.state.changed",
    actor_type: "human",
    actor_id: userId,
    payload: { from: "pending", to: taskStatus },
  });

  // Enqueue in BullMQ only when an agent is online (best-effort)
  if (assignedAgentId) {
    try {
      const queue = getTaskQueue();

      const jobPayload: JobPayload = {
        taskId: task.id,
        workspaceId: workspace.id,
        agentId: assignedAgentId,
        repositoryUrl: process.env["DEFAULT_REPOSITORY_URL"] ?? "",
        branch: process.env["DEFAULT_BRANCH"] ?? "main",
        repositoryPath: process.env["DEFAULT_REPOSITORY_PATH"] ?? "/workspace/repo",
        taskTitle: title,
        taskDescription: description,
        taskType: type,
        priority,
        timeoutMinutes: defaultTimeoutByType[type] ?? 30,
        claudeMdPath: "CLAUDE.md",
      };

      await queue.add(title, jobPayload, {
        priority: priorityToNumber(priority),
        jobId: task.id,
      });
    } catch (err) {
      // Log but don't fail — the task is created, orchestrator can poll if needed
      console.error("[POST /api/tasks] BullMQ enqueue error:", err);
    }
  }

  return NextResponse.json(
    { task, agentAssigned: !!assignedAgentId },
    { status: 201 }
  );
}
