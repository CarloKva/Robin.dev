import { auth } from "@clerk/nextjs/server";
import { redirect } from "next/navigation";
import { getWorkspaceForUser, getWorkspaceMemberRole, getWorkspaceMcpConfig } from "@/lib/db/workspace";
import { getGitHubConnection } from "@/lib/db/github";
import { listInstallationRepos } from "@/lib/github/app";
import { getRepositoriesForWorkspace } from "@/lib/db/github";
import { getWorkspaceSettings } from "@/lib/db/workspace-settings";
import { GitHubConnectionCard } from "@/components/settings/GitHubConnectionCard";
import { RepositorySelector } from "@/components/settings/RepositorySelector";
import { WorkspaceNameForm } from "@/components/settings/WorkspaceNameForm";
import { NotificationsForm } from "@/components/settings/NotificationsForm";
import { McpServersForm } from "@/components/settings/McpServersForm";
import { SettingsSidebar } from "@/components/settings/SettingsSidebar";
import { EnvironmentsSection } from "@/components/settings/EnvironmentsSection";
import { getEnvironmentsForRepository } from "@/lib/db/environments";
import type { WorkspaceEnvironment } from "@robin/shared-types";

export const metadata = { title: "Settings — Robin.dev" };

export default async function SettingsPage({
  searchParams,
}: {
  searchParams: Promise<{ github_connected?: string; github_error?: string }>;
}) {
  const { userId } = await auth();
  if (!userId) redirect("/sign-in");

  const workspace = await getWorkspaceForUser(userId);
  if (!workspace) redirect("/onboarding/workspace");

  const { github_connected, github_error } = await searchParams;

  const [connection, wsSettings, userRole, mcpConfig] = await Promise.all([
    getGitHubConnection(workspace.id),
    getWorkspaceSettings(workspace.id),
    getWorkspaceMemberRole(userId),
    getWorkspaceMcpConfig(workspace.id),
  ]);

  const isOwnerOrAdmin = userRole === "owner";

  // Build repo list for the selector (only if GitHub is connected)
  let repos: Awaited<ReturnType<typeof listInstallationRepos>> = [];
  let dbRepos: Awaited<ReturnType<typeof getRepositoriesForWorkspace>> = [];

  if (connection) {
    [repos, dbRepos] = await Promise.all([
      listInstallationRepos(connection.installation_id).catch(() => []),
      getRepositoriesForWorkspace(workspace.id),
    ]);
  }

  // Load environments for all enabled repositories
  const enabledRepos = dbRepos.filter((r) => r.is_enabled);
  const environmentsByRepo: Record<string, WorkspaceEnvironment[]> = {};
  await Promise.all(
    enabledRepos.map(async (repo) => {
      const envs = await getEnvironmentsForRepository(repo.id);
      if (envs.length > 0) {
        environmentsByRepo[repo.id] = envs;
      }
    })
  );

  const dbRepoMap = new Map(dbRepos.map((r) => [r.github_repo_id, r]));

  const repoRows = repos.map((gr) => {
    const dbRepo = dbRepoMap.get(gr.id);
    return {
      github_repo_id: gr.id,
      full_name: gr.full_name,
      default_branch: gr.default_branch,
      is_private: gr.private,
      description: gr.description,
      updated_at: gr.updated_at,
      db_id: dbRepo?.id ?? null,
      is_enabled: dbRepo?.is_enabled ?? false,
      is_available: dbRepo?.is_available ?? true,
    };
  });

  const createdAt = new Date(workspace.created_at).toLocaleDateString("it-IT", {
    year: "numeric",
    month: "long",
    day: "numeric",
  });

  const githubError =
    github_error === "invalid_callback"
      ? "Callback non valido. Riprova."
      : github_error === "connection_failed"
        ? "Connessione a GitHub fallita. Riprova."
        : null;

  return (
    <div className="flex flex-col lg:flex-row gap-6 lg:gap-8 max-w-5xl">
      <SettingsSidebar isOwner={isOwnerOrAdmin} />

      <div className="flex-1 min-w-0 space-y-6">
        {/* Page header */}
        <div>
          <h1 className="text-2xl font-bold tracking-tight text-[#1C1C1E] dark:text-white">
            Impostazioni
          </h1>
          <p className="mt-1 text-sm text-[#8E8E93]">
            Gestisci le preferenze e le integrazioni del tuo workspace.
          </p>
          {github_connected === "true" && (
            <div className="mt-3 flex items-center gap-2 rounded-xl border border-[#34C759]/40 bg-[#34C759]/5 px-4 py-2.5 text-sm text-[#34C759]">
              <svg className="h-4 w-4 shrink-0" viewBox="0 0 20 20" fill="currentColor">
                <path fillRule="evenodd" d="M16.704 4.153a.75.75 0 01.143 1.052l-8 10.5a.75.75 0 01-1.127.075l-4.5-4.5a.75.75 0 011.06-1.06l3.894 3.893 7.48-9.817a.75.75 0 011.05-.143z" clipRule="evenodd" />
              </svg>
              GitHub connesso con successo.
            </div>
          )}
        </div>

        {/* ── Workspace ──────────────────────────────────────────── */}
        <section
          id="workspace"
          className="scroll-mt-6 space-y-5 rounded-ios-lg shadow-ios-sm bg-white dark:bg-[#1C1C1E] p-6"
        >
          <div className="border-b border-[#D1D1D6]/60 dark:border-[#38383A] pb-4">
            <h2 className="text-base font-semibold text-[#1C1C1E] dark:text-white">Workspace</h2>
            <p className="mt-0.5 text-sm text-[#8E8E93]">
              Informazioni generali sul tuo workspace Robin.dev.
            </p>
          </div>

          {/* Name */}
          <div className="space-y-1.5">
            <label className="text-sm font-medium text-[#1C1C1E] dark:text-white">
              Nome workspace
            </label>
            <WorkspaceNameForm initialName={workspace.name} />
            <p className="text-xs text-[#8E8E93]">
              Il nome viene mostrato nella sidebar e nelle notifiche.
            </p>
          </div>

          {/* Read-only fields */}
          <div className="grid gap-4 sm:grid-cols-2">
            <div className="space-y-1">
              <p className="text-xs font-medium uppercase tracking-wider text-[#8E8E93]">Slug</p>
              <p className="rounded-xl border border-[#D1D1D6]/60 dark:border-[#38383A] bg-[#F2F2F7] dark:bg-[#2C2C2E] px-3 py-2 font-mono text-sm text-[#1C1C1E] dark:text-white">
                {workspace.slug}
              </p>
              <p className="text-xs text-[#8E8E93]">Identificatore URL del workspace.</p>
            </div>
            <div className="space-y-1">
              <p className="text-xs font-medium uppercase tracking-wider text-[#8E8E93]">Creato il</p>
              <p className="rounded-xl border border-[#D1D1D6]/60 dark:border-[#38383A] bg-[#F2F2F7] dark:bg-[#2C2C2E] px-3 py-2 text-sm text-[#1C1C1E] dark:text-white">
                {createdAt}
              </p>
            </div>
            <div className="space-y-1 sm:col-span-2">
              <p className="text-xs font-medium uppercase tracking-wider text-[#8E8E93]">Workspace ID</p>
              <p className="rounded-xl border border-[#D1D1D6]/60 dark:border-[#38383A] bg-[#F2F2F7] dark:bg-[#2C2C2E] px-3 py-2 font-mono text-xs text-[#8E8E93]">
                {workspace.id}
              </p>
              <p className="text-xs text-[#8E8E93]">ID interno — utile per debug e supporto.</p>
            </div>
          </div>
        </section>

        {/* ── Connessioni ────────────────────────────────────────── */}
        <section
          id="connections"
          className="scroll-mt-6 space-y-5 rounded-ios-lg shadow-ios-sm bg-white dark:bg-[#1C1C1E] p-6"
        >
          <div className="border-b border-[#D1D1D6]/60 dark:border-[#38383A] pb-4">
            <h2 className="text-base font-semibold text-[#1C1C1E] dark:text-white">Connessioni</h2>
            <p className="mt-0.5 text-sm text-[#8E8E93]">
              Collega il tuo account GitHub per permettere agli agenti di lavorare sui tuoi repository.
            </p>
          </div>
          <GitHubConnectionCard
            connection={connection}
            initialError={githubError}
          />
        </section>

        {/* ── Repository ─────────────────────────────────────────── */}
        <section
          id="repositories"
          className="scroll-mt-6 space-y-5 rounded-ios-lg shadow-ios-sm bg-white dark:bg-[#1C1C1E] p-6"
        >
          <div className="border-b border-[#D1D1D6]/60 dark:border-[#38383A] pb-4">
            <h2 className="text-base font-semibold text-[#1C1C1E] dark:text-white">Repository</h2>
            <p className="mt-0.5 text-sm text-[#8E8E93]">
              Abilita i repository su cui gli agenti possono operare.
            </p>
          </div>

          {!connection && (
            <div className="flex items-center gap-3 rounded-xl border border-dashed border-[#D1D1D6] dark:border-[#38383A] p-4">
              <div className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-[#F2F2F7] dark:bg-[#2C2C2E]">
                <svg className="h-4 w-4 text-[#8E8E93]" viewBox="0 0 20 20" fill="currentColor">
                  <path fillRule="evenodd" d="M18 10a8 8 0 11-16 0 8 8 0 0116 0zm-7-4a1 1 0 11-2 0 1 1 0 012 0zM9 9a.75.75 0 000 1.5h.253a.25.25 0 01.244.304l-.459 2.066A1.75 1.75 0 0010.747 15H11a.75.75 0 000-1.5h-.253a.25.25 0 01-.244-.304l.459-2.066A1.75 1.75 0 009.253 9H9z" clipRule="evenodd" />
                </svg>
              </div>
              <p className="text-sm text-[#8E8E93]">
                Connetti GitHub nella sezione{" "}
                <span className="font-medium text-[#1C1C1E] dark:text-white">Connessioni</span>{" "}
                per abilitare i repository.
              </p>
            </div>
          )}

          {connection && repoRows.length === 0 && (
            <div className="rounded-xl border border-dashed border-[#D1D1D6] dark:border-[#38383A] p-4">
              <p className="text-sm text-[#8E8E93]">
                Nessun repository accessibile tramite Robin.dev App. Verifica la configurazione su{" "}
                <a
                  href="https://github.com/settings/installations"
                  target="_blank"
                  rel="noopener noreferrer"
                  className="font-medium text-[#007AFF] hover:underline"
                >
                  GitHub
                </a>
                .
              </p>
            </div>
          )}

          {connection && repoRows.length > 0 && (
            <RepositorySelector initialRepos={repoRows} compact />
          )}
        </section>

        {/* ── Ambienti ───────────────────────────────────────────── */}
        <section
          id="environments"
          className="scroll-mt-6 space-y-5 rounded-ios-lg shadow-ios-sm bg-white dark:bg-[#1C1C1E] p-6"
        >
          <div className="border-b border-[#D1D1D6]/60 dark:border-[#38383A] pb-4">
            <h2 className="text-base font-semibold text-[#1C1C1E] dark:text-white">Ambienti</h2>
            <p className="mt-0.5 text-sm text-[#8E8E93]">
              Configura ambienti di staging e production per i tuoi repository. Definisci il branch target e abilita l&apos;auto-merge.
            </p>
          </div>
          <EnvironmentsSection
            repositories={enabledRepos.map((r) => ({
              id: r.id,
              full_name: r.full_name,
              default_branch: r.default_branch,
            }))}
            initialEnvironmentsByRepo={environmentsByRepo}
          />
        </section>

        {/* ── MCP Servers ────────────────────────────────────────── */}
        {isOwnerOrAdmin && (
          <section
            id="mcp-servers"
            className="scroll-mt-6 space-y-5 rounded-ios-lg shadow-ios-sm bg-white dark:bg-[#1C1C1E] p-6"
          >
            <div className="border-b border-[#D1D1D6]/60 dark:border-[#38383A] pb-4">
              <h2 className="text-base font-semibold text-[#1C1C1E] dark:text-white">MCP Servers</h2>
              <p className="mt-0.5 text-sm text-[#8E8E93]">
                Configura i server MCP disponibili per gli agenti di questo workspace.
              </p>
            </div>
            <McpServersForm
              workspaceId={workspace.id}
              initialMcpConfig={mcpConfig}
            />
          </section>
        )}

        {/* ── Notifiche ──────────────────────────────────────────── */}
        <section
          id="notifications"
          className="scroll-mt-6 space-y-5 rounded-ios-lg shadow-ios-sm bg-white dark:bg-[#1C1C1E] p-6"
        >
          <div className="border-b border-[#D1D1D6]/60 dark:border-[#38383A] pb-4">
            <h2 className="text-base font-semibold text-[#1C1C1E] dark:text-white">Notifiche</h2>
            <p className="mt-0.5 text-sm text-[#8E8E93]">
              Configura dove ricevere notifiche sulle attività degli agenti.
            </p>
          </div>
          <NotificationsForm
            initialEmail={wsSettings?.notify_email ?? null}
            initialSlackWebhook={wsSettings?.notify_slack_webhook ?? null}
          />
        </section>
      </div>
    </div>
  );
}
