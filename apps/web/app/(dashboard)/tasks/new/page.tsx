import { auth } from "@clerk/nextjs/server";
import { redirect } from "next/navigation";
import { getWorkspaceForUser } from "@/lib/db/workspace";
import { getOnlineAgentForWorkspace } from "@/lib/db/agents";
import { TaskCreationForm } from "./TaskCreationForm";

export default async function NewTaskPage() {
  const { userId } = await auth();
  if (!userId) redirect("/sign-in");

  const workspace = await getWorkspaceForUser(userId);
  if (!workspace) redirect("/onboarding/workspace");

  const onlineAgent = await getOnlineAgentForWorkspace(workspace.id);

  return (
    <div className="mx-auto max-w-5xl space-y-4">
      <div>
        <h1 className="text-2xl font-bold text-foreground">Nuova task</h1>
        <p className="text-sm text-muted-foreground">
          Descrivi il lavoro in modo chiaro — l&apos;agente userà questa
          descrizione per capire cosa fare.
        </p>
      </div>

      <TaskCreationForm hasOnlineAgent={!!onlineAgent} workspaceId={workspace.id} />
    </div>
  );
}
