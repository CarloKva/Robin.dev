"use client";

import { useState, useTransition, useMemo } from "react";
import { cn } from "@/lib/utils";

// ─── Types (inline — mirrors API response) ────────────────────────────────────

interface RepoRow {
  github_repo_id: number;
  full_name: string;
  default_branch: string;
  is_private: boolean;
  description: string | null;
  updated_at: string;
  db_id: string | null;
  is_enabled: boolean;
  is_available: boolean;
}

// ─── Repository row ───────────────────────────────────────────────────────────

function RepoRow({
  repo,
  onToggle,
  isPending,
}: {
  repo: RepoRow;
  onToggle: (repo: RepoRow, enabled: boolean) => void;
  isPending: boolean;
}) {
  return (
    <div
      className={cn(
        "flex items-center justify-between gap-4 rounded-lg border px-4 py-3 transition-colors",
        repo.is_enabled
          ? "border-emerald-200 bg-emerald-50/50 dark:border-emerald-800 dark:bg-emerald-950/30"
          : "border-border bg-card hover:bg-muted/30"
      )}
    >
      <div className="min-w-0 flex-1">
        <div className="flex items-center gap-2">
          <span className="truncate text-sm font-medium text-foreground">
            {repo.full_name}
          </span>
          {repo.is_private && (
            <span className="inline-flex items-center rounded-full border border-zinc-200 bg-zinc-100 px-1.5 py-0.5 text-[10px] font-medium text-zinc-600 dark:border-zinc-700 dark:bg-zinc-800 dark:text-zinc-400">
              privata
            </span>
          )}
        </div>
        {repo.description && (
          <p className="mt-0.5 truncate text-xs text-muted-foreground">{repo.description}</p>
        )}
        <p className="mt-0.5 font-mono text-[10px] text-muted-foreground">
          branch: {repo.default_branch}
        </p>
      </div>

      {/* Toggle */}
      <button
        role="switch"
        aria-checked={repo.is_enabled}
        disabled={isPending || !repo.is_available}
        onClick={() => onToggle(repo, !repo.is_enabled)}
        className={cn(
          "relative inline-flex h-5 w-9 shrink-0 items-center rounded-full border-2 transition-colors",
          repo.is_enabled
            ? "border-emerald-500 bg-emerald-500"
            : "border-zinc-300 bg-zinc-200 dark:border-zinc-600 dark:bg-zinc-700",
          "disabled:cursor-not-allowed disabled:opacity-50"
        )}
      >
        <span
          className={cn(
            "pointer-events-none block h-3.5 w-3.5 rounded-full bg-white shadow-sm transition-transform",
            repo.is_enabled ? "translate-x-4" : "translate-x-0.5"
          )}
        />
      </button>
    </div>
  );
}

// ─── Main component ───────────────────────────────────────────────────────────

interface RepositorySelectorProps {
  initialRepos: RepoRow[];
}

export function RepositorySelector({ initialRepos }: RepositorySelectorProps) {
  const [repos, setRepos] = useState<RepoRow[]>(initialRepos);
  const [search, setSearch] = useState("");
  const [pendingRepos, startTransition] = useTransition();

  const filtered = useMemo(() => {
    if (!search.trim()) return repos;
    const q = search.toLowerCase();
    return repos.filter(
      (r) =>
        r.full_name.toLowerCase().includes(q) ||
        (r.description?.toLowerCase().includes(q) ?? false)
    );
  }, [repos, search]);

  function handleToggle(repo: RepoRow, enabled: boolean) {
    // Optimistic update
    setRepos((prev) =>
      prev.map((r) =>
        r.github_repo_id === repo.github_repo_id ? { ...r, is_enabled: enabled } : r
      )
    );

    startTransition(async () => {
      if (enabled) {
        const res = await fetch("/api/github/repos/enable", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            github_repo_id: repo.github_repo_id,
            full_name: repo.full_name,
            default_branch: repo.default_branch,
            is_private: repo.is_private,
          }),
        });
        if (res.ok) {
          const data = (await res.json()) as { repo: { id: string } };
          setRepos((prev) =>
            prev.map((r) =>
              r.github_repo_id === repo.github_repo_id
                ? { ...r, db_id: data.repo.id, is_enabled: true }
                : r
            )
          );
        } else {
          // Revert on error
          setRepos((prev) =>
            prev.map((r) =>
              r.github_repo_id === repo.github_repo_id ? { ...r, is_enabled: false } : r
            )
          );
        }
      } else {
        if (!repo.db_id) return;
        const res = await fetch(`/api/github/repos/${repo.db_id}`, {
          method: "DELETE",
        });
        if (!res.ok) {
          // Revert on error
          setRepos((prev) =>
            prev.map((r) =>
              r.github_repo_id === repo.github_repo_id ? { ...r, is_enabled: true } : r
            )
          );
        }
      }
    });
  }

  const enabledCount = repos.filter((r) => r.is_enabled).length;

  return (
    <section className="space-y-4 rounded-lg border border-border p-6">
      <div className="flex items-center justify-between gap-3">
        <div>
          <h2 className="text-base font-semibold">Repository</h2>
          <p className="mt-0.5 text-xs text-muted-foreground">
            {enabledCount} di {repos.length} abilitate
          </p>
        </div>
      </div>

      {/* Search */}
      <input
        type="text"
        placeholder="Cerca repository..."
        value={search}
        onChange={(e) => setSearch(e.target.value)}
        className="w-full rounded-md border border-border bg-background px-3 py-2 text-sm placeholder:text-muted-foreground focus:outline-none focus:ring-2 focus:ring-ring"
      />

      {/* Repo list */}
      <div className="max-h-[480px] space-y-2 overflow-y-auto pr-1">
        {filtered.length === 0 && (
          <p className="py-6 text-center text-sm text-muted-foreground">
            {search ? "Nessun repository trovato" : "Nessun repository disponibile"}
          </p>
        )}
        {filtered.map((repo) => (
          <RepoRow
            key={repo.github_repo_id}
            repo={repo}
            onToggle={handleToggle}
            isPending={pendingRepos}
          />
        ))}
      </div>
    </section>
  );
}
