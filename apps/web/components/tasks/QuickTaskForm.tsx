"use client";

import { useState, useEffect, useRef, useCallback } from "react";
import { useRouter } from "next/navigation";
import type { Repository } from "@robin/shared-types";
import { Input } from "@/components/ui/input";

interface QuickTaskFormProps {
  repositories: Repository[];
}

export function QuickTaskForm({ repositories }: QuickTaskFormProps) {
  const [open, setOpen] = useState(false);
  const [title, setTitle] = useState("");
  const [repositoryId, setRepositoryId] = useState<string>(() => {
    if (typeof window !== "undefined") {
      return localStorage.getItem("lastUsedRepoId") ?? "";
    }
    return "";
  });
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const inputRef = useRef<HTMLInputElement>(null);
  const router = useRouter();

  // Global N shortcut
  useEffect(() => {
    function handleKeyDown(e: KeyboardEvent) {
      const target = e.target as HTMLElement;
      const inInput = target.tagName === "INPUT" || target.tagName === "TEXTAREA" || target.isContentEditable;
      if (e.key === "n" && !inInput && !e.metaKey && !e.ctrlKey && !open) {
        e.preventDefault();
        setOpen(true);
      }
      if (e.key === "Escape" && open) {
        setOpen(false);
      }
    }
    document.addEventListener("keydown", handleKeyDown);
    return () => document.removeEventListener("keydown", handleKeyDown);
  }, [open]);

  useEffect(() => {
    if (open) {
      setTimeout(() => inputRef.current?.focus(), 50);
    } else {
      setTitle("");
      setError(null);
    }
  }, [open]);

  const handleRepoChange = useCallback((id: string) => {
    setRepositoryId(id);
    if (typeof window !== "undefined") {
      localStorage.setItem("lastUsedRepoId", id);
    }
  }, []);

  async function handleCreate(andRefine = false) {
    if (!title.trim()) {
      setError("Il titolo è obbligatorio.");
      return;
    }
    setLoading(true);
    setError(null);

    try {
      const res = await fetch("/api/tasks", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          title: title.trim(),
          ...(repositoryId && { repository_id: repositoryId }),
        }),
      });

      if (!res.ok) {
        const body = await res.json().catch(() => ({}));
        setError(body.error ?? "Errore nella creazione.");
        return;
      }

      const { task } = await res.json();
      setOpen(false);

      if (andRefine) {
        router.push(`/tasks/${task.id}`);
      } else {
        router.refresh();
      }
    } finally {
      setLoading(false);
    }
  }

  const enabledRepos = repositories.filter((r) => r.is_enabled);

  if (!open) return null;

  return (
    <div
      className="fixed inset-0 z-50 flex items-start justify-center pt-[15vh]"
      onClick={(e) => e.target === e.currentTarget && setOpen(false)}
    >
      {/* Backdrop */}
      <div className="absolute inset-0 bg-background/80 backdrop-blur-sm" />

      <div className="relative z-10 w-full max-w-lg rounded-xl border border-border bg-popover shadow-2xl">
        <div className="p-5">
          <h2 className="mb-4 text-base font-semibold">Nuova task</h2>

          <Input
            ref={inputRef}
            value={title}
            onChange={(e) => setTitle(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === "Enter" && !e.shiftKey) { e.preventDefault(); void handleCreate(); }
            }}
            placeholder="Titolo della task..."
          />

          {enabledRepos.length > 0 && (
            <select
              value={repositoryId}
              onChange={(e) => handleRepoChange(e.target.value)}
              className="mt-3 w-full rounded-md border border-border bg-background px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-ring"
            >
              <option value="">Repository (opzionale)</option>
              {enabledRepos.map((r) => (
                <option key={r.id} value={r.id}>
                  {r.full_name}
                </option>
              ))}
            </select>
          )}

          {error && <p className="mt-2 text-xs text-destructive">{error}</p>}

          <div className="mt-4 flex items-center justify-between gap-2">
            <button
              type="button"
              onClick={() => setOpen(false)}
              className="text-sm text-muted-foreground hover:text-foreground"
            >
              Annulla
            </button>
            <div className="flex gap-2">
              <button
                type="button"
                onClick={() => void handleCreate(true)}
                disabled={loading}
                className="rounded-md border border-border px-3 py-1.5 text-sm hover:bg-accent disabled:opacity-50"
              >
                Crea e affina
              </button>
              <button
                type="button"
                onClick={() => void handleCreate()}
                disabled={loading}
                className="rounded-md bg-primary px-3 py-1.5 text-sm font-medium text-primary-foreground hover:bg-primary/90 disabled:opacity-50"
              >
                {loading ? "Creando..." : "Crea"}
              </button>
            </div>
          </div>
        </div>

        <div className="border-t border-border px-5 py-2">
          <p className="text-xs text-muted-foreground">
            <kbd className="rounded border border-border px-1 font-mono">Enter</kbd> per creare ·{" "}
            <kbd className="rounded border border-border px-1 font-mono">Esc</kbd> per chiudere
          </p>
        </div>
      </div>
    </div>
  );
}

/**
 * Thin component that mounts QuickTaskForm and registers the global N shortcut.
 * Include in the dashboard layout — receives repositories server-side.
 */
export function QuickTaskFormProvider({ repositories }: QuickTaskFormProps) {
  return <QuickTaskForm repositories={repositories} />;
}
