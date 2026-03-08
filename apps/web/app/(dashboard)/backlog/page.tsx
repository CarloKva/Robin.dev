import { auth } from "@clerk/nextjs/server";
import { redirect } from "next/navigation";
import { getWorkspaceForUser } from "@/lib/db/workspace";
import { getBacklogTasks } from "@/lib/db/backlog";
import { getSprintsWithTasksForBacklog, getSprintsForWorkspace } from "@/lib/db/sprints";
import { getRepositoriesForWorkspace } from "@/lib/db/github";
import { getAgentsForWorkspace } from "@/lib/db/agents";
import { getContextDocuments } from "@/lib/db/context";
import { BacklogJiraView } from "@/components/backlog/BacklogJiraView";
import { PlanningHeader } from "@/components/backlog/PlanningHeader";

export default async function BacklogPage() {
  const { userId } = await auth();
  if (!userId) redirect("/sign-in");

  const workspace = await getWorkspaceForUser(userId);
  if (!workspace) redirect("/onboarding/workspace");

  const [{ tasks: backlogTasks }, repositories, sprints, allSprints, agents, contextDocs] =
    await Promise.all([
      getBacklogTasks(workspace.id, { pageSize: 100 }),
      getRepositoriesForWorkspace(workspace.id),
      getSprintsWithTasksForBacklog(workspace.id),
      getSprintsForWorkspace(workspace.id),
      getAgentsForWorkspace(workspace.id),
      getContextDocuments(workspace.id),
    ]);

  const activeSprintCount = allSprints.filter((s) => s.status === "active").length;

  return (
    <div>
      <PlanningHeader
        activeSprintCount={activeSprintCount}
        backlogTaskCount={backlogTasks.length}
      />

      <BacklogJiraView
        sprints={sprints}
        backlogTasks={backlogTasks}
        repositories={repositories.filter((r) => r.is_enabled)}
        allSprints={allSprints}
        agents={agents.map((a) => ({ id: a.id, name: a.name }))}
        contextDocs={contextDocs}
      />
    </div>
  );
}
