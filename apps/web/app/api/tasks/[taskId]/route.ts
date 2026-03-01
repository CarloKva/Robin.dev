import { auth } from "@clerk/nextjs/server";
import { NextResponse } from "next/server";
import { z } from "zod";
import { createSupabaseServerClient } from "@/lib/supabase/server";
import { getWorkspaceForUser } from "@/lib/db/workspace";

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
  const { userId } = await auth();
  if (!userId) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const { taskId } = await params;
  const supabase = await createSupabaseServerClient();
  const workspace = await getWorkspaceForUser(userId);
  if (!workspace) return NextResponse.json({ error: "Workspace not found" }, { status: 404 });

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
  const { userId } = await auth();
  if (!userId) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

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

  const workspace = await getWorkspaceForUser(userId);
  if (!workspace) {
    return NextResponse.json({ error: "Workspace not found" }, { status: 404 });
  }

  // Emit state change event if status is changing
  if (updates.status) {
    const { data: currentTask } = await supabase
      .from("tasks")
      .select("status")
      .eq("id", taskId)
      .eq("workspace_id", workspace.id)
      .single();

    if (currentTask && currentTask.status !== updates.status) {
      await supabase.from("task_events").insert({
        task_id: taskId,
        workspace_id: workspace.id,
        event_type: "task.state.changed",
        actor_type: "human",
        actor_id: userId,
        payload: { from: currentTask.status, to: updates.status },
      });
    }
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

  return NextResponse.json({ task });
}
