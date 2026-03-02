/**
 * POST /api/admin/update-agents
 *
 * Publishes a message on the `robin:update` Redis channel.
 * All connected orchestrator instances (agents + control-plane) will
 * gracefully restart, pulling the latest code from main.
 */

import { auth } from "@clerk/nextjs/server";
import { NextResponse } from "next/server";
import { getWorkspaceForUser } from "@/lib/db/workspace";
import { createRedisConnection } from "@/lib/queue/redis.connection";

const UPDATE_CHANNEL = "robin:update";

export async function POST() {
  const { userId } = await auth();
  if (!userId) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const workspace = await getWorkspaceForUser(userId);
  if (!workspace) return NextResponse.json({ error: "Workspace non trovato" }, { status: 404 });

  const redis = createRedisConnection();

  try {
    const receiverCount = await redis.publish(
      UPDATE_CHANNEL,
      JSON.stringify({ triggeredBy: userId, timestamp: new Date().toISOString() })
    );

    return NextResponse.json({
      ok: true,
      message: `Update command sent to ${receiverCount} agent(s)`,
      receiverCount,
    });
  } catch (err) {
    console.error("[POST /api/admin/update-agents] publish error:", err);
    return NextResponse.json({ error: "Impossibile inviare il comando di aggiornamento" }, { status: 502 });
  } finally {
    await redis.quit();
  }
}
