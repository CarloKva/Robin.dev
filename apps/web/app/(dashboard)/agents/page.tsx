import { auth } from "@clerk/nextjs/server";
import { redirect } from "next/navigation";
import { getWorkspaceForUser } from "@/lib/db/workspace";
import { getAgentsForWorkspace } from "@/lib/db/agents";
import { getGitHubConnection, getRepositoriesForWorkspace } from "@/lib/db/github";
import { AgentsClient } from "./AgentsClient";

export const metadata = { title: "Agents — Robin.dev" };

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
    <div className="space-y-6">
      <div className="flex items-start justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold tracking-tight text-foreground">Agents</h1>
          <p className="mt-1 text-sm text-muted-foreground">
            Stato real-time degli agenti — aggiornato ogni 30 secondi via heartbeat.
          </p>
        </div>
      </div>

      <AgentsClient
        workspaceId={workspace.id}
        initialAgents={agents}
        hasGitHubConnection={!!connection}
        enabledRepositories={enabledRepos}
      />
    </div>
  );
}
