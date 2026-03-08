"use client";

import { useState } from "react";
import { X, Search, FileCode, FileText, Code, Loader2, Github } from "lucide-react";
import { Button } from "@/components/ui/button";
import type { Repository } from "@robin/shared-types";

interface SyncFromGitHubModalProps {
  repositories: Repository[];
  onClose: () => void;
  onSynced: () => void;
}

function getFileIcon(path: string) {
  const ext = path.split(".").pop()?.toLowerCase();
  if (ext === "md" || ext === "mdx") return <FileCode className="h-4 w-4 shrink-0 text-muted-foreground" />;
  if (ext === "ts" || ext === "tsx" || ext === "js" || ext === "jsx") {
    return <Code className="h-4 w-4 shrink-0 text-muted-foreground" />;
  }
  return <FileText className="h-4 w-4 shrink-0 text-muted-foreground" />;
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
      <div className="absolute inset-0 bg-background/80 backdrop-blur-sm" onClick={onClose} aria-hidden="true" />

      {/* Modal — bottom drawer on mobile, centered on desktop */}
      <div className="relative z-10 mx-0 sm:mx-4 w-full sm:max-w-lg max-h-[92vh] flex flex-col rounded-t-xl sm:rounded-xl border border-border bg-background shadow-lg overflow-hidden">
        {/* Drag indicator on mobile */}
        <div className="flex justify-center pt-3 pb-1 sm:hidden shrink-0">
          <div className="w-9 h-1 rounded-full bg-border" />
        </div>

        {/* Header */}
        <div className="flex items-center justify-between px-6 py-4 shrink-0 border-b border-border">
          <div className="flex items-center gap-2">
            <Github className="h-4 w-4 text-muted-foreground" />
            <h2 className="font-semibold text-base text-foreground">Importa da GitHub</h2>
          </div>
          <Button
            variant="ghost"
            size="icon"
            className="w-7 h-7"
            onClick={onClose}
            aria-label="Chiudi"
          >
            <X className="h-4 w-4" />
          </Button>
        </div>

        {/* Body */}
        <div className="flex-1 overflow-y-auto px-6 py-4 space-y-4">
          {/* Repo selector */}
          <div>
            <label className="block text-xs font-medium text-muted-foreground uppercase tracking-wide mb-2">
              Repository
            </label>
            <select
              value={selectedRepo}
              onChange={(e) => handleRepoChange(e.target.value)}
              className="w-full h-9 rounded-md border border-border bg-background px-3 text-sm text-foreground focus:outline-none focus:ring-1 focus:ring-ring transition-colors"
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
                className="mt-2 text-xs text-primary hover:underline"
              >
                Carica file
              </button>
            )}
          </div>

          {/* Loading */}
          {loadingTree && (
            <div className="flex items-center gap-2 py-2">
              <Loader2 className="h-4 w-4 animate-spin text-muted-foreground" />
              <span className="text-sm text-muted-foreground">Caricamento file…</span>
            </div>
          )}

          {/* Error */}
          {treeError && (
            <p className="text-sm text-destructive">{treeError}</p>
          )}

          {/* File list */}
          {!loadingTree && mdPaths.length > 0 && (
            <div className="space-y-2">
              {/* File search */}
              <div className="relative">
                <Search className="absolute left-2.5 top-1/2 -translate-y-1/2 h-3.5 w-3.5 text-muted-foreground" />
                <input
                  type="text"
                  placeholder="Cerca file…"
                  value={fileSearch}
                  onChange={(e) => setFileSearch(e.target.value)}
                  className="h-9 w-full rounded-md bg-muted pl-8 pr-3 text-sm text-foreground placeholder:text-muted-foreground border-none outline-none focus:ring-1 focus:ring-ring transition-colors"
                />
              </div>

              {/* Select all */}
              <div className="flex items-center justify-between">
                <span className="text-xs text-muted-foreground">
                  {filteredPaths.length} file trovati
                  {selectedPaths.size > 0 && ` · ${selectedPaths.size} selezionati`}
                </span>
                <button
                  onClick={() => toggleAll(!allVisibleSelected)}
                  className="text-xs text-primary hover:underline"
                >
                  {allVisibleSelected ? "Deseleziona tutti" : "Seleziona tutti"}
                </button>
              </div>

              {/* File items */}
              <ul className="rounded-md border border-border divide-y divide-border max-h-52 overflow-y-auto">
                {filteredPaths.length === 0 ? (
                  <li className="px-4 py-3 text-sm text-muted-foreground text-center">
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
                              ? "bg-primary/5"
                              : "hover:bg-accent"
                          }`}
                        >
                          {getFileIcon(path)}
                          <div className="flex-1 min-w-0">
                            <p className="text-sm font-medium text-foreground truncate">
                              {getFileName(path)}
                            </p>
                            {getFilePath(path) && (
                              <p className="text-xs text-muted-foreground truncate font-mono">
                                {getFilePath(path)}
                              </p>
                            )}
                          </div>
                          <input
                            type="checkbox"
                            checked={isSelected}
                            onChange={() => togglePath(path)}
                            className="h-4 w-4 rounded border-border shrink-0"
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
            <p className="text-sm text-muted-foreground text-center py-4">
              Nessun file trovato nella repository.
            </p>
          )}

          {syncError && (
            <p className="text-sm text-destructive">{syncError}</p>
          )}
        </div>

        {/* Footer */}
        <div className="flex items-center justify-end gap-2 border-t border-border px-6 py-4 shrink-0">
          <Button variant="ghost" size="sm" onClick={onClose} disabled={syncing}>
            Annulla
          </Button>
          <Button
            size="sm"
            onClick={() => void handleSync()}
            disabled={syncing || selectedPaths.size === 0}
          >
            {syncing ? (
              <>
                <Loader2 className="h-3.5 w-3.5 animate-spin" />
                Importando…
              </>
            ) : (
              `Importa${selectedPaths.size > 0 ? ` (${selectedPaths.size})` : ""}`
            )}
          </Button>
        </div>
      </div>
    </div>
  );
}
