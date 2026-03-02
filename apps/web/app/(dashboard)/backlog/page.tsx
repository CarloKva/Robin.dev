import { auth } from "@clerk/nextjs/server";
import { redirect } from "next/navigation";
import { getWorkspaceForUser } from "@/lib/db/workspace";
import { getBacklogTasks } from "@/lib/db/backlog";
import { getSprintsForWorkspace, getSprintWithTasks } from "@/lib/db/sprints";
import { getRepositoriesForWorkspace } from "@/lib/db/github";
import { BacklogSprintTabs } from "@/components/backlog/BacklogSprintTabs";
import type { TaskType, TaskPriority, EstimatedEffort } from "@robin/shared-types";

interface BacklogPageProps {
  searchParams: Promise<{
    type?: string;
    priority?: string;
    effort?: string;
    repositoryId?: string;
    search?: string;
    page?: string;
    tab?: string;
  }>;
}

export default async function BacklogPage({ searchParams }: BacklogPageProps) {
  const { userId } = await auth();
  if (!userId) redirect("/sign-in");

  const workspace = await getWorkspaceForUser(userId);
  if (!workspace) redirect("/onboarding/workspace");

  const params = await searchParams;
  const page = Math.max(1, parseInt(params.page ?? "1", 10));
  const defaultTab = params.tab === "sprint" ? "sprint" : "backlog";

  const [{ tasks, total }, repositories, allSprints] = await Promise.all([
    getBacklogTasks(workspace.id, {
      ...(params.type && { type: params.type as TaskType }),
      ...(params.priority && { priority: params.priority as TaskPriority }),
      ...(params.effort && { estimatedEffort: params.effort as EstimatedEffort }),
      ...(params.repositoryId && { repositoryId: params.repositoryId }),
      ...(params.search && { search: params.search }),
      page,
      pageSize: 30,
    }),
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

      <BacklogSprintTabs
        tasks={tasks}
        total={total}
        page={page}
        pageSize={30}
        repositories={repositories.filter((r) => r.is_enabled)}
        sprints={allSprints}
        activeSprint={activeSprint}
        planningSprint={planningSprint}
        pastSprints={pastSprints}
        workspaceId={workspace.id}
        defaultTab={defaultTab}
      />
    </div>
  );
}
