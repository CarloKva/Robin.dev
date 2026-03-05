import { NextResponse } from "next/server";
import { z } from "zod";
import { createSupabaseServerClient } from "@/lib/supabase/server";
import { requireWorkspace } from "@/lib/api/requireWorkspace";
import { trackUserAction } from "@/lib/events/trackUserAction";

const patchSchema = z.object({
  title: z.string().min(1).max(200).optional(),
  description: z.string().max(5000).optional(),
  context: z.string().max(5000).nullable().optional(),
  priority: z.enum(["low", "medium", "high", "urgent", "critical"]).optional(),
  type: z.enum(["bug", "feature", "docs", "refactor", "chore", "accessibility", "security"]).optional(),
  estimated_effort: z.enum(["xs", "s", "m", "l"]).nullable().optional(),
  status: z.enum([
    "backlog", "sprint_ready", "pending", "queued", "in_progress",
    "in_review", "rework", "review_pending", "approved", "rejected",
    "done", "completed", "failed", "cancelled",
  ]).optional(),
  sprint_id: z.string().uuid().nullable().optional(),
  repository_id: z.string().uuid().nullable().optional(),
  preferred_agent_id: z.string().uuid().nullable().optional(),
  sprint_order: z.number().int().min(0).nullable().optional(),
});

export async function GET(
  _request: Request,
  { params }: { params: Promise<{ taskId: string }> }
) {
  const result = await requireWorkspace();
  if (result instanceof NextResponse) return result;
  const { workspace } = result;

  const { taskId } = await params;
  const supabase = await createSupabaseServerClient();

  const { data: task, error } = await supabase
    .from("tasks")
    .select("*")
    .eq("id", taskId)
    .eq("workspace_id", workspace.id)
    .single();

  if (error) return NextResponse.json({ error: error.message }, { status: 404 });
  return NextResponse.json({ task });
}

export async function PATCH(
  request: Request,
  { params }: { params: Promise<{ taskId: string }> }
) {
  const result = await requireWorkspace();
  if (result instanceof NextResponse) return result;
  const { userId, workspace } = result;

  const { taskId } = await params;

  const body = await request.json().catch(() => null);
  const parsed = patchSchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json(
      { error: "Invalid request body", details: parsed.error.flatten() },
      { status: 400 }
    );
  }

  const updates = parsed.data;
  if (Object.keys(updates).length === 0) {
    return NextResponse.json({ error: "No fields to update" }, { status: 400 });
  }

  const supabase = await createSupabaseServerClient();

  // Fetch current task state for diff and state-change event
  const { data: currentTask } = await supabase
    .from("tasks")
    .select("*")
    .eq("id", taskId)
    .eq("workspace_id", workspace.id)
    .single();

  // Emit state change event if status is changing
  if (updates.status && currentTask && currentTask.status !== updates.status) {
    await supabase.from("task_events").insert({
      task_id: taskId,
      workspace_id: workspace.id,
      event_type: "task.state.changed",
      actor_type: "human",
      actor_id: userId,
      payload: { from: currentTask.status, to: updates.status },
    });
  }

  const { data: task, error } = await supabase
    .from("tasks")
    .update({ ...updates, updated_at: new Date().toISOString() })
    .eq("id", taskId)
    .eq("workspace_id", workspace.id)
    .select()
    .single();

  if (error) {
    console.error("[PATCH /api/tasks/:id] error:", error.message);
    return NextResponse.json({ error: error.message }, { status: 500 });
  }

  // Audit trail: compute diff and track founder action
  if (currentTask) {
    const before: Record<string, unknown> = {};
    const after: Record<string, unknown> = {};
    for (const key of Object.keys(updates) as (keyof typeof updates)[]) {
      const oldVal = (currentTask as Record<string, unknown>)[key as string];
      const newVal = updates[key];
      if (oldVal !== newVal) {
        before[key as string] = oldVal;
        after[key as string] = newVal;
      }
    }
    if (Object.keys(before).length > 0) {
      await trackUserAction(supabase, workspace.id, userId, taskId, "user.task.updated", { before, after });
    }
  }

  return NextResponse.json({ task });
}

export async function DELETE(
  _request: Request,
  { params }: { params: Promise<{ taskId: string }> }
) {
  const result = await requireWorkspace();
  if (result instanceof NextResponse) return result;
  const { userId, workspace } = result;

  const { taskId } = await params;
  const supabase = await createSupabaseServerClient();

  // Fetch task before deletion for the audit event
  const { data: task } = await supabase
    .from("tasks")
    .select("title, status")
    .eq("id", taskId)
    .eq("workspace_id", workspace.id)
    .single();

  // Audit trail: emit before deletion so the event is persisted
  if (task) {
    await trackUserAction(supabase, workspace.id, userId, taskId, "user.task.deleted", {
      title: task.title,
      status: task.status,
    });
  }

  const { error } = await supabase
    .from("tasks")
    .delete()
    .eq("id", taskId)
    .eq("workspace_id", workspace.id);

  if (error) {
    console.error("[DELETE /api/tasks/:id] error:", error.message);
    return NextResponse.json({ error: error.message }, { status: 500 });
  }

  return new NextResponse(null, { status: 204 });
}
