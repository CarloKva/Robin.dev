import { auth } from "@clerk/nextjs/server";
import { NextResponse } from "next/server";
import { z } from "zod";
import { createSupabaseServerClient } from "@/lib/supabase/server";
import { getWorkspaceForUser } from "@/lib/db/workspace";

const createTaskSchema = z.object({
  title: z.string().min(1, "Titolo obbligatorio").max(200),
  description: z.string().max(5000).optional().default(""),
  type: z.enum(["bug", "feature", "docs", "refactor", "chore", "accessibility", "security"]).optional().default("feature"),
  priority: z.enum(["low", "medium", "high", "urgent", "critical"]).optional().default("medium"),
  // Sprint B new fields
  sprint_id: z.string().uuid().nullable().optional(),
  repository_id: z.string().uuid("Repository obbligatoria"),
  preferred_agent_id: z.string().uuid().nullable().optional(),
  context: z.string().max(5000).nullable().optional(),
  estimated_effort: z.enum(["xs", "s", "m", "l"]).nullable().optional(),
  // If sprint_id provided, initial status should be sprint_ready, not backlog
  add_to_sprint: z.boolean().optional().default(false),
});

export async function GET(request: Request) {
  const { userId } = await auth();
  if (!userId) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const supabase = await createSupabaseServerClient();
  const workspace = await getWorkspaceForUser(userId);
  if (!workspace) return NextResponse.json({ error: "Workspace not found" }, { status: 404 });

  const url = new URL(request.url);
  const status = url.searchParams.get("status");
  const type = url.searchParams.get("type");
  const priority = url.searchParams.get("priority");
  const search = url.searchParams.get("search");
  const page = parseInt(url.searchParams.get("page") ?? "1", 10);
  const pageSize = Math.min(parseInt(url.searchParams.get("pageSize") ?? "30", 10), 100);
  const offset = (page - 1) * pageSize;

  let query = supabase
    .from("tasks")
    .select("*", { count: "exact" })
    .eq("workspace_id", workspace.id)
    .order("created_at", { ascending: false })
    .range(offset, offset + pageSize - 1);

  if (status) query = query.eq("status", status);
  if (type) query = query.eq("type", type);
  if (priority) query = query.eq("priority", priority);
  if (search) query = query.ilike("title", `%${search}%`);

  const { data, error, count } = await query;
  if (error) return NextResponse.json({ error: error.message }, { status: 500 });

  return NextResponse.json({ tasks: data, total: count, page, pageSize });
}

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

  const { title, description, type, priority, sprint_id, repository_id, preferred_agent_id, context, estimated_effort, add_to_sprint } = parsed.data;

  const supabase = await createSupabaseServerClient();
  const workspace = await getWorkspaceForUser(userId);
  if (!workspace) {
    return NextResponse.json({ error: "Workspace not found" }, { status: 404 });
  }

  // Verify repository belongs to this workspace
  const { data: repoCheck } = await supabase
    .from("repositories")
    .select("id")
    .eq("id", repository_id)
    .eq("workspace_id", workspace.id)
    .maybeSingle();
  if (!repoCheck) {
    return NextResponse.json(
      { error: "Repository non trovata o non appartenente al workspace." },
      { status: 422 }
    );
  }

  // Determine initial status:
  // - If sprint_id or add_to_sprint → sprint_ready (task assigned to sprint, pending sprint start)
  // - Otherwise → backlog (task will only execute when added to a sprint and sprint is started)
  let taskStatus: string;
  if (sprint_id || add_to_sprint) {
    taskStatus = "sprint_ready";
  } else {
    taskStatus = "backlog";
  }

  // Determine sprint_order if adding to sprint
  let sprint_order: number | null = null;
  if (sprint_id) {
    const { data: lastTask } = await supabase
      .from("tasks")
      .select("sprint_order")
      .eq("sprint_id", sprint_id)
      .order("sprint_order", { ascending: false })
      .limit(1)
      .maybeSingle();
    sprint_order = (lastTask?.sprint_order ?? -1) + 1;
  }

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
      created_by_user_id: userId,
      ...(sprint_id !== undefined && sprint_id !== null && { sprint_id }),
      repository_id,
      ...(preferred_agent_id !== undefined && preferred_agent_id !== null && { preferred_agent_id }),
      ...(context !== undefined && context !== null && { context }),
      ...(estimated_effort !== undefined && estimated_effort !== null && { estimated_effort }),
      ...(sprint_order !== null && { sprint_order }),
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

  // Tasks are NOT enqueued at creation time. Execution only starts when the sprint is started
  // explicitly via POST /api/sprints/{id}/start. This decouples task creation from execution.

  return NextResponse.json(
    { task, agentAssigned: false },
    { status: 201 }
  );
}
