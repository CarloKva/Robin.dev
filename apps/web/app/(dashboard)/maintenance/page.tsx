import { auth } from "@clerk/nextjs/server";
import { redirect } from "next/navigation";
import { getWorkspaceForUser, getWorkspaceMemberRole } from "@/lib/db/workspace";
import { getRepositoriesForWorkspace } from "@/lib/db/github";
import { listCapabilityConfigs } from "@/lib/db/maintenance";
import { MaintenanceClient } from "./MaintenanceClient";

export const metadata = { title: "Maintenance — Robin.dev" };

export default async function MaintenancePage({
  searchParams,
}: {
  searchParams: Promise<{ repository_id?: string }>;
}) {
  const { userId } = await auth();
  if (!userId) redirect("/sign-in");

  const workspace = await getWorkspaceForUser(userId);
  if (!workspace) redirect("/onboarding/workspace");

  const [repositories, role, params] = await Promise.all([
    getRepositoriesForWorkspace(workspace.id),
    getWorkspaceMemberRole(userId),
    searchParams,
  ]);

  const enabledRepos = repositories.filter((r) => r.is_enabled && r.is_available);
  const selectedRepoId = params.repository_id ?? enabledRepos[0]?.id;

  const configs = selectedRepoId
    ? await listCapabilityConfigs(workspace.id, { repositoryId: selectedRepoId })
    : [];

  return (
    <MaintenanceClient
      workspaceId={workspace.id}
      isOwner={role === "owner"}
      repositories={enabledRepos.map((r) => ({
        id: r.id,
        full_name: r.full_name,
        default_branch: r.default_branch,
      }))}
      selectedRepoId={selectedRepoId ?? null}
      configs={configs}
    />
  );
}
