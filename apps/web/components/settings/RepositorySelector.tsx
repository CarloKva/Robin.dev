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
        "flex items-center justify-between gap-4 rounded-xl border border-[#D1D1D6]/60 dark:border-[#38383A] px-4 py-3 transition-colors",
        "bg-white dark:bg-[#1C1C1E] hover:bg-[#F2F2F7]/50 dark:hover:bg-[#2C2C2E]/50"
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

      {/* iOS toggle */}
      <button
        role="switch"
        aria-checked={repo.is_enabled}
        disabled={isPending || !repo.is_available}
        onClick={() => onToggle(repo, !repo.is_enabled)}
        className={cn(
          "relative inline-flex h-6 w-11 shrink-0 cursor-pointer items-center rounded-full transition-colors duration-200",
          repo.is_enabled ? "bg-[#34C759]" : "bg-[#D1D1D6] dark:bg-[#38383A]",
          "disabled:cursor-not-allowed disabled:opacity-50"
        )}
      >
        <span
          className={cn(
            "pointer-events-none block h-5 w-5 rounded-full bg-white shadow-sm transition-transform duration-200",
            repo.is_enabled ? "translate-x-[22px]" : "translate-x-0.5"
          )}
        />
      </button>
    </div>
  );
}

// ─── Main component ───────────────────────────────────────────────────────────

interface RepositorySelectorProps {
  initialRepos: RepoRow[];
  /** When true, renders without a section wrapper (for embedding inside another section) */
  compact?: boolean;
}

export function RepositorySelector({ initialRepos, compact }: RepositorySelectorProps) {
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

  const inner = (
    <div className="space-y-4">
      <div className="flex items-center justify-between gap-3">
        {!compact && (
          <div>
            <h2 className="text-base font-semibold">Repository</h2>
          </div>
        )}
        <p className={cn("text-xs text-muted-foreground", !compact && "mt-0.5")}>
          {enabledCount} di {repos.length} abilitate
        </p>
      </div>

      {/* Search */}
      <input
        type="text"
        placeholder="Cerca repository..."
        value={search}
        onChange={(e) => setSearch(e.target.value)}
        className="h-11 w-full rounded-xl border border-[#D1D1D6] bg-white dark:bg-[#1C1C1E] dark:border-[#38383A] px-3.5 text-sm text-[#1C1C1E] dark:text-white placeholder:text-[#8E8E93] outline-none transition-colors focus:border-[#007AFF] focus:ring-2 focus:ring-[#007AFF]/20"
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
    </div>
  );

  if (compact) return inner;

  return (
    <section className="space-y-4 rounded-lg border border-border p-6">
      {inner}
    </section>
  );
}
