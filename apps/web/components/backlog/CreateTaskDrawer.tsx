"use client";

import { useEffect, useRef, useCallback, useState } from "react";
import { X, ChevronDown } from "lucide-react";
import { useRouter } from "next/navigation";
import { useForm, Controller } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";
import {
  descriptionQualityScore,
  qualitySuggestions,
  type QualityScore,
} from "@/lib/tasks/descriptionQuality";
import { CustomSelect } from "@/components/ui/CustomSelect";
import type { TaskType, Repository, ContextDocument } from "@robin/shared-types";

// ─── Schema ─────────────────────────────────────────────────────────────────

const schema = z.object({
  title: z
    .string()
    .min(5, "Il titolo deve avere almeno 5 caratteri")
    .max(200, "Titolo troppo lungo"),
  description: z
    .string()
    .min(20, "La descrizione deve avere almeno 20 caratteri")
    .max(5000, "Descrizione troppo lunga"),
  type: z.enum(["bug", "feature", "docs", "refactor", "chore", "accessibility", "security"]),
  priority: z.enum(["low", "medium", "high", "urgent", "critical"]),
  repository_id: z.string().uuid("Seleziona una repository"),
  agent_id: z.string().optional(),
  estimated_effort: z.union([z.literal(""), z.enum(["xs", "s", "m", "l"])]).optional(),
  context: z.string().max(5000, "Contesto troppo lungo").optional(),
});

type FormValues = z.infer<typeof schema>;

// ─── Helpers ─────────────────────────────────────────────────────────────────

function FieldLabel({ htmlFor, children }: { htmlFor: string; children: React.ReactNode }) {
  return (
    <label htmlFor={htmlFor} className="block text-sm font-medium text-foreground">
      {children}
    </label>
  );
}

function FieldError({ message }: { message: string | undefined }) {
  if (!message) return null;
  return <p className="mt-1 text-xs text-red-600 dark:text-red-400">{message}</p>;
}

const inputClass =
  "w-full rounded-md border border-input bg-background px-3 py-2 text-sm shadow-sm placeholder:text-muted-foreground focus:outline-none focus:ring-2 focus:ring-ring disabled:opacity-50";

function DescriptionQualityBar({
  score,
  type,
}: {
  score: QualityScore | null;
  type: TaskType;
}) {
  if (!score) return null;

  const config: Record<QualityScore, { label: string; color: string; bg: string; bar: number }> = {
    poor: { label: "Descrizione debole", color: "text-red-600", bg: "bg-red-500", bar: 25 },
    fair: { label: "Descrizione discreta", color: "text-amber-600", bg: "bg-amber-500", bar: 60 },
    good: { label: "Descrizione ottima", color: "text-emerald-600", bg: "bg-emerald-500", bar: 100 },
  };

  const { label, color, bg, bar } = config[score];

  return (
    <div className="mt-2 space-y-1.5">
      <div className="flex items-center gap-2">
        <div className="h-1.5 flex-1 overflow-hidden rounded-full bg-muted">
          <div
            className={`h-full rounded-full transition-all duration-500 ${bg}`}
            style={{ width: `${bar}%` }}
          />
        </div>
        <span className={`text-xs font-medium ${color}`}>{label}</span>
      </div>
      {score !== "good" && (
        <p className="text-xs text-muted-foreground">{qualitySuggestions[type]}</p>
      )}
    </div>
  );
}

// ─── Context docs multiselect ─────────────────────────────────────────────

interface ContextDocMultiSelectProps {
  docs: ContextDocument[];
  selectedIds: string[];
  onChange: (ids: string[]) => void;
  disabled?: boolean;
}

function ContextDocMultiSelect({ docs, selectedIds, onChange, disabled }: ContextDocMultiSelectProps) {
  const [open, setOpen] = useState(false);
  const ref = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!open) return;
    function handleOutside(e: MouseEvent) {
      if (ref.current && !ref.current.contains(e.target as Node)) {
        setOpen(false);
      }
    }
    document.addEventListener("mousedown", handleOutside);
    return () => document.removeEventListener("mousedown", handleOutside);
  }, [open]);

  function toggle(id: string) {
    if (selectedIds.includes(id)) {
      onChange(selectedIds.filter((x) => x !== id));
    } else {
      onChange([...selectedIds, id]);
    }
  }

  const selectedDocs = docs.filter((d) => selectedIds.includes(d.id));

  if (docs.length === 0) return null;

  return (
    <div ref={ref} className="relative">
      <button
        type="button"
        onClick={() => !disabled && setOpen((p) => !p)}
        disabled={disabled}
        className="w-full flex items-center justify-between gap-2 rounded-md border border-input bg-white px-3 py-2 text-sm shadow-sm text-left focus:outline-none focus:ring-2 focus:ring-ring disabled:opacity-50"
      >
        <span className="text-muted-foreground truncate">
          {selectedDocs.length === 0
            ? "Seleziona documenti..."
            : selectedDocs.map((d) => d.title).join(", ")}
        </span>
        <ChevronDown
          className={`h-4 w-4 text-muted-foreground shrink-0 transition-transform duration-150 ${open ? "rotate-180" : ""}`}
        />
      </button>

      {open && (
        <ul className="absolute z-50 mt-1 w-full overflow-auto rounded-md border border-border bg-white shadow-lg max-h-52 py-1">
          {docs.map((doc) => {
            const checked = selectedIds.includes(doc.id);
            return (
              <li
                key={doc.id}
                onClick={() => toggle(doc.id)}
                className="flex items-center gap-3 px-3 py-2 text-sm cursor-pointer hover:bg-accent/60 select-none"
              >
                <span
                  className={`h-4 w-4 shrink-0 rounded border flex items-center justify-center transition-colors ${
                    checked ? "bg-primary border-primary" : "border-input bg-background"
                  }`}
                >
                  {checked && (
                    <svg viewBox="0 0 12 12" className="h-3 w-3 text-primary-foreground fill-current">
                      <path d="M2 6l3 3 5-5" stroke="currentColor" strokeWidth="1.5" fill="none" strokeLinecap="round" strokeLinejoin="round" />
                    </svg>
                  )}
                </span>
                <span className="truncate">{doc.title}</span>
              </li>
            );
          })}
        </ul>
      )}

      {/* Selected chips */}
      {selectedDocs.length > 0 && (
        <div className="mt-2 flex flex-wrap gap-1.5">
          {selectedDocs.map((doc) => (
            <span
              key={doc.id}
              className="inline-flex items-center gap-1 rounded-full bg-primary/10 px-2.5 py-0.5 text-xs font-medium text-primary"
            >
              {doc.title}
              <button
                type="button"
                onClick={() => toggle(doc.id)}
                className="ml-0.5 hover:text-primary/70 transition-colors"
                aria-label={`Rimuovi ${doc.title}`}
              >
                <X className="h-3 w-3" />
              </button>
            </span>
          ))}
        </div>
      )}
    </div>
  );
}

// ─── Props ───────────────────────────────────────────────────────────────────

interface Agent {
  id: string;
  name: string;
}

interface CreateTaskDrawerProps {
  isOpen: boolean;
  onClose: () => void;
  onCreated: () => void;
  repositories: Repository[];
  agents?: Agent[];
  contextDocs?: ContextDocument[];
}

// ─── Component ───────────────────────────────────────────────────────────────

export function CreateTaskDrawer({
  isOpen,
  onClose,
  onCreated,
  repositories,
  agents = [],
  contextDocs = [],
}: CreateTaskDrawerProps) {
  const router = useRouter();
  const [serverError, setServerError] = useState<string | null>(null);
  const [selectedDocIds, setSelectedDocIds] = useState<string[]>([]);
  const titleRef = useRef<HTMLInputElement | null>(null);

  const {
    register,
    handleSubmit,
    watch,
    reset,
    control,
    formState: { errors, isSubmitting },
  } = useForm<FormValues>({
    resolver: zodResolver(schema),
    defaultValues: {
      type: "feature",
      priority: "medium",
      repository_id: repositories[0]?.id ?? "",
      agent_id: "",
      estimated_effort: "",
      context: "",
    },
  });

  const watchedDescription = watch("description") ?? "";
  const watchedType = (watch("type") ?? "feature") as TaskType;
  const qualityScore: QualityScore | null =
    watchedDescription.length > 0
      ? descriptionQualityScore(watchedDescription, watchedType)
      : null;

  useEffect(() => {
    if (isOpen) {
      setTimeout(() => titleRef.current?.focus(), 50);
    }
  }, [isOpen]);

  useEffect(() => {
    if (!isOpen) return;
    function handler(e: KeyboardEvent) {
      if (e.key === "Escape") {
        e.preventDefault();
        onClose();
      }
    }
    window.addEventListener("keydown", handler);
    return () => window.removeEventListener("keydown", handler);
  }, [isOpen, onClose]);

  useEffect(() => {
    if (!isOpen) {
      reset({
        type: "feature",
        priority: "medium",
        repository_id: repositories[0]?.id ?? "",
        agent_id: "",
        estimated_effort: "",
        context: "",
      });
      setSelectedDocIds([]);
      setServerError(null);
    }
  }, [isOpen, reset, repositories]);

  const handleClose = useCallback(() => {
    if (!isSubmitting) onClose();
  }, [isSubmitting, onClose]);

  const { ref: titleRegisterRef, ...titleRegisterRest } = register("title");

  const onSubmit = async (data: FormValues) => {
    setServerError(null);
    try {
      // Build context: merge user text + referenced doc IDs
      let finalContext = data.context ?? "";
      if (selectedDocIds.length > 0) {
        const docsSection = selectedDocIds
          .map((id) => {
            const doc = contextDocs.find((d) => d.id === id);
            return doc ? `- ${doc.title} (id: ${id})` : `- ${id}`;
          })
          .join("\n");
        finalContext = finalContext
          ? `${finalContext}\n\n--- Documenti di contesto allegati ---\n${docsSection}`
          : `--- Documenti di contesto allegati ---\n${docsSection}`;
      }

      const body = {
        title: data.title,
        description: data.description,
        type: data.type,
        priority: data.priority,
        repository_id: data.repository_id,
        estimated_effort: data.estimated_effort || undefined,
        context: finalContext || undefined,
        ...(data.agent_id ? { preferred_agent_id: data.agent_id } : {}),
      };

      const res = await fetch("/api/tasks", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(body),
      });

      if (!res.ok) {
        const json = await res.json().catch(() => ({}));
        setServerError(
          (json as { error?: string }).error ?? "Errore durante la creazione della task."
        );
        return;
      }

      onCreated();
      onClose();
      router.refresh();
    } catch {
      setServerError("Errore di rete. Riprova tra un momento.");
    }
  };

  // ── Options for CustomSelect ───────────────────────────────────────────────

  const repoOptions = repositories.map((r) => ({ value: r.id, label: r.full_name }));

  const typeOptions = [
    { value: "bug", label: "Bug" },
    { value: "feature", label: "Feature" },
    { value: "docs", label: "Docs" },
    { value: "refactor", label: "Refactor" },
    { value: "chore", label: "Chore" },
    { value: "accessibility", label: "Accessibility" },
    { value: "security", label: "Security" },
  ];

  const priorityOptions = [
    { value: "low", label: "Bassa" },
    { value: "medium", label: "Media" },
    { value: "high", label: "Alta" },
    { value: "urgent", label: "Urgente" },
    { value: "critical", label: "Critica" },
  ];

  const effortOptions = [
    { value: "", label: "— Non specificato —" },
    { value: "xs", label: "XS — Meno di 1 ora" },
    { value: "s", label: "S — Poche ore" },
    { value: "m", label: "M — Mezzo giorno / 1 giorno" },
    { value: "l", label: "L — Più giorni" },
  ];

  const agentOptions = [
    { value: "", label: "— Auto-assegna —" },
    ...agents.map((a) => ({ value: a.id, label: a.name })),
  ];

  return (
    <>
      {/* Backdrop */}
      <div
        aria-hidden="true"
        onClick={handleClose}
        className={[
          "fixed inset-0 z-40 bg-black/40 transition-opacity duration-300",
          isOpen ? "opacity-100 pointer-events-auto" : "opacity-0 pointer-events-none",
        ].join(" ")}
      />

      {/* Drawer panel */}
      <div
        role="dialog"
        aria-modal="true"
        aria-label="Crea nuova task"
        className={[
          "fixed inset-y-0 right-0 z-50 flex w-full flex-col bg-white shadow-2xl transition-transform duration-300 ease-in-out sm:w-[520px] sm:border-l sm:border-border",
          isOpen ? "translate-x-0" : "translate-x-full",
        ].join(" ")}
      >
        {/* Header */}
        <div className="flex shrink-0 items-center justify-between border-b border-border px-5 py-4">
          <div>
            <h2 className="font-semibold text-base text-foreground">Crea task</h2>
            <p className="mt-0.5 text-xs text-muted-foreground">
              La task verrà aggiunta al backlog.
            </p>
          </div>
          <button
            type="button"
            onClick={handleClose}
            disabled={isSubmitting}
            className="rounded-md p-1.5 text-muted-foreground transition-colors hover:bg-accent hover:text-foreground disabled:opacity-50"
            aria-label="Chiudi"
          >
            <X className="h-4 w-4" />
          </button>
        </div>

        {/* Scrollable body */}
        <div className="flex-1 overflow-y-auto px-5 py-5">
          <form
            id="create-task-drawer-form"
            onSubmit={handleSubmit(onSubmit)}
            noValidate
            className="space-y-5"
          >
            {/* Title */}
            <div>
              <FieldLabel htmlFor="drawer-task-title">Titolo *</FieldLabel>
              <input
                id="drawer-task-title"
                type="text"
                placeholder="es. Fix: login button non risponde su mobile"
                className={`mt-1 ${inputClass}`}
                {...titleRegisterRest}
                ref={(el) => {
                  titleRegisterRef(el);
                  (titleRef as React.MutableRefObject<HTMLInputElement | null>).current = el;
                }}
                disabled={isSubmitting}
              />
              <FieldError message={errors.title?.message} />
            </div>

            {/* Repository */}
            <div>
              <FieldLabel htmlFor="drawer-task-repo">Repository *</FieldLabel>
              {repositories.length === 0 ? (
                <p className="mt-1.5 text-xs text-amber-600 dark:text-amber-400">
                  Nessuna repository collegata.{" "}
                  <a href="/settings" className="underline hover:no-underline">
                    Collegane una in Settings.
                  </a>
                </p>
              ) : (
                <Controller
                  name="repository_id"
                  control={control}
                  render={({ field }) => (
                    <CustomSelect
                      value={field.value}
                      onChange={field.onChange}
                      options={repoOptions}
                      placeholder="Seleziona repository"
                      disabled={isSubmitting}
                      className="mt-1"
                    />
                  )}
                />
              )}
              <FieldError message={errors.repository_id?.message} />
            </div>

            {/* Type + Priority row */}
            <div className="grid grid-cols-2 gap-4">
              <div>
                <FieldLabel htmlFor="drawer-task-type">Tipo</FieldLabel>
                <Controller
                  name="type"
                  control={control}
                  render={({ field }) => (
                    <CustomSelect
                      value={field.value}
                      onChange={field.onChange}
                      options={typeOptions}
                      disabled={isSubmitting}
                      className="mt-1"
                    />
                  )}
                />
                <FieldError message={errors.type?.message} />
              </div>

              <div>
                <FieldLabel htmlFor="drawer-task-priority">Priorità</FieldLabel>
                <Controller
                  name="priority"
                  control={control}
                  render={({ field }) => (
                    <CustomSelect
                      value={field.value}
                      onChange={field.onChange}
                      options={priorityOptions}
                      disabled={isSubmitting}
                      className="mt-1"
                    />
                  )}
                />
                <FieldError message={errors.priority?.message} />
              </div>
            </div>

            {/* Effort + Agent row */}
            <div className="grid grid-cols-2 gap-4">
              <div>
                <FieldLabel htmlFor="drawer-task-effort">Effort stimato</FieldLabel>
                <Controller
                  name="estimated_effort"
                  control={control}
                  render={({ field }) => (
                    <CustomSelect
                      value={field.value ?? ""}
                      onChange={field.onChange}
                      options={effortOptions}
                      disabled={isSubmitting}
                      className="mt-1"
                    />
                  )}
                />
                <FieldError message={errors.estimated_effort?.message} />
              </div>

              {agents.length > 0 && (
                <div>
                  <FieldLabel htmlFor="drawer-task-agent">Agente</FieldLabel>
                  <Controller
                    name="agent_id"
                    control={control}
                    render={({ field }) => (
                      <CustomSelect
                        value={field.value ?? ""}
                        onChange={field.onChange}
                        options={agentOptions}
                        disabled={isSubmitting}
                        className="mt-1"
                      />
                    )}
                  />
                </div>
              )}
            </div>

            {/* Description */}
            <div>
              <div className="flex items-center justify-between">
                <FieldLabel htmlFor="drawer-task-description">Descrizione *</FieldLabel>
                <span className="text-xs text-muted-foreground">min. 20 caratteri</span>
              </div>
              <textarea
                id="drawer-task-description"
                rows={7}
                placeholder="Descrivi il problema o la feature in modo dettagliato…"
                className={`mt-1 resize-y ${inputClass}`}
                {...register("description")}
                disabled={isSubmitting}
              />
              <DescriptionQualityBar score={qualityScore} type={watchedType} />
              <FieldError message={errors.description?.message} />
            </div>

            {/* Context */}
            <div>
              <FieldLabel htmlFor="drawer-task-context">Contesto aggiuntivo</FieldLabel>
              <textarea
                id="drawer-task-context"
                rows={3}
                placeholder="Link di riferimento, dettagli tecnici, dipendenze, note per l'agente…"
                className={`mt-1 resize-y ${inputClass}`}
                {...register("context")}
                disabled={isSubmitting}
              />

              {/* Context docs multiselect */}
              {contextDocs.length > 0 && (
                <div className="mt-2">
                  <p className="mb-1.5 text-xs text-muted-foreground font-medium">
                    Documenti di contesto da allegare
                  </p>
                  <ContextDocMultiSelect
                    docs={contextDocs}
                    selectedIds={selectedDocIds}
                    onChange={setSelectedDocIds}
                    disabled={isSubmitting}
                  />
                </div>
              )}

              <p className="mt-2 text-xs text-muted-foreground">
                Opzionale — usato dall&apos;agente come contesto aggiuntivo.
              </p>
              <FieldError message={errors.context?.message} />
            </div>

            {/* Server error */}
            {serverError && (
              <div className="rounded-md border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700 dark:border-red-800 dark:bg-red-950 dark:text-red-400">
                {serverError}
              </div>
            )}
          </form>
        </div>

        {/* Footer */}
        <div className="shrink-0 border-t border-border px-5 py-4">
          <div className="flex items-center gap-3">
            <button
              type="submit"
              form="create-task-drawer-form"
              disabled={isSubmitting || repositories.length === 0}
              className="rounded-md bg-primary px-5 py-2 text-sm font-semibold text-primary-foreground shadow-sm transition-colors hover:bg-primary/90 focus:outline-none focus:ring-2 focus:ring-ring focus:ring-offset-2 disabled:cursor-not-allowed disabled:opacity-50"
            >
              {isSubmitting ? "Creazione…" : "Crea task"}
            </button>
            <button
              type="button"
              onClick={handleClose}
              disabled={isSubmitting}
              className="rounded-md px-4 py-2 text-sm font-medium text-muted-foreground transition-colors hover:text-foreground disabled:opacity-50"
            >
              Annulla
            </button>
          </div>
        </div>
      </div>
    </>
  );
}
