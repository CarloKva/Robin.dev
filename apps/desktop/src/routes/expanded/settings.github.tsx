import { createRoute } from '@tanstack/react-router';
import { Search } from 'lucide-react';
import { useCallback, useEffect, useMemo, useState } from 'react';

import { ConnectionCard } from '@/components/settings-github/ConnectionCard';
import { EnvironmentCard } from '@/components/settings-github/EnvironmentCard';
import { RepoRow } from '@/components/settings-github/RepoRow';
import { Btn } from '@/components/primitives/Btn';
import { SettingsShell } from '@/components/shell/SettingsShell';
import { WindowShell } from '@/components/expanded/WindowShell';
import { getConnection, listRepos, type GitHubConnection, type RemoteRepo } from '@/lib/api/github';
import { listEnvironments } from '@/lib/api/environments';
import type { WorkspaceEnvironment } from '@robin/shared-types';
import { Route as ExpandedRootRoute } from './__root';

export const Route = createRoute({
  getParentRoute: () => ExpandedRootRoute,
  path: '/settings/github',
  component: GithubSettingsPage,
});

function GithubSettingsPage() {
  const [connection, setConnection] = useState<GitHubConnection | null>(null);
  const [repos, setRepos] = useState<RemoteRepo[]>([]);
  const [query, setQuery] = useState('');
  const [environmentsByRepo, setEnvironmentsByRepo] = useState<Record<string, WorkspaceEnvironment[]>>({});

  const refresh = useCallback(async () => {
    const [c, r] = await Promise.all([getConnection().catch(() => null), listRepos().catch(() => ({ repos: [] }))]);
    setConnection(c);
    setRepos(r.repos);

    const enabled = r.repos.filter((repo) => repo.enabled && repo.workspace_repo_id);
    const envEntries = await Promise.all(
      enabled.map(async (repo) => {
        const res = await listEnvironments(repo.workspace_repo_id!).catch(() => ({ environments: [] }));
        return [repo.workspace_repo_id!, res.environments] as const;
      }),
    );
    setEnvironmentsByRepo(Object.fromEntries(envEntries));
  }, []);

  useEffect(() => {
    void refresh();
  }, [refresh]);

  const filtered = useMemo(() => {
    if (!query.trim()) return repos;
    const q = query.toLowerCase();
    return repos.filter((r) => r.full_name.toLowerCase().includes(q));
  }, [repos, query]);

  const enabledRepos = filtered.filter((r) => r.enabled);

  return (
    <WindowShell title="Settings" subtitle="GitHub">
      <SettingsShell activeId="github" title="GitHub" subtitle="Connect repos and configure environments">
        <div className="grid gap-5">
          <ConnectionCard connection={connection} onChange={refresh} />

          {connection?.connected ? (
            <>
              <section className="rounded-2xl border border-divider bg-popover">
                <header className="flex items-center justify-between gap-3 border-b border-divider px-4 py-3">
                  <h3 className="text-xs font-semibold text-ink">Repositories</h3>
                  <div className="relative">
                    <Search
                      size={12}
                      className="pointer-events-none absolute left-2 top-1/2 -translate-y-1/2 text-ink3"
                      aria-hidden="true"
                    />
                    <input
                      type="text"
                      value={query}
                      onChange={(e) => setQuery(e.target.value)}
                      placeholder="Search repos…"
                      className="h-7 rounded-md border border-border bg-inset pl-7 pr-2 text-xs text-ink placeholder:text-ink4"
                    />
                  </div>
                </header>
                <ul>
                  {filtered.map((repo) => (
                    <RepoRow key={repo.id} repo={repo} onChange={refresh} />
                  ))}
                  {filtered.length === 0 ? (
                    <li className="px-4 py-6 text-center text-xs text-ink3">No repositories found.</li>
                  ) : null}
                </ul>
              </section>

              {enabledRepos.length > 0 ? (
                <section>
                  <h3 className="mb-3 text-2xs font-semibold uppercase tracking-[0.08em] text-ink3">
                    Environments
                  </h3>
                  <div className="grid gap-3">
                    {enabledRepos.map((repo) => {
                      const envs = environmentsByRepo[repo.workspace_repo_id!] ?? [];
                      return (
                        <div key={repo.id} className="rounded-xl border border-divider bg-panel p-3">
                          <p className="mb-2 font-mono text-xs text-ink">{repo.full_name}</p>
                          {envs.length === 0 ? (
                            <p className="text-2xs text-ink3">No environments yet.</p>
                          ) : (
                            <div className="grid grid-cols-2 gap-3">
                              {envs.map((env) => (
                                <EnvironmentCard key={env.id} environment={env} onChange={refresh} />
                              ))}
                            </div>
                          )}
                        </div>
                      );
                    })}
                  </div>
                </section>
              ) : null}
            </>
          ) : (
            <section className="rounded-2xl border border-dashed border-border bg-panel p-6 text-center">
              <p className="text-sm text-ink2">Connect GitHub to enable repositories and environments.</p>
              <Btn
                variant="secondary"
                size="sm"
                className="mt-3"
                onClick={() => void refresh()}
              >
                I&rsquo;ve completed sign-in — refresh
              </Btn>
            </section>
          )}
        </div>
      </SettingsShell>
    </WindowShell>
  );
}
