import { auth } from "@clerk/nextjs/server";
import { redirect } from "next/navigation";
import { getWorkspaceForUser } from "@/lib/db/workspace";
import { getRepositoriesForWorkspace } from "@/lib/db/github";
import { listAgentRuns } from "@/lib/db/maintenance";
import type { MaintenanceCapabilityId } from "@robin/shared-types";
import { RunsClient } from "./RunsClient";

export const metadata = { title: "Maintenance · Runs — Robin.dev" };

const VALID_CAPABILITIES = new Set<MaintenanceCapabilityId>([
  "spec_discovery",
  "spec_impl",
  "bug_discovery",
  "bug_impl",
]);

type Params = {
  repository_id?: string;
  capability_definition_id?: string;
};

export default async function MaintenanceRunsPage({
  searchParams,
}: {
  searchParams: Promise<Params>;
}) {
  const { userId } = await auth();
  if (!userId) redirect("/sign-in");

  const workspace = await getWorkspaceForUser(userId);
  if (!workspace) redirect("/onboarding/workspace");

  const [repositories, params] = await Promise.all([
    getRepositoriesForWorkspace(workspace.id),
    searchParams,
  ]);

  const enabledRepos = repositories.filter((r) => r.is_enabled && r.is_available);
  const capabilityFilter =
    params.capability_definition_id &&
    VALID_CAPABILITIES.has(params.capability_definition_id as MaintenanceCapabilityId)
      ? (params.capability_definition_id as MaintenanceCapabilityId)
      : null;

  const runs = await listAgentRuns(workspace.id, {
    ...(params.repository_id ? { repositoryId: params.repository_id } : {}),
    ...(capabilityFilter ? { capabilityDefinitionId: capabilityFilter } : {}),
    limit: 100,
  });

  return (
    <RunsClient
      repositories={enabledRepos.map((r) => ({ id: r.id, full_name: r.full_name }))}
      selectedRepositoryId={params.repository_id ?? null}
      selectedCapability={capabilityFilter}
      runs={runs}
    />
  );
}
