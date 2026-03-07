"use client";

import { useCallback, useEffect, useState } from "react";
import { Check, X } from "lucide-react";
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
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import type { TaskType, Repository, AgentWithStatus } from "@robin/shared-types";

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
  type: z.enum(["bug", "feature", "docs", "refactor", "chore", "accessibility", "security"]),
  priority: z.enum(["low", "medium", "high", "urgent", "critical"]),
  repository_id: z.string().uuid("Seleziona una repository"),
  preferred_agent_id: z.string().uuid().nullable(),
});

type FormValues = z.infer<typeof schema>;

// ─── Preflight state ────────────────────────────────────────────────────────

type PreflightState =
  | { status: "idle" }
  | { status: "checking" }
  | { status: "ok"; full_name: string }
  | { status: "error"; error: string };

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
    <label htmlFor={htmlFor} className="block text-sm font-medium text-[#1C1C1E] dark:text-white mb-1.5">
      {children}
    </label>
  );
}

function FieldError({ message }: { message: string | undefined }) {
  if (!message) return null;
  return <p className="mt-1 text-xs text-[#FF3B30]">{message}</p>;
}

const selectClass =
  "w-full rounded-xl border border-[#D1D1D6] bg-white px-3.5 py-2.5 text-sm text-[#1C1C1E] outline-none transition-colors focus:border-[#007AFF] focus:ring-2 focus:ring-[#007AFF]/20 disabled:cursor-not-allowed disabled:opacity-50 dark:bg-[#1C1C1E] dark:text-white";

// ─── Preflight indicator ────────────────────────────────────────────────────

function PreflightIndicator({ state }: { state: PreflightState }) {
  if (state.status === "idle") return null;
  if (state.status === "checking") {
    return (
      <p className="mt-1.5 flex items-center gap-1.5 text-xs text-muted-foreground">
        <span className="inline-block h-3 w-3 animate-spin rounded-full border-2 border-muted-foreground border-t-transparent" />
        Verifica accesso GitHub…
      </p>
    );
  }
  if (state.status === "ok") {
    return (
      <p className="mt-1.5 flex items-center gap-1 text-xs text-emerald-600 dark:text-emerald-400">
        <Check className="h-3.5 w-3.5" /> Accessibile — {state.full_name}
      </p>
    );
  }
  return (
    <p className="mt-1.5 flex items-center gap-1 text-xs text-red-600 dark:text-red-400">
      <X className="h-3.5 w-3.5" /> {state.error}
    </p>
  );
}

// ─── Main form ─────────────────────────────────────────────────────────────

interface Props {
  workspaceId: string;
  repositories: Repository[];
  agents: AgentWithStatus[];
}

export function TaskCreationForm({ workspaceId: _workspaceId, repositories, agents }: Props) {
  const router = useRouter();
  const [serverError, setServerError] = useState<string | null>(null);
  const [activeTab, setActiveTab] = useState<"form" | "preview">("form");
  const [preflight, setPreflight] = useState<PreflightState>({ status: "idle" });

  const {
    register,
    handleSubmit,
    watch,
    setValue,
    formState: { errors, isSubmitting },
  } = useForm<FormValues>({
    resolver: zodResolver(schema),
    defaultValues: {
      type: "feature",
      priority: "medium",
      repository_id: repositories[0]?.id ?? "",
      preferred_agent_id: null,
    },
  });

  const watchedDescription = watch("description") ?? "";
  const watchedType = (watch("type") ?? "feature") as TaskType;
  const watchedRepoId = watch("repository_id");
  const qualityScore: QualityScore | null =
    watchedDescription.length > 0
      ? descriptionQualityScore(watchedDescription, watchedType)
      : null;

  const previewMd = buildTaskMd(watch());

  // Preflight: verify GitHub App access when a repo is selected
  useEffect(() => {
    if (!watchedRepoId) {
      setPreflight({ status: "idle" });
      return;
    }
    setPreflight({ status: "checking" });
    const controller = new AbortController();
    fetch(`/api/repositories/${watchedRepoId}/check`, { signal: controller.signal })
      .then((r) => r.json())
      .then((data: { accessible?: boolean; full_name?: string; error?: string }) => {
        if (data.accessible) {
          setPreflight({ status: "ok", full_name: data.full_name ?? "" });
        } else {
          setPreflight({ status: "error", error: data.error ?? "Repository non accessibile" });
        }
      })
      .catch((err: unknown) => {
        if ((err as { name?: string }).name !== "AbortError") {
          setPreflight({ status: "error", error: "Errore di rete durante la verifica" });
        }
      });
    return () => controller.abort();
  }, [watchedRepoId]);

  // Pre-select first repo if none selected
  useEffect(() => {
    if (repositories.length > 0 && !watchedRepoId && repositories[0]) {
      setValue("repository_id", repositories[0].id);
    }
  }, [repositories, watchedRepoId, setValue]);

  // Keyboard shortcut: N → focus title input
  const focusTitle = useCallback(() => {
    const el = document.getElementById("task-title");
    if (el) el.focus();
  }, []);
  useKeyboardShortcut("n", focusTitle);

  // Online agents for the selector
  const onlineAgents = agents.filter((a) => {
    if (!a.last_seen_at) return false;
    return Date.now() - new Date(a.last_seen_at).getTime() < 2 * 60 * 1000;
  });

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
      router.push(`/tasks/${task.id}?created=1`);
      router.refresh();
    } catch {
      setServerError("Errore di rete. Riprova tra un momento.");
    }
  };

  return (
    <div className="flex gap-6 lg:gap-8">
      {/* ── Mobile tab switcher ── */}
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
            errors={errors}
            isSubmitting={isSubmitting}
            serverError={serverError}
            qualityScore={qualityScore}
            watchedType={watchedType}
            register={register}
            handleSubmit={handleSubmit}
            onSubmit={onSubmit}
            onCancel={() => router.back()}
            repositories={repositories}
            onlineAgents={onlineAgents}
            preflight={preflight}
          />
        ) : (
          <PreviewPanel markdown={previewMd} />
        )}
      </div>

      {/* ── Desktop two-column layout ── */}
      <div className="hidden w-full gap-6 lg:flex lg:gap-8">
        <div className="flex-1 min-w-0">
          <FormPanel
            errors={errors}
            isSubmitting={isSubmitting}
            serverError={serverError}
            qualityScore={qualityScore}
            watchedType={watchedType}
            register={register}
            handleSubmit={handleSubmit}
            onSubmit={onSubmit}
            onCancel={() => router.back()}
            repositories={repositories}
            onlineAgents={onlineAgents}
            preflight={preflight}
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
  errors: FieldErrors<FormValues>;
  isSubmitting: boolean;
  serverError: string | null;
  qualityScore: QualityScore | null;
  watchedType: TaskType;
  register: UseFormRegister<FormValues>;
  handleSubmit: ReturnType<typeof useForm<FormValues>>["handleSubmit"];
  onSubmit: (data: FormValues) => Promise<void>;
  onCancel: () => void;
  repositories: Repository[];
  onlineAgents: AgentWithStatus[];
  preflight: PreflightState;
}

function FormPanel({
  errors,
  isSubmitting,
  serverError,
  qualityScore,
  watchedType,
  register,
  handleSubmit,
  onSubmit,
  onCancel,
  repositories,
  onlineAgents,
  preflight,
}: FormPanelProps) {
  return (
    <form onSubmit={handleSubmit(onSubmit)} className="space-y-5" noValidate>
      {/* Title */}
      <div>
        <FieldLabel htmlFor="task-title">Titolo</FieldLabel>
        <Input
          id="task-title"
          type="text"
          placeholder="es. Fix: login button non risponde su mobile"
          className="mt-1"
          error={!!errors.title}
          {...register("title")}
          disabled={isSubmitting}
        />
        <FieldError message={errors.title?.message} />
      </div>

      {/* Repository + Agent row */}
      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
        <div>
          <FieldLabel htmlFor="task-repo">Repository *</FieldLabel>
          {repositories.length === 0 ? (
            <p className="mt-1.5 text-xs text-amber-600 dark:text-amber-400">
              Nessuna repository collegata.{" "}
              <a href="/settings" className="underline hover:no-underline">
                Collega una repository in Settings.
              </a>
            </p>
          ) : (
            <>
              <select
                id="task-repo"
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
              <PreflightIndicator state={preflight} />
            </>
          )}
          <FieldError message={errors.repository_id?.message} />
        </div>

        <div>
          <FieldLabel htmlFor="task-agent">Agente (opzionale)</FieldLabel>
          <select
            id="task-agent"
            className={`mt-1 ${selectClass}`}
            {...register("preferred_agent_id")}
            disabled={isSubmitting}
          >
            <option value="">— Assegna automaticamente —</option>
            {onlineAgents.map((a) => (
              <option key={a.id} value={a.id}>
                {a.name}
              </option>
            ))}
          </select>
          <p className="mt-1 text-xs text-muted-foreground">
            L&apos;agente viene assegnato all&apos;avvio dello sprint.
          </p>
          <FieldError message={errors.preferred_agent_id?.message} />
        </div>
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
            <option value="critical">Critica</option>
          </select>
          <FieldError message={errors.priority?.message} />
        </div>
      </div>

      {/* Backlog info */}
      <div className="rounded-md border border-blue-200 bg-blue-50 px-4 py-3 text-sm text-blue-800 dark:border-blue-800 dark:bg-blue-950 dark:text-blue-300">
        La task verrà creata nel <strong>backlog</strong>. Aggiungila a uno sprint e avvia lo sprint per iniziare l&apos;esecuzione.
      </div>

      {/* Description */}
      <div>
        <div className="flex items-center justify-between">
          <FieldLabel htmlFor="task-description">Descrizione</FieldLabel>
          <span className="text-xs text-muted-foreground">min. 20 caratteri</span>
        </div>
        <Textarea
          id="task-description"
          rows={10}
          placeholder="Descrivi il problema o la feature in modo dettagliato…"
          className="mt-1"
          error={!!errors.description}
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
          disabled={isSubmitting || preflight.status === "error"}
          className="rounded-md bg-brand-600 px-5 py-2 text-sm font-semibold text-white shadow-sm transition-colors hover:bg-brand-700 focus:outline-none focus:ring-2 focus:ring-brand-500 focus:ring-offset-2 disabled:cursor-not-allowed disabled:opacity-50 min-h-[44px]"
        >
          {isSubmitting ? "Creazione…" : "Crea task"}
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
