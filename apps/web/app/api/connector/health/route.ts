import { NextResponse } from "next/server";
import { createSupabaseAdminClient } from "@/lib/supabase/admin";
import type { HealthResponse } from "@/types/connector";

// Public endpoint — no auth required
export async function GET(): Promise<NextResponse> {
  let dbStatus: "connected" | "error" = "connected";

  try {
    const supabase = createSupabaseAdminClient();
    const { error } = await supabase.from("workspaces").select("id").limit(1);
    if (error) dbStatus = "error";
  } catch {
    dbStatus = "error";
  }

  const payload: HealthResponse = {
    status: dbStatus === "connected" ? "ok" : "degraded",
    connector: "robin-dev",
    version: "1.0.0",
    db: dbStatus,
    timestamp: new Date().toISOString(),
  };

  return NextResponse.json(payload, {
    status: payload.status === "ok" ? 200 : 503,
  });
}
