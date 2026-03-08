"use client";

import { useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { MoreHorizontal, Layers, Plus } from "lucide-react";
import { cn } from "@/lib/utils";
import type { SprintWithTaskCount } from "@/lib/db/sprints";

// ── Status badge ──────────────────────────────────────────────────────────────

const STATUS_CONFIG: Record<string, { label: string; className: string }> = {
  planning: {
    label: "In pianificazione",
    className: "bg-muted text-muted-foreground",
  },
  active: {
    label: "Attivo",
    className: "bg-foreground/10 text-foreground",
  },
  completed: {
    label: "Completato",
    className: "bg-muted text-muted-foreground",
  },
  cancelled: {
    label: "Annullato",
    className: "bg-muted text-muted-foreground/60",
  },
};

// ── Helpers ───────────────────────────────────────────────────────────────────

function formatDate(iso: string | null): string {
  if (!iso) return "—";
  return new Date(iso).toLocaleDateString("it-IT", { day: "2-digit", month: "short" });
}

function formatPeriod(sprint: SprintWithTaskCount): string {
  const start = formatDate(sprint.started_at ?? sprint.created_at);
  const end = formatDate(sprint.completed_at);
  if (sprint.status === "planning") return formatDate(sprint.created_at);
  return `${start} → ${end}`;
}

// ── Actions dropdown ──────────────────────────────────────────────────────────

interface ActionsDropdownProps {
  sprint: SprintWithTaskCount;
  onDeleted: (id: string) => void;
}

function ActionsDropdown({ sprint, onDeleted }: ActionsDropdownProps) {
  const [open, setOpen] = useState(false);
  const [loading, setLoading] = useState(false);
  const router = useRouter();

  async function handleActivate() {
    setOpen(false);
    setLoading(true);
    try {
      await fetch(`/api/sprints/${sprint.id}/start`, { method: "POST" });
      router.refresh();
    } finally {
      setLoading(false);
    }
  }

  async function handleDelete() {
    setOpen(false);
    setLoading(true);
    try {
      const res = await fetch(`/api/sprints/${sprint.id}`, { method: "DELETE" });
      if (res.ok) onDeleted(sprint.id);
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="relative">
      <button
        type="button"
        disabled={loading}
        onClick={() => setOpen((v) => !v)}
        className="inline-flex h-8 w-8 items-center justify-center rounded-md text-muted-foreground transition-colors hover:bg-accent hover:text-foreground disabled:opacity-40"
        aria-label="Azioni sprint"
      >
        <MoreHorizontal size={16} />
      </button>

      {open && (
        <>
          <div
            className="fixed inset-0 z-10"
            onClick={() => setOpen(false)}
          />
          <div className="absolute right-0 top-9 z-20 min-w-[140px] overflow-hidden rounded-lg border border-border bg-popover shadow-md">
            <Link
              href={`/sprints/${sprint.id}`}
              onClick={() => setOpen(false)}
              className="flex w-full items-center px-3 py-2 text-sm text-foreground hover:bg-accent"
            >
              Modifica
            </Link>
            {sprint.status === "planning" && (
              <button
                type="button"
                onClick={() => void handleActivate()}
                className="flex w-full items-center px-3 py-2 text-sm text-foreground hover:bg-accent"
              >
                Attiva
              </button>
            )}
            {sprint.status === "planning" && (
              <button
                type="button"
                onClick={() => void handleDelete()}
                className="flex w-full items-center px-3 py-2 text-sm text-destructive hover:bg-accent"
              >
                Elimina
              </button>
            )}
          </div>
        </>
      )}
    </div>
  );
}

// ── SprintsListClient ─────────────────────────────────────────────────────────

interface SprintsListClientProps {
  initialSprints: SprintWithTaskCount[];
}

export function SprintsListClient({ initialSprints }: SprintsListClientProps) {
  const [sprints, setSprints] = useState(initialSprints);

  function handleDeleted(id: string) {
    setSprints((prev) => prev.filter((s) => s.id !== id));
  }

  if (sprints.length === 0) {
    return (
      <div className="flex flex-col items-center justify-center rounded-lg border border-border bg-card py-16 text-center">
        <Layers size={32} className="mb-3 text-muted-foreground/40" />
        <p className="text-sm text-muted-foreground">Nessuno sprint creato</p>
      </div>
    );
  }

  return (
    <div className="overflow-x-auto rounded-lg border border-border">
      <table className="w-full text-sm">
        <thead>
          <tr className="border-b border-border bg-muted/30 text-left text-xs font-medium text-muted-foreground">
            <th className="px-4 py-3">Nome</th>
            <th className="px-4 py-3">Status</th>
            <th className="px-4 py-3">Periodo</th>
            <th className="px-4 py-3">Task</th>
            <th className="px-4 py-3 min-w-[140px]">Progresso</th>
            <th className="px-4 py-3 w-12" />
          </tr>
        </thead>
        <tbody>
          {sprints.map((sprint) => {
            const config = STATUS_CONFIG[sprint.status] ?? STATUS_CONFIG["planning"]!;
            const total = sprint.task_count;
            const completed = sprint.tasks_completed;
            const pct = total > 0 ? Math.round((completed / total) * 100) : 0;

            return (
              <tr
                key={sprint.id}
                className="h-11 border-b border-border last:border-b-0 hover:bg-accent/50 transition-colors"
              >
                {/* Sprint name */}
                <td className="px-4 py-2">
                  <Link
                    href={`/sprints/${sprint.id}`}
                    className="text-sm font-medium text-foreground hover:underline"
                  >
                    {sprint.name}
                  </Link>
                </td>

                {/* Status badge */}
                <td className="px-4 py-2">
                  <span
                    className={cn(
                      "inline-flex items-center rounded-full px-2 py-0.5 text-xs font-medium",
                      config.className
                    )}
                  >
                    {config.label}
                  </span>
                </td>

                {/* Period */}
                <td className="px-4 py-2 text-sm text-muted-foreground whitespace-nowrap">
                  {formatPeriod(sprint)}
                </td>

                {/* Task count */}
                <td className="px-4 py-2 text-sm text-muted-foreground">
                  {total} task
                </td>

                {/* Progress bar */}
                <td className="px-4 py-2">
                  <div className="flex items-center gap-2">
                    <div className="h-1 flex-1 rounded-full bg-muted overflow-hidden">
                      <div
                        className="h-full rounded-full bg-foreground transition-all"
                        style={{ width: `${pct}%` }}
                      />
                    </div>
                    <span className="text-xs text-muted-foreground tabular-nums w-8 text-right">
                      {pct}%
                    </span>
                  </div>
                </td>

                {/* Actions */}
                <td className="px-2 py-2">
                  <ActionsDropdown sprint={sprint} onDeleted={handleDeleted} />
                </td>
              </tr>
            );
          })}
        </tbody>
      </table>
    </div>
  );
}

// ── New Sprint button (client for navigation) ─────────────────────────────────

export function NewSprintButton() {
  return (
    <Link
      href="/backlog?tab=sprint&action=new"
      className="inline-flex items-center gap-1.5 rounded-md border border-border px-3 py-2 text-sm font-medium transition-colors hover:bg-accent"
    >
      <Plus size={14} />
      Nuovo Sprint
    </Link>
  );
}
