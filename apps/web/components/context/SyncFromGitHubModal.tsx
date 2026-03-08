"use client";

import { useState } from "react";
import { X, Search, FileCode, FileText, Code, Loader2, Github } from "lucide-react";
import type { Repository } from "@robin/shared-types";

interface SyncFromGitHubModalProps {
  repositories: Repository[];
  onClose: () => void;
  onSynced: () => void;
}

function getFileIcon(path: string) {
  const ext = path.split(".").pop()?.toLowerCase();
  if (ext === "md" || ext === "mdx") return <FileCode className="h-4 w-4 shrink-0 text-[#8E8E93]" />;
  if (ext === "ts" || ext === "tsx" || ext === "js" || ext === "jsx") {
    return <Code className="h-4 w-4 shrink-0 text-[#8E8E93]" />;
  }
  return <FileText className="h-4 w-4 shrink-0 text-[#8E8E93]" />;
}

function getFileName(path: string) {
  return path.split("/").pop() ?? path;
}

function getFilePath(path: string) {
  const parts = path.split("/");
  if (parts.length <= 1) return "";
  return parts.slice(0, -1).join("/");
}

export function SyncFromGitHubModal({ repositories, onClose, onSynced }: SyncFromGitHubModalProps) {
  const [selectedRepo, setSelectedRepo] = useState(repositories[0]?.full_name ?? "");
  const [mdPaths, setMdPaths] = useState<string[]>([]);
  const [selectedPaths, setSelectedPaths] = useState<Set<string>>(new Set());
  const [loadingTree, setLoadingTree] = useState(false);
  const [treeError, setTreeError] = useState<string | null>(null);
  const [syncing, setSyncing] = useState(false);
  const [syncError, setSyncError] = useState<string | null>(null);
  const [fileSearch, setFileSearch] = useState("");

  async function loadTree(repoFullName: string) {
    if (!repoFullName) return;
    setLoadingTree(true);
    setTreeError(null);
    setMdPaths([]);
    setSelectedPaths(new Set());
    setFileSearch("");
    try {
      const res = await fetch(
        `/api/context/sync/tree?repoFullName=${encodeURIComponent(repoFullName)}`,
      );
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
    const visible = mdPaths.filter((p) => matchesSearch(p));
    setSelectedPaths((prev) => {
      const next = new Set(prev);
      if (select) {
        visible.forEach((p) => next.add(p));
      } else {
        visible.forEach((p) => next.delete(p));
      }
      return next;
    });
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
      const data = (await res.json()) as {
        results?: { path: string; ok: boolean; error?: string }[];
        error?: string;
      };
      if (!res.ok) {
        setSyncError(data.error ?? "Errore durante la sincronizzazione.");
        return;
      }
      const failed = (data.results ?? []).filter((r) => !r.ok);
      if (failed.length > 0) {
        setSyncError(
          `${failed.length} file non sincronizzati: ${failed.map((f) => f.path).join(", ")}`,
        );
        return;
      }
      onSynced();
    } catch {
      setSyncError("Errore di rete.");
    } finally {
      setSyncing(false);
    }
  }

  function matchesSearch(path: string) {
    if (!fileSearch.trim()) return true;
    return path.toLowerCase().includes(fileSearch.toLowerCase());
  }

  const filteredPaths = mdPaths.filter(matchesSearch);
  const allVisibleSelected =
    filteredPaths.length > 0 && filteredPaths.every((p) => selectedPaths.has(p));

  return (
    <div className="fixed inset-0 z-50 flex items-end justify-center sm:items-center">
      {/* Backdrop */}
      <div className="absolute inset-0 bg-black/50 backdrop-blur-sm" onClick={onClose} aria-hidden="true" />

      {/* Modal — bottom drawer on mobile, centered on desktop */}
      <div className="relative z-10 mx-0 sm:mx-4 w-full sm:max-w-lg max-h-[92vh] flex flex-col rounded-t-2xl sm:rounded-2xl border border-[#D1D1D6]/60 dark:border-[#38383A]/60 bg-white dark:bg-[#1C1C1E] shadow-2xl overflow-hidden">
        {/* Drag indicator on mobile */}
        <div className="flex justify-center pt-3 pb-1 sm:hidden shrink-0">
          <div className="w-9 h-1 rounded-full bg-[#D1D1D6] dark:bg-[#48484A]" />
        </div>

        {/* Header */}
        <div className="flex items-center justify-between px-5 py-4 shrink-0 border-b border-[#D1D1D6]/60 dark:border-[#38383A]/60">
          <div className="flex items-center gap-2">
            <Github className="h-4 w-4 text-[#8E8E93]" />
            <h2 className="font-semibold text-base">Importa da GitHub</h2>
          </div>
          <button
            onClick={onClose}
            className="rounded-xl p-1.5 text-[#8E8E93] hover:text-foreground hover:bg-gray-100 dark:hover:bg-[#2C2C2E] transition-colors"
            aria-label="Chiudi"
          >
            <X className="h-4 w-4" />
          </button>
        </div>

        {/* Body */}
        <div className="flex-1 overflow-y-auto px-5 py-4 space-y-4">
          {/* Repo selector */}
          <div>
            <label className="block text-xs font-medium text-[#8E8E93] uppercase tracking-wide mb-2">
              Repository
            </label>
            <select
              value={selectedRepo}
              onChange={(e) => handleRepoChange(e.target.value)}
              className="w-full h-9 rounded-xl border border-[#D1D1D6] dark:border-[#38383A] bg-gray-50 dark:bg-[#2C2C2E] px-3 text-sm text-foreground focus:outline-none focus:ring-1 focus:ring-[#007AFF]/40 transition-colors"
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
                className="mt-2 text-xs text-[#007AFF] hover:underline"
              >
                Carica file
              </button>
            )}
          </div>

          {/* Loading */}
          {loadingTree && (
            <div className="flex items-center gap-2 py-2">
              <Loader2 className="h-4 w-4 animate-spin text-[#8E8E93]" />
              <span className="text-sm text-[#8E8E93]">Caricamento file…</span>
            </div>
          )}

          {/* Error */}
          {treeError && (
            <p className="text-sm text-red-600 dark:text-red-400 bg-red-50 dark:bg-red-950/20 rounded-xl px-3 py-2">
              {treeError}
            </p>
          )}

          {/* File list */}
          {!loadingTree && mdPaths.length > 0 && (
            <div className="space-y-2">
              {/* File search */}
              <div className="relative">
                <Search className="absolute left-2.5 top-1/2 -translate-y-1/2 h-3.5 w-3.5 text-[#8E8E93]" />
                <input
                  type="text"
                  placeholder="Cerca file…"
                  value={fileSearch}
                  onChange={(e) => setFileSearch(e.target.value)}
                  className="h-9 w-full rounded-xl bg-gray-100 dark:bg-[#2C2C2E] pl-8 pr-3 text-sm text-foreground placeholder:text-[#8E8E93] border-none outline-none focus:ring-1 focus:ring-[#007AFF]/40 transition-colors"
                />
              </div>

              {/* Select all */}
              <div className="flex items-center justify-between">
                <span className="text-xs text-[#8E8E93]">
                  {filteredPaths.length} file trovati
                  {selectedPaths.size > 0 && ` · ${selectedPaths.size} selezionati`}
                </span>
                <button
                  onClick={() => toggleAll(!allVisibleSelected)}
                  className="text-xs text-[#007AFF] hover:underline"
                >
                  {allVisibleSelected ? "Deseleziona tutti" : "Seleziona tutti"}
                </button>
              </div>

              {/* File items */}
              <ul className="rounded-xl border border-[#D1D1D6]/60 dark:border-[#38383A]/60 divide-y divide-[#D1D1D6]/40 dark:divide-[#38383A]/40 max-h-52 overflow-y-auto">
                {filteredPaths.length === 0 ? (
                  <li className="px-4 py-3 text-sm text-[#8E8E93] text-center">
                    Nessun file trovato
                  </li>
                ) : (
                  filteredPaths.map((path) => {
                    const isSelected = selectedPaths.has(path);
                    return (
                      <li key={path}>
                        <label
                          className={`flex items-center gap-3 px-4 py-2.5 cursor-pointer transition-colors ${
                            isSelected
                              ? "bg-[#007AFF]/5 dark:bg-[#007AFF]/10"
                              : "hover:bg-gray-50 dark:hover:bg-[#2C2C2E]/50"
                          }`}
                        >
                          {getFileIcon(path)}
                          <div className="flex-1 min-w-0">
                            <p className="text-sm font-medium text-foreground truncate">
                              {getFileName(path)}
                            </p>
                            {getFilePath(path) && (
                              <p className="text-xs text-[#8E8E93] truncate font-mono">
                                {getFilePath(path)}
                              </p>
                            )}
                          </div>
                          <input
                            type="checkbox"
                            checked={isSelected}
                            onChange={() => togglePath(path)}
                            className="h-4 w-4 rounded border-[#D1D1D6] accent-[#007AFF] shrink-0"
                          />
                        </label>
                      </li>
                    );
                  })
                )}
              </ul>
            </div>
          )}

          {!loadingTree && mdPaths.length === 0 && !treeError && selectedRepo && (
            <p className="text-sm text-[#8E8E93] text-center py-4">
              Nessun file trovato nella repository.
            </p>
          )}

          {syncError && (
            <p className="text-sm text-red-600 dark:text-red-400 bg-red-50 dark:bg-red-950/20 rounded-xl px-3 py-2">
              {syncError}
            </p>
          )}
        </div>

        {/* Footer */}
        <div className="border-t border-[#D1D1D6]/60 dark:border-[#38383A]/60 px-5 py-4 shrink-0 flex gap-2 justify-end">
          <button
            onClick={onClose}
            disabled={syncing}
            className="rounded-xl border border-[#D1D1D6] dark:border-[#38383A] bg-transparent px-4 py-2 text-sm font-medium text-foreground hover:bg-gray-50 dark:hover:bg-[#2C2C2E] transition-colors disabled:opacity-50"
          >
            Annulla
          </button>
          <button
            onClick={() => void handleSync()}
            disabled={syncing || selectedPaths.size === 0}
            className="flex items-center gap-1.5 rounded-xl bg-[#007AFF] px-4 py-2 text-sm font-medium text-white hover:bg-[#007AFF]/90 transition-colors disabled:opacity-50"
          >
            {syncing ? (
              <>
                <Loader2 className="h-3.5 w-3.5 animate-spin" />
                Importando…
              </>
            ) : (
              `Importa${selectedPaths.size > 0 ? ` (${selectedPaths.size})` : ""}`
            )}
          </button>
        </div>
      </div>
    </div>
  );
}
