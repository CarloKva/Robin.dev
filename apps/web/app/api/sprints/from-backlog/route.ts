import { auth } from "@clerk/nextjs/server";
import { NextResponse } from "next/server";
import { createSupabaseServerClient } from "@/lib/supabase/server";
import { getWorkspaceForUser } from "@/lib/db/workspace";
import { getOnlineAgentForWorkspace } from "@/lib/db/agents";
import { getSprintWithTasks } from "@/lib/db/sprints";

function generateSprintName(): string {
  const now = new Date();
  const year = now.getFullYear();
  const week = Math.ceil(
    ((now.getTime() - new Date(year, 0, 1).getTime()) / 86400000 +
      new Date(year, 0, 1).getDay() +
      1) /
      7
  );
  return `Sprint W${String(week).padStart(2, "0")}-${year}`;
}

/**
 * POST /api/sprints/from-backlog
 * Creates a sprint, moves all backlog tasks into it as sprint_ready, then starts it.
 */
export async function POST() {
  const { userId } = await auth();
  if (!userId) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const workspace = await getWorkspaceForUser(userId);
  if (!workspace) return NextResponse.json({ error: "Workspace not found" }, { status: 404 });

  const supabase = await createSupabaseServerClient();

  // ── 1. Prevent multiple active sprints ──────────────────────────────────────
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

  // ── 2. Fetch backlog tasks ───────────────────────────────────────────────────
  const { data: backlogTasks, error: fetchError } = await supabase
    .from("tasks")
    .select("id, title, repository_id, sprint_order")
    .eq("workspace_id", workspace.id)
    .eq("status", "backlog")
    .order("created_at", { ascending: true });

  if (fetchError) {
    return NextResponse.json({ error: fetchError.message }, { status: 500 });
  }

  if (!backlogTasks || backlogTasks.length === 0) {
    return NextResponse.json(
      { error: "Il backlog è vuoto. Aggiungi almeno una task prima di avviare lo sprint." },
      { status: 422 }
    );
  }

  // ── 3. Check all tasks have a repository ────────────────────────────────────
  const tasksWithoutRepo = backlogTasks.filter((t) => !t.repository_id);
  if (tasksWithoutRepo.length > 0) {
    return NextResponse.json(
      {
        error: `${tasksWithoutRepo.length} ${tasksWithoutRepo.length === 1 ? "task non ha" : "task non hanno"} un repository assegnato.`,
        hint: "Assegna una repository a ogni task prima di avviare lo sprint.",
        tasks: tasksWithoutRepo.map((t) => ({ id: t.id, title: t.title })),
      },
      { status: 422 }
    );
  }

  // ── 4. Check online agent ────────────────────────────────────────────────────
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

  // ── 5. Create sprint ─────────────────────────────────────────────────────────
  const { data: sprint, error: sprintError } = await supabase
    .from("sprints")
    .insert({
      workspace_id: workspace.id,
      name: generateSprintName(),
      status: "planning",
    })
    .select()
    .single();

  if (sprintError || !sprint) {
    return NextResponse.json({ error: sprintError?.message ?? "Errore creazione sprint" }, { status: 500 });
  }

  // ── 6. Assign backlog tasks to sprint as sprint_ready ────────────────────────
  const taskIds = backlogTasks.map((t) => t.id);

  const { error: assignError } = await supabase
    .from("tasks")
    .update({
      sprint_id: sprint.id,
      status: "sprint_ready",
      updated_at: new Date().toISOString(),
    })
    .in("id", taskIds)
    .eq("workspace_id", workspace.id);

  if (assignError) {
    // Roll back sprint creation
    await supabase.from("sprints").delete().eq("id", sprint.id);
    return NextResponse.json({ error: assignError.message }, { status: 500 });
  }

  // ── 7. Activate sprint ───────────────────────────────────────────────────────
  const { error: activateError } = await supabase
    .from("sprints")
    .update({
      status: "active",
      started_at: new Date().toISOString(),
      updated_at: new Date().toISOString(),
    })
    .eq("id", sprint.id)
    .eq("workspace_id", workspace.id);

  if (activateError) {
    return NextResponse.json({ error: activateError.message }, { status: 500 });
  }

  // ── 8. Move tasks to queued ──────────────────────────────────────────────────
  await supabase
    .from("tasks")
    .update({ status: "queued", updated_at: new Date().toISOString() })
    .in("id", taskIds)
    .eq("workspace_id", workspace.id);

  // ── 9. Emit task events ──────────────────────────────────────────────────────
  const eventInserts = backlogTasks.map((t) => ({
    task_id: t.id,
    workspace_id: workspace.id,
    event_type: "task.state.changed",
    actor_type: "human",
    actor_id: userId,
    payload: { from: "backlog", to: "queued", note: `Sprint "${sprint.name}" avviato dal backlog` },
  }));

  await supabase.from("task_events").insert(eventInserts);

  // ── 10. Enqueue BullMQ jobs ──────────────────────────────────────────────────
  const tasksByRepo = new Map<string, typeof backlogTasks>();
  for (const task of backlogTasks.sort((a, b) => (a.sprint_order ?? 0) - (b.sprint_order ?? 0))) {
    const repoId = task.repository_id!;
    if (!tasksByRepo.has(repoId)) tasksByRepo.set(repoId, []);
    tasksByRepo.get(repoId)!.push(task);
  }

  try {
    const { getRepoQueue } = await import("@/lib/queue/repo.queue");
    for (const [repoId, tasks] of tasksByRepo) {
      const queue = getRepoQueue(repoId);
      for (const task of tasks) {
        await queue.add(
          `task:${task.id}`,
          {
            taskId: task.id,
            workspaceId: workspace.id,
            repositoryId: repoId,
            sprintId: sprint.id,
            sprintOrder: task.sprint_order ?? 0,
          },
          {
            jobId: `sprint:${sprint.id}:task:${task.id}`,
            priority: task.sprint_order ?? 999,
          }
        );
      }
    }
  } catch (err) {
    console.error("[POST /api/sprints/from-backlog] BullMQ enqueue error:", err);
  }

  try {
    const activeRepoIds = [...tasksByRepo.keys()];
    if (activeRepoIds.length > 0) {
      const { getSprintControlQueue } = await import("@/lib/queue/sprint-control.queue");
      await getSprintControlQueue().add(
        `sprint:${sprint.id}`,
        { repositoryIds: activeRepoIds, sprintId: sprint.id, workspaceId: workspace.id },
        { jobId: `sprint-control:${sprint.id}` }
      );
    }
  } catch (err) {
    console.error("[POST /api/sprints/from-backlog] sprint-control enqueue error:", err);
  }

  const updatedSprint = await getSprintWithTasks(sprint.id, workspace.id);
  return NextResponse.json({ sprint: updatedSprint, tasksQueued: backlogTasks.length }, { status: 201 });
}
