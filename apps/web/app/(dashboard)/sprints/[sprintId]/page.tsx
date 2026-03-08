import { auth } from "@clerk/nextjs/server";
import { redirect, notFound } from "next/navigation";
import { getWorkspaceForUser } from "@/lib/db/workspace";
import { getSprintWithTasks } from "@/lib/db/sprints";
import { SprintDetailGroupedView } from "@/components/sprints/SprintDetailGroupedView";

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
    <SprintDetailGroupedView sprint={sprint} initialTasks={sprint.tasks} />
  );
}
