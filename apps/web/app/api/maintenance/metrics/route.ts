/**
 * GET /api/maintenance/metrics
 *
 * Aggregated maintenance metrics for the workspace, used by the dashboard
 * tile. Reads from the `maintenance_capability_metrics` view (defined in
 * migration 0020) plus the recent capability_health_reviews for kill-switch
 * state.
 */

import { NextResponse } from "next/server";
import { requireWorkspace } from "@/lib/api/requireWorkspace";
import { listMaintenanceMetrics, listRecentHealthReviews } from "@/lib/db/maintenance";

export async function GET() {
  const result = await requireWorkspace();
  if (result instanceof NextResponse) return result;
  const { workspace } = result;

  const [byCapability, healthReviews] = await Promise.all([
    listMaintenanceMetrics(workspace.id),
    listRecentHealthReviews(),
  ]);

  return NextResponse.json({
    byCapability,
    healthReviews,
  });
}
