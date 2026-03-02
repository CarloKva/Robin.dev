import { auth } from "@clerk/nextjs/server";
import { redirect } from "next/navigation";
import { getWorkspaceForUser } from "@/lib/db/workspace";
import { getSprintsForWorkspace } from "@/lib/db/sprints";
import { createSupabaseServerClient } from "@/lib/supabase/server";
import { SprintCard } from "@/components/sprints/SprintCard";
import { CreateSprintButton } from "@/components/sprints/CreateSprintButton";
import { SprintArchiveTable } from "@/components/sprints/SprintArchiveTable";

export default async function SprintsPage() {
  const { userId } = await auth();
  if (!userId) redirect("/sign-in");

  const workspace = await getWorkspaceForUser(userId);
  if (!workspace) redirect("/onboarding/workspace");

  const sprints = await getSprintsForWorkspace(workspace.id);

  // Count tasks per sprint
  const supabase = await createSupabaseServerClient();
  const sprintIds = sprints.map((s) => s.id);
  let taskCountMap: Record<string, number> = {};

  if (sprintIds.length > 0) {
    const { data: taskCounts } = await supabase
      .from("tasks")
      .select("sprint_id")
      .in("sprint_id", sprintIds);

    taskCountMap = (taskCounts ?? []).reduce<Record<string, number>>((acc, t) => {
      if (t.sprint_id) acc[t.sprint_id] = (acc[t.sprint_id] ?? 0) + 1;
      return acc;
    }, {});
  }

  const activeSprints = sprints.filter((s) => s.status === "active");
  const planningSprints = sprints.filter((s) => s.status === "planning");
  const pastSprints = sprints.filter((s) => ["completed", "cancelled"].includes(s.status));

  return (
    <div className="space-y-8">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold">Sprint</h1>
          <p className="text-sm text-muted-foreground">
            Pianifica il lavoro degli agenti in sprint settimanali.
          </p>
        </div>
        <CreateSprintButton />
      </div>

      {activeSprints.length > 0 && (
        <section className="space-y-3">
          <h2 className="text-sm font-semibold uppercase tracking-wide text-muted-foreground">Sprint attivo</h2>
          {activeSprints.map((s) => (
            <SprintCard key={s.id} sprint={s} taskCount={taskCountMap[s.id]} />
          ))}
        </section>
      )}

      {planningSprints.length > 0 && (
        <section className="space-y-3">
          <h2 className="text-sm font-semibold uppercase tracking-wide text-muted-foreground">In pianificazione</h2>
          <div className="grid gap-3 md:grid-cols-2">
            {planningSprints.map((s) => (
              <SprintCard key={s.id} sprint={s} taskCount={taskCountMap[s.id]} />
            ))}
          </div>
        </section>
      )}

      {pastSprints.length > 0 && (
        <SprintArchiveTable
          sprints={pastSprints}
          taskCountMap={taskCountMap}
          defaultExpanded={activeSprints.length === 0}
        />
      )}

      {sprints.length === 0 && (
        <div className="rounded-lg border border-dashed border-border p-12 text-center">
          <p className="text-sm text-muted-foreground">Nessuno sprint ancora.</p>
          <p className="mt-2 text-xs text-muted-foreground">
            Crea il primo sprint e aggiungi task dal backlog.
          </p>
          <div className="mt-4 flex justify-center">
            <CreateSprintButton />
          </div>
        </div>
      )}
    </div>
  );
}
