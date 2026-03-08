import { auth } from "@clerk/nextjs/server";
import { redirect } from "next/navigation";
import { Sidebar } from "@/components/sidebar";
import { Header } from "@/components/header";
import { MobileNav } from "@/components/mobile-nav";
import { HeaderRepoSelector } from "@/components/HeaderRepoSelector";
import { QuickTaskFormProvider } from "@/components/tasks/QuickTaskForm";
import { GlobalCreateModal } from "@/components/GlobalCreateModal";
import { getWorkspaceForUser } from "@/lib/db/workspace";
import { getRepositoriesForWorkspace, getGitHubConnection } from "@/lib/db/github";
import { getActiveAgentsCount } from "@/lib/db/agents";

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

  // Fetch active agent count for the header pill (best-effort — never blocks the layout)
  const activeAgentsCount = await getActiveAgentsCount(workspace.id);

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
      <Sidebar workspaceName={workspace.name} />
      <div className="flex flex-1 flex-col overflow-hidden">
        <Header workspaceName={workspace.name} activeAgentsCount={activeAgentsCount}>
          {repositories.length > 0 && (
            <HeaderRepoSelector
              repositories={repositories}
              workspaceId={workspace.id}
            />
          )}
        </Header>
        {/* padding-bottom accounts for the 49px tab bar + env(safe-area-inset-bottom) on mobile */}
        <main className="flex-1 overflow-y-auto p-4 pb-[calc(49px+env(safe-area-inset-bottom))] md:p-6 md:pb-6">{children}</main>
      </div>
      <MobileNav />
      {/* Global quick task form — accessible via N shortcut from any page */}
      <QuickTaskFormProvider repositories={repositories} />
      {/* Global create modal — Crea task button in header */}
      <GlobalCreateModal repositories={repositories} hasGitHubConnection={hasGitHubConnection} />
    </div>
  );
}
