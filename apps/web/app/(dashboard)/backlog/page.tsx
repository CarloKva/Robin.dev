import { auth } from "@clerk/nextjs/server";
import { redirect } from "next/navigation";
import Link from "next/link";
import { getWorkspaceForUser } from "@/lib/db/workspace";
import { getBacklogTasks } from "@/lib/db/backlog";
import { getSprintsForWorkspace } from "@/lib/db/sprints";
import { getRepositoriesForWorkspace } from "@/lib/db/github";
import { BacklogClient } from "@/components/backlog/BacklogClient";
import type { TaskType, TaskPriority, EstimatedEffort } from "@robin/shared-types";

interface BacklogPageProps {
  searchParams: Promise<{
    type?: string;
    priority?: string;
    effort?: string;
    repositoryId?: string;
    search?: string;
    page?: string;
  }>;
}

export default async function BacklogPage({ searchParams }: BacklogPageProps) {
  const { userId } = await auth();
  if (!userId) redirect("/sign-in");

  const workspace = await getWorkspaceForUser(userId);
  if (!workspace) redirect("/onboarding/workspace");

  const params = await searchParams;
  const page = Math.max(1, parseInt(params.page ?? "1", 10));

  const [{ tasks, total }, repositories, sprints] = await Promise.all([
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

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold">Backlog</h1>
          <p className="text-sm text-muted-foreground">
            Crea, affina e organizza le task prima di assegnarle a uno sprint.
          </p>
        </div>
        <Link
          href="/tasks/new"
          className="rounded-md bg-primary px-4 py-2 text-sm font-medium text-primary-foreground hover:bg-primary/90 min-h-[44px] flex items-center"
        >
          + Nuova task
        </Link>
      </div>

      <BacklogClient
        tasks={tasks}
        total={total}
        page={page}
        pageSize={30}
        repositories={repositories.filter((r) => r.is_enabled)}
        sprints={sprints}
      />
    </div>
  );
}
