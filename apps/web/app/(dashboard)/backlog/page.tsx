import { auth } from "@clerk/nextjs/server";
import { redirect } from "next/navigation";
import { getWorkspaceForUser } from "@/lib/db/workspace";
import { getBacklogTasks } from "@/lib/db/backlog";
import { getSprintsWithTasksForBacklog, getSprintsForWorkspace } from "@/lib/db/sprints";
import { getRepositoriesForWorkspace } from "@/lib/db/github";
import { BacklogJiraView } from "@/components/backlog/BacklogJiraView";

export default async function BacklogPage() {
  const { userId } = await auth();
  if (!userId) redirect("/sign-in");

  const workspace = await getWorkspaceForUser(userId);
  if (!workspace) redirect("/onboarding/workspace");

  const [{ tasks: backlogTasks }, repositories, sprints, allSprints] = await Promise.all([
    getBacklogTasks(workspace.id, { pageSize: 100 }),
    getRepositoriesForWorkspace(workspace.id),
    getSprintsWithTasksForBacklog(workspace.id),
    getSprintsForWorkspace(workspace.id),
  ]);

  return (
    <div>
      <div className="mb-6 flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold">Planning</h1>
          <p className="text-sm text-muted-foreground">
            Gestisci sprint e backlog in un unico posto.
          </p>
        </div>
      </div>

      <BacklogJiraView
        sprints={sprints}
        backlogTasks={backlogTasks}
        repositories={repositories.filter((r) => r.is_enabled)}
        allSprints={allSprints}
      />
    </div>
  );
}
