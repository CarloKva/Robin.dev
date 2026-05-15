import { auth } from "@clerk/nextjs/server";
import { redirect } from "next/navigation";
import { getWorkspaceForUser } from "@/lib/db/workspace";
import { getRepositoriesForWorkspace } from "@/lib/db/github";
import {
  listMaintenanceMetrics,
  listRecentHealthReviews,
} from "@/lib/db/maintenance";
import { MetricsClient } from "./MetricsClient";

export const metadata = { title: "Maintenance · Metrics — Robin.dev" };

export default async function MaintenanceMetricsPage() {
  const { userId } = await auth();
  if (!userId) redirect("/sign-in");

  const workspace = await getWorkspaceForUser(userId);
  if (!workspace) redirect("/onboarding/workspace");

  const [metrics, healthReviews, repositories] = await Promise.all([
    listMaintenanceMetrics(workspace.id),
    listRecentHealthReviews(),
    getRepositoriesForWorkspace(workspace.id),
  ]);

  const repoNames = new Map(repositories.map((r) => [r.id, r.full_name]));

  return (
    <MetricsClient
      metrics={metrics.map((m) => ({
        ...m,
        repository_full_name: repoNames.get(m.repository_id) ?? m.repository_id,
      }))}
      healthReviews={healthReviews}
    />
  );
}
