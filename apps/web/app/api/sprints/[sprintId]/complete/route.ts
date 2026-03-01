import { auth } from "@clerk/nextjs/server";
import { NextResponse } from "next/server";
import { createSupabaseServerClient } from "@/lib/supabase/server";
import { getWorkspaceForUser } from "@/lib/db/workspace";
import { getSprintWithTasks } from "@/lib/db/sprints";

/**
 * POST /api/sprints/{sprintId}/complete
 * Closes an active sprint:
 * - Tasks in done/failed/cancelled stay as-is (read-only history)
 * - Tasks still in queued/in_progress/in_review/rework/sprint_ready → backlog
 * - Computes and persists aggregate metrics
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

  const sprint = await getSprintWithTasks(sprintId, workspace.id);
  if (!sprint) return NextResponse.json({ error: "Sprint not found" }, { status: 404 });

  if (sprint.status !== "active") {
    return NextResponse.json(
      { error: `Cannot complete a sprint with status '${sprint.status}'` },
      { status: 422 }
    );
  }

  const IN_PROGRESS_STATUSES = ["queued", "in_progress", "in_review", "rework", "sprint_ready"] as const;
  const DONE_STATUSES = ["done", "completed"] as const;
  const FAILED_STATUSES = ["failed"] as const;

  const completedTasks = sprint.tasks.filter((t) =>
    (DONE_STATUSES as readonly string[]).includes(t.status)
  );
  const failedTasks = sprint.tasks.filter((t) =>
    (FAILED_STATUSES as readonly string[]).includes(t.status)
  );
  const inProgressTasks = sprint.tasks.filter((t) =>
    (IN_PROGRESS_STATUSES as readonly string[]).includes(t.status)
  );

  // Move unfinished tasks back to backlog
  if (inProgressTasks.length > 0) {
    const ids = inProgressTasks.map((t) => t.id);
    await supabase
      .from("tasks")
      .update({
        status: "backlog",
        sprint_id: null,
        sprint_order: null,
        updated_at: new Date().toISOString(),
      })
      .in("id", ids)
      .eq("workspace_id", workspace.id);

    // Emit state change events
    const events = inProgressTasks.map((t) => ({
      task_id: t.id,
      workspace_id: workspace.id,
      event_type: "task.state.changed",
      actor_type: "human",
      actor_id: userId,
      payload: {
        from: t.status,
        to: "backlog",
        note: `Sprint "${sprint.name}" chiuso — task rimossa dallo sprint`,
      },
    }));
    await supabase.from("task_events").insert(events);
  }

  // Compute avg cycle time (from queued_at to done)
  const cycleTimesMs = completedTasks
    .filter((t) => t.queued_at)
    .map((t) => new Date(t.updated_at).getTime() - new Date(t.queued_at!).getTime());
  const avgCycleMinutes =
    cycleTimesMs.length > 0
      ? Math.round(cycleTimesMs.reduce((a, b) => a + b, 0) / cycleTimesMs.length / 60000)
      : null;

  // Close sprint with metrics
  const { error } = await supabase
    .from("sprints")
    .update({
      status: "completed",
      completed_at: new Date().toISOString(),
      tasks_completed: completedTasks.length,
      tasks_failed: failedTasks.length,
      tasks_moved_back: inProgressTasks.length,
      ...(avgCycleMinutes !== null && { avg_cycle_time_minutes: avgCycleMinutes }),
      updated_at: new Date().toISOString(),
    })
    .eq("id", sprintId)
    .eq("workspace_id", workspace.id);

  if (error) {
    console.error("[POST /api/sprints/:id/complete]", error.message);
    return NextResponse.json({ error: error.message }, { status: 500 });
  }

  const updatedSprint = await getSprintWithTasks(sprintId, workspace.id);
  return NextResponse.json({
    sprint: updatedSprint,
    summary: {
      completed: completedTasks.length,
      failed: failedTasks.length,
      movedBack: inProgressTasks.length,
      avgCycleMinutes,
    },
  });
}
