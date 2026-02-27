import { auth } from "@clerk/nextjs/server";
import { NextResponse } from "next/server";
import { createSupabaseServerClient } from "@/lib/supabase/server";
import { getWorkspaceForUser } from "@/lib/db/workspace";

/**
 * GET /api/workspace/export
 *
 * Exports all workspace data (tasks, events, agents, metrics) as a JSON archive.
 * Returns a JSON object with a Content-Disposition header for file download.
 * GDPR Article 20 — right to data portability.
 */
export async function GET() {
  const { userId } = await auth();
  if (!userId) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const workspace = await getWorkspaceForUser(userId);
  if (!workspace) {
    return NextResponse.json({ error: "Workspace not found" }, { status: 404 });
  }

  const supabase = await createSupabaseServerClient();

  // Fetch all workspace data in parallel
  const [tasksResult, eventsResult, agentsResult, artifactsResult] = await Promise.all([
    supabase
      .from("tasks")
      .select("*")
      .eq("workspace_id", workspace.id)
      .order("created_at", { ascending: true }),
    supabase
      .from("task_events")
      .select("*")
      .eq("workspace_id", workspace.id)
      .order("created_at", { ascending: true }),
    supabase
      .from("agents")
      .select("id, name, type, slug, github_account, vps_region, created_at")
      .eq("workspace_id", workspace.id),
    supabase
      .from("task_artifacts")
      .select("*")
      .eq("workspace_id", workspace.id)
      .order("created_at", { ascending: true }),
  ]);

  const exportPayload = {
    exported_at: new Date().toISOString(),
    workspace: {
      id: workspace.id,
      name: workspace.name,
      slug: workspace.slug,
    },
    summary: {
      total_tasks: (tasksResult.data ?? []).length,
      total_events: (eventsResult.data ?? []).length,
      total_agents: (agentsResult.data ?? []).length,
      total_artifacts: (artifactsResult.data ?? []).length,
    },
    data: {
      tasks: tasksResult.data ?? [],
      task_events: eventsResult.data ?? [],
      agents: agentsResult.data ?? [],
      task_artifacts: artifactsResult.data ?? [],
    },
  };

  const filename = `robin-export-${workspace.slug}-${new Date().toISOString().slice(0, 10)}.json`;
  const json = JSON.stringify(exportPayload, null, 2);

  return new Response(json, {
    status: 200,
    headers: {
      "Content-Type": "application/json",
      "Content-Disposition": `attachment; filename="${filename}"`,
      "Content-Length": String(Buffer.byteLength(json, "utf-8")),
    },
  });
}
