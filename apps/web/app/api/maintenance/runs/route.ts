/**
 * GET /api/maintenance/runs
 *
 * Run history for the workspace, filterable by repository and capability.
 * Ordered by created_at DESC, capped at 200.
 */

import { NextResponse } from "next/server";
import { requireWorkspace } from "@/lib/api/requireWorkspace";
import { listAgentRuns } from "@/lib/db/maintenance";
import type { MaintenanceCapabilityId } from "@robin/shared-types";

const VALID_CAPABILITIES = new Set([
  "spec_discovery",
  "spec_impl",
  "bug_discovery",
  "bug_impl",
]);

export async function GET(request: Request) {
  const result = await requireWorkspace();
  if (result instanceof NextResponse) return result;
  const { workspace } = result;

  const { searchParams } = new URL(request.url);
  const repositoryId = searchParams.get("repository_id") ?? undefined;
  const capabilityRaw = searchParams.get("capability_definition_id");
  const limitRaw = searchParams.get("limit");

  const capabilityDefinitionId =
    capabilityRaw && VALID_CAPABILITIES.has(capabilityRaw)
      ? (capabilityRaw as MaintenanceCapabilityId)
      : undefined;
  const limit = limitRaw ? Math.min(200, Math.max(1, parseInt(limitRaw, 10) || 50)) : 50;

  const runs = await listAgentRuns(workspace.id, {
    ...(repositoryId ? { repositoryId } : {}),
    ...(capabilityDefinitionId ? { capabilityDefinitionId } : {}),
    limit,
  });

  return NextResponse.json({ runs });
}
