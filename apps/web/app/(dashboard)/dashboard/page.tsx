import { auth, currentUser } from "@clerk/nextjs/server";
import { redirect } from "next/navigation";
import { getWorkspaceForUser } from "@/lib/db/workspace";
import {
  getDashboardMetrics,
  getDashboardAgents,
  getWorkspaceFeed,
  getActiveTaskData,
  getRecentTasksForDashboard,
} from "@/lib/db/dashboard";
import { DashboardClient } from "./DashboardClient";

export default async function DashboardPage() {
  const { userId } = await auth();
  if (!userId) redirect("/sign-in");

  const workspace = await getWorkspaceForUser(userId);
  if (!workspace) redirect("/onboarding/workspace");

  // Fetch all dashboard data in parallel (+ user for personalized empty state)
  const [metrics, agents, activeTask, feed, recentTasks, clerkUser] = await Promise.all([
    getDashboardMetrics(workspace.id),
    getDashboardAgents(workspace.id),
    getActiveTaskData(workspace.id),
    getWorkspaceFeed(workspace.id, 10),
    getRecentTasksForDashboard(workspace.id, 10),
    currentUser(),
  ]);

  const userName =
    clerkUser?.firstName ??
    clerkUser?.fullName ??
    clerkUser?.username ??
    "";

  return (
    <DashboardClient
      workspaceId={workspace.id}
      initialAgents={agents}
      metrics={metrics}
      activeTask={activeTask}
      initialFeed={feed}
      recentTasks={recentTasks}
      userName={userName}
    />
  );
}
