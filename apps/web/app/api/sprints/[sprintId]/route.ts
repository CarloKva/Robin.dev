import { NextResponse } from "next/server";
import { z } from "zod";
import { createSupabaseServerClient } from "@/lib/supabase/server";
import { requireWorkspace } from "@/lib/api/requireWorkspace";
import { getSprintWithTasks } from "@/lib/db/sprints";

const patchSprintSchema = z.object({
  name: z.string().min(1).max(100).optional(),
  goal: z.string().max(500).optional(),
  // Reorder: array of { taskId, sprint_order }
  taskOrder: z
    .array(z.object({ taskId: z.string().uuid(), sprint_order: z.number().int().min(0) }))
    .optional(),
});

export async function GET(
  _request: Request,
  { params }: { params: Promise<{ sprintId: string }> }
) {
  const result = await requireWorkspace();
  if (result instanceof NextResponse) return result;
  const { workspace } = result;

  const { sprintId } = await params;

  const sprint = await getSprintWithTasks(sprintId, workspace.id);
  if (!sprint) return NextResponse.json({ error: "Sprint not found" }, { status: 404 });

  return NextResponse.json({ sprint });
}

export async function PATCH(
  request: Request,
  { params }: { params: Promise<{ sprintId: string }> }
) {
  const result = await requireWorkspace();
  if (result instanceof NextResponse) return result;
  const { workspace } = result;

  const { sprintId } = await params;
  const body = await request.json().catch(() => ({}));
  const parsed = patchSprintSchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json({ error: "Invalid body", details: parsed.error.flatten() }, { status: 400 });
  }

  const supabase = await createSupabaseServerClient();
  const { name, goal, taskOrder } = parsed.data;

  // Update sprint fields
  if (name !== undefined || goal !== undefined) {
    const { error } = await supabase
      .from("sprints")
      .update({
        ...(name !== undefined && { name }),
        ...(goal !== undefined && { goal }),
        updated_at: new Date().toISOString(),
      })
      .eq("id", sprintId)
      .eq("workspace_id", workspace.id);

    if (error) {
      console.error("[PATCH /api/sprints/:id]", error.message);
      return NextResponse.json({ error: error.message }, { status: 500 });
    }
  }

  // Reorder tasks within sprint (bulk update sprint_order)
  if (taskOrder?.length) {
    const updates = taskOrder.map(({ taskId, sprint_order }) =>
      supabase
        .from("tasks")
        .update({ sprint_order, updated_at: new Date().toISOString() })
        .eq("id", taskId)
        .eq("sprint_id", sprintId)
        .eq("workspace_id", workspace.id)
    );
    await Promise.all(updates);
  }

  const sprint = await getSprintWithTasks(sprintId, workspace.id);
  return NextResponse.json({ sprint });
}

export async function DELETE(
  _request: Request,
  { params }: { params: Promise<{ sprintId: string }> }
) {
  const result = await requireWorkspace();
  if (result instanceof NextResponse) return result;
  const { workspace } = result;

  const { sprintId } = await params;

  const supabase = await createSupabaseServerClient();

  // Move tasks back to backlog before deleting sprint
  await supabase
    .from("tasks")
    .update({ sprint_id: null, status: "backlog", sprint_order: null, updated_at: new Date().toISOString() })
    .eq("sprint_id", sprintId)
    .eq("workspace_id", workspace.id)
    .in("status", ["sprint_ready"]);

  const { error } = await supabase
    .from("sprints")
    .delete()
    .eq("id", sprintId)
    .eq("workspace_id", workspace.id)
    .eq("status", "planning"); // Can only delete planning sprints

  if (error) {
    console.error("[DELETE /api/sprints/:id]", error.message);
    return NextResponse.json({ error: error.message }, { status: 500 });
  }

  return NextResponse.json({ ok: true });
}
