import { auth } from "@clerk/nextjs/server";
import { redirect } from "next/navigation";
import { getWorkspaceForUser } from "@/lib/db/workspace";
import { createSupabaseServerClient } from "@/lib/supabase/server";
import {
  getDashboardMetrics,
  getWorkspaceFeed,
  getActiveTaskData,
} from "@/lib/db/dashboard";
import { DashboardClient } from "./DashboardClient";
import type { AgentStatusEnum } from "@robin/shared-types";

export default async function DashboardPage() {
  const { userId } = await auth();
  if (!userId) redirect("/sign-in");

  const workspace = await getWorkspaceForUser(userId);
  if (!workspace) redirect("/onboarding/workspace");

  const supabase = await createSupabaseServerClient();

  // Fetch all dashboard data in parallel — never block on one query
  const [metrics, activeTask, feed, agentRow, agentRecord] = await Promise.all([
    getDashboardMetrics(workspace.id),
    getActiveTaskData(workspace.id),
    getWorkspaceFeed(workspace.id, 10),
    // Agent status for the hero section
    supabase
      .from("agent_status")
      .select("status, current_task_id")
      .limit(1)
      .single()
      .then(({ data }) => data),
    // Agent name
    supabase
      .from("agents")
      .select("name")
      .eq("workspace_id", workspace.id)
      .limit(1)
      .single()
      .then(({ data }) => data),
  ]);

  let agentTaskTitle: string | null = null;
  if (agentRow?.current_task_id) {
    const { data: t } = await supabase
      .from("tasks")
      .select("title")
      .eq("id", agentRow.current_task_id)
      .single();
    agentTaskTitle = (t as { title: string } | null)?.title ?? null;
  }

  const initialAgentStatus: AgentStatusEnum =
    (agentRow?.status as AgentStatusEnum | undefined) ?? "idle";

  return (
    <DashboardClient
      workspaceId={workspace.id}
      agentName={(agentRecord as { name: string } | null)?.name ?? "Robin"}
      initialAgentStatus={initialAgentStatus}
      initialAgentTaskTitle={agentTaskTitle}
      metrics={metrics}
      activeTask={activeTask}
      initialFeed={feed}
    />
  );
}
