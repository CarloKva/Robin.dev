import { auth } from "@clerk/nextjs/server";
import { redirect, notFound } from "next/navigation";
import Link from "next/link";
import { getWorkspaceForUser } from "@/lib/db/workspace";
import { getSprintWithTasks } from "@/lib/db/sprints";
import { SprintPlanningView } from "@/components/sprints/SprintPlanningView";
import { ActiveSprintBoard } from "@/components/sprints/ActiveSprintBoard";
import { SprintSummary } from "@/components/sprints/SprintSummary";
import { CompleteSprintButton } from "@/components/sprints/CompleteSprintButton";

interface SprintDetailPageProps {
  params: Promise<{ sprintId: string }>;
}

export default async function SprintDetailPage({ params }: SprintDetailPageProps) {
  const { userId } = await auth();
  if (!userId) redirect("/sign-in");

  const workspace = await getWorkspaceForUser(userId);
  if (!workspace) redirect("/onboarding/workspace");

  const { sprintId } = await params;
  const sprint = await getSprintWithTasks(sprintId, workspace.id);
  if (!sprint) notFound();

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-start justify-between gap-4">
        <div className="min-w-0">
          <div className="flex items-center gap-2">
            <Link href="/backlog?tab=sprint" className="text-sm text-muted-foreground hover:text-foreground">
              ← Backlog / Sprint
            </Link>
          </div>
          <h1 className="mt-1 truncate text-2xl font-bold">{sprint.name}</h1>
          {sprint.goal && (
            <p className="mt-0.5 text-sm text-muted-foreground italic">&ldquo;{sprint.goal}&rdquo;</p>
          )}
        </div>

        {sprint.status === "active" && (
          <CompleteSprintButton sprintId={sprint.id} />
        )}
      </div>

      {/* Content based on sprint status */}
      {sprint.status === "planning" && (
        <SprintPlanningView sprint={sprint} tasks={sprint.tasks} />
      )}

      {sprint.status === "active" && (
        <ActiveSprintBoard
          initialTasks={sprint.tasks}
          sprintId={sprint.id}
          workspaceId={workspace.id}
        />
      )}

      {sprint.status === "completed" && (
        <SprintSummary sprint={sprint} />
      )}

      {sprint.status === "cancelled" && (
        <div className="rounded-lg border border-border bg-card p-8 text-center">
          <p className="text-muted-foreground">Sprint annullato.</p>
        </div>
      )}
    </div>
  );
}
