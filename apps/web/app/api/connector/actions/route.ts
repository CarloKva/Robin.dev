import { NextResponse } from "next/server";
import { z } from "zod";
import { createSupabaseAdminClient } from "@/lib/supabase/admin";
import { extractKVAAuth, upsertUserFromSSO, resolveWorkspaceId } from "@/lib/auth/sso";
import { emitConnectorEvent, buildEvent } from "@/lib/events/emitter";
import type {
  ActionRequest,
  ActionResponse,
  // Legacy
  CreateProjectParams,
  GetProjectSummaryParams,
  RunAgentParams,
  GetAgentOutputParams,
  // Tasks
  ListTasksParams,
  GetTaskParams,
  CreateTaskParams,
  UpdateTaskParams,
  DeleteTaskParams,
  // Sprints
  ListSprintsParams,
  GetSprintParams,
  CreateSprintParams,
  StartSprintParams,
  CompleteSprintParams,
  // Agents
  GetAgentParams,
  // Events
  GetTaskEventsParams,
} from "@/types/connector";

// ---------------------------------------------------------------------------
// Request schema
// ---------------------------------------------------------------------------

const actionRequestSchema = z.object({
  action: z.enum([
    // Legacy
    "create_project", "get_project_summary", "run_agent", "get_agent_output",
    // Tasks
    "list_tasks", "get_task", "create_task", "update_task", "delete_task",
    // Sprints
    "list_sprints", "get_sprint", "create_sprint", "start_sprint", "complete_sprint",
    // Agents
    "list_agents", "get_agent",
    // Repositories
    "list_repositories",
    // Events
    "get_task_events",
  ]),
  params: z.record(z.unknown()),
  requestedBy: z.string(),
  sessionToken: z.string(),
});

// ---------------------------------------------------------------------------
// Legacy action handlers (kept for backward compatibility)
// ---------------------------------------------------------------------------

async function createProject(
  params: CreateProjectParams,
  workspaceId: string,
  userId: string
): Promise<ActionResponse> {
  const supabase = createSupabaseAdminClient();

  const { data, error } = await supabase
    .from("tasks")
    .insert({
      workspace_id: workspaceId,
      title: params.title,
      description: params.description ?? "",
      priority: params.priority ?? "medium",
      status: "pending",
      created_by_user_id: userId,
      ...(params.repository_id !== undefined && { repository_id: params.repository_id }),
    })
    .select()
    .single();

  if (error) {
    return { action: "create_project", success: false, data: null, error: error.message };
  }

  await emitConnectorEvent(
    buildEvent("project.created", (data as { id: string }).id, "Project", {
      title: params.title,
      workspaceId,
    })
  );

  return { action: "create_project", success: true, data, error: undefined };
}

async function getProjectSummary(
  params: GetProjectSummaryParams,
  workspaceId: string
): Promise<ActionResponse> {
  const supabase = createSupabaseAdminClient();

  const { data, error } = await supabase
    .from("tasks")
    .select(
      "id, title, description, status, priority, created_at, updated_at, task_artifacts(type, url, title)"
    )
    .eq("id", params.task_id)
    .eq("workspace_id", workspaceId)
    .single();

  if (error) {
    return {
      action: "get_project_summary",
      success: false,
      data: null,
      error: error.code === "PGRST116" ? "Task not found" : error.message,
    };
  }

  return { action: "get_project_summary", success: true, data, error: undefined };
}

async function runAgent(
  params: RunAgentParams,
  workspaceId: string
): Promise<ActionResponse> {
  const supabase = createSupabaseAdminClient();

  const update: Record<string, unknown> = {
    status: "pending",
    queued_at: null,
    updated_at: new Date().toISOString(),
  };
  if (params.agent_id) {
    update["assigned_agent_id"] = params.agent_id;
  }

  const { data, error } = await supabase
    .from("tasks")
    .update(update)
    .eq("id", params.task_id)
    .eq("workspace_id", workspaceId)
    .select("id, title, status, assigned_agent_id")
    .single();

  if (error) {
    return {
      action: "run_agent",
      success: false,
      data: null,
      error: error.code === "PGRST116" ? "Task not found" : error.message,
    };
  }

  return { action: "run_agent", success: true, data, error: undefined };
}

async function getAgentOutput(
  params: GetAgentOutputParams,
  workspaceId: string
): Promise<ActionResponse> {
  const supabase = createSupabaseAdminClient();

  const { data, error } = await supabase
    .from("tasks")
    .select(
      "id, title, status, task_artifacts(id, type, url, title, created_at), task_iterations(id, iteration_number, status, summary, pr_url, completed_at)"
    )
    .eq("id", params.task_id)
    .eq("workspace_id", workspaceId)
    .single();

  if (error) {
    return {
      action: "get_agent_output",
      success: false,
      data: null,
      error: error.code === "PGRST116" ? "Task not found" : error.message,
    };
  }

  const task = data as { status: string; task_artifacts: unknown[]; task_iterations: unknown[] };

  if (task.status === "completed" || task.status === "review_pending") {
    await emitConnectorEvent(
      buildEvent("output.ready", params.task_id, "Output", {
        status: task.status,
        workspaceId,
      })
    );
  }

  return { action: "get_agent_output", success: true, data, error: undefined };
}

// ---------------------------------------------------------------------------
// Task handlers
// ---------------------------------------------------------------------------

async function listTasks(
  params: ListTasksParams,
  workspaceId: string
): Promise<ActionResponse> {
  const supabase = createSupabaseAdminClient();

  const page = params.page ?? 1;
  const pageSize = Math.min(params.pageSize ?? 30, 100);
  const from = (page - 1) * pageSize;
  const to = from + pageSize - 1;

  let query = supabase
    .from("tasks")
    .select(
      "id, title, description, status, priority, type, assigned_agent_id, sprint_id, repository_id, sprint_order, estimated_effort, current_iteration, rework_count, queued_at, created_at, updated_at",
      { count: "exact" }
    )
    .eq("workspace_id", workspaceId)
    .order("created_at", { ascending: false })
    .range(from, to);

  if (params.status) query = query.eq("status", params.status);
  if (params.repository_id) query = query.eq("repository_id", params.repository_id);
  if (params.sprint_id) query = query.eq("sprint_id", params.sprint_id);
  if (params.priority) query = query.eq("priority", params.priority);

  const { data, error, count } = await query;

  if (error) {
    return { action: "list_tasks", success: false, data: null, error: error.message };
  }

  return {
    action: "list_tasks",
    success: true,
    data: { tasks: data ?? [], total: count ?? 0, page, pageSize },
    error: undefined,
  };
}

async function getTask(
  params: GetTaskParams,
  workspaceId: string
): Promise<ActionResponse> {
  const supabase = createSupabaseAdminClient();

  const { data, error } = await supabase
    .from("tasks")
    .select(
      "*, task_artifacts(id, type, url, title, created_at), task_iterations(id, iteration_number, status, summary, pr_url, completed_at)"
    )
    .eq("id", params.task_id)
    .eq("workspace_id", workspaceId)
    .single();

  if (error) {
    return {
      action: "get_task",
      success: false,
      data: null,
      error: error.code === "PGRST116" ? "Task not found" : error.message,
    };
  }

  return { action: "get_task", success: true, data, error: undefined };
}

async function createTask(
  params: CreateTaskParams,
  workspaceId: string,
  userId: string
): Promise<ActionResponse> {
  const supabase = createSupabaseAdminClient();

  const taskStatus = params.sprint_id ? "sprint_ready" : "backlog";

  const { data, error } = await supabase
    .from("tasks")
    .insert({
      workspace_id: workspaceId,
      title: params.title,
      description: params.description ?? "",
      type: params.type ?? "feature",
      priority: params.priority ?? "medium",
      status: taskStatus,
      created_by_user_id: userId,
      ...(params.repository_id !== undefined && { repository_id: params.repository_id }),
      ...(params.sprint_id !== undefined && { sprint_id: params.sprint_id }),
      ...(params.estimated_effort !== undefined && { estimated_effort: params.estimated_effort }),
    })
    .select()
    .single();

  if (error) {
    return { action: "create_task", success: false, data: null, error: error.message };
  }

  const taskId = (data as { id: string }).id;

  // Emit task.created event
  await supabase.from("task_events").insert({
    task_id: taskId,
    workspace_id: workspaceId,
    event_type: "task.created",
    actor_type: "human",
    actor_id: userId,
    payload: { title: params.title, priority: params.priority ?? "medium", source: "brook" },
  });

  // Emit task.state.changed event
  await supabase.from("task_events").insert({
    task_id: taskId,
    workspace_id: workspaceId,
    event_type: "task.state.changed",
    actor_type: "human",
    actor_id: userId,
    payload: { from: "pending", to: taskStatus },
  });

  await emitConnectorEvent(
    buildEvent("project.created", taskId, "Project", { title: params.title, workspaceId })
  );

  return { action: "create_task", success: true, data, error: undefined };
}

async function updateTask(
  params: UpdateTaskParams,
  workspaceId: string
): Promise<ActionResponse> {
  const supabase = createSupabaseAdminClient();

  const updateFields: Record<string, unknown> = {
    updated_at: new Date().toISOString(),
  };

  if (params.title !== undefined) updateFields["title"] = params.title;
  if (params.description !== undefined) updateFields["description"] = params.description;
  if (params.status !== undefined) updateFields["status"] = params.status;
  if (params.priority !== undefined) updateFields["priority"] = params.priority;
  if (params.type !== undefined) updateFields["type"] = params.type;
  if (params.estimated_effort !== undefined) updateFields["estimated_effort"] = params.estimated_effort;
  // sprint_id can be explicitly null to remove from sprint
  if ("sprint_id" in params) updateFields["sprint_id"] = params.sprint_id;

  if (Object.keys(updateFields).length === 1) {
    return { action: "update_task", success: false, data: null, error: "No fields to update" };
  }

  // Emit state change event if status is changing
  if (params.status !== undefined) {
    const { data: current } = await supabase
      .from("tasks")
      .select("status")
      .eq("id", params.task_id)
      .eq("workspace_id", workspaceId)
      .single();

    if (current && (current as { status: string }).status !== params.status) {
      await supabase.from("task_events").insert({
        task_id: params.task_id,
        workspace_id: workspaceId,
        event_type: "task.state.changed",
        actor_type: "human",
        actor_id: "brook",
        payload: { from: (current as { status: string }).status, to: params.status },
      });
    }
  }

  const { data, error } = await supabase
    .from("tasks")
    .update(updateFields)
    .eq("id", params.task_id)
    .eq("workspace_id", workspaceId)
    .select()
    .single();

  if (error) {
    return {
      action: "update_task",
      success: false,
      data: null,
      error: error.code === "PGRST116" ? "Task not found" : error.message,
    };
  }

  return { action: "update_task", success: true, data, error: undefined };
}

async function deleteTask(
  params: DeleteTaskParams,
  workspaceId: string
): Promise<ActionResponse> {
  const supabase = createSupabaseAdminClient();

  const { error } = await supabase
    .from("tasks")
    .delete()
    .eq("id", params.task_id)
    .eq("workspace_id", workspaceId);

  if (error) {
    return { action: "delete_task", success: false, data: null, error: error.message };
  }

  return { action: "delete_task", success: true, data: { deleted: true, task_id: params.task_id }, error: undefined };
}

// ---------------------------------------------------------------------------
// Sprint handlers
// ---------------------------------------------------------------------------

async function listSprints(
  params: ListSprintsParams,
  workspaceId: string
): Promise<ActionResponse> {
  const supabase = createSupabaseAdminClient();

  let query = supabase
    .from("sprints")
    .select(
      "id, name, goal, status, started_at, completed_at, tasks_completed, tasks_failed, tasks_moved_back, avg_cycle_time_minutes, created_at, updated_at"
    )
    .eq("workspace_id", workspaceId)
    .order("created_at", { ascending: false });

  if (params.status) query = query.eq("status", params.status);

  const { data, error } = await query;

  if (error) {
    return { action: "list_sprints", success: false, data: null, error: error.message };
  }

  return { action: "list_sprints", success: true, data: { sprints: data ?? [] }, error: undefined };
}

async function getSprint(
  params: GetSprintParams,
  workspaceId: string
): Promise<ActionResponse> {
  const supabase = createSupabaseAdminClient();

  const { data: sprint, error: sprintError } = await supabase
    .from("sprints")
    .select("*")
    .eq("id", params.sprint_id)
    .eq("workspace_id", workspaceId)
    .single();

  if (sprintError) {
    return {
      action: "get_sprint",
      success: false,
      data: null,
      error: sprintError.code === "PGRST116" ? "Sprint not found" : sprintError.message,
    };
  }

  const { data: tasks } = await supabase
    .from("tasks")
    .select("id, title, status, priority, type, assigned_agent_id, sprint_order, estimated_effort, repository_id")
    .eq("sprint_id", params.sprint_id)
    .eq("workspace_id", workspaceId)
    .order("sprint_order", { ascending: true });

  return {
    action: "get_sprint",
    success: true,
    data: { ...sprint, tasks: tasks ?? [] },
    error: undefined,
  };
}

async function createSprint(
  params: CreateSprintParams,
  workspaceId: string
): Promise<ActionResponse> {
  const supabase = createSupabaseAdminClient();

  const { data, error } = await supabase
    .from("sprints")
    .insert({
      workspace_id: workspaceId,
      name: params.name,
      ...(params.goal !== undefined && { goal: params.goal }),
      status: "planning",
    })
    .select()
    .single();

  if (error) {
    return { action: "create_sprint", success: false, data: null, error: error.message };
  }

  return { action: "create_sprint", success: true, data, error: undefined };
}

async function startSprint(
  params: StartSprintParams,
  workspaceId: string
): Promise<ActionResponse> {
  const supabase = createSupabaseAdminClient();

  // Load sprint
  const { data: sprint, error: sprintError } = await supabase
    .from("sprints")
    .select("id, name, status")
    .eq("id", params.sprint_id)
    .eq("workspace_id", workspaceId)
    .single();

  if (sprintError) {
    return { action: "start_sprint", success: false, data: null, error: "Sprint not found" };
  }

  const s = sprint as { id: string; name: string; status: string };
  if (s.status !== "planning") {
    return {
      action: "start_sprint",
      success: false,
      data: null,
      error: `Cannot start a sprint with status '${s.status}'`,
    };
  }

  // Check for existing active sprint
  const { data: existingActive } = await supabase
    .from("sprints")
    .select("id")
    .eq("workspace_id", workspaceId)
    .eq("status", "active")
    .maybeSingle();

  if (existingActive) {
    return {
      action: "start_sprint",
      success: false,
      data: null,
      error: "There is already an active sprint. Complete it before starting a new one.",
    };
  }

  // Get sprint_ready tasks
  const { data: tasks } = await supabase
    .from("tasks")
    .select("id")
    .eq("sprint_id", params.sprint_id)
    .eq("workspace_id", workspaceId)
    .eq("status", "sprint_ready");

  if (!tasks || tasks.length === 0) {
    return {
      action: "start_sprint",
      success: false,
      data: null,
      error: "No sprint-ready tasks in this sprint. Add tasks with status 'sprint_ready' first.",
    };
  }

  // Activate sprint
  await supabase
    .from("sprints")
    .update({
      status: "active",
      started_at: new Date().toISOString(),
      updated_at: new Date().toISOString(),
    })
    .eq("id", params.sprint_id)
    .eq("workspace_id", workspaceId);

  // Move tasks to queued
  const taskIds = (tasks as { id: string }[]).map((t) => t.id);
  await supabase
    .from("tasks")
    .update({ status: "queued", updated_at: new Date().toISOString() })
    .in("id", taskIds)
    .eq("workspace_id", workspaceId);

  // Emit state change events
  await supabase.from("task_events").insert(
    taskIds.map((taskId) => ({
      task_id: taskId,
      workspace_id: workspaceId,
      event_type: "task.state.changed",
      actor_type: "human",
      actor_id: "brook",
      payload: { from: "sprint_ready", to: "queued", note: `Sprint "${s.name}" started via Brook` },
    }))
  );

  return {
    action: "start_sprint",
    success: true,
    data: { sprint_id: params.sprint_id, sprint_name: s.name, tasks_queued: tasks.length },
    error: undefined,
  };
}

async function completeSprint(
  params: CompleteSprintParams,
  workspaceId: string
): Promise<ActionResponse> {
  const supabase = createSupabaseAdminClient();

  // Load sprint
  const { data: sprint, error: sprintError } = await supabase
    .from("sprints")
    .select("id, name, status")
    .eq("id", params.sprint_id)
    .eq("workspace_id", workspaceId)
    .single();

  if (sprintError) {
    return { action: "complete_sprint", success: false, data: null, error: "Sprint not found" };
  }

  const s = sprint as { id: string; name: string; status: string };
  if (s.status !== "active") {
    return {
      action: "complete_sprint",
      success: false,
      data: null,
      error: `Cannot complete a sprint with status '${s.status}'`,
    };
  }

  // Load sprint tasks
  const { data: tasks } = await supabase
    .from("tasks")
    .select("id, status, queued_at, updated_at")
    .eq("sprint_id", params.sprint_id)
    .eq("workspace_id", workspaceId);

  const allTasks = (tasks ?? []) as { id: string; status: string; queued_at: string | null; updated_at: string }[];
  const doneTasks = allTasks.filter((t) => ["done", "completed"].includes(t.status));
  const failedTasks = allTasks.filter((t) => t.status === "failed");
  const inProgressTasks = allTasks.filter((t) =>
    ["queued", "in_progress", "in_review", "rework", "sprint_ready"].includes(t.status)
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
      .eq("workspace_id", workspaceId);

    await supabase.from("task_events").insert(
      inProgressTasks.map((t) => ({
        task_id: t.id,
        workspace_id: workspaceId,
        event_type: "task.state.changed",
        actor_type: "human",
        actor_id: "brook",
        payload: {
          from: t.status,
          to: "backlog",
          note: `Sprint "${s.name}" completed via Brook`,
        },
      }))
    );
  }

  // Compute avg cycle time
  const cycleTimes = doneTasks
    .filter((t) => t.queued_at !== null)
    .map((t) => new Date(t.updated_at).getTime() - new Date(t.queued_at!).getTime());
  const avgCycleMinutes =
    cycleTimes.length > 0
      ? Math.round(cycleTimes.reduce((a, b) => a + b, 0) / cycleTimes.length / 60000)
      : null;

  // Close sprint
  await supabase
    .from("sprints")
    .update({
      status: "completed",
      completed_at: new Date().toISOString(),
      tasks_completed: doneTasks.length,
      tasks_failed: failedTasks.length,
      tasks_moved_back: inProgressTasks.length,
      ...(avgCycleMinutes !== null && { avg_cycle_time_minutes: avgCycleMinutes }),
      updated_at: new Date().toISOString(),
    })
    .eq("id", params.sprint_id)
    .eq("workspace_id", workspaceId);

  return {
    action: "complete_sprint",
    success: true,
    data: {
      sprint_id: params.sprint_id,
      sprint_name: s.name,
      completed: doneTasks.length,
      failed: failedTasks.length,
      moved_back: inProgressTasks.length,
      avg_cycle_minutes: avgCycleMinutes,
    },
    error: undefined,
  };
}

// ---------------------------------------------------------------------------
// Agent handlers
// ---------------------------------------------------------------------------

async function listAgents(workspaceId: string): Promise<ActionResponse> {
  const supabase = createSupabaseAdminClient();

  const { data, error } = await supabase
    .from("agents")
    .select(
      "id, name, slug, provisioning_status, last_seen_at, created_at, updated_at, agent_status(status, current_task_id, last_heartbeat)"
    )
    .eq("workspace_id", workspaceId)
    .order("created_at", { ascending: false });

  if (error) {
    return { action: "list_agents", success: false, data: null, error: error.message };
  }

  return { action: "list_agents", success: true, data: { agents: data ?? [] }, error: undefined };
}

async function getAgent(
  params: GetAgentParams,
  workspaceId: string
): Promise<ActionResponse> {
  const supabase = createSupabaseAdminClient();

  const { data, error } = await supabase
    .from("agents")
    .select("*, agent_status(status, current_task_id, last_heartbeat)")
    .eq("id", params.agent_id)
    .eq("workspace_id", workspaceId)
    .single();

  if (error) {
    return {
      action: "get_agent",
      success: false,
      data: null,
      error: error.code === "PGRST116" ? "Agent not found" : error.message,
    };
  }

  return { action: "get_agent", success: true, data, error: undefined };
}

// ---------------------------------------------------------------------------
// Repository handlers
// ---------------------------------------------------------------------------

async function listRepositories(workspaceId: string): Promise<ActionResponse> {
  const supabase = createSupabaseAdminClient();

  const { data, error } = await supabase
    .from("repositories")
    .select("id, full_name, name, enabled, default_branch, created_at, updated_at")
    .eq("workspace_id", workspaceId)
    .order("full_name", { ascending: true });

  if (error) {
    return { action: "list_repositories", success: false, data: null, error: error.message };
  }

  return {
    action: "list_repositories",
    success: true,
    data: { repositories: data ?? [] },
    error: undefined,
  };
}

// ---------------------------------------------------------------------------
// Task events handler
// ---------------------------------------------------------------------------

async function getTaskEvents(
  params: GetTaskEventsParams,
  workspaceId: string
): Promise<ActionResponse> {
  const supabase = createSupabaseAdminClient();

  const { data, error } = await supabase
    .from("task_events")
    .select("id, event_type, actor_type, actor_id, payload, iteration_number, created_at")
    .eq("task_id", params.task_id)
    .eq("workspace_id", workspaceId)
    .order("created_at", { ascending: true })
    .limit(200);

  if (error) {
    return { action: "get_task_events", success: false, data: null, error: error.message };
  }

  return { action: "get_task_events", success: true, data: { events: data ?? [] }, error: undefined };
}

// ---------------------------------------------------------------------------
// Route handler
// ---------------------------------------------------------------------------

export async function POST(request: Request): Promise<NextResponse> {
  const auth = extractKVAAuth(request);
  if (!auth.ok) return auth.response;

  await upsertUserFromSSO(auth.ctx.ssoPayload);

  const workspaceId = await resolveWorkspaceId(auth.ctx.ssoPayload);
  if (!workspaceId) {
    return NextResponse.json(
      { error: "No Robin Dev workspace associated with this KVA user" },
      { status: 404 }
    );
  }

  const body = await request.json().catch(() => null);
  const parsed = actionRequestSchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json(
      { error: "Invalid request body", details: parsed.error.flatten() },
      { status: 400 }
    );
  }

  const { action, params } = parsed.data as ActionRequest;
  const userId = auth.ctx.ssoPayload.sub;

  let result: ActionResponse;

  try {
    switch (action) {
      // ── Legacy actions ──────────────────────────────────────────────────────
      case "create_project":
        result = await createProject(params as unknown as CreateProjectParams, workspaceId, userId);
        break;
      case "get_project_summary":
        result = await getProjectSummary(params as unknown as GetProjectSummaryParams, workspaceId);
        break;
      case "run_agent":
        result = await runAgent(params as unknown as RunAgentParams, workspaceId);
        break;
      case "get_agent_output":
        result = await getAgentOutput(params as unknown as GetAgentOutputParams, workspaceId);
        break;

      // ── Task actions ────────────────────────────────────────────────────────
      case "list_tasks":
        result = await listTasks(params as unknown as ListTasksParams, workspaceId);
        break;
      case "get_task":
        result = await getTask(params as unknown as GetTaskParams, workspaceId);
        break;
      case "create_task":
        result = await createTask(params as unknown as CreateTaskParams, workspaceId, userId);
        break;
      case "update_task":
        result = await updateTask(params as unknown as UpdateTaskParams, workspaceId);
        break;
      case "delete_task":
        result = await deleteTask(params as unknown as DeleteTaskParams, workspaceId);
        break;

      // ── Sprint actions ──────────────────────────────────────────────────────
      case "list_sprints":
        result = await listSprints(params as unknown as ListSprintsParams, workspaceId);
        break;
      case "get_sprint":
        result = await getSprint(params as unknown as GetSprintParams, workspaceId);
        break;
      case "create_sprint":
        result = await createSprint(params as unknown as CreateSprintParams, workspaceId);
        break;
      case "start_sprint":
        result = await startSprint(params as unknown as StartSprintParams, workspaceId);
        break;
      case "complete_sprint":
        result = await completeSprint(params as unknown as CompleteSprintParams, workspaceId);
        break;

      // ── Agent actions ───────────────────────────────────────────────────────
      case "list_agents":
        result = await listAgents(workspaceId);
        break;
      case "get_agent":
        result = await getAgent(params as unknown as GetAgentParams, workspaceId);
        break;

      // ── Repository actions ──────────────────────────────────────────────────
      case "list_repositories":
        result = await listRepositories(workspaceId);
        break;

      // ── Task events actions ─────────────────────────────────────────────────
      case "get_task_events":
        result = await getTaskEvents(params as unknown as GetTaskEventsParams, workspaceId);
        break;
    }
  } catch (err) {
    const message = err instanceof Error ? err.message : "Internal error";
    console.error(`[POST /api/connector/actions] ${action} error:`, message);
    return NextResponse.json({ error: message }, { status: 500 });
  }

  return NextResponse.json(result!, {
    status: result!.success ? 200 : 422,
  });
}
