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
    <div className="space-y-8">
      <div>
        <h1 className="text-2xl font-bold">Report</h1>
        <p className="text-sm text-muted-foreground">
          Statistiche sprint e attività degli agenti.
        </p>
      </div>
      <ReportsClient sprints={data.sprints} tasks={data.tasks} repositories={data.repositories} agents={data.agents} />
    </div>
  );
}
