import { NextResponse } from "next/server";
import { z } from "zod";
import { createSupabaseAdminClient } from "@/lib/supabase/admin";
import { extractKVAAuth, upsertUserFromSSO, resolveWorkspaceId } from "@/lib/auth/sso";
import type {
  KOCompatibleEntity,
  KOEntityType,
  EntitiesResponse,
} from "@/types/connector";

const querySchema = z.object({
  type: z.enum(["Project", "Agent", "Session", "Output", "Investment"]).optional(),
  limit: z.coerce.number().int().min(1).max(100).default(50),
  cursor: z.string().uuid().optional(),
});

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

/** Strips ASCII control characters (U+0000–U+001F) that break JSON parsers. */
function sanitizeText(text: string): string {
  return text.replace(/[\x00-\x1F]/g, " ").trim();
}

// ---------------------------------------------------------------------------
// Entity mappers
// ---------------------------------------------------------------------------

type TaskRow = {
  id: string;
  title: string;
  description: string;
  status: string;
  priority: string;
  created_by_user_id: string;
  assigned_agent_id: string | null;
  ai_readable: boolean;
  created_at: string;
  updated_at: string;
};

type AgentRow = {
  id: string;
  name: string;
  type: string;
  workspace_id: string;
  created_at: string;
  updated_at: string;
};

function mapTaskToKO(task: TaskRow): KOCompatibleEntity {
  const rawSummary = sanitizeText(task.description ?? "");
  const summary =
    rawSummary.length > 0
      ? rawSummary.slice(0, 500)
      : sanitizeText(`${task.status} task: ${task.title}`).slice(0, 500);

  const entityType: KOEntityType =
    task.status === "completed" || task.status === "review_pending"
      ? "Output"
      : "Project";

  return {
    id: task.id,
    type: entityType,
    title: task.title,
    summary,
    content: task.description.length > 500 ? sanitizeText(task.description) : undefined,
    metadata: {
      source: "robin-dev",
      createdAt: task.created_at,
      updatedAt: task.updated_at,
      ownerId: task.created_by_user_id,
      tags: [task.status, task.priority, ...(task.assigned_agent_id ? ["assigned"] : [])],
      status: task.status,
    },
    relations:
      task.assigned_agent_id !== null
        ? [
            {
              type: "ENABLES",
              targetId: task.assigned_agent_id,
              targetType: "Agent",
            },
          ]
        : undefined,
  };
}

function mapAgentToKO(agent: AgentRow): KOCompatibleEntity {
  return {
    id: agent.id,
    type: "Agent",
    title: agent.name,
    summary: `Robin Dev AI agent — type: ${agent.type}`.slice(0, 500),
    content: undefined,
    metadata: {
      source: "robin-dev",
      createdAt: agent.created_at,
      updatedAt: agent.updated_at,
      ownerId: agent.workspace_id,
      tags: ["agent", agent.type],
      status: "active",
    },
    relations: undefined,
  };
}

// ---------------------------------------------------------------------------
// Route handler
// ---------------------------------------------------------------------------

export async function GET(request: Request): Promise<NextResponse> {
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

  const { searchParams } = new URL(request.url);
  const parsed = querySchema.safeParse({
    type: searchParams.get("type") ?? undefined,
    limit: searchParams.get("limit") ?? undefined,
    cursor: searchParams.get("cursor") ?? undefined,
  });

  if (!parsed.success) {
    return NextResponse.json(
      { error: "Invalid query parameters", details: parsed.error.flatten() },
      { status: 400 }
    );
  }

  const { type, limit, cursor } = parsed.data;
  const supabase = createSupabaseAdminClient();
  const entities: KOCompatibleEntity[] = [];

  const wantsTasks = !type || type === "Project" || type === "Output";
  const wantsAgents = !type || type === "Agent";

  // --- Tasks ---
  if (wantsTasks) {
    let query = supabase
      .from("tasks")
      .select(
        "id, title, description, status, priority, created_by_user_id, assigned_agent_id, ai_readable, created_at, updated_at"
      )
      .eq("workspace_id", workspaceId)
      .order("created_at", { ascending: false })
      .limit(limit);

    if (cursor) {
      query = query.lt("id", cursor);
    }

    const { data, error } = await query;
    if (error) {
      console.error("[GET /api/connector/entities] tasks error:", error.message);
      return NextResponse.json({ error: error.message }, { status: 500 });
    }

    for (const task of (data ?? []) as TaskRow[]) {
      entities.push(mapTaskToKO(task));
    }
  }

  // --- Agents ---
  if (wantsAgents) {
    const { data, error } = await supabase
      .from("agents")
      .select("id, name, type, workspace_id, created_at, updated_at")
      .eq("workspace_id", workspaceId)
      .limit(limit);

    if (error) {
      console.error("[GET /api/connector/entities] agents error:", error.message);
      return NextResponse.json({ error: error.message }, { status: 500 });
    }

    for (const agent of (data ?? []) as AgentRow[]) {
      entities.push(mapAgentToKO(agent));
    }
  }

  const nextCursor =
    entities.length === limit ? (entities[entities.length - 1]?.id ?? null) : null;

  const response: EntitiesResponse = {
    data: entities,
    cursor: nextCursor,
    total: entities.length,
  };

  return NextResponse.json(response);
}
