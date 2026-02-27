import { auth } from "@clerk/nextjs/server";
import { redirect } from "next/navigation";
import { Sidebar } from "@/components/sidebar";
import { Header } from "@/components/header";
import { MobileNav } from "@/components/mobile-nav";
import { AgentStatusWidget } from "@/components/agent/AgentStatusWidget";
import { getWorkspaceForUser } from "@/lib/db/workspace";
import { createSupabaseServerClient } from "@/lib/supabase/server";
import type { AgentStatusEnum } from "@robin/shared-types";

export default async function DashboardLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const { userId } = await auth();

  if (!userId) {
    redirect("/sign-in");
  }

  const workspace = await getWorkspaceForUser(userId);

  if (!workspace) {
    redirect("/onboarding/workspace");
  }

  // Fetch agent status for the header badge (best-effort — never blocks the layout)
  let agentStatus: AgentStatusEnum | null = null;
  let agentCurrentTaskTitle: string | null = null;

  try {
    const supabase = await createSupabaseServerClient();
    const { data: agentStatusRow } = await supabase
      .from("agent_status")
      .select("status, current_task_id")
      .limit(1)
      .single();

    if (agentStatusRow) {
      agentStatus = agentStatusRow.status as AgentStatusEnum;

      if (agentStatusRow.current_task_id) {
        const { data: currentTask } = await supabase
          .from("tasks")
          .select("title")
          .eq("id", agentStatusRow.current_task_id)
          .single();
        agentCurrentTaskTitle = currentTask?.title ?? null;
      }
    }
  } catch {
    // Silently ignore — widget simply won't render if agent data unavailable
  }

  return (
    <div className="flex h-screen overflow-hidden">
      <Sidebar />
      <div className="flex flex-1 flex-col overflow-hidden">
        <Header workspaceName={workspace.name}>
          {agentStatus != null && (
            <AgentStatusWidget
              workspaceId={workspace.id}
              initialStatus={agentStatus}
              initialTaskTitle={agentCurrentTaskTitle}
            />
          )}
        </Header>
        {/* pb-16 reserves space for the mobile bottom nav bar */}
        <main className="flex-1 overflow-y-auto p-4 pb-20 md:p-6 md:pb-6">{children}</main>
      </div>
      <MobileNav />
    </div>
  );
}
