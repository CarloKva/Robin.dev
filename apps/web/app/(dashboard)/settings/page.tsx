import { auth } from "@clerk/nextjs/server";
import { redirect } from "next/navigation";
import { getWorkspaceForUser } from "@/lib/db/workspace";
import { getGitHubConnection } from "@/lib/db/github";
import { listInstallationRepos } from "@/lib/github/app";
import { getRepositoriesForWorkspace } from "@/lib/db/github";
import { GitHubConnectionCard } from "@/components/settings/GitHubConnectionCard";
import { RepositorySelector } from "@/components/settings/RepositorySelector";
import { WorkspaceNameForm } from "@/components/settings/WorkspaceNameForm";

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

  const connection = await getGitHubConnection(workspace.id);

  // Build repo list for the selector (only if GitHub is connected)
  let repos: Awaited<ReturnType<typeof listInstallationRepos>> = [];
  let dbRepos: Awaited<ReturnType<typeof getRepositoriesForWorkspace>> = [];

  if (connection) {
    [repos, dbRepos] = await Promise.all([
      listInstallationRepos(connection.installation_id).catch(() => []),
      getRepositoriesForWorkspace(workspace.id),
    ]);
  }

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
    <div className="max-w-xl space-y-8">
      <div>
        <h1 className="text-2xl font-bold tracking-tight">Settings</h1>
        {github_connected === "true" && (
          <div className="mt-3 rounded-md border border-emerald-200 bg-emerald-50 px-4 py-2 text-sm text-emerald-700 dark:border-emerald-800 dark:bg-emerald-950 dark:text-emerald-400">
            GitHub connesso con successo.
          </div>
        )}
      </div>

      {/* Workspace info */}
      <section className="space-y-4 rounded-lg border border-border p-6">
        <h2 className="text-base font-semibold">Workspace</h2>
        <dl className="space-y-3 text-sm">
          <div className="flex flex-col gap-1.5">
            <dt className="text-muted-foreground text-sm">Nome</dt>
            <dd>
              <WorkspaceNameForm initialName={workspace.name} />
            </dd>
          </div>
          <div className="flex justify-between">
            <dt className="text-muted-foreground">Slug</dt>
            <dd className="font-mono">{workspace.slug}</dd>
          </div>
          <div className="flex justify-between">
            <dt className="text-muted-foreground">Creato</dt>
            <dd>{createdAt}</dd>
          </div>
          <div className="flex justify-between">
            <dt className="text-muted-foreground">Workspace ID</dt>
            <dd className="font-mono text-xs">{workspace.id}</dd>
          </div>
        </dl>
      </section>

      {/* GitHub connection */}
      <GitHubConnectionCard
        connection={connection}
        initialError={githubError}
      />

      {/* Repository selector — shown only when GitHub is connected */}
      {connection && repoRows.length > 0 && (
        <RepositorySelector initialRepos={repoRows} />
      )}

      {connection && repoRows.length === 0 && (
        <section className="space-y-3 rounded-lg border border-border p-6">
          <h2 className="text-base font-semibold">Repository</h2>
          <p className="text-sm text-muted-foreground">
            Nessun repository accessibile tramite Robin.dev App. Verifica la configurazione su{" "}
            <a
              href="https://github.com/settings/installations"
              target="_blank"
              rel="noopener noreferrer"
              className="underline"
            >
              GitHub
            </a>
            .
          </p>
        </section>
      )}
    </div>
  );
}
