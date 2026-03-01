import { auth } from "@clerk/nextjs/server";
import { NextResponse } from "next/server";
import { z } from "zod";
import { createSupabaseServerClient } from "@/lib/supabase/server";
import { getWorkspaceForUser } from "@/lib/db/workspace";

// DB only supports: bug, feature, docs, refactor, chore (check constraint from migration 0005)
// "spike" maps to "chore" since the DB enum doesn't include it yet.
const DB_TYPE_MAP: Record<string, string> = {
  feature: "feature",
  bug: "bug",
  spike: "chore",
  chore: "chore",
};

const parsedTaskSchema = z.object({
  title: z.string().min(1).max(200),
  type: z.enum(["feature", "bug", "spike", "chore"]),
  priority: z.enum(["high", "medium", "low"]),
  agent: z.string().optional(),
  repository: z.string().optional(),
  depends_on: z.string().optional(),
  description: z.string().min(20).max(5000),
});

const importBodySchema = z.object({
  tasks: z.array(parsedTaskSchema).min(1).max(50),
});

export async function POST(request: Request) {
  const { userId } = await auth();
  if (!userId) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const body = await request.json().catch(() => null);
  const parsed = importBodySchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json(
      { error: "Invalid request body", details: parsed.error.flatten() },
      { status: 400 }
    );
  }

  const { tasks } = parsed.data;

  const supabase = await createSupabaseServerClient();
  const workspace = await getWorkspaceForUser(userId);
  if (!workspace) {
    return NextResponse.json({ error: "Workspace not found" }, { status: 404 });
  }

  // Resolve agent names → agent IDs (best-effort; unresolved agents are silently skipped)
  const agentNames = [...new Set(tasks.flatMap((t) => (t.agent !== undefined ? [t.agent] : [])))]
  const agentMap: Record<string, string> = {};
  if (agentNames.length > 0) {
    const { data: agents } = await supabase
      .from("agents")
      .select("id, name")
      .eq("workspace_id", workspace.id)
      .in("name", agentNames);
    for (const a of agents ?? []) {
      agentMap[(a as { id: string; name: string }).name] =
        (a as { id: string; name: string }).id;
    }
  }

  // Resolve repository full_names → repository IDs (best-effort)
  const repoNames = [
    ...new Set(tasks.flatMap((t) => (t.repository !== undefined ? [t.repository] : []))),
  ];
  const repoMap: Record<string, string> = {};
  if (repoNames.length > 0) {
    const { data: repos } = await supabase
      .from("repositories")
      .select("id, full_name")
      .eq("workspace_id", workspace.id)
      .in("full_name", repoNames);
    for (const r of repos ?? []) {
      repoMap[(r as { id: string; full_name: string }).full_name] =
        (r as { id: string; full_name: string }).id;
    }
  }

  // Build task rows for batch insert
  const taskRows = tasks.map((task) => {
    const dbType = DB_TYPE_MAP[task.type] ?? "feature";
    const preferredAgentId =
      task.agent !== undefined && agentMap[task.agent] !== undefined
        ? agentMap[task.agent]
        : undefined;
    const repositoryId =
      task.repository !== undefined && repoMap[task.repository] !== undefined
        ? repoMap[task.repository]
        : undefined;

    return {
      workspace_id: workspace.id,
      title: task.title,
      description: task.description,
      type: dbType,
      priority: task.priority,
      status: "backlog",
      created_by_user_id: userId,
      ...(preferredAgentId !== undefined && { preferred_agent_id: preferredAgentId }),
      ...(repositoryId !== undefined && { repository_id: repositoryId }),
    };
  });

  // Single batch insert — atomic in PostgreSQL (one INSERT statement)
  const { data: createdTasks, error: insertError } = await supabase
    .from("tasks")
    .insert(taskRows)
    .select();

  if (insertError ?? !createdTasks) {
    console.error("[POST /api/backlog/import] insert error:", insertError?.message);
    return NextResponse.json(
      { error: insertError?.message ?? "Failed to create tasks" },
      { status: 422 }
    );
  }

  // Emit task.created events for all imported tasks
  if (createdTasks.length > 0) {
    await supabase.from("task_events").insert(
      (createdTasks as { id: string; title: string }[]).map((task) => ({
        task_id: task.id,
        workspace_id: workspace.id,
        event_type: "task.created",
        actor_type: "human",
        actor_id: userId,
        payload: { source: "import", title: task.title },
      }))
    );
  }

  return NextResponse.json(
    { created: createdTasks.length, tasks: createdTasks },
    { status: 201 }
  );
}
