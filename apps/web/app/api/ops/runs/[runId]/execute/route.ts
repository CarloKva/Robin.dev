/**
 * POST /api/ops/runs/[runId]/execute
 *
 * Executes a safe corrective action from an ops run recommendation.
 * Only actions in the safe whitelist can be triggered via this endpoint.
 *
 * Role: owner only.
 */

import { NextResponse } from "next/server";
import { z } from "zod";
import { requireWorkspace } from "@/lib/api/requireWorkspace";
import { getWorkspaceMemberRole } from "@/lib/db/workspace";
import { getOpsExecuteQueue } from "@/lib/queue/ops.queue";
import type { OpsExecuteJobPayload } from "@robin/shared-types";

const SAFE_ACTIONS = [
  "restart_orchestrator",
  "restart_redis",
  "reset_stuck_task",
  "clear_bullmq_stalled",
] as const;

const bodySchema = z.object({
  actionType: z.enum(SAFE_ACTIONS),
  params: z.record(z.string()),
});

export async function POST(
  request: Request,
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

  const body = await request.json().catch(() => null);
  const parsed = bodySchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json(
      { error: "Invalid request body", details: parsed.error.flatten() },
      { status: 400 }
    );
  }

  const { actionType, params: actionParams } = parsed.data;

  const payload: OpsExecuteJobPayload = {
    opsRunId: runId,
    actionType,
    params: actionParams,
    triggeredBy: userId,
  };

  try {
    const queue = getOpsExecuteQueue();
    const jobId = `ops-execute-${runId}-${actionType}-${Date.now()}`;
    await Promise.race([
      queue.add(jobId, payload, { jobId }),
      new Promise<never>((_, reject) =>
        setTimeout(() => reject(new Error("Redis enqueue timeout")), 5000)
      ),
    ]);
  } catch (err) {
    console.error("[POST /api/ops/runs/[runId]/execute] enqueue error:", err);
    return NextResponse.json(
      { error: "Failed to enqueue action" },
      { status: 502 }
    );
  }

  return NextResponse.json({ ok: true, message: `Action "${actionType}" queued` });
}
