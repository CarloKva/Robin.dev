"use client";

import { useState } from "react";
import type { Repository, WorkspaceEnvironment } from "@robin/shared-types";
import { cn } from "@/lib/utils";
import { Input } from "@/components/ui/input";

interface CreateEnvironmentModalProps {
  repositories: Pick<Repository, "id" | "full_name" | "default_branch">[];
  onCreated: (env: WorkspaceEnvironment) => void;
  onClose: () => void;
}

export function CreateEnvironmentModal({
  repositories,
  onCreated,
  onClose,
}: CreateEnvironmentModalProps) {
  const [repositoryId, setRepositoryId] = useState(repositories[0]?.id ?? "");
  const [name, setName] = useState("");
  const [environmentType, setEnvironmentType] = useState<"staging" | "production">("staging");
  const [targetBranch, setTargetBranch] = useState("");
  const [autoMerge, setAutoMerge] = useState(false);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const autoMergeDisabled = targetBranch.trim() === "main";

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError(null);
    setSaving(true);

    try {
      const res = await fetch("/api/environments", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          repositoryId,
          name: name.trim(),
          environmentType,
          targetBranch: targetBranch.trim(),
          autoMerge: autoMergeDisabled ? false : autoMerge,
        }),
      });

      const data = (await res.json()) as { environment?: WorkspaceEnvironment; error?: string };

      if (!res.ok) {
        setError(data.error ?? "Creazione fallita");
        return;
      }

      onCreated(data.environment!);
      onClose();
    } catch {
      setError("Errore di rete — riprova");
    } finally {
      setSaving(false);
    }
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4">
      <div className="w-full max-w-md rounded-xl border border-border bg-card shadow-xl flex flex-col max-h-[90vh]">
        {/* Header */}
        <div className="flex shrink-0 items-center justify-between border-b border-border px-6 py-4">
          <h2 className="text-base font-semibold text-foreground">Nuovo ambiente</h2>
          <button
            onClick={onClose}
            className="rounded-md p-1.5 text-muted-foreground hover:bg-muted hover:text-foreground"
          >
            <svg className="h-4 w-4" viewBox="0 0 20 20" fill="currentColor">
              <path d="M6.28 5.22a.75.75 0 00-1.06 1.06L8.94 10l-3.72 3.72a.75.75 0 101.06 1.06L10 11.06l3.72 3.72a.75.75 0 101.06-1.06L11.06 10l3.72-3.72a.75.75 0 00-1.06-1.06L10 8.94 6.28 5.22z" />
            </svg>
          </button>
        </div>

        {/* Form */}
        <form onSubmit={handleSubmit} className="p-6 space-y-4 overflow-y-auto">
          {/* Repository */}
          <div className="space-y-1.5">
            <label className="text-sm font-medium text-foreground">Repository</label>
            <select
              value={repositoryId}
              onChange={(e) => setRepositoryId(e.target.value)}
              required
              className="w-full rounded-md border border-border bg-background px-3 py-2 text-sm text-foreground focus:outline-none focus:ring-2 focus:ring-ring"
            >
              {repositories.map((r) => (
                <option key={r.id} value={r.id}>
                  {r.full_name}
                </option>
              ))}
            </select>
          </div>

          {/* Name */}
          <div className="space-y-1.5">
            <label className="text-sm font-medium text-foreground">Nome</label>
            <Input
              type="text"
              placeholder="Staging"
              value={name}
              onChange={(e) => setName(e.target.value)}
              required
            />
          </div>

          {/* Type */}
          <div className="space-y-1.5">
            <label className="text-sm font-medium text-foreground">Tipo</label>
            <div className="grid grid-cols-2 gap-2">
              {(["staging", "production"] as const).map((t) => (
                <button
                  key={t}
                  type="button"
                  onClick={() => setEnvironmentType(t)}
                  className={cn(
                    "rounded-md border px-3 py-2 text-sm font-medium capitalize transition-colors",
                    environmentType === t
                      ? "border-foreground bg-foreground text-background"
                      : "border-border text-muted-foreground hover:border-foreground/50 hover:text-foreground"
                  )}
                >
                  {t}
                </button>
              ))}
            </div>
          </div>

          {/* Target branch */}
          <div className="space-y-1.5">
            <label className="text-sm font-medium text-foreground">Branch target</label>
            <Input
              type="text"
              placeholder="staging"
              value={targetBranch}
              onChange={(e) => setTargetBranch(e.target.value)}
              required
              className="font-mono"
            />
            <p className="text-xs text-muted-foreground">
              Branch Git di destinazione per le PR di questo ambiente.
            </p>
          </div>

          {/* Auto-merge */}
          <div className="flex items-start gap-3">
            <button
              type="button"
              role="switch"
              aria-checked={autoMerge}
              onClick={() => !autoMergeDisabled && setAutoMerge(!autoMerge)}
              disabled={autoMergeDisabled}
              className={cn(
                "mt-0.5 relative inline-flex h-5 w-9 shrink-0 rounded-full border-2 border-transparent transition-colors",
                "focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring",
                "disabled:cursor-not-allowed disabled:opacity-50",
                autoMerge && !autoMergeDisabled ? "bg-foreground" : "bg-muted"
              )}
            >
              <span
                className={cn(
                  "pointer-events-none block h-4 w-4 rounded-full bg-background shadow-lg transition-transform",
                  autoMerge && !autoMergeDisabled ? "translate-x-4" : "translate-x-0"
                )}
              />
            </button>
            <div>
              <p className="text-sm font-medium text-foreground">Auto-merge</p>
              {autoMergeDisabled ? (
                <p className="text-xs text-destructive">Non disponibile su main</p>
              ) : (
                <p className="text-xs text-muted-foreground">
                  Abilita auto-merge GitHub una volta superati i CI checks.
                </p>
              )}
            </div>
          </div>

          {error && (
            <p className="rounded-md border border-destructive/30 bg-destructive/10 px-3 py-2 text-sm text-destructive">
              {error}
            </p>
          )}

          {/* Footer */}
          <div className="flex justify-end gap-2 pt-2">
            <button
              type="button"
              onClick={onClose}
              className="rounded-md border border-border px-4 py-2 text-sm text-muted-foreground hover:bg-muted hover:text-foreground"
            >
              Annulla
            </button>
            <button
              type="submit"
              disabled={saving}
              className="rounded-md bg-foreground px-4 py-2 text-sm font-medium text-background hover:bg-foreground/90 disabled:opacity-50"
            >
              {saving ? "Creazione..." : "Crea"}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}
