import { auth } from "@clerk/nextjs/server";
import { redirect } from "next/navigation";
import { Sidebar } from "@/components/sidebar";
import { Header } from "@/components/header";
import { MobileNav } from "@/components/mobile-nav";
import { AgentStatusWidget } from "@/components/agent/AgentStatusWidget";
import { HeaderRepoSelector } from "@/components/HeaderRepoSelector";
import { QuickTaskFormProvider } from "@/components/tasks/QuickTaskForm";
import { CreateButton } from "@/components/CreateButton";
import { GlobalCreateModal } from "@/components/GlobalCreateModal";
import { getWorkspaceForUser } from "@/lib/db/workspace";
import { getRepositoriesForWorkspace, getGitHubConnection } from "@/lib/db/github";
import { getActiveAgentStatus } from "@/lib/db/agents";

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
  const { status: agentStatus, currentTaskTitle: agentCurrentTaskTitle } =
    await getActiveAgentStatus();

  // Fetch repositories + GitHub connection for QuickTaskForm and GlobalCreateModal (best-effort)
  let repositories: Awaited<ReturnType<typeof getRepositoriesForWorkspace>> = [];
  let hasGitHubConnection = false;
  try {
    const [repos, connection] = await Promise.all([
      getRepositoriesForWorkspace(workspace.id),
      getGitHubConnection(workspace.id),
    ]);
    repositories = repos;
    hasGitHubConnection = !!connection;
  } catch {
    // Non-fatal
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
          {repositories.length > 0 && (
            <HeaderRepoSelector
              repositories={repositories}
              workspaceId={workspace.id}
            />
          )}
          <CreateButton />
        </Header>
        {/* pb-16 reserves space for the mobile bottom nav bar */}
        <main className="flex-1 overflow-y-auto p-4 pb-20 md:p-6 md:pb-6">{children}</main>
      </div>
      <MobileNav />
      {/* Global quick task form — accessible via N shortcut from any page */}
      <QuickTaskFormProvider repositories={repositories} />
      {/* Global create modal — CREA button in header */}
      <GlobalCreateModal repositories={repositories} hasGitHubConnection={hasGitHubConnection} />
    </div>
  );
}
