import { auth } from "@clerk/nextjs/server";
import { redirect } from "next/navigation";
import { getWorkspaceForUser } from "@/lib/db/workspace";
import { getSprintsWithTaskCounts } from "@/lib/db/sprints";
import { SprintsListClient, NewSprintButton } from "@/components/sprints/SprintsListClient";

export default async function SprintsPage() {
  const { userId } = await auth();
  if (!userId) redirect("/sign-in");

  const workspace = await getWorkspaceForUser(userId);
  if (!workspace) redirect("/onboarding/workspace");

  const sprints = await getSprintsWithTaskCounts(workspace.id);

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between gap-4">
        <h1 className="text-xl font-semibold">Sprint</h1>
        <NewSprintButton />
      </div>

      {/* Sprint table */}
      <SprintsListClient initialSprints={sprints} />
    </div>
  );
}
