import { NextResponse } from "next/server";
import { z } from "zod";
import { createSupabaseAdminClient } from "@/lib/supabase/admin";
import { extractKVAAuth, upsertUserFromSSO, resolveWorkspaceId } from "@/lib/auth/sso";
import { emitConnectorEvent, buildEvent } from "@/lib/events/emitter";
import type {
  ActionRequest,
  ActionResponse,
  CreateProjectParams,
  GetProjectSummaryParams,
  RunAgentParams,
  GetAgentOutputParams,
} from "@/types/connector";

// ---------------------------------------------------------------------------
// Request schema
// ---------------------------------------------------------------------------

const actionRequestSchema = z.object({
  action: z.enum(["create_project", "get_project_summary", "run_agent", "get_agent_output"]),
  params: z.record(z.unknown()),
  requestedBy: z.string(),
  sessionToken: z.string(),
});

// ---------------------------------------------------------------------------
// Action handlers
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

  // Emit event to Room
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

  // Reset queued_at so the TaskPoller picks it up; optionally pin to an agent
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

  const task = data as {
    status: string;
    task_artifacts: unknown[];
    task_iterations: unknown[];
  };

  // Emit output.ready if the task is completed or in review
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
    }
  } catch (err) {
    const message = err instanceof Error ? err.message : "Internal error";
    console.error(`[POST /api/connector/actions] ${action} error:`, message);
    return NextResponse.json({ error: message }, { status: 500 });
  }

  return NextResponse.json(result, {
    status: result.success ? 200 : 422,
  });
}
