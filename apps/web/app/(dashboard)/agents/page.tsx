import { auth } from "@clerk/nextjs/server";
import { redirect } from "next/navigation";
import { getWorkspaceForUser } from "@/lib/db/workspace";
import { getAgentsForWorkspace } from "@/lib/db/agents";
import { AgentsClient } from "./AgentsClient";

export const metadata = { title: "Agents — Robin.dev" };

export default async function AgentsPage() {
  const { userId } = await auth();
  if (!userId) redirect("/sign-in");

  const workspace = await getWorkspaceForUser(userId);
  if (!workspace) redirect("/onboarding/workspace");

  const agents = await getAgentsForWorkspace(workspace.id);

  return (
    <div className="space-y-6">
      {/* Page header */}
      <div className="flex items-start justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold tracking-tight text-foreground">Agents</h1>
          <p className="mt-1 text-sm text-muted-foreground">
            Stato real-time degli agenti Robin.dev — aggiornato ogni 30 secondi via heartbeat.
          </p>
        </div>
      </div>

      <AgentsClient workspaceId={workspace.id} initialAgents={agents} />
    </div>
  );
}
