import { auth } from "@clerk/nextjs/server";
import { NextResponse } from "next/server";
import { createSupabaseServerClient } from "@/lib/supabase/server";
import { getWorkspaceForUser } from "@/lib/db/workspace";
import { getSprintWithTasks } from "@/lib/db/sprints";
import { getOnlineAgentForWorkspace } from "@/lib/db/agents";

/**
 * POST /api/sprints/{sprintId}/start
 * Validates preconditions, then:
 * 1. Sets sprint → active
 * 2. Sets all sprint_ready tasks → queued
 * 3. Enqueues per-repo BullMQ jobs (one queue per repository, ordered by sprint_order)
 */
export async function POST(
  _request: Request,
  { params }: { params: Promise<{ sprintId: string }> }
) {
  const { userId } = await auth();
  if (!userId) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const { sprintId } = await params;
  const workspace = await getWorkspaceForUser(userId);
  if (!workspace) return NextResponse.json({ error: "Workspace not found" }, { status: 404 });

  const supabase = await createSupabaseServerClient();

  // ── 1. Load sprint ──────────────────────────────────────────────────────────
  const sprint = await getSprintWithTasks(sprintId, workspace.id);
  if (!sprint) return NextResponse.json({ error: "Sprint not found" }, { status: 404 });

  if (sprint.status !== "planning") {
    return NextResponse.json(
      { error: `Cannot start a sprint with status '${sprint.status}'` },
      { status: 422 }
    );
  }

  // ── 2. Validation ───────────────────────────────────────────────────────────
  const readyTasks = sprint.tasks.filter((t) => t.status === "sprint_ready");
  if (readyTasks.length === 0) {
    return NextResponse.json(
      {
        error: "Nessuna task pronta per lo sprint.",
        hint: "Aggiungi almeno una task con stato 'sprint_ready' prima di avviare.",
      },
      { status: 422 }
    );
  }

  const tasksWithoutRepo = readyTasks.filter((t) => !t.repository_id);
  if (tasksWithoutRepo.length > 0) {
    return NextResponse.json(
      {
        error: `${tasksWithoutRepo.length} task non ha un repository assegnato.`,
        hint: "Assegna una repository a ogni task prima di avviare lo sprint.",
        tasks: tasksWithoutRepo.map((t) => ({ id: t.id, title: t.title })),
      },
      { status: 422 }
    );
  }

  const onlineAgent = await getOnlineAgentForWorkspace(workspace.id);
  if (!onlineAgent) {
    return NextResponse.json(
      {
        error: "Nessun agente online.",
        hint: "Provisiona almeno un agente e attendi che sia online prima di avviare lo sprint.",
      },
      { status: 422 }
    );
  }

  // ── 3. Prevent multiple active sprints ─────────────────────────────────────
  const { data: existingActive } = await supabase
    .from("sprints")
    .select("id")
    .eq("workspace_id", workspace.id)
    .eq("status", "active")
    .maybeSingle();

  if (existingActive) {
    return NextResponse.json(
      { error: "Esiste già uno sprint attivo. Chiudilo prima di avviarne uno nuovo." },
      { status: 422 }
    );
  }

  // ── 4. Activate sprint ──────────────────────────────────────────────────────
  const { error: sprintError } = await supabase
    .from("sprints")
    .update({
      status: "active",
      started_at: new Date().toISOString(),
      updated_at: new Date().toISOString(),
    })
    .eq("id", sprintId)
    .eq("workspace_id", workspace.id);

  if (sprintError) {
    console.error("[POST /api/sprints/:id/start] sprint update error:", sprintError.message);
    return NextResponse.json({ error: sprintError.message }, { status: 500 });
  }

  // ── 5. Move tasks to queued ─────────────────────────────────────────────────
  const { error: tasksError } = await supabase
    .from("tasks")
    .update({
      status: "queued",
      updated_at: new Date().toISOString(),
    })
    .eq("sprint_id", sprintId)
    .eq("workspace_id", workspace.id)
    .eq("status", "sprint_ready");

  if (tasksError) {
    console.error("[POST /api/sprints/:id/start] tasks update error:", tasksError.message);
    // Don't fail — sprint is active, tasks will be picked up by poller
  }

  // ── 6. Emit events for each task transition ─────────────────────────────────
  const eventInserts = readyTasks.map((t) => ({
    task_id: t.id,
    workspace_id: workspace.id,
    event_type: "task.state.changed",
    actor_type: "human",
    actor_id: userId,
    payload: { from: "sprint_ready", to: "queued", note: `Sprint "${sprint.name}" avviato` },
  }));

  if (eventInserts.length > 0) {
    await supabase.from("task_events").insert(eventInserts);
  }

  // ── 7. Enqueue per-repo BullMQ jobs (best-effort via web queue) ─────────────
  // Group tasks by repository_id, ordered by sprint_order
  const tasksByRepo = new Map<string, typeof readyTasks>();
  for (const task of readyTasks.sort((a, b) => (a.sprint_order ?? 0) - (b.sprint_order ?? 0))) {
    const repoId = task.repository_id ?? "__no_repo__";
    if (!tasksByRepo.has(repoId)) tasksByRepo.set(repoId, []);
    tasksByRepo.get(repoId)!.push(task);
  }

  try {
    const { getRepoQueue } = await import("@/lib/queue/repo.queue");
    for (const [repoId, tasks] of tasksByRepo) {
      if (repoId === "__no_repo__") continue; // Skip tasks without a repo target
      const queue = getRepoQueue(repoId);
      for (const task of tasks) {
        await queue.add(
          `task:${task.id}`,
          {
            taskId: task.id,
            workspaceId: workspace.id,
            repositoryId: repoId,
            sprintId,
            sprintOrder: task.sprint_order ?? 0,
          },
          {
            jobId: `sprint:${sprintId}:task:${task.id}`,
            priority: task.sprint_order ?? 999,
          }
        );
      }
    }
  } catch (err) {
    // BullMQ failure is non-fatal — orchestrator poller will pick up queued tasks
    console.error("[POST /api/sprints/:id/start] BullMQ enqueue error:", err);
  }

  const updatedSprint = await getSprintWithTasks(sprintId, workspace.id);
  return NextResponse.json({ sprint: updatedSprint, tasksQueued: readyTasks.length });
}
