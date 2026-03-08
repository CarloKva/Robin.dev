import { NextResponse } from "next/server";
import type { ConnectorManifest } from "@/types/connector";

// Public endpoint — no auth required
export async function GET(): Promise<NextResponse> {
  const manifest: ConnectorManifest = {
    id: "robin-dev",
    name: "Robin Dev",
    version: "1.0.0",
    description: "Sviluppo AI-native, vibe coding e agent workspace",
    capabilities: ["investment-analysis", "vibe-coding", "agent-workspace"],
    endpoints: {
      health: "/api/connector/health",
      entities: "/api/connector/entities",
      actions: "/api/connector/actions",
      events: "/api/connector/subscribe",
    },
    widgetSlots: ["robin-dev-dashboard", "robin-dev-agent"],
    authRequired: true,
    kvaRoomCompatible: true,
  };

  return NextResponse.json(manifest);
}
