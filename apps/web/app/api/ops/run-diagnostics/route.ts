/**
 * POST /api/ops/run-diagnostics
 *
 * Triggers a new ops diagnostics run.
 * Inserts an ops_run record and enqueues the BullMQ job on the control-plane.
 *
 * If a run is already in progress, returns the existing run ID instead of
 * creating a duplicate.
 *
 * Role: owner only.
 */

import { NextResponse } from "next/server";
import { z } from "zod";
import { requireWorkspace } from "@/lib/api/requireWorkspace";
import { getWorkspaceMemberRole } from "@/lib/db/workspace";
import { createSupabaseAdminClient } from "@/lib/supabase/admin";
import { getOpsDiagnosticsQueue } from "@/lib/queue/ops.queue";
import type { OpsDiagnosticsJobPayload } from "@robin/shared-types";

const bodySchema = z.object({
  scope: z.enum(["all", "workspace"]).optional().default("all"),
  workspaceId: z.string().uuid().optional(),
});

export async function POST(request: Request) {
  const result = await requireWorkspace();
  if (result instanceof NextResponse) return result;
  const { userId, workspace } = result;

  const role = await getWorkspaceMemberRole(userId);
  if (role !== "owner") {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  const body = await request.json().catch(() => ({}));
  const parsed = bodySchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json(
      { error: "Invalid request body", details: parsed.error.flatten() },
      { status: 400 }
    );
  }

  const { scope, workspaceId } = parsed.data;
  const supabase = createSupabaseAdminClient();

  // Check for existing running run — avoid duplicates
  const { data: existing } = await supabase
    .from("ops_runs")
    .select("id")
    .eq("status", "running")
    .order("created_at", { ascending: false })
    .limit(1)
    .maybeSingle();

  if (existing) {
    return NextResponse.json({ opsRunId: existing.id, alreadyRunning: true });
  }

  // Insert new ops_run record
  const insertData: Record<string, unknown> = {
    triggered_by_user_id: userId,
    scope,
    status: "running",
    progress: 0,
    log: [],
  };

  if (scope === "workspace") {
    insertData["workspace_id"] = workspaceId ?? workspace.id;
  }
  // scope=all: workspace_id remains NULL (cross-tenant)

  const { data: opsRun, error: insertErr } = await supabase
    .from("ops_runs")
    .insert(insertData)
    .select("id")
    .single();

  if (insertErr || !opsRun) {
    console.error("[POST /api/ops/run-diagnostics] insert error:", insertErr?.message);
    return NextResponse.json({ error: "Failed to create ops run" }, { status: 500 });
  }

  // Enqueue BullMQ job
  const payload: OpsDiagnosticsJobPayload = {
    opsRunId: opsRun.id as string,
    scope,
    triggeredBy: userId,
    ...(scope === "workspace" && workspaceId ? { workspaceId } : {}),
  };

  try {
    const queue = getOpsDiagnosticsQueue();
    await Promise.race([
      queue.add(`ops-run-${opsRun.id}`, payload, {
        jobId: `ops-run-${opsRun.id}`,
      }),
      new Promise<never>((_, reject) =>
        setTimeout(() => reject(new Error("Redis enqueue timeout")), 5000)
      ),
    ]);
  } catch (err) {
    console.error("[POST /api/ops/run-diagnostics] enqueue error:", err);
    // Mark the run as failed since it won't be processed
    await supabase
      .from("ops_runs")
      .update({ status: "failed", completed_at: new Date().toISOString() })
      .eq("id", opsRun.id);
    return NextResponse.json(
      { error: "Failed to enqueue diagnostics job" },
      { status: 502 }
    );
  }

  return NextResponse.json({ opsRunId: opsRun.id });
}
