"use client";

import { useEffect, useRef, useCallback, useState } from "react";
import { X } from "lucide-react";
import { useRouter } from "next/navigation";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";
import {
  descriptionQualityScore,
  qualitySuggestions,
  type QualityScore,
} from "@/lib/tasks/descriptionQuality";
import type { TaskType, Repository } from "@robin/shared-types";

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

const selectClass =
  "w-full rounded-md border border-input bg-background px-3 py-2 text-sm shadow-sm focus:outline-none focus:ring-2 focus:ring-ring disabled:opacity-50";

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

// ─── Props ───────────────────────────────────────────────────────────────────

interface CreateTaskDrawerProps {
  isOpen: boolean;
  onClose: () => void;
  onCreated: () => void;
  repositories: Repository[];
}

// ─── Component ───────────────────────────────────────────────────────────────

export function CreateTaskDrawer({
  isOpen,
  onClose,
  onCreated,
  repositories,
}: CreateTaskDrawerProps) {
  const router = useRouter();
  const [serverError, setServerError] = useState<string | null>(null);
  const titleRef = useRef<HTMLInputElement | null>(null);

  const {
    register,
    handleSubmit,
    watch,
    reset,
    formState: { errors, isSubmitting },
  } = useForm<FormValues>({
    resolver: zodResolver(schema),
    defaultValues: {
      type: "feature",
      priority: "medium",
      repository_id: repositories[0]?.id ?? "",
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

  // Focus title when drawer opens
  useEffect(() => {
    if (isOpen) {
      setTimeout(() => titleRef.current?.focus(), 50);
    }
  }, [isOpen]);

  // Escape to close
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

  // Reset form when closed
  useEffect(() => {
    if (!isOpen) {
      reset({
        type: "feature",
        priority: "medium",
        repository_id: repositories[0]?.id ?? "",
        estimated_effort: "",
        context: "",
      });
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
      const body = {
        ...data,
        estimated_effort: data.estimated_effort || undefined,
        context: data.context || undefined,
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
                <select
                  id="drawer-task-repo"
                  className={`mt-1 ${selectClass}`}
                  {...register("repository_id")}
                  disabled={isSubmitting}
                >
                  {repositories.map((r) => (
                    <option key={r.id} value={r.id}>
                      {r.full_name}
                    </option>
                  ))}
                </select>
              )}
              <FieldError message={errors.repository_id?.message} />
            </div>

            {/* Type + Priority row */}
            <div className="grid grid-cols-2 gap-4">
              <div>
                <FieldLabel htmlFor="drawer-task-type">Tipo</FieldLabel>
                <select
                  id="drawer-task-type"
                  className={`mt-1 ${selectClass}`}
                  {...register("type")}
                  disabled={isSubmitting}
                >
                  <option value="bug">Bug</option>
                  <option value="feature">Feature</option>
                  <option value="docs">Docs</option>
                  <option value="refactor">Refactor</option>
                  <option value="chore">Chore</option>
                  <option value="accessibility">Accessibility</option>
                  <option value="security">Security</option>
                </select>
                <FieldError message={errors.type?.message} />
              </div>

              <div>
                <FieldLabel htmlFor="drawer-task-priority">Priorità</FieldLabel>
                <select
                  id="drawer-task-priority"
                  className={`mt-1 ${selectClass}`}
                  {...register("priority")}
                  disabled={isSubmitting}
                >
                  <option value="low">Bassa</option>
                  <option value="medium">Media</option>
                  <option value="high">Alta</option>
                  <option value="urgent">Urgente</option>
                  <option value="critical">Critica</option>
                </select>
                <FieldError message={errors.priority?.message} />
              </div>
            </div>

            {/* Effort */}
            <div>
              <FieldLabel htmlFor="drawer-task-effort">Effort stimato</FieldLabel>
              <select
                id="drawer-task-effort"
                className={`mt-1 ${selectClass}`}
                {...register("estimated_effort")}
                disabled={isSubmitting}
              >
                <option value="">— Non specificato —</option>
                <option value="xs">XS — Meno di 1 ora</option>
                <option value="s">S — Poche ore</option>
                <option value="m">M — Mezzo giorno / 1 giorno</option>
                <option value="l">L — Più giorni</option>
              </select>
              <FieldError message={errors.estimated_effort?.message} />
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
                rows={4}
                placeholder="Link di riferimento, dettagli tecnici, dipendenze, note per l'agente…"
                className={`mt-1 resize-y ${inputClass}`}
                {...register("context")}
                disabled={isSubmitting}
              />
              <p className="mt-1 text-xs text-muted-foreground">
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
