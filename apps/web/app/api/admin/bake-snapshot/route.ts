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

import { auth } from "@clerk/nextjs/server";
import { NextResponse } from "next/server";
import { getWorkspaceForUser } from "@/lib/db/workspace";
import { createRedisConnection } from "@/lib/queue/redis.connection";

const BAKE_CHANNEL = "robin:bake-snapshot";

export async function POST() {
  const { userId } = await auth();
  if (!userId) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const workspace = await getWorkspaceForUser(userId);
  if (!workspace) return NextResponse.json({ error: "Workspace non trovato" }, { status: 404 });

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
