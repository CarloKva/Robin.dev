/**
 * GET /api/maintenance/inbox
 *
 * Unified read-only inbox for spec_findings + bug_findings. Phase 1 ships
 * read-only; triage actions arrive in Phase 2.
 *
 * Query params:
 *   - repository_id: optional UUID
 *   - type: "spec" | "bug" (default: both)
 *   - state: triage_state filter (default: "pending")
 *   - limit: 1-200 (default: 50)
 */

import { NextResponse } from "next/server";
import { requireWorkspace } from "@/lib/api/requireWorkspace";
import { listInboxFindings } from "@/lib/db/maintenance";

const VALID_STATES = new Set(["pending", "approved", "rejected", "snoozed", "implemented"]);

export async function GET(request: Request) {
  const result = await requireWorkspace();
  if (result instanceof NextResponse) return result;
  const { workspace } = result;

  const { searchParams } = new URL(request.url);
  const repositoryId = searchParams.get("repository_id") ?? undefined;
  const typeRaw = searchParams.get("type");
  const stateRaw = searchParams.get("state");
  const limitRaw = searchParams.get("limit");

  const type =
    typeRaw === "spec" || typeRaw === "bug" ? (typeRaw as "spec" | "bug") : undefined;
  const triageState =
    stateRaw && VALID_STATES.has(stateRaw) ? stateRaw : "pending";
  const limit = limitRaw ? Math.min(200, Math.max(1, parseInt(limitRaw, 10) || 50)) : 50;

  const findings = await listInboxFindings(workspace.id, {
    ...(repositoryId ? { repositoryId } : {}),
    ...(type ? { type } : {}),
    triageState,
    limit,
  });

  return NextResponse.json({ findings, limit, triageState });
}
