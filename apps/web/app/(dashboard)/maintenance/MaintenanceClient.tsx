"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import {
  Wrench,
  Bug,
  FileSearch,
  Hammer,
  Play,
  CheckCircle2,
  XCircle,
  Loader2,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { formatShortDate, formatTokens } from "@/lib/format";
import type {
  CapabilityConfigWithRelations,
} from "@/lib/db/maintenance";
import type { MaintenanceCapabilityId, MaintenanceSchedule } from "@robin/shared-types";
import { cn } from "@/lib/utils";

type Repo = { id: string; full_name: string; default_branch: string };

type Props = {
  isOwner: boolean;
  repositories: Repo[];
  selectedRepoId: string | null;
  configs: CapabilityConfigWithRelations[];
};

const CAPABILITY_ICONS: Record<MaintenanceCapabilityId, React.ElementType> = {
  spec_discovery: FileSearch,
  spec_impl: Hammer,
  bug_discovery: Bug,
  bug_impl: Wrench,
};

// Typed map — adding a new capability to MaintenanceCapabilityId without
// extending this record will fail typecheck instead of silently sorting to
// the top of the list.
const CAPABILITY_ORDER: Record<MaintenanceCapabilityId, number> = {
  spec_discovery: 0,
  spec_impl: 1,
  bug_discovery: 2,
  bug_impl: 3,
};

export function MaintenanceClient(props: Props) {
  const router = useRouter();
  const [configs, setConfigs] = useState(props.configs);

  const sortedConfigs = [...configs].sort(
    (a, b) =>
      CAPABILITY_ORDER[a.capability_definition_id] -
      CAPABILITY_ORDER[b.capability_definition_id]
  );

  function handleRepoChange(repoId: string) {
    router.push(`/maintenance?repository_id=${repoId}`);
  }

  function handleConfigUpdate(updated: CapabilityConfigWithRelations) {
    setConfigs((prev) => prev.map((c) => (c.id === updated.id ? updated : c)));
  }

  return (
    <div className="max-w-6xl mx-auto p-6 space-y-6">
      <header className="space-y-2">
        <h1 className="text-2xl font-semibold">Maintenance</h1>
        <p className="text-sm text-muted-foreground">
          Capabilities di manutenzione (spec coverage, bug discovery, fix automation) eseguite
          dai tuoi agenti. La discovery è on di default, le implementation sono off finché non
          approvate.
        </p>
      </header>

      {props.repositories.length === 0 ? (
        <EmptyState
          title="Nessun repository abilitato"
          message="Vai su Settings → GitHub per abilitare un repository prima di configurare le capabilities."
        />
      ) : (
        <>
          <RepoSelector
            repos={props.repositories}
            selectedId={props.selectedRepoId}
            onChange={handleRepoChange}
          />

          {!props.selectedRepoId ? (
            <EmptyState title="Seleziona un repository per vedere le capabilities" />
          ) : sortedConfigs.length === 0 ? (
            <EmptyState
              title="Nessuna config trovata"
              message="Le configurazioni vengono create automaticamente quando un repo viene abilitato. Riabilita il repo se la lista è vuota."
            />
          ) : (
            <div className="grid gap-4 md:grid-cols-2">
              {sortedConfigs.map((config) => (
                <CapabilityCard
                  key={config.id}
                  config={config}
                  isOwner={props.isOwner}
                  onUpdated={handleConfigUpdate}
                />
              ))}
            </div>
          )}
        </>
      )}
    </div>
  );
}

// ─── Sub-components ─────────────────────────────────────────────────────────

function RepoSelector(props: {
  repos: Repo[];
  selectedId: string | null;
  onChange: (id: string) => void;
}) {
  return (
    <div className="flex items-center gap-3">
      <label className="text-sm font-medium" htmlFor="repo-select">
        Repository
      </label>
      <select
        id="repo-select"
        className="h-9 rounded-md border border-input bg-background px-3 text-sm"
        value={props.selectedId ?? ""}
        onChange={(e) => props.onChange(e.target.value)}
      >
        {props.repos.map((r) => (
          <option key={r.id} value={r.id}>
            {r.full_name}
          </option>
        ))}
      </select>
    </div>
  );
}

function CapabilityCard(props: {
  config: CapabilityConfigWithRelations;
  isOwner: boolean;
  onUpdated: (c: CapabilityConfigWithRelations) => void;
}) {
  const { config } = props;
  const Icon = CAPABILITY_ICONS[config.capability_definition_id] ?? Wrench;
  const definition = config.capability_definition;
  const [pendingToggle, startToggle] = useTransition();
  const [runState, setRunState] = useState<
    { kind: "idle" } | { kind: "running" } | { kind: "ok"; runId: string } | { kind: "err"; msg: string }
  >({ kind: "idle" });

  function toggle() {
    startToggle(async () => {
      const res = await fetch(`/api/maintenance/configs/${config.id}`, {
        method: "PATCH",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ enabled: !config.enabled }),
      });
      if (!res.ok) return;
      const { config: updated } = (await res.json()) as { config: CapabilityConfigWithRelations };
      props.onUpdated(updated);
    });
  }

  const router = useRouter();

  async function runNow() {
    setRunState({ kind: "running" });
    const res = await fetch(`/api/maintenance/configs/${config.id}/run-now`, {
      method: "POST",
    });
    if (!res.ok) {
      const body = await res.json().catch(() => ({}));
      setRunState({ kind: "err", msg: body?.error ?? `HTTP ${res.status}` });
      return;
    }
    const body = (await res.json()) as { agent_run_id: string };
    setRunState({ kind: "ok", runId: body.agent_run_id });
    // Re-fetch the page so last_run_at + next_run_at update and the new run
    // shows up on /maintenance/runs if the user navigates there.
    router.refresh();
  }

  const isImplemented =
    config.capability_definition_id === "spec_discovery" ||
    config.capability_definition_id === "bug_discovery";

  return (
    <div className="rounded-lg border border-border bg-card p-5 space-y-4">
      <header className="flex items-start justify-between gap-3">
        <div className="flex gap-3 items-start">
          <div className="rounded-md bg-muted p-2">
            <Icon className="h-5 w-5" />
          </div>
          <div className="space-y-0.5">
            <h3 className="font-semibold leading-tight">
              {definition?.display_name ?? config.capability_definition_id}
            </h3>
            <p className="text-xs text-muted-foreground line-clamp-2 max-w-md">
              {definition?.description ?? ""}
            </p>
          </div>
        </div>
        <EnabledPill enabled={config.enabled} />
      </header>

      <dl className="grid grid-cols-2 gap-x-4 gap-y-2 text-sm">
        <FieldRow label="Schedule" value={describeSchedule(config.schedule)} />
        <FieldRow
          label="Daily budget"
          value={`${formatTokens(config.daily_token_budget)} tok`}
        />
        <FieldRow label="Last run" value={formatShortDate(config.last_run_at)} />
        <FieldRow label="Next run" value={formatShortDate(config.next_run_at)} />
      </dl>

      <div className="flex items-center justify-between gap-2 pt-2 border-t border-border">
        <Button
          size="sm"
          variant={config.enabled ? "outline" : "default"}
          disabled={!props.isOwner || pendingToggle}
          onClick={toggle}
        >
          {pendingToggle ? (
            <Loader2 className="h-3.5 w-3.5 animate-spin" />
          ) : null}
          {config.enabled ? "Disabilita" : "Abilita"}
        </Button>

        <div className="flex items-center gap-2">
          {!isImplemented && (
            <span className="text-xs text-muted-foreground">
              Disponibile in Phase 2+
            </span>
          )}
          {isImplemented && (
            <Button
              size="sm"
              disabled={!props.isOwner || runState.kind === "running"}
              onClick={runNow}
              title={!props.isOwner ? "Solo il proprietario può lanciare run" : "Lancia subito"}
            >
              {runState.kind === "running" ? (
                <Loader2 className="h-3.5 w-3.5 animate-spin" />
              ) : (
                <Play className="h-3.5 w-3.5" />
              )}
              Run now
            </Button>
          )}
        </div>
      </div>

      {runState.kind === "ok" && (
        <p className="text-xs text-emerald-600 flex items-center gap-1.5">
          <CheckCircle2 className="h-3.5 w-3.5" />
          Run accodato. ID: <span className="font-mono">{runState.runId.slice(0, 8)}</span>
        </p>
      )}
      {runState.kind === "err" && (
        <p className="text-xs text-red-600 flex items-center gap-1.5">
          <XCircle className="h-3.5 w-3.5" />
          {runState.msg}
        </p>
      )}
    </div>
  );
}

function EnabledPill({ enabled }: { enabled: boolean }) {
  return (
    <span
      className={cn(
        "rounded-full px-2 py-0.5 text-xs font-medium border",
        enabled
          ? "bg-emerald-50 text-emerald-700 border-emerald-200 dark:bg-emerald-950 dark:text-emerald-400 dark:border-emerald-800"
          : "bg-zinc-100 text-zinc-600 border-zinc-200 dark:bg-zinc-800 dark:text-zinc-400 dark:border-zinc-700"
      )}
    >
      {enabled ? "Abilitata" : "Disabilitata"}
    </span>
  );
}

function FieldRow({ label, value }: { label: string; value: string }) {
  return (
    <>
      <dt className="text-muted-foreground">{label}</dt>
      <dd className="text-foreground font-mono text-xs">{value}</dd>
    </>
  );
}

function EmptyState({ title, message }: { title: string; message?: string }) {
  return (
    <div className="rounded-lg border border-dashed border-border p-10 text-center space-y-1">
      <p className="text-sm font-medium">{title}</p>
      {message && <p className="text-xs text-muted-foreground">{message}</p>}
    </div>
  );
}

// ─── Helpers ────────────────────────────────────────────────────────────────

function describeSchedule(schedule: MaintenanceSchedule): string {
  if (schedule.mode === "disabled") return "disabled";
  if (schedule.mode === "always_on") return `every ${schedule.interval_minutes}min`;
  return `${schedule.windows.length} window${schedule.windows.length === 1 ? "" : "s"} · every ${schedule.interval_minutes}min`;
}

