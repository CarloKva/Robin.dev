import { auth } from "@clerk/nextjs/server";
import { redirect } from "next/navigation";
import { getWorkspaceForUser } from "@/lib/db/workspace";
import { getSprintReportData } from "@/lib/db/reports";
import { ReportsClient } from "./ReportsClient";

export default async function ReportsPage() {
  const { userId } = await auth();
  if (!userId) redirect("/sign-in");

  const workspace = await getWorkspaceForUser(userId);
  if (!workspace) redirect("/onboarding/workspace");

  const data = await getSprintReportData(workspace.id);

  return (
    <ReportsClient
      sprints={data.sprints}
      tasks={data.tasks}
      repositories={data.repositories}
      agents={data.agents}
      agentStats={data.agentStats}
      weeklyThroughput={data.weeklyThroughput}
    />
  );
}
