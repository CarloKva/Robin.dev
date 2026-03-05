/**
 * POST /api/admin/update-agents
 *
 * Publishes a message on the `robin:update` Redis channel.
 * All connected orchestrator instances (agents + control-plane) will
 * gracefully restart, pulling the latest code from main.
 */

import { NextResponse } from "next/server";
import { getWorkspaceMemberRole } from "@/lib/db/workspace";
import { requireWorkspace } from "@/lib/api/requireWorkspace";
import { createRedisConnection } from "@/lib/queue/redis.connection";

const UPDATE_CHANNEL = "robin:update";

export async function POST() {
  const result = await requireWorkspace();
  if (result instanceof NextResponse) return result;
  const { userId } = result;

  const role = await getWorkspaceMemberRole(userId);
  if (role !== "owner") return NextResponse.json({ error: "Forbidden" }, { status: 403 });

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
