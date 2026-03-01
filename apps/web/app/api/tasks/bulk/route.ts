import { auth } from "@clerk/nextjs/server";
import { NextResponse } from "next/server";
import { z } from "zod";
import { createSupabaseServerClient } from "@/lib/supabase/server";
import { getWorkspaceForUser } from "@/lib/db/workspace";

const bulkSchema = z.discriminatedUnion("action", [
  z.object({
    action: z.literal("add_to_sprint"),
    taskIds: z.array(z.string().uuid()).min(1).max(100),
    payload: z.object({
      sprintId: z.string().uuid(),
    }),
  }),
  z.object({
    action: z.literal("set_priority"),
    taskIds: z.array(z.string().uuid()).min(1).max(100),
    payload: z.object({
      priority: z.enum(["low", "medium", "high", "urgent", "critical"]),
    }),
  }),
  z.object({
    action: z.literal("cancel"),
    taskIds: z.array(z.string().uuid()).min(1).max(100),
    payload: z.object({}).optional(),
  }),
  z.object({
    action: z.literal("move_to_backlog"),
    taskIds: z.array(z.string().uuid()).min(1).max(100),
    payload: z.object({}).optional(),
  }),
]);

export async function POST(request: Request) {
  const { userId } = await auth();
  if (!userId) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const body = await request.json().catch(() => null);
  const parsed = bulkSchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json({ error: "Invalid body", details: parsed.error.flatten() }, { status: 400 });
  }

  const workspace = await getWorkspaceForUser(userId);
  if (!workspace) return NextResponse.json({ error: "Workspace not found" }, { status: 404 });

  const supabase = await createSupabaseServerClient();
  const { action, taskIds } = parsed.data;
  const now = new Date().toISOString();

  // Verify all tasks belong to this workspace (RLS also enforces, but explicit check is cleaner)
  const { data: existing } = await supabase
    .from("tasks")
    .select("id, status")
    .eq("workspace_id", workspace.id)
    .in("id", taskIds);

  const existingIds = new Set((existing ?? []).map((t: { id: string }) => t.id));
  const validIds = taskIds.filter((id) => existingIds.has(id));

  if (validIds.length === 0) {
    return NextResponse.json({ error: "No valid tasks found" }, { status: 404 });
  }

  let updates: Record<string, unknown> = { updated_at: now };

  if (action === "add_to_sprint") {
    const { sprintId } = parsed.data.payload;

    // Verify sprint belongs to workspace
    const { data: sprint } = await supabase
      .from("sprints")
      .select("id, status")
      .eq("id", sprintId)
      .eq("workspace_id", workspace.id)
      .maybeSingle();

    if (!sprint) return NextResponse.json({ error: "Sprint not found" }, { status: 404 });

    // Get current max sprint_order to append after
    const { data: lastTask } = await supabase
      .from("tasks")
      .select("sprint_order")
      .eq("sprint_id", sprintId)
      .order("sprint_order", { ascending: false })
      .limit(1)
      .maybeSingle();

    let order = (lastTask?.sprint_order ?? -1) + 1;

    // Update each task with incremented order
    const updatePromises = validIds.map((taskId) => {
      const update = {
        sprint_id: sprintId,
        status: "sprint_ready",
        sprint_order: order++,
        updated_at: now,
      };
      return supabase
        .from("tasks")
        .update(update)
        .eq("id", taskId)
        .eq("workspace_id", workspace.id)
        .in("status", ["backlog", "sprint_ready"]);
    });

    await Promise.all(updatePromises);
    return NextResponse.json({ ok: true, updated: validIds.length });
  }

  if (action === "set_priority") {
    updates = { ...updates, priority: parsed.data.payload.priority };
  }

  if (action === "cancel") {
    updates = { ...updates, status: "cancelled" };
  }

  if (action === "move_to_backlog") {
    updates = { ...updates, status: "backlog", sprint_id: null, sprint_order: null };
  }

  const { error } = await supabase
    .from("tasks")
    .update(updates)
    .eq("workspace_id", workspace.id)
    .in("id", validIds);

  if (error) {
    console.error("[POST /api/tasks/bulk]", error.message);
    return NextResponse.json({ error: error.message }, { status: 500 });
  }

  // Emit events for status changes
  if (action === "cancel" || action === "move_to_backlog") {
    const currentTasks = existing ?? [];
    const events = currentTasks
      .filter((t: { id: string }) => validIds.includes(t.id))
      .map((t: { id: string; status: string }) => ({
        task_id: t.id,
        workspace_id: workspace.id,
        event_type: "task.state.changed",
        actor_type: "human",
        actor_id: userId,
        payload: {
          from: t.status,
          to: action === "cancel" ? "cancelled" : "backlog",
        },
      }));
    if (events.length > 0) {
      await supabase.from("task_events").insert(events);
    }
  }

  return NextResponse.json({ ok: true, updated: validIds.length });
}
