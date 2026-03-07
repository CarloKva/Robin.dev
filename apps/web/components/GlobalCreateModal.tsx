"use client";

import { useEffect, useState, useRef, useCallback } from "react";
import { useRouter } from "next/navigation";
import { useAuth } from "@clerk/nextjs";
import { createClient } from "@supabase/supabase-js";
import { AgentCreationForm } from "@/components/agents/AgentCreationForm";
import { ImageUploader } from "@/components/ImageUploader";
import { cn } from "@/lib/utils";
import type { Repository, Sprint, TaskAttachment } from "@robin/shared-types";

type Tab = "task" | "agent";

interface GlobalCreateModalProps {
  repositories: Repository[];
  hasGitHubConnection: boolean;
}

// ─── Task creation tab ─────────────────────────────────────────────────────

interface TaskFormState {
  title: string;
  description: string;
  type: string;
  priority: string;
  repositoryId: string;
  destination: "sprint" | "backlog";
  sprintId: string;
}

function TaskCreationTab({
  repositories,
  onClose,
}: {
  repositories: Repository[];
  onClose: () => void;
}) {
  const router = useRouter();
  const { getToken } = useAuth();
  const [sprints, setSprints] = useState<Sprint[]>([]);
  const [sprintsLoading, setSprintsLoading] = useState(true);
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [uploadError, setUploadError] = useState<string | null>(null);
  const [files, setFiles] = useState<File[]>([]);
  const titleRef = useRef<HTMLInputElement>(null);

  const enabledRepos = repositories.filter((r) => r.is_enabled);

  const [form, setForm] = useState<TaskFormState>(() => ({
    title: "",
    description: "",
    type: "feature",
    priority: "medium",
    repositoryId:
      typeof window !== "undefined"
        ? (localStorage.getItem("lastUsedRepoId") ?? (enabledRepos[0]?.id ?? ""))
        : (enabledRepos[0]?.id ?? ""),
    destination: "sprint",
    sprintId: "",
  }));

  // Load sprints
  useEffect(() => {
    let cancelled = false;
    setSprintsLoading(true);
    fetch("/api/sprints")
      .then((r) => r.json())
      .then((data: { sprints?: Sprint[] }) => {
        if (cancelled) return;
        const plannable = (data.sprints ?? []).filter(
          (s) => s.status === "planning" || s.status === "active"
        );
        setSprints(plannable);
        if (plannable.length > 0) {
          setForm((prev) => ({
            ...prev,
            destination: "sprint",
            sprintId: plannable[0]!.id,
          }));
        } else {
          setForm((prev) => ({ ...prev, destination: "backlog" }));
        }
      })
      .catch(() => {
        if (!cancelled) setForm((prev) => ({ ...prev, destination: "backlog" }));
      })
      .finally(() => {
        if (!cancelled) setSprintsLoading(false);
      });
    return () => { cancelled = true; };
  }, []);

  // Focus title on mount
  useEffect(() => {
    setTimeout(() => titleRef.current?.focus(), 50);
  }, []);

  const set = useCallback(<K extends keyof TaskFormState>(key: K, val: TaskFormState[K]) => {
    setForm((prev) => ({ ...prev, [key]: val }));
  }, []);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!form.title.trim()) { setError("Il titolo è obbligatorio."); return; }
    if (!form.repositoryId) { setError("Seleziona un repository."); return; }

    setSubmitting(true);
    setError(null);
    setUploadError(null);

    const payload: Record<string, unknown> = {
      title: form.title.trim(),
      description: form.description.trim() || "",
      type: form.type,
      priority: form.priority,
      repository_id: form.repositoryId,
    };

    if (form.destination === "sprint" && form.sprintId) {
      payload["sprint_id"] = form.sprintId;
    }

    if (typeof window !== "undefined" && form.repositoryId) {
      localStorage.setItem("lastUsedRepoId", form.repositoryId);
    }

    try {
      // Step 1: Create the task
      const res = await fetch("/api/tasks", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload),
      });
      if (!res.ok) {
        const body = await res.json().catch(() => ({})) as { error?: string };
        setError(body.error ?? "Errore nella creazione della task.");
        return;
      }

      const { task } = await res.json() as { task: { id: string; workspace_id: string } };

      // Step 2: Upload files to Supabase Storage (if any)
      if (files.length > 0) {
        try {
          const token = await getToken({ template: "supabase" });
          const supabase = createClient(
            process.env["NEXT_PUBLIC_SUPABASE_URL"]!,
            process.env["NEXT_PUBLIC_SUPABASE_ANON_KEY"]!,
            token ? { global: { headers: { Authorization: `Bearer ${token}` } } } : {}
          );

          const attachments: TaskAttachment[] = [];

          for (const file of files) {
            const storagePath = `${task.workspace_id}/${task.id}/${file.name}`;
            const { error: uploadErr } = await supabase.storage
              .from("task-attachments")
              .upload(storagePath, file);

            if (uploadErr) {
              console.error("[GlobalCreateModal] storage upload error:", uploadErr.message);
              setUploadError(`Errore caricamento allegati: ${uploadErr.message}`);
              break;
            }

            attachments.push({
              name: file.name,
              storage_path: storagePath,
              mime_type: file.type,
            });
          }

          // Step 3: Update task with attachment metadata (only if any succeeded)
          if (attachments.length > 0) {
            await fetch(`/api/tasks/${task.id}`, {
              method: "PATCH",
              headers: { "Content-Type": "application/json" },
              body: JSON.stringify({ attachments }),
            });
          }
        } catch (uploadEx) {
          console.error("[GlobalCreateModal] upload exception:", uploadEx);
          setUploadError("Errore durante il caricamento degli allegati.");
        }
      }

      onClose();
      router.refresh();
    } catch {
      setError("Errore di rete.");
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <form onSubmit={handleSubmit} className="space-y-4">
      {/* Title */}
      <div className="space-y-1.5">
        <label className="text-sm font-medium" htmlFor="ct-title">
          Titolo <span className="text-destructive">*</span>
        </label>
        <input
          ref={titleRef}
          id="ct-title"
          value={form.title}
          onChange={(e) => set("title", e.target.value)}
          placeholder="es. Aggiungere autenticazione OAuth"
          maxLength={200}
          disabled={submitting}
          className="w-full rounded-lg border border-border bg-background px-3 py-2 text-sm placeholder:text-muted-foreground focus:outline-none focus:ring-2 focus:ring-primary/30 focus:border-primary disabled:opacity-50"
        />
      </div>

      {/* Description */}
      <div className="space-y-1.5">
        <label className="text-sm font-medium" htmlFor="ct-desc">
          Descrizione <span className="text-xs font-normal text-muted-foreground">(opzionale)</span>
        </label>
        <textarea
          id="ct-desc"
          value={form.description}
          onChange={(e) => set("description", e.target.value)}
          placeholder="Contesto, criteri di accettazione..."
          rows={3}
          maxLength={5000}
          disabled={submitting}
          className="w-full resize-none rounded-lg border border-border bg-background px-3 py-2 text-sm placeholder:text-muted-foreground focus:outline-none focus:ring-2 focus:ring-primary/30 focus:border-primary disabled:opacity-50"
        />
      </div>

      {/* Image attachments */}
      <div className="space-y-1.5">
        <label className="text-sm font-medium">
          Allegati <span className="text-xs font-normal text-muted-foreground">(opzionale)</span>
        </label>
        <ImageUploader files={files} onChange={setFiles} disabled={submitting} />
        {uploadError !== null && (
          <p className="text-xs text-destructive">{uploadError}</p>
        )}
      </div>

      {/* Type + Priority */}
      <div className="grid grid-cols-2 gap-3">
        <div className="space-y-1.5">
          <label className="text-sm font-medium" htmlFor="ct-type">Tipo</label>
          <select
            id="ct-type"
            value={form.type}
            onChange={(e) => set("type", e.target.value)}
            disabled={submitting}
            className="w-full rounded-lg border border-border bg-background px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-primary/30 focus:border-primary disabled:opacity-50"
          >
            <option value="feature">Feature</option>
            <option value="bug">Bug</option>
            <option value="refactor">Refactor</option>
            <option value="docs">Docs</option>
            <option value="chore">Chore</option>
            <option value="accessibility">Accessibility</option>
            <option value="security">Security</option>
          </select>
        </div>
        <div className="space-y-1.5">
          <label className="text-sm font-medium" htmlFor="ct-priority">Priorità</label>
          <select
            id="ct-priority"
            value={form.priority}
            onChange={(e) => set("priority", e.target.value)}
            disabled={submitting}
            className="w-full rounded-lg border border-border bg-background px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-primary/30 focus:border-primary disabled:opacity-50"
          >
            <option value="low">Low</option>
            <option value="medium">Medium</option>
            <option value="high">High</option>
            <option value="urgent">Urgent</option>
            <option value="critical">Critical</option>
          </select>
        </div>
      </div>

      {/* Repository */}
      {enabledRepos.length > 0 && (
        <div className="space-y-1.5">
          <label className="text-sm font-medium" htmlFor="ct-repo">
            Repository <span className="text-destructive">*</span>
          </label>
          <select
            id="ct-repo"
            value={form.repositoryId}
            onChange={(e) => set("repositoryId", e.target.value)}
            disabled={submitting}
            className="w-full rounded-lg border border-border bg-background px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-primary/30 focus:border-primary disabled:opacity-50"
          >
            <option value="">Seleziona repository…</option>
            {enabledRepos.map((r) => (
              <option key={r.id} value={r.id}>
                {r.full_name}
              </option>
            ))}
          </select>
        </div>
      )}

      {/* Destination: sprint or backlog */}
      <div className="space-y-2">
        <span className="text-sm font-medium">Destinazione</span>
        <div className="flex gap-2">
          <button
            type="button"
            onClick={() => set("destination", "backlog")}
            disabled={submitting}
            className={cn(
              "flex-1 rounded-lg border px-3 py-2 text-sm font-medium transition-colors",
              form.destination === "backlog"
                ? "border-primary bg-primary/10 text-primary"
                : "border-border text-muted-foreground hover:bg-muted hover:text-foreground"
            )}
          >
            Backlog
          </button>
          <button
            type="button"
            onClick={() => {
              set("destination", "sprint");
              if (!form.sprintId && sprints.length > 0) {
                set("sprintId", sprints[0]!.id);
              }
            }}
            disabled={submitting || sprintsLoading}
            className={cn(
              "flex-1 rounded-lg border px-3 py-2 text-sm font-medium transition-colors",
              form.destination === "sprint"
                ? "border-primary bg-primary/10 text-primary"
                : "border-border text-muted-foreground hover:bg-muted hover:text-foreground"
            )}
          >
            Sprint
          </button>
        </div>

        {form.destination === "sprint" && (
          <div className="mt-2">
            {sprintsLoading ? (
              <p className="text-xs text-muted-foreground">Caricamento sprint…</p>
            ) : sprints.length === 0 ? (
              <p className="rounded-lg border border-dashed border-border px-3 py-2.5 text-xs text-muted-foreground">
                Nessun sprint attivo o in pianificazione.{" "}
                <button
                  type="button"
                  className="underline hover:text-foreground"
                  onClick={() => set("destination", "backlog")}
                >
                  Aggiungi al backlog
                </button>
              </p>
            ) : (
              <div className="space-y-1 rounded-lg border border-border p-1.5">
                {sprints.map((s) => (
                  <label
                    key={s.id}
                    className={cn(
                      "flex cursor-pointer items-center gap-3 rounded-md px-3 py-2 text-sm transition-colors",
                      form.sprintId === s.id
                        ? "bg-primary/10 text-foreground"
                        : "text-muted-foreground hover:bg-muted/60 hover:text-foreground"
                    )}
                  >
                    <span
                      className={cn(
                        "flex h-4 w-4 shrink-0 items-center justify-center rounded-full border transition-colors",
                        form.sprintId === s.id
                          ? "border-primary bg-primary"
                          : "border-border"
                      )}
                    >
                      {form.sprintId === s.id && (
                        <span className="h-1.5 w-1.5 rounded-full bg-primary-foreground" />
                      )}
                    </span>
                    <input
                      type="radio"
                      name="sprint"
                      value={s.id}
                      checked={form.sprintId === s.id}
                      onChange={() => set("sprintId", s.id)}
                      disabled={submitting}
                      className="sr-only"
                    />
                    <span className="min-w-0 flex-1 truncate font-medium">{s.name}</span>
                    <span
                      className={cn(
                        "shrink-0 rounded px-1.5 py-0.5 text-[10px] font-medium leading-none",
                        s.status === "active"
                          ? "bg-emerald-100 text-emerald-700 dark:bg-emerald-950 dark:text-emerald-400"
                          : "bg-blue-100 text-blue-700 dark:bg-blue-950 dark:text-blue-400"
                      )}
                    >
                      {s.status === "active" ? "attivo" : "planning"}
                    </span>
                  </label>
                ))}
              </div>
            )}
          </div>
        )}
      </div>

      {error && <p className="text-xs text-destructive">{error}</p>}

      <div className="flex items-center justify-end gap-3 pt-1">
        <button
          type="button"
          onClick={onClose}
          disabled={submitting}
          className="rounded-lg border border-border px-4 py-2 text-sm font-medium text-muted-foreground transition-colors hover:bg-muted hover:text-foreground disabled:opacity-50"
        >
          Annulla
        </button>
        <button
          type="submit"
          disabled={submitting || !form.title.trim() || !form.repositoryId}
          className="rounded-lg bg-primary px-4 py-2 text-sm font-semibold text-primary-foreground transition-colors hover:bg-primary/90 disabled:cursor-not-allowed disabled:opacity-50"
        >
          {submitting ? "Creando…" : "Crea task"}
        </button>
      </div>
    </form>
  );
}

// ─── Main modal ────────────────────────────────────────────────────────────

export function GlobalCreateModal({ repositories, hasGitHubConnection }: GlobalCreateModalProps) {
  const [open, setOpen] = useState(false);
  const [activeTab, setActiveTab] = useState<Tab>("task");

  useEffect(() => {
    function handler(e: Event) {
      const detail = (e as CustomEvent<{ tab?: Tab }>).detail;
      setActiveTab(detail?.tab ?? "task");
      setOpen(true);
    }
    document.addEventListener("open-create-modal", handler);
    return () => document.removeEventListener("open-create-modal", handler);
  }, []);

  // Esc to close
  useEffect(() => {
    function onKey(e: KeyboardEvent) {
      if (e.key === "Escape" && open) setOpen(false);
    }
    document.addEventListener("keydown", onKey);
    return () => document.removeEventListener("keydown", onKey);
  }, [open]);

  if (!open) return null;

  const tabs: { id: Tab; label: string }[] = [
    { id: "task", label: "Task" },
    { id: "agent", label: "Agente" },
  ];

  return (
    <div
      className="fixed inset-0 z-50 flex items-start justify-center pt-[10vh]"
      onClick={(e) => e.target === e.currentTarget && setOpen(false)}
    >
      {/* Backdrop */}
      <div className="absolute inset-0 bg-background/80 backdrop-blur-sm" />

      <div className="relative z-10 w-full max-w-lg rounded-xl border border-border bg-white shadow-2xl">
        {/* Header */}
        <div className="flex items-center justify-between border-b border-border px-5 pt-4 pb-0">
          <div className="flex gap-0">
            {tabs.map((tab) => (
              <button
                key={tab.id}
                type="button"
                onClick={() => setActiveTab(tab.id)}
                className={cn(
                  "relative px-4 pb-3 pt-1 text-sm font-medium transition-colors",
                  activeTab === tab.id
                    ? "text-foreground after:absolute after:bottom-0 after:left-0 after:right-0 after:h-0.5 after:bg-primary after:rounded-t"
                    : "text-muted-foreground hover:text-foreground"
                )}
              >
                {tab.label}
              </button>
            ))}
          </div>
          <button
            type="button"
            onClick={() => setOpen(false)}
            className="mb-3 rounded-md p-1 text-muted-foreground transition-colors hover:bg-muted hover:text-foreground"
            aria-label="Chiudi"
          >
            <svg width="16" height="16" viewBox="0 0 16 16" fill="none" aria-hidden="true">
              <path
                d="M12 4L4 12M4 4L12 12"
                stroke="currentColor"
                strokeWidth="1.5"
                strokeLinecap="round"
              />
            </svg>
          </button>
        </div>

        {/* Body */}
        <div className="p-5">
          {activeTab === "task" ? (
            <TaskCreationTab repositories={repositories} onClose={() => setOpen(false)} />
          ) : (
            <AgentCreationForm
              repositories={repositories}
              hasGitHubConnection={hasGitHubConnection}
              onClose={() => setOpen(false)}
            />
          )}
        </div>

        {/* Footer hint */}
        <div className="border-t border-border px-5 py-2">
          <p className="text-xs text-muted-foreground">
            <kbd className="rounded border border-border px-1 font-mono">Esc</kbd> per chiudere
          </p>
        </div>
      </div>
    </div>
  );
}
