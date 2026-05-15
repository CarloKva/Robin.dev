"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import {
  Bug,
  Check,
  Clock,
  FileSearch,
  Inbox as InboxIcon,
  Loader2,
  PackageCheck,
  X,
} from "lucide-react";
import { cn } from "@/lib/utils";
import { formatRelativeIt } from "@/lib/format";
import { Button } from "@/components/ui/button";
import type { InboxFinding } from "@/lib/db/maintenance";
import type { SpecFindingStatus, BugFindingSeverity } from "@robin/shared-types";

type Repo = { id: string; full_name: string };

type Props = {
  isOwner: boolean;
  repositories: Repo[];
  selectedRepositoryId: string | null;
  selectedType: "spec" | "bug" | null;
  selectedState: string;
  findings: InboxFinding[];
};

const STATES = [
  { value: "pending", label: "Pending" },
  { value: "approved", label: "Approved" },
  { value: "implemented", label: "Implemented" },
  { value: "rejected", label: "Rejected" },
  { value: "snoozed", label: "Snoozed" },
];

const STATUS_COLOR: Record<SpecFindingStatus, string> = {
  missing: "bg-red-50 text-red-700 border-red-200 dark:bg-red-950 dark:text-red-400",
  partial: "bg-amber-50 text-amber-700 border-amber-200 dark:bg-amber-950 dark:text-amber-400",
  drifted: "bg-orange-50 text-orange-700 border-orange-200 dark:bg-orange-950 dark:text-orange-400",
  implemented:
    "bg-emerald-50 text-emerald-700 border-emerald-200 dark:bg-emerald-950 dark:text-emerald-400",
};

const SEVERITY_COLOR: Record<BugFindingSeverity, string> = {
  P0: "bg-red-100 text-red-800 border-red-300",
  P1: "bg-orange-100 text-orange-800 border-orange-300",
  P2: "bg-amber-100 text-amber-800 border-amber-300",
  P3: "bg-zinc-100 text-zinc-700 border-zinc-300",
};

const SNOOZE_PRESETS = [
  { label: "1 giorno", days: 1 },
  { label: "7 giorni", days: 7 },
  { label: "30 giorni", days: 30 },
];

export function InboxClient(props: Props) {
  const router = useRouter();

  function setParam(key: string, value: string | null) {
    const url = new URL(window.location.href);
    if (value) url.searchParams.set(key, value);
    else url.searchParams.delete(key);
    router.push(`/maintenance/inbox?${url.searchParams.toString()}`);
  }

  return (
    <div className="max-w-6xl mx-auto p-6 space-y-6">
      <header className="space-y-1">
        <h1 className="text-2xl font-semibold flex items-center gap-2">
          <InboxIcon className="h-6 w-6" />
          Inbox
        </h1>
        <p className="text-sm text-muted-foreground">
          Findings da spec_discovery e bug_discovery. Phase 2 abilita le azioni di triage —
          approve/reject/snooze/mark-implemented (solo owner del workspace). L&apos;esecuzione
          dell&apos;implementation agent dopo approve arriva in Phase 3.
        </p>
      </header>

      <div className="flex flex-wrap items-center gap-3 text-sm">
        <div className="flex items-center gap-2">
          <label htmlFor="inbox-repo" className="text-muted-foreground">Repository</label>
          <select
            id="inbox-repo"
            className="h-9 rounded-md border border-input bg-background px-3 text-sm"
            value={props.selectedRepositoryId ?? ""}
            onChange={(e) => setParam("repository_id", e.target.value || null)}
          >
            <option value="">Tutti</option>
            {props.repositories.map((r) => (
              <option key={r.id} value={r.id}>{r.full_name}</option>
            ))}
          </select>
        </div>

        <div className="flex items-center gap-2">
          <label htmlFor="inbox-type" className="text-muted-foreground">Tipo</label>
          <select
            id="inbox-type"
            className="h-9 rounded-md border border-input bg-background px-3 text-sm"
            value={props.selectedType ?? ""}
            onChange={(e) => setParam("type", e.target.value || null)}
          >
            <option value="">Tutti</option>
            <option value="spec">Spec</option>
            <option value="bug">Bug</option>
          </select>
        </div>

        <div className="flex items-center gap-2">
          <label htmlFor="inbox-state" className="text-muted-foreground">Stato</label>
          <select
            id="inbox-state"
            className="h-9 rounded-md border border-input bg-background px-3 text-sm"
            value={props.selectedState}
            onChange={(e) => setParam("state", e.target.value)}
          >
            {STATES.map((s) => (
              <option key={s.value} value={s.value}>{s.label}</option>
            ))}
          </select>
        </div>

        <span className="ml-auto text-xs text-muted-foreground">
          {props.findings.length} finding{props.findings.length === 1 ? "" : "s"}
        </span>
      </div>

      {props.findings.length === 0 ? (
        <div className="rounded-lg border border-dashed border-border p-10 text-center text-sm text-muted-foreground">
          Nessun finding per questa combinazione di filtri.
        </div>
      ) : (
        <ul className="space-y-3">
          {props.findings.map((finding) => (
            <li key={`${finding.type}-${finding.id}`}>
              <FindingCard finding={finding} isOwner={props.isOwner} />
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}

function FindingCard({ finding, isOwner }: { finding: InboxFinding; isOwner: boolean }) {
  const TypeIcon = finding.type === "bug" ? Bug : FileSearch;
  return (
    <div className="rounded-lg border border-border bg-card p-4 space-y-3">
      <header className="flex items-start gap-3">
        <div className="rounded-md bg-muted p-1.5 mt-0.5">
          <TypeIcon className="h-4 w-4" />
        </div>
        <div className="flex-1 space-y-1">
          <h3 className="font-medium text-sm leading-snug">{finding.title}</h3>
          <div className="flex flex-wrap items-center gap-2 text-xs text-muted-foreground">
            {finding.repository_full_name && (
              <span className="font-mono">{finding.repository_full_name}</span>
            )}
            {finding.source_path && (
              <>
                <span aria-hidden>·</span>
                <span className="font-mono">
                  {finding.source_path}
                  {finding.source_line ? `:${finding.source_line}` : ""}
                </span>
              </>
            )}
            <span aria-hidden>·</span>
            <span title={finding.created_at}>{formatRelativeIt(finding.created_at)}</span>
          </div>
        </div>
        <div className="flex flex-col items-end gap-1.5">
          <ConfidencePill confidence={finding.confidence} />
          {finding.status && (
            <span
              className={cn(
                "rounded-full px-2 py-0.5 text-xs font-medium border",
                STATUS_COLOR[finding.status as SpecFindingStatus] ??
                  "bg-zinc-100 text-zinc-700 border-zinc-300"
              )}
            >
              {finding.status}
            </span>
          )}
          {finding.severity && (
            <span
              className={cn(
                "rounded-full px-2 py-0.5 text-xs font-medium border",
                SEVERITY_COLOR[finding.severity as BugFindingSeverity] ??
                  "bg-zinc-100 text-zinc-700 border-zinc-300"
              )}
            >
              {finding.severity}
            </span>
          )}
        </div>
      </header>

      {finding.description && (
        <p className="text-sm text-muted-foreground line-clamp-3 ml-9">{finding.description}</p>
      )}

      <TriageBar finding={finding} isOwner={isOwner} />
    </div>
  );
}

function TriageBar({ finding, isOwner }: { finding: InboxFinding; isOwner: boolean }) {
  const router = useRouter();
  const [busy, setBusy] = useState<"approve" | "reject" | "snooze" | "mark_implemented" | null>(
    null
  );
  const [error, setError] = useState<string | null>(null);
  const [snoozeOpen, setSnoozeOpen] = useState(false);

  async function callTriage(
    action: "approve" | "reject" | "snooze" | "mark_implemented",
    extra: { snoozed_until?: string } = {}
  ) {
    setBusy(action);
    setError(null);
    try {
      const res = await fetch(
        `/api/maintenance/findings/${finding.type}/${finding.id}/triage`,
        {
          method: "POST",
          headers: { "content-type": "application/json" },
          body: JSON.stringify({ action, ...extra }),
        }
      );
      if (!res.ok) {
        const body = await res.json().catch(() => ({}));
        setError(body?.error ?? `HTTP ${res.status}`);
        return;
      }
      router.refresh();
    } catch (err) {
      setError(err instanceof Error ? err.message : String(err));
    } finally {
      setBusy(null);
      setSnoozeOpen(false);
    }
  }

  function snooze(days: number) {
    const date = new Date();
    date.setUTCDate(date.getUTCDate() + days);
    void callTriage("snooze", { snoozed_until: date.toISOString() });
  }

  if (!isOwner) {
    return (
      <p className="text-xs text-muted-foreground ml-9 italic">
        Triage disponibile solo per il proprietario del workspace.
      </p>
    );
  }

  return (
    <div className="ml-9 space-y-1.5">
      <div className="flex flex-wrap items-center gap-2">
        <Button
          size="sm"
          variant={finding.triage_state === "approved" ? "default" : "outline"}
          onClick={() => callTriage("approve")}
          disabled={busy !== null || finding.triage_state === "approved"}
        >
          {busy === "approve" ? (
            <Loader2 className="h-3.5 w-3.5 animate-spin" />
          ) : (
            <Check className="h-3.5 w-3.5" />
          )}
          Approve
        </Button>
        <Button
          size="sm"
          variant="outline"
          onClick={() => callTriage("reject")}
          disabled={busy !== null || finding.triage_state === "rejected"}
        >
          {busy === "reject" ? (
            <Loader2 className="h-3.5 w-3.5 animate-spin" />
          ) : (
            <X className="h-3.5 w-3.5" />
          )}
          Reject
        </Button>
        <div className="relative">
          <Button
            size="sm"
            variant="outline"
            onClick={() => setSnoozeOpen((v) => !v)}
            disabled={busy !== null}
          >
            {busy === "snooze" ? (
              <Loader2 className="h-3.5 w-3.5 animate-spin" />
            ) : (
              <Clock className="h-3.5 w-3.5" />
            )}
            Snooze
          </Button>
          {snoozeOpen && (
            <div
              className="absolute z-10 mt-1 w-40 rounded-md border border-border bg-popover p-1 shadow-md"
              role="menu"
            >
              {SNOOZE_PRESETS.map((preset) => (
                <button
                  key={preset.days}
                  type="button"
                  className="w-full text-left px-2 py-1.5 text-xs rounded hover:bg-muted"
                  onClick={() => snooze(preset.days)}
                >
                  {preset.label}
                </button>
              ))}
            </div>
          )}
        </div>
        <Button
          size="sm"
          variant="outline"
          onClick={() => callTriage("mark_implemented")}
          disabled={busy !== null || finding.triage_state === "implemented"}
          title="Marca come implementato (utile quando il fix è stato spedito a mano)"
        >
          {busy === "mark_implemented" ? (
            <Loader2 className="h-3.5 w-3.5 animate-spin" />
          ) : (
            <PackageCheck className="h-3.5 w-3.5" />
          )}
          Mark implemented
        </Button>
        <span className="ml-auto text-xs text-muted-foreground">
          state: <span className="font-mono">{finding.triage_state}</span>
        </span>
      </div>
      {error && <p className="text-xs text-red-600">{error}</p>}
    </div>
  );
}

function ConfidencePill({ confidence }: { confidence: number }) {
  const pct = Math.round(confidence * 100);
  const tone =
    confidence >= 0.85
      ? "bg-emerald-50 text-emerald-700 border-emerald-200"
      : confidence >= 0.7
      ? "bg-sky-50 text-sky-700 border-sky-200"
      : "bg-amber-50 text-amber-700 border-amber-200";
  return (
    <span
      className={cn(
        "rounded-full px-2 py-0.5 text-xs font-medium border font-mono",
        tone
      )}
      title={`Confidence ${confidence.toFixed(2)}`}
    >
      {pct}%
    </span>
  );
}
