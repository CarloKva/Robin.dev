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
import { CreditCard } from "lucide-react";
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
    <div className="grid grid-cols-1 lg:grid-cols-4 gap-8 max-w-5xl">
      {/* Sidebar */}
      <div className="lg:col-span-1">
        <SettingsSidebar isOwner={isOwnerOrAdmin} />
      </div>

      {/* Content */}
      <div className="lg:col-span-3 space-y-10">
        {/* Page header */}
        <div>
          <h1 className="text-2xl font-bold tracking-tight">Impostazioni</h1>
          <p className="mt-1 text-sm text-muted-foreground">
            Gestisci le preferenze e le integrazioni del tuo workspace.
          </p>
          {github_connected === "true" && (
            <div className="mt-3 flex items-center gap-2 rounded-md border border-emerald-200 bg-emerald-50 px-4 py-2.5 text-sm text-emerald-700 dark:border-emerald-800 dark:bg-emerald-950 dark:text-emerald-400">
              <svg className="h-4 w-4 shrink-0" viewBox="0 0 20 20" fill="currentColor">
                <path fillRule="evenodd" d="M16.704 4.153a.75.75 0 01.143 1.052l-8 10.5a.75.75 0 01-1.127.075l-4.5-4.5a.75.75 0 011.06-1.06l3.894 3.893 7.48-9.817a.75.75 0 011.05-.143z" clipRule="evenodd" />
              </svg>
              GitHub connesso con successo.
            </div>
          )}
        </div>

        {/* ── General ────────────────────────────────────────────── */}
        <section id="general" className="scroll-mt-6 space-y-5">
          <div className="border-b border-border pb-4 mb-6">
            <h2 className="text-base font-semibold text-foreground">General</h2>
            <p className="text-sm text-muted-foreground mt-1">Gestisci le impostazioni generali del workspace</p>
          </div>

          {/* Nome workspace */}
          <div className="space-y-1.5">
            <label className="text-sm font-medium text-foreground">Nome workspace</label>
            <WorkspaceNameForm initialName={workspace.name} />
            <p className="text-xs text-muted-foreground">Il nome viene mostrato nella sidebar e nelle notifiche.</p>
          </div>

          {/* Slug workspace */}
          <div className="space-y-1.5">
            <label className="text-sm font-medium text-foreground">Slug workspace</label>
            <div className="flex items-center rounded-xl border border-[#D1D1D6] dark:border-[#38383A] bg-muted/50 overflow-hidden">
              <span className="px-3 text-sm text-muted-foreground border-r border-[#D1D1D6] dark:border-[#38383A] h-11 flex items-center shrink-0">
                robin.dev/
              </span>
              <input
                readOnly
                value={workspace.slug}
                className="flex-1 h-11 px-3 text-sm bg-transparent text-foreground outline-none cursor-default"
              />
            </div>
            <p className="text-xs text-muted-foreground">Identificatore URL del workspace.</p>
          </div>

          {/* Read-only info */}
          <div className="grid gap-4 sm:grid-cols-2">
            <div className="space-y-1">
              <p className="text-xs font-medium uppercase tracking-wider text-muted-foreground">Creato il</p>
              <p className="rounded-xl border border-[#D1D1D6] dark:border-[#38383A] bg-muted/50 px-3 py-2 text-sm text-foreground">
                {createdAt}
              </p>
            </div>
            <div className="space-y-1">
              <p className="text-xs font-medium uppercase tracking-wider text-muted-foreground">Workspace ID</p>
              <p className="rounded-xl border border-[#D1D1D6] dark:border-[#38383A] bg-muted/50 px-3 py-2 font-mono text-xs text-muted-foreground truncate">
                {workspace.id}
              </p>
            </div>
          </div>

          {/* Notifications subsection */}
          <div className="pt-4 border-t border-border">
            <div className="mb-4">
              <h3 className="text-sm font-semibold text-foreground">Notifiche</h3>
              <p className="text-xs text-muted-foreground mt-0.5">Configura dove ricevere notifiche sulle attività degli agenti.</p>
            </div>
            <NotificationsForm
              initialEmail={wsSettings?.notify_email ?? null}
              initialSlackWebhook={wsSettings?.notify_slack_webhook ?? null}
            />
          </div>
        </section>

        {/* ── GitHub ─────────────────────────────────────────────── */}
        <section id="github" className="scroll-mt-6 space-y-5">
          <div className="border-b border-border pb-4 mb-6">
            <h2 className="text-base font-semibold text-foreground">GitHub</h2>
            <p className="text-sm text-muted-foreground mt-1">Collega il tuo account GitHub e gestisci i repository</p>
          </div>

          {/* Connection status badge */}
          <div className="flex items-center gap-2">
            <span className="text-sm font-medium text-foreground">Stato connessione</span>
            {connection ? (
              <span className="inline-flex items-center gap-1.5 rounded-full bg-emerald-50 px-2.5 py-0.5 text-xs font-medium text-emerald-700 dark:bg-emerald-950 dark:text-emerald-400 border border-emerald-200 dark:border-emerald-800">
                <span className="h-1.5 w-1.5 rounded-full bg-emerald-500" />
                Connesso
              </span>
            ) : (
              <span className="inline-flex items-center gap-1.5 rounded-full bg-zinc-100 px-2.5 py-0.5 text-xs font-medium text-zinc-600 dark:bg-zinc-800 dark:text-zinc-400 border border-zinc-200 dark:border-zinc-700">
                <span className="h-1.5 w-1.5 rounded-full bg-zinc-400" />
                Non configurato
              </span>
            )}
          </div>

          <GitHubConnectionCard
            connection={connection}
            initialError={githubError}
          />

          {/* Repository subsection */}
          <div className="pt-4 border-t border-border">
            <div className="mb-4">
              <h3 className="text-sm font-semibold text-foreground">Repository</h3>
              <p className="text-xs text-muted-foreground mt-0.5">Abilita i repository su cui gli agenti possono operare.</p>
            </div>

            {!connection && (
              <div className="flex items-center gap-3 rounded-lg border border-dashed border-border p-4">
                <div className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-muted">
                  <svg className="h-4 w-4 text-muted-foreground" viewBox="0 0 20 20" fill="currentColor">
                    <path fillRule="evenodd" d="M18 10a8 8 0 11-16 0 8 8 0 0116 0zm-7-4a1 1 0 11-2 0 1 1 0 012 0zM9 9a.75.75 0 000 1.5h.253a.25.25 0 01.244.304l-.459 2.066A1.75 1.75 0 0010.747 15H11a.75.75 0 000-1.5h-.253a.25.25 0 01-.244-.304l.459-2.066A1.75 1.75 0 009.253 9H9z" clipRule="evenodd" />
                  </svg>
                </div>
                <p className="text-sm text-muted-foreground">
                  Connetti GitHub nella sezione <span className="font-medium text-foreground">Connessioni</span> per abilitare i repository.
                </p>
              </div>
            )}

            {connection && repoRows.length === 0 && (
              <div className="rounded-lg border border-dashed border-border p-4">
                <p className="text-sm text-muted-foreground">
                  Nessun repository accessibile tramite Robin.dev App. Verifica la configurazione su{" "}
                  <a
                    href="https://github.com/settings/installations"
                    target="_blank"
                    rel="noopener noreferrer"
                    className="font-medium text-foreground underline hover:no-underline"
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
          </div>

          {/* Environments subsection */}
          <div className="pt-4 border-t border-border">
            <div className="mb-4">
              <h3 className="text-sm font-semibold text-foreground">Ambienti</h3>
              <p className="text-xs text-muted-foreground mt-0.5">
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
          </div>
        </section>

        {/* ── Agents ─────────────────────────────────────────────── */}
        <section id="agents" className="scroll-mt-6 space-y-5">
          <div className="border-b border-border pb-4 mb-6">
            <h2 className="text-base font-semibold text-foreground">Agents</h2>
            <p className="text-sm text-muted-foreground mt-1">Configura l&apos;infrastruttura e i parametri degli agenti</p>
          </div>

          {/* VPS default */}
          <div className="space-y-1.5">
            <label className="text-sm font-medium text-foreground">VPS default</label>
            <input
              type="text"
              placeholder="0.0.0.0"
              disabled
              className="h-11 w-full rounded-xl border border-[#D1D1D6] dark:border-[#38383A] bg-white dark:bg-[#1C1C1E] px-3.5 text-sm text-[#1C1C1E] dark:text-white outline-none placeholder:text-[#8E8E93] disabled:cursor-not-allowed disabled:opacity-50"
            />
            <p className="text-xs text-muted-foreground">Indirizzo IP del VPS di default per i nuovi agenti.</p>
          </div>

          {/* SSH key path */}
          <div className="space-y-1.5">
            <label className="text-sm font-medium text-foreground">SSH key path</label>
            <input
              type="text"
              placeholder="~/.ssh/id_rsa"
              disabled
              className="h-11 w-full rounded-xl border border-[#D1D1D6] dark:border-[#38383A] bg-white dark:bg-[#1C1C1E] px-3.5 text-sm text-[#1C1C1E] dark:text-white outline-none placeholder:text-[#8E8E93] disabled:cursor-not-allowed disabled:opacity-50"
            />
            <p className="text-xs text-muted-foreground">Percorso della chiave SSH per il provisioning.</p>
          </div>

          {/* Timeout task */}
          <div className="space-y-1.5">
            <label className="text-sm font-medium text-foreground">Timeout task (min)</label>
            <input
              type="number"
              placeholder="60"
              disabled
              className="h-11 w-full rounded-xl border border-[#D1D1D6] dark:border-[#38383A] bg-white dark:bg-[#1C1C1E] px-3.5 text-sm text-[#1C1C1E] dark:text-white outline-none placeholder:text-[#8E8E93] disabled:cursor-not-allowed disabled:opacity-50"
            />
            <p className="text-xs text-muted-foreground">Minuti prima che un task venga considerato scaduto.</p>
          </div>

          {/* MCP Servers subsection — owner only */}
          {isOwnerOrAdmin && (
            <div className="pt-4 border-t border-border">
              <div className="mb-4">
                <h3 className="text-sm font-semibold text-foreground">MCP Servers</h3>
                <p className="text-xs text-muted-foreground mt-0.5">Configura i server MCP disponibili per gli agenti di questo workspace.</p>
              </div>
              <McpServersForm
                workspaceId={workspace.id}
                initialMcpConfig={mcpConfig}
              />
            </div>
          )}
        </section>

        {/* ── Billing ────────────────────────────────────────────── */}
        <section id="billing" className="scroll-mt-6 space-y-5">
          <div className="border-b border-border pb-4 mb-6">
            <h2 className="text-base font-semibold text-foreground">Billing</h2>
            <p className="text-sm text-muted-foreground mt-1">Gestisci il piano e la fatturazione del workspace</p>
          </div>

          <div className="border border-border rounded-lg p-6 text-center">
            <CreditCard className="h-8 w-8 text-muted-foreground mx-auto mb-3" />
            <p className="text-sm text-muted-foreground">Gestione billing disponibile a breve</p>
          </div>
        </section>

        {/* ── Danger Zone ────────────────────────────────────────── */}
        <section id="danger-zone" className="scroll-mt-6 space-y-5">
          <div className="border-b border-border pb-4 mb-6">
            <h2 className="text-base font-semibold text-foreground">Danger Zone</h2>
            <p className="text-sm text-muted-foreground mt-1">Azioni irreversibili sul workspace</p>
          </div>

          <div className="border border-destructive/50 rounded-lg p-4">
            <h3 className="text-base font-semibold text-destructive mb-1">Attenzione</h3>
            <p className="text-sm text-muted-foreground mb-4">Le seguenti azioni sono permanenti e non possono essere annullate.</p>

            {/* Elimina workspace */}
            <div className="flex items-center justify-between py-3 border-b border-destructive/20">
              <div>
                <p className="text-sm font-medium text-foreground">Elimina workspace</p>
                <p className="text-xs text-muted-foreground mt-0.5">Rimuove permanentemente il workspace e tutti i dati associati.</p>
              </div>
              <button
                disabled
                className="shrink-0 ml-4 rounded-md border border-destructive px-3 py-1.5 text-sm text-destructive hover:bg-destructive hover:text-destructive-foreground transition-colors disabled:opacity-40 disabled:cursor-not-allowed"
              >
                Elimina workspace
              </button>
            </div>

            {/* Reset dati */}
            <div className="flex items-center justify-between py-3">
              <div>
                <p className="text-sm font-medium text-foreground">Reset dati</p>
                <p className="text-xs text-muted-foreground mt-0.5">Cancella task, sprint e agenti mantenendo la configurazione del workspace.</p>
              </div>
              <button
                disabled
                className="shrink-0 ml-4 rounded-md border border-destructive px-3 py-1.5 text-sm text-destructive hover:bg-destructive hover:text-destructive-foreground transition-colors disabled:opacity-40 disabled:cursor-not-allowed"
              >
                Reset dati
              </button>
            </div>
          </div>
        </section>
      </div>
    </div>
  );
}
