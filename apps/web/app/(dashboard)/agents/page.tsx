import { auth } from "@clerk/nextjs/server";
import { redirect } from "next/navigation";
import { getWorkspaceForUser } from "@/lib/db/workspace";
import { getAgentsForWorkspace } from "@/lib/db/agents";
import { getGitHubConnection, getRepositoriesForWorkspace } from "@/lib/db/github";
import { AgentsClient } from "./AgentsClient";

export const metadata = { title: "Agenti — Robin.dev" };

export default async function AgentsPage() {
  const { userId } = await auth();
  if (!userId) redirect("/sign-in");

  const workspace = await getWorkspaceForUser(userId);
  if (!workspace) redirect("/onboarding/workspace");

  const [agents, connection, repositories] = await Promise.all([
    getAgentsForWorkspace(workspace.id),
    getGitHubConnection(workspace.id),
    getRepositoriesForWorkspace(workspace.id),
  ]);

  const enabledRepos = repositories.filter((r) => r.is_enabled && r.is_available);

  return (
    <AgentsClient
      workspaceId={workspace.id}
      initialAgents={agents}
      hasGitHubConnection={!!connection}
      enabledRepositories={enabledRepos}
    />
  );
}
