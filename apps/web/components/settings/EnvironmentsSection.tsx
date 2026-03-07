"use client";

import { useState } from "react";
import type { Repository, WorkspaceEnvironment } from "@robin/shared-types";
import { EnvironmentCard } from "@/components/environments/EnvironmentCard";
import { CreateEnvironmentModal } from "@/components/environments/CreateEnvironmentModal";

interface EnvironmentsSectionProps {
  repositories: Pick<Repository, "id" | "full_name" | "default_branch">[];
  initialEnvironmentsByRepo: Record<string, WorkspaceEnvironment[]>;
}

export function EnvironmentsSection({
  repositories,
  initialEnvironmentsByRepo,
}: EnvironmentsSectionProps) {
  const [environmentsByRepo, setEnvironmentsByRepo] = useState(
    initialEnvironmentsByRepo
  );
  const [showCreate, setShowCreate] = useState(false);

  function handleCreated(env: WorkspaceEnvironment) {
    setEnvironmentsByRepo((prev) => {
      const existing = prev[env.repository_id] ?? [];
      return { ...prev, [env.repository_id]: [...existing, env] };
    });
  }

  function handleUpdated(env: WorkspaceEnvironment) {
    setEnvironmentsByRepo((prev) => {
      const existing = prev[env.repository_id] ?? [];
      return {
        ...prev,
        [env.repository_id]: existing.map((e) => (e.id === env.id ? env : e)),
      };
    });
  }

  function handleDeleted(repositoryId: string, id: string) {
    setEnvironmentsByRepo((prev) => {
      const existing = prev[repositoryId] ?? [];
      const updated = existing.filter((e) => e.id !== id);
      if (updated.length === 0) {
        const next = { ...prev };
        delete next[repositoryId];
        return next;
      }
      return { ...prev, [repositoryId]: updated };
    });
  }

  const repoById = new Map(repositories.map((r) => [r.id, r]));
  const enabledRepoIds = Object.keys(environmentsByRepo);
  const reposWithEnvs = enabledRepoIds
    .map((id) => repoById.get(id))
    .filter(Boolean) as Pick<Repository, "id" | "full_name" | "default_branch">[];

  const reposWithoutEnvs = repositories.filter(
    (r) => !environmentsByRepo[r.id]?.length
  );

  const hasAny = repositories.length > 0;

  return (
    <>
      <div className="flex items-center justify-between">
        {hasAny && (
          <button
            onClick={() => setShowCreate(true)}
            className="flex items-center gap-1.5 rounded-md bg-foreground px-3 py-1.5 text-sm font-medium text-background hover:bg-foreground/90"
          >
            <svg className="h-4 w-4" viewBox="0 0 20 20" fill="currentColor">
              <path d="M10.75 4.75a.75.75 0 00-1.5 0v4.5h-4.5a.75.75 0 000 1.5h4.5v4.5a.75.75 0 001.5 0v-4.5h4.5a.75.75 0 000-1.5h-4.5v-4.5z" />
            </svg>
            Nuovo ambiente
          </button>
        )}
      </div>

      {!hasAny && (
        <div className="flex items-center gap-3 rounded-lg border border-dashed border-border p-4">
          <div className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-muted">
            <svg className="h-4 w-4 text-muted-foreground" viewBox="0 0 20 20" fill="currentColor">
              <path fillRule="evenodd" d="M18 10a8 8 0 11-16 0 8 8 0 0116 0zm-7-4a1 1 0 11-2 0 1 1 0 012 0zM9 9a.75.75 0 000 1.5h.253a.25.25 0 01.244.304l-.459 2.066A1.75 1.75 0 0010.747 15H11a.75.75 0 000-1.5h-.253a.25.25 0 01-.244-.304l.459-2.066A1.75 1.75 0 009.253 9H9z" clipRule="evenodd" />
            </svg>
          </div>
          <p className="text-sm text-muted-foreground">
            Abilita almeno un repository nella sezione{" "}
            <span className="font-medium text-foreground">Repository</span> per configurare gli ambienti.
          </p>
        </div>
      )}

      {hasAny && Object.keys(environmentsByRepo).length === 0 && (
        <div className="rounded-lg border border-dashed border-border p-6 text-center">
          <p className="text-sm text-muted-foreground">
            Nessun ambiente configurato. Crea il tuo primo ambiente con il pulsante qui sopra.
          </p>
        </div>
      )}

      {/* Repos with environments */}
      {reposWithEnvs.map((repo) => {
        const envs = environmentsByRepo[repo.id] ?? [];
        return (
          <div key={repo.id} className="space-y-2">
            <p className="text-xs font-medium uppercase tracking-wider text-muted-foreground">
              {repo.full_name}
            </p>
            <div className="grid gap-3 sm:grid-cols-2">
              {envs.map((env) => (
                <EnvironmentCard
                  key={env.id}
                  environment={env}
                  onUpdated={handleUpdated}
                  onDeleted={(id) => handleDeleted(repo.id, id)}
                />
              ))}
            </div>
          </div>
        );
      })}

      {/* Repos with no environments yet (hint) */}
      {reposWithoutEnvs.length > 0 && reposWithEnvs.length > 0 && (
        <div className="space-y-1">
          <p className="text-xs font-medium uppercase tracking-wider text-muted-foreground">
            Repository senza ambienti
          </p>
          <div className="flex flex-wrap gap-2">
            {reposWithoutEnvs.map((r) => (
              <span
                key={r.id}
                className="inline-flex items-center rounded-full border border-border px-2.5 py-0.5 font-mono text-xs text-muted-foreground"
              >
                {r.full_name}
              </span>
            ))}
          </div>
        </div>
      )}

      {showCreate && (
        <CreateEnvironmentModal
          repositories={repositories}
          onCreated={handleCreated}
          onClose={() => setShowCreate(false)}
        />
      )}
    </>
  );
}
