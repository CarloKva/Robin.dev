/**
 * GET /api/maintenance/configs
 * GET /api/maintenance/configs?repository_id=...
 *
 * Lists workspace_capability_configs for the caller's workspace with the
 * related repository and capability_definition. Used by the maintenance
 * overview page.
 */

import { NextResponse } from "next/server";
import { requireWorkspace } from "@/lib/api/requireWorkspace";
import { listCapabilityConfigs } from "@/lib/db/maintenance";

export async function GET(request: Request) {
  const result = await requireWorkspace();
  if (result instanceof NextResponse) return result;
  const { workspace } = result;

  const { searchParams } = new URL(request.url);
  const repositoryId = searchParams.get("repository_id") ?? undefined;

  const configs = await listCapabilityConfigs(workspace.id, {
    ...(repositoryId !== undefined && { repositoryId }),
  });
  return NextResponse.json({ configs });
}
