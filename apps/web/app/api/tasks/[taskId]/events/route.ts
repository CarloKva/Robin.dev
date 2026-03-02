import { auth } from "@clerk/nextjs/server";
import { NextResponse } from "next/server";
import { z } from "zod";
import { createSupabaseServerClient } from "@/lib/supabase/server";
import { getWorkspaceForUser } from "@/lib/db/workspace";

/**
 * Fetch task events for a task (used by the inline terminal panel).
 * Capped at 500 events, ordered chronologically.
 */
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

  const { data, error } = await supabase
    .from("task_events")
    .select("*")
    .eq("task_id", taskId)
    .eq("workspace_id", workspace.id)
    .order("created_at", { ascending: true })
    .limit(500);

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }

  return NextResponse.json({ events: data ?? [] });
}

const eventSchema = z.discriminatedUnion("event_type", [
  z.object({
    event_type: z.literal("human.approved"),
    payload: z.object({ comment: z.string().optional() }),
  }),
  z.object({
    event_type: z.literal("human.rejected"),
    payload: z.object({ reason: z.string().optional() }),
  }),
  z.object({
    event_type: z.literal("human.commented"),
    payload: z.object({ comment: z.string().min(1) }),
  }),
]);

/**
 * Emit a human event on a task.
 * Used for: unblocking (human.approved), rejecting (human.rejected),
 * and commenting (human.commented).
 */
export async function POST(
  request: Request,
  { params }: { params: Promise<{ taskId: string }> }
) {
  const { userId } = await auth();
  if (!userId) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const { taskId } = await params;

  const body = await request.json().catch(() => null);
  const parsed = eventSchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json(
      { error: "Invalid event", details: parsed.error.flatten() },
      { status: 400 }
    );
  }

  const { event_type, payload } = parsed.data;

  const supabase = await createSupabaseServerClient();
  const workspace = await getWorkspaceForUser(userId);
  if (!workspace) {
    return NextResponse.json({ error: "Workspace not found" }, { status: 404 });
  }

  // Verify task belongs to workspace
  const { data: task } = await supabase
    .from("tasks")
    .select("id, workspace_id")
    .eq("id", taskId)
    .eq("workspace_id", workspace.id)
    .single();

  if (!task) {
    return NextResponse.json({ error: "Task not found" }, { status: 404 });
  }

  const { data: event, error } = await supabase
    .from("task_events")
    .insert({
      task_id: taskId,
      workspace_id: workspace.id,
      event_type,
      actor_type: "human",
      actor_id: userId,
      payload,
    })
    .select()
    .single();

  if (error) {
    console.error("[POST /api/tasks/:id/events] error:", error.message);
    return NextResponse.json({ error: error.message }, { status: 500 });
  }

  return NextResponse.json({ event }, { status: 201 });
}
