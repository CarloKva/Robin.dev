/**
 * POST /api/admin/bake-snapshot
 *
 * Triggers a snapshot bake via the control-plane orchestrator.
 * Publishes a "bake-snapshot" command on a Redis channel;
 * the control-plane picks it up and runs the bake process.
 *
 * This is a long-running operation (~7-10 minutes).
 * The endpoint returns immediately; progress is logged on the control-plane.
 */

import { NextResponse } from "next/server";
import { getWorkspaceMemberRole } from "@/lib/db/workspace";
import { requireWorkspace } from "@/lib/api/requireWorkspace";
import { createRedisConnection } from "@/lib/queue/redis.connection";

const BAKE_CHANNEL = "robin:bake-snapshot";

export async function POST() {
  const result = await requireWorkspace();
  if (result instanceof NextResponse) return result;
  const { userId, workspace } = result;

  const role = await getWorkspaceMemberRole(userId);
  if (role !== "owner") return NextResponse.json({ error: "Forbidden" }, { status: 403 });

  const redis = createRedisConnection();

  try {
    await redis.publish(
      BAKE_CHANNEL,
      JSON.stringify({ triggeredBy: userId, timestamp: new Date().toISOString() })
    );

    return NextResponse.json({
      ok: true,
      message: "Snapshot bake started. Check control-plane logs for progress (~7-10 min).",
    });
  } catch (err) {
    console.error("[POST /api/admin/bake-snapshot] publish error:", err);
    return NextResponse.json({ error: "Impossibile avviare il bake" }, { status: 502 });
  } finally {
    await redis.quit();
  }
}
