/**
 * GET /api/ops/runs/[runId]
 *
 * Returns a single ops_run by ID.
 * Used as fallback when Realtime is unavailable.
 *
 * Role: owner only.
 */

import { NextResponse } from "next/server";
import { requireWorkspace } from "@/lib/api/requireWorkspace";
import { getWorkspaceMemberRole } from "@/lib/db/workspace";
import { createSupabaseAdminClient } from "@/lib/supabase/admin";
import type { OpsRun } from "@robin/shared-types";

function mapRow(row: Record<string, unknown>): OpsRun {
  return {
    id: row["id"] as string,
    workspaceId: (row["workspace_id"] as string | null) ?? null,
    triggeredByUserId: row["triggered_by_user_id"] as string,
    scope: row["scope"] as OpsRun["scope"],
    status: row["status"] as OpsRun["status"],
    progress: (row["progress"] as number) ?? 0,
    log: (row["log"] as OpsRun["log"]) ?? [],
    rawDiagnostics: (row["raw_diagnostics"] as OpsRun["rawDiagnostics"]) ?? null,
    aiAnalysis: (row["ai_analysis"] as string | null) ?? null,
    aiRecommendations:
      (row["ai_recommendations"] as OpsRun["aiRecommendations"]) ?? null,
    actionsTaken: (row["actions_taken"] as OpsRun["actionsTaken"]) ?? [],
    createdAt: row["created_at"] as string,
    completedAt: (row["completed_at"] as string | null) ?? null,
  };
}

export async function GET(
  _request: Request,
  { params }: { params: Promise<{ runId: string }> }
) {
  const result = await requireWorkspace();
  if (result instanceof NextResponse) return result;
  const { userId } = result;

  const role = await getWorkspaceMemberRole(userId);
  if (role !== "owner") {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  const { runId } = await params;
  const supabase = createSupabaseAdminClient();

  const { data, error } = await supabase
    .from("ops_runs")
    .select("*")
    .eq("id", runId)
    .maybeSingle();

  if (error) {
    console.error("[GET /api/ops/runs/[runId]] error:", error.message);
    return NextResponse.json({ error: error.message }, { status: 500 });
  }

  if (!data) {
    return NextResponse.json({ error: "Not found" }, { status: 404 });
  }

  return NextResponse.json({ run: mapRow(data as Record<string, unknown>) });
}
