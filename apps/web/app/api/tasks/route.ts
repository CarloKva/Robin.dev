import { auth } from "@clerk/nextjs/server";
import { NextResponse } from "next/server";
import { z } from "zod";
import { createSupabaseServerClient } from "@/lib/supabase/server";
import { getWorkspaceForUser } from "@/lib/db/workspace";
import { getOnlineAgentForWorkspace } from "@/lib/db/agents";
import { getGitHubConnection } from "@/lib/db/github";
import { getInstallationToken } from "@/lib/github/app";
import { getTaskQueue, priorityToNumber, defaultTimeoutByType } from "@/lib/queue/tasks.queue";
import type { JobPayload } from "@robin/shared-types";

const createTaskSchema = z.object({
  title: z.string().min(1, "Titolo obbligatorio").max(200),
  description: z.string().max(5000).optional().default(""),
  type: z.enum(["bug", "feature", "docs", "refactor", "chore", "accessibility", "security"]).optional().default("feature"),
  priority: z.enum(["low", "medium", "high", "urgent", "critical"]).optional().default("medium"),
  // Sprint B new fields
  sprint_id: z.string().uuid().nullable().optional(),
  repository_id: z.string().uuid().nullable().optional(),
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

  // ── Resolve repository metadata for the job payload ─────────────────────
  // When repository_id is provided, build an authenticated clone URL using
  // the GitHub App installation token so the orchestrator can clone private repos.
  const reposBasePath = process.env["AGENT_REPOS_BASE_PATH"] ?? "/home/agent/repos";
  let resolvedRepositoryUrl = process.env["DEFAULT_REPOSITORY_URL"] ?? "";
  let resolvedRepositoryPath = process.env["DEFAULT_REPOSITORY_PATH"] ?? "/workspace/repo";
  let resolvedBranch = process.env["DEFAULT_BRANCH"] ?? "main";

  if (repository_id) {
    const { data: repo } = await supabase
      .from("repositories")
      .select("id, full_name, default_branch")
      .eq("id", repository_id)
      .eq("workspace_id", workspace.id)
      .single();

    if (repo) {
      resolvedRepositoryPath = `${reposBasePath}/${repo.id}`;
      resolvedBranch = repo.default_branch ?? "main";
      try {
        const connection = await getGitHubConnection(workspace.id);
        if (connection) {
          const token = await getInstallationToken(connection.installation_id);
          resolvedRepositoryUrl = `https://x-access-token:${token}@github.com/${repo.full_name}.git`;
        } else {
          resolvedRepositoryUrl = `https://github.com/${repo.full_name}.git`;
        }
      } catch (err) {
        console.error("[POST /api/tasks] failed to build clone URL:", err);
        resolvedRepositoryUrl = `https://github.com/${repo.full_name}.git`;
      }
    }
  }

  // Determine initial status
  let taskStatus: string;
  let assignedAgentId: string | null = null;

  if (sprint_id) {
    // Task is being added directly to a sprint — mark as sprint_ready
    taskStatus = "sprint_ready";
  } else if (add_to_sprint) {
    taskStatus = "sprint_ready";
  } else {
    // Routing: prefer explicit agent, fall back to auto-routing
    if (preferred_agent_id) {
      const twoMinutesAgo = new Date(Date.now() - 2 * 60 * 1000).toISOString();
      const { data: preferredAgent } = await supabase
        .from("agents")
        .select("id")
        .eq("id", preferred_agent_id)
        .eq("workspace_id", workspace.id)
        .gt("last_seen_at", twoMinutesAgo)
        .maybeSingle();
      assignedAgentId = preferredAgent?.id ?? null;
    }
    if (!assignedAgentId) {
      const onlineAgent = await getOnlineAgentForWorkspace(workspace.id);
      assignedAgentId = onlineAgent?.id ?? null;
    }
    taskStatus = assignedAgentId ? "queued" : "backlog";
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
      assigned_agent_id: assignedAgentId,
      created_by_user_id: userId,
      ...(sprint_id !== undefined && sprint_id !== null && { sprint_id }),
      ...(repository_id !== undefined && repository_id !== null && { repository_id }),
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

  // Enqueue in BullMQ only when an agent is online (best-effort)
  if (assignedAgentId && taskStatus === "queued") {
    try {
      const queue = getTaskQueue();

      const jobPayload: JobPayload = {
        taskId: task.id,
        workspaceId: workspace.id,
        agentId: assignedAgentId,
        repositoryUrl: resolvedRepositoryUrl,
        branch: resolvedBranch,
        repositoryPath: resolvedRepositoryPath,
        taskTitle: title,
        taskDescription: description,
        taskType: type as JobPayload["taskType"],
        priority: priority as JobPayload["priority"],
        timeoutMinutes: defaultTimeoutByType[type as keyof typeof defaultTimeoutByType] ?? 30,
        claudeMdPath: "CLAUDE.md",
      };

      await queue.add(title, jobPayload, {
        priority: priorityToNumber(priority as Parameters<typeof priorityToNumber>[0]),
        jobId: task.id,
      });
    } catch (err) {
      console.error("[POST /api/tasks] BullMQ enqueue error:", err);
    }
  }

  return NextResponse.json(
    { task, agentAssigned: !!assignedAgentId },
    { status: 201 }
  );
}
