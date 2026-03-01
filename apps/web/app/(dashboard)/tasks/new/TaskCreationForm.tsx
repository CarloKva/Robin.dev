"use client";

import { useCallback, useState } from "react";
import { useRouter } from "next/navigation";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";
import ReactMarkdown from "react-markdown";
import { useKeyboardShortcut } from "@/lib/hooks/useKeyboardShortcut";
import {
  descriptionQualityScore,
  qualitySuggestions,
  type QualityScore,
} from "@/lib/tasks/descriptionQuality";
import type { TaskType } from "@robin/shared-types";

// ─── Schema ────────────────────────────────────────────────────────────────

const schema = z.object({
  title: z
    .string()
    .min(5, "Il titolo deve avere almeno 5 caratteri")
    .max(200, "Titolo troppo lungo"),
  description: z
    .string()
    .min(20, "La descrizione deve avere almeno 20 caratteri")
    .max(5000, "Descrizione troppo lunga"),
  type: z.enum(["bug", "feature", "docs", "refactor", "chore"]),
  priority: z.enum(["low", "medium", "high", "urgent"]),
});

type FormValues = z.infer<typeof schema>;

// ─── Sub-components ────────────────────────────────────────────────────────

function DescriptionQualityIndicator({
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

// ─── TASK.md preview builder ────────────────────────────────────────────────

function buildTaskMd(values: Partial<FormValues>): string {
  const { title, description, type, priority } = values;
  if (!title && !description) return "*Inizia a compilare il form per vedere l'anteprima.*";

  const lines: string[] = [];
  lines.push(`# ${title || "…"}`);
  lines.push("");
  lines.push(`**Tipo:** ${type ?? "—"} · **Priorità:** ${priority ?? "—"}`);
  lines.push("");
  lines.push("## Descrizione");
  lines.push("");
  lines.push(description || "*nessuna descrizione*");
  return lines.join("\n");
}

// ─── Field wrappers ────────────────────────────────────────────────────────

function FieldLabel({ htmlFor, children }: { htmlFor: string; children: React.ReactNode }) {
  return (
    <label htmlFor={htmlFor} className="block text-sm font-medium text-foreground">
      {children}
    </label>
  );
}

function FieldError({ message }: { message: string | undefined }) {
  if (!message) return null;
  return <p className="mt-1 text-xs text-red-600">{message}</p>;
}

const selectClass =
  "w-full rounded-md border border-input bg-background px-3 py-2 text-sm shadow-sm focus:outline-none focus:ring-2 focus:ring-brand-500 disabled:opacity-50";

const inputClass =
  "w-full rounded-md border border-input bg-background px-3 py-2 text-sm shadow-sm placeholder:text-muted-foreground focus:outline-none focus:ring-2 focus:ring-brand-500 disabled:opacity-50";

// ─── Main form ─────────────────────────────────────────────────────────────

interface Props {
  hasOnlineAgent: boolean;
  workspaceId: string;
}

export function TaskCreationForm({ hasOnlineAgent, workspaceId: _workspaceId }: Props) {
  const router = useRouter();
  const [serverError, setServerError] = useState<string | null>(null);
  const [activeTab, setActiveTab] = useState<"form" | "preview">("form");

  const {
    register,
    handleSubmit,
    watch,
    formState: { errors, isSubmitting },
  } = useForm<FormValues>({
    resolver: zodResolver(schema),
    defaultValues: {
      type: "feature",
      priority: "medium",
    },
  });

  // Watch values for quality indicator and preview
  const watchedDescription = watch("description") ?? "";
  const watchedType = (watch("type") ?? "feature") as TaskType;
  const qualityScore: QualityScore | null =
    watchedDescription.length > 0
      ? descriptionQualityScore(watchedDescription, watchedType)
      : null;

  const previewMd = buildTaskMd(watch());

  // Keyboard shortcut: N → focus title input (from task list)
  const focusTitle = useCallback(() => {
    const el = document.getElementById("task-title");
    if (el) el.focus();
  }, []);
  useKeyboardShortcut("n", focusTitle);

  const onSubmit = async (data: FormValues) => {
    setServerError(null);
    try {
      const res = await fetch("/api/tasks", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(data),
      });

      if (!res.ok) {
        const body = await res.json().catch(() => ({}));
        setServerError(
          (body as { error?: string }).error ?? "Errore durante la creazione della task."
        );
        return;
      }

      const { task } = (await res.json()) as { task: { id: string } };

      // Redirect to task detail with success banner via search param
      router.push(`/tasks/${task.id}?created=1`);
      router.refresh();
    } catch {
      setServerError("Errore di rete. Riprova tra un momento.");
    }
  };

  return (
    <div className="flex gap-6 lg:gap-8">
      {/* ── Mobile tab switcher (hidden on lg+) ── */}
      <div className="flex w-full flex-col gap-4 lg:hidden">
        <div className="flex rounded-lg border border-border bg-muted/40 p-1">
          <button
            type="button"
            onClick={() => setActiveTab("form")}
            className={`flex-1 rounded-md py-1.5 text-sm font-medium transition-colors ${
              activeTab === "form"
                ? "bg-background shadow-sm text-foreground"
                : "text-muted-foreground hover:text-foreground"
            }`}
          >
            Form
          </button>
          <button
            type="button"
            onClick={() => setActiveTab("preview")}
            className={`flex-1 rounded-md py-1.5 text-sm font-medium transition-colors ${
              activeTab === "preview"
                ? "bg-background shadow-sm text-foreground"
                : "text-muted-foreground hover:text-foreground"
            }`}
          >
            Anteprima TASK.md
          </button>
        </div>

        {activeTab === "form" ? (
          <FormPanel
            hasOnlineAgent={hasOnlineAgent}
            errors={errors}
            isSubmitting={isSubmitting}
            serverError={serverError}
            qualityScore={qualityScore}
            watchedType={watchedType}
            register={register}
            handleSubmit={handleSubmit}
            onSubmit={onSubmit}
            onCancel={() => router.back()}
          />
        ) : (
          <PreviewPanel markdown={previewMd} />
        )}
      </div>

      {/* ── Desktop two-column layout ── */}
      <div className="hidden w-full gap-6 lg:flex lg:gap-8">
        <div className="flex-1 min-w-0">
          <FormPanel
            hasOnlineAgent={hasOnlineAgent}
            errors={errors}
            isSubmitting={isSubmitting}
            serverError={serverError}
            qualityScore={qualityScore}
            watchedType={watchedType}
            register={register}
            handleSubmit={handleSubmit}
            onSubmit={onSubmit}
            onCancel={() => router.back()}
          />
        </div>
        <div className="w-96 shrink-0">
          <PreviewPanel markdown={previewMd} />
        </div>
      </div>
    </div>
  );
}

// ─── Form panel ────────────────────────────────────────────────────────────

import type { UseFormRegister, FieldErrors } from "react-hook-form";

interface FormPanelProps {
  hasOnlineAgent: boolean;
  errors: FieldErrors<FormValues>;
  isSubmitting: boolean;
  serverError: string | null;
  qualityScore: QualityScore | null;
  watchedType: TaskType;
  register: UseFormRegister<FormValues>;
  handleSubmit: ReturnType<typeof useForm<FormValues>>["handleSubmit"];
  onSubmit: (data: FormValues) => Promise<void>;
  onCancel: () => void;
}

function FormPanel({
  hasOnlineAgent,
  errors,
  isSubmitting,
  serverError,
  qualityScore,
  watchedType,
  register,
  handleSubmit,
  onSubmit,
  onCancel,
}: FormPanelProps) {
  return (
    <form onSubmit={handleSubmit(onSubmit)} className="space-y-5" noValidate>
      {/* Title */}
      <div>
        <FieldLabel htmlFor="task-title">Titolo</FieldLabel>
        <input
          id="task-title"
          type="text"
          placeholder="es. Fix: login button non risponde su mobile"
          className={`mt-1 ${inputClass}`}
          {...register("title")}
          disabled={isSubmitting}
        />
        <FieldError message={errors.title?.message} />
      </div>

      {/* Type + Priority row */}
      <div className="grid grid-cols-2 gap-4">
        <div>
          <FieldLabel htmlFor="task-type">Tipo</FieldLabel>
          <select
            id="task-type"
            className={`mt-1 ${selectClass}`}
            {...register("type")}
            disabled={isSubmitting}
          >
            <option value="bug">🐛 Bug</option>
            <option value="feature">✨ Feature</option>
            <option value="docs">📝 Docs</option>
            <option value="refactor">♻️ Refactor</option>
            <option value="chore">🔧 Chore</option>
          </select>
          <FieldError message={errors.type?.message} />
        </div>

        <div>
          <FieldLabel htmlFor="task-priority">Priorità</FieldLabel>
          <select
            id="task-priority"
            className={`mt-1 ${selectClass}`}
            {...register("priority")}
            disabled={isSubmitting}
          >
            <option value="low">Bassa</option>
            <option value="medium">Media</option>
            <option value="high">Alta</option>
            <option value="urgent">Urgente</option>
          </select>
          <FieldError message={errors.priority?.message} />
        </div>
      </div>

      {/* Agent status (auto-assigned — no manual selection) */}
      {!hasOnlineAgent && (
        <div className="rounded-md border border-amber-200 bg-amber-50 px-4 py-3 text-sm text-amber-800 dark:border-amber-800 dark:bg-amber-950 dark:text-amber-300">
          <strong>Nessun agente online.</strong> La task verrà creata in stato{" "}
          <em>backlog</em> e assegnata automaticamente quando l&apos;agente si connette.
        </div>
      )}

      {/* Description */}
      <div>
        <div className="flex items-center justify-between">
          <FieldLabel htmlFor="task-description">Descrizione</FieldLabel>
          <span className="text-xs text-muted-foreground">min. 20 caratteri</span>
        </div>
        <textarea
          id="task-description"
          rows={10}
          placeholder="Descrivi il problema o la feature in modo dettagliato…"
          className={`mt-1 resize-y ${inputClass}`}
          {...register("description")}
          disabled={isSubmitting}
        />
        <DescriptionQualityIndicator score={qualityScore} type={watchedType} />
        <FieldError message={errors.description?.message} />
      </div>

      {/* Server error */}
      {serverError && (
        <div className="rounded-md border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700 dark:border-red-800 dark:bg-red-950 dark:text-red-400">
          {serverError}
        </div>
      )}

      {/* Actions */}
      <div className="flex items-center gap-3 pt-1">
        <button
          type="submit"
          disabled={isSubmitting}
          className="rounded-md bg-brand-600 px-5 py-2 text-sm font-semibold text-white shadow-sm transition-colors hover:bg-brand-700 focus:outline-none focus:ring-2 focus:ring-brand-500 focus:ring-offset-2 disabled:cursor-not-allowed disabled:opacity-50 min-h-[44px]"
        >
          {isSubmitting ? "Creazione…" : hasOnlineAgent ? "Crea task" : "Crea task (backlog)"}
        </button>
        <button
          type="button"
          onClick={onCancel}
          disabled={isSubmitting}
          className="rounded-md px-4 py-2 text-sm font-medium text-muted-foreground transition-colors hover:text-foreground disabled:opacity-50"
        >
          Annulla
        </button>
      </div>
    </form>
  );
}

// ─── Preview panel ─────────────────────────────────────────────────────────

function PreviewPanel({ markdown }: { markdown: string }) {
  return (
    <div className="sticky top-6">
      <div className="mb-2 flex items-center gap-2">
        <span className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">
          Anteprima TASK.md
        </span>
        <span className="rounded border border-border bg-muted px-1.5 py-0.5 font-mono text-[10px] text-muted-foreground">
          TASK.md
        </span>
      </div>
      <div className="min-h-64 rounded-lg border border-border bg-muted/30 p-4">
        <div className="prose prose-sm dark:prose-invert max-w-none [&_h1]:text-base [&_h1]:font-bold [&_h2]:text-sm [&_h2]:font-semibold [&_p]:text-sm [&_p]:leading-relaxed">
          <ReactMarkdown>{markdown}</ReactMarkdown>
        </div>
      </div>
      <p className="mt-2 text-xs text-muted-foreground">
        Questo è il file che l&apos;agente leggerà per capire la task.
      </p>
    </div>
  );
}
