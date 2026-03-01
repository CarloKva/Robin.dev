import { auth } from "@clerk/nextjs/server";
import { redirect } from "next/navigation";
import { getWorkspaceForUser } from "@/lib/db/workspace";
import { getBacklogTasks } from "@/lib/db/backlog";
import { getSprintsWithTasksForBacklog, getSprintsForWorkspace } from "@/lib/db/sprints";
import { getRepositoriesForWorkspace } from "@/lib/db/github";
import { BacklogPageClient } from "@/components/backlog/BacklogPageClient";

export default async function BacklogPage() {
  const { userId } = await auth();
  if (!userId) redirect("/sign-in");

  const workspace = await getWorkspaceForUser(userId);
  if (!workspace) redirect("/onboarding/workspace");

  const [sprintsWithTasks, { tasks: backlogTasks }, repositories, allSprints] = await Promise.all([
    getSprintsWithTasksForBacklog(workspace.id),
    getBacklogTasks(workspace.id, { status: ["backlog"], pageSize: 200 }),
    getRepositoriesForWorkspace(workspace.id),
    getSprintsForWorkspace(workspace.id),
  ]);

  // Load current active or planning sprint with its tasks for the Sprint tab
  const activeSprintMeta = allSprints.find((s) => s.status === "active") ?? null;
  const planningSprintMeta = allSprints.find((s) => s.status === "planning") ?? null;
  const pastSprints = allSprints.filter((s) => ["completed", "cancelled"].includes(s.status));

  const [activeSprint, planningSprint] = await Promise.all([
    activeSprintMeta ? getSprintWithTasks(activeSprintMeta.id, workspace.id) : Promise.resolve(null),
    planningSprintMeta && !activeSprintMeta
      ? getSprintWithTasks(planningSprintMeta.id, workspace.id)
      : Promise.resolve(null),
  ]);

  return (
    <div>
      <div className="mb-6 flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold">Backlog</h1>
          <p className="text-sm text-muted-foreground">
            Gestisci sprint e backlog in un unico posto.
          </p>
        </div>
      </div>

      <BacklogPageClient
        sprints={sprintsWithTasks}
        backlogTasks={backlogTasks}
        repositories={repositories.filter((r) => r.is_enabled)}
        allSprints={allSprints}
      />
    </div>
  );
}
