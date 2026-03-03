"use client";

import { useState } from "react";
import type { Repository } from "@robin/shared-types";

interface SyncFromGitHubModalProps {
  repositories: Repository[];
  onClose: () => void;
  onSynced: () => void;
}

export function SyncFromGitHubModal({ repositories, onClose, onSynced }: SyncFromGitHubModalProps) {
  const [selectedRepo, setSelectedRepo] = useState(repositories[0]?.full_name ?? "");
  const [mdPaths, setMdPaths] = useState<string[]>([]);
  const [selectedPaths, setSelectedPaths] = useState<Set<string>>(new Set());
  const [loadingTree, setLoadingTree] = useState(false);
  const [treeError, setTreeError] = useState<string | null>(null);
  const [syncing, setSyncing] = useState(false);
  const [syncError, setSyncError] = useState<string | null>(null);

  async function loadTree(repoFullName: string) {
    if (!repoFullName) return;
    setLoadingTree(true);
    setTreeError(null);
    setMdPaths([]);
    setSelectedPaths(new Set());
    try {
      const res = await fetch(`/api/context/sync/tree?repoFullName=${encodeURIComponent(repoFullName)}`);
      const data = (await res.json()) as { paths?: string[]; error?: string };
      if (!res.ok) {
        setTreeError(data.error ?? "Errore nel caricamento dei file.");
        return;
      }
      setMdPaths(data.paths ?? []);
    } catch {
      setTreeError("Errore di rete.");
    } finally {
      setLoadingTree(false);
    }
  }

  function handleRepoChange(repo: string) {
    setSelectedRepo(repo);
    void loadTree(repo);
  }

  function togglePath(path: string) {
    setSelectedPaths((prev) => {
      const next = new Set(prev);
      if (next.has(path)) next.delete(path);
      else next.add(path);
      return next;
    });
  }

  function toggleAll(select: boolean) {
    setSelectedPaths(select ? new Set(mdPaths) : new Set());
  }

  async function handleSync() {
    if (selectedPaths.size === 0) return;
    setSyncing(true);
    setSyncError(null);
    try {
      const res = await fetch("/api/context/sync", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ repoFullName: selectedRepo, paths: [...selectedPaths] }),
      });
      const data = (await res.json()) as { results?: { path: string; ok: boolean; error?: string }[]; error?: string };
      if (!res.ok) {
        setSyncError(data.error ?? "Errore durante la sincronizzazione.");
        return;
      }
      const failed = (data.results ?? []).filter((r) => !r.ok);
      if (failed.length > 0) {
        setSyncError(`${failed.length} file non sincronizzati: ${failed.map((f) => f.path).join(", ")}`);
        return;
      }
      onSynced();
    } catch {
      setSyncError("Errore di rete.");
    } finally {
      setSyncing(false);
    }
  }

  const allSelected = mdPaths.length > 0 && mdPaths.every((p) => selectedPaths.has(p));

  return (
    <div className="fixed inset-0 z-50 flex items-end justify-center sm:items-center">
      {/* Backdrop */}
      <div className="absolute inset-0 bg-black/50" onClick={onClose} aria-hidden="true" />

      {/* Modal */}
      <div className="relative z-10 mx-0 sm:mx-4 w-full sm:max-w-lg max-h-[90vh] flex flex-col rounded-t-xl sm:rounded-xl border border-border bg-card shadow-2xl">
        {/* Header */}
        <div className="flex items-center justify-between border-b border-border px-5 py-4 shrink-0">
          <h2 className="font-semibold text-base">Sincronizza da GitHub</h2>
          <button
            onClick={onClose}
            className="rounded-md p-1 text-muted-foreground hover:text-foreground hover:bg-accent transition-colors"
            aria-label="Chiudi"
          >
            ✕
          </button>
        </div>

        {/* Body */}
        <div className="flex-1 overflow-y-auto px-5 py-4 space-y-4">
          {/* Repo selector */}
          <div>
            <label className="block text-sm font-medium mb-1.5">Repository</label>
            <select
              value={selectedRepo}
              onChange={(e) => handleRepoChange(e.target.value)}
              className="w-full h-9 rounded-md border border-border bg-background px-2.5 text-sm text-foreground focus:outline-none focus:ring-1 focus:ring-ring"
            >
              {repositories.map((r) => (
                <option key={r.id} value={r.full_name}>
                  {r.full_name}
                </option>
              ))}
            </select>
            {!mdPaths.length && !loadingTree && selectedRepo && (
              <button
                onClick={() => void loadTree(selectedRepo)}
                className="mt-2 text-xs text-primary underline hover:no-underline"
              >
                Carica file .md
              </button>
            )}
          </div>

          {/* Tree */}
          {loadingTree && (
            <p className="text-xs text-muted-foreground animate-pulse">Caricamento file…</p>
          )}
          {treeError && (
            <p className="text-xs text-red-600 dark:text-red-400">{treeError}</p>
          )}
          {!loadingTree && mdPaths.length > 0 && (
            <div>
              <div className="flex items-center justify-between mb-2">
                <label className="text-sm font-medium">File .md trovati ({mdPaths.length})</label>
                <button
                  onClick={() => toggleAll(!allSelected)}
                  className="text-xs text-primary underline hover:no-underline"
                >
                  {allSelected ? "Deseleziona tutti" : "Seleziona tutti"}
                </button>
              </div>
              <ul className="rounded-lg border border-border divide-y divide-border max-h-60 overflow-y-auto">
                {mdPaths.map((path) => (
                  <li key={path}>
                    <label className="flex items-center gap-2.5 px-3 py-2 cursor-pointer hover:bg-accent/40 transition-colors">
                      <input
                        type="checkbox"
                        checked={selectedPaths.has(path)}
                        onChange={() => togglePath(path)}
                        className="h-4 w-4 rounded border-border accent-primary"
                      />
                      <span className="text-xs font-mono text-foreground">{path}</span>
                    </label>
                  </li>
                ))}
              </ul>
            </div>
          )}
          {!loadingTree && mdPaths.length === 0 && !treeError && selectedRepo && (
            <p className="text-xs text-muted-foreground">Nessun file .md trovato nella repository.</p>
          )}

          {syncError && (
            <p className="text-xs text-red-600 dark:text-red-400">{syncError}</p>
          )}
        </div>

        {/* Footer */}
        <div className="border-t border-border px-5 py-4 shrink-0 flex gap-2 justify-end">
          <button
            onClick={onClose}
            disabled={syncing}
            className="rounded-md border border-border bg-background px-4 py-2 text-sm font-medium hover:bg-accent transition-colors disabled:opacity-50"
          >
            Annulla
          </button>
          <button
            onClick={() => void handleSync()}
            disabled={syncing || selectedPaths.size === 0}
            className="rounded-md bg-primary px-4 py-2 text-sm font-medium text-primary-foreground hover:bg-primary/90 transition-colors disabled:opacity-50"
          >
            {syncing ? "Sincronizzando…" : `Sincronizza ${selectedPaths.size > 0 ? `(${selectedPaths.size})` : ""}`}
          </button>
        </div>
      </div>
    </div>
  );
}
