"use client";

import { useRouter, useSearchParams, usePathname } from "next/navigation";
import { cn } from "@/lib/utils";
import type { TaskStatus, TaskType, TaskPriority } from "@robin/shared-types";

// ── Filter option lists ───────────────────────────────────────────────────────

const STATUS_OPTIONS: { value: TaskStatus | ""; label: string }[] = [
  { value: "", label: "Tutti gli stati" },
  { value: "pending", label: "Pending" },
  { value: "queued", label: "In coda" },
  { value: "in_progress", label: "In corso" },
  { value: "review_pending", label: "In review" },
  { value: "approved", label: "Approvata" },
  { value: "rejected", label: "Rifiutata" },
  { value: "completed", label: "Completata" },
  { value: "failed", label: "Fallita" },
  { value: "cancelled", label: "Annullata" },
];

const TYPE_OPTIONS: { value: TaskType | ""; label: string }[] = [
  { value: "", label: "Tutti i tipi" },
  { value: "bug", label: "Bug" },
  { value: "feature", label: "Feature" },
  { value: "docs", label: "Docs" },
  { value: "refactor", label: "Refactor" },
  { value: "chore", label: "Chore" },
];

const PRIORITY_OPTIONS: { value: TaskPriority | ""; label: string }[] = [
  { value: "", label: "Tutte le priorità" },
  { value: "urgent", label: "Urgent" },
  { value: "high", label: "High" },
  { value: "medium", label: "Medium" },
  { value: "low", label: "Low" },
];

const PERIOD_OPTIONS: { value: string; label: string }[] = [
  { value: "", label: "Tutto il periodo" },
  { value: "today", label: "Oggi" },
  { value: "week", label: "Questa settimana" },
  { value: "month", label: "Questo mese" },
];

// ── Component ─────────────────────────────────────────────────────────────────

export interface ActiveFilters {
  status: string;
  type: string;
  priority: string;
  period: string;
}

interface TaskFiltersProps {
  initialFilters: ActiveFilters;
}

/**
 * Filter controls for the task list.
 * Reads/writes URL search params — no local state for filter values.
 * Changes trigger a server-side re-fetch (no client filtering).
 */
export function TaskFilters({ initialFilters }: TaskFiltersProps) {
  const router = useRouter();
  const pathname = usePathname();
  const searchParams = useSearchParams();

  function updateParam(key: string, value: string) {
    const params = new URLSearchParams(searchParams.toString());
    if (value) {
      params.set(key, value);
    } else {
      params.delete(key);
    }
    // Reset to page 1 when filters change
    params.delete("page");
    router.replace(`${pathname}?${params.toString()}`, { scroll: false });
  }

  const hasActiveFilters =
    initialFilters.status ||
    initialFilters.type ||
    initialFilters.priority ||
    initialFilters.period;

  function clearAll() {
    const params = new URLSearchParams(searchParams.toString());
    params.delete("status");
    params.delete("type");
    params.delete("priority");
    params.delete("period");
    params.delete("page");
    router.replace(`${pathname}?${params.toString()}`, { scroll: false });
  }

  return (
    <div className="flex flex-wrap items-center gap-2">
      <FilterSelect
        value={initialFilters.status}
        options={STATUS_OPTIONS}
        onChange={(v) => updateParam("status", v)}
        placeholder="Stato"
      />
      <FilterSelect
        value={initialFilters.type}
        options={TYPE_OPTIONS}
        onChange={(v) => updateParam("type", v)}
        placeholder="Tipo"
      />
      <FilterSelect
        value={initialFilters.priority}
        options={PRIORITY_OPTIONS}
        onChange={(v) => updateParam("priority", v)}
        placeholder="Priorità"
      />
      <FilterSelect
        value={initialFilters.period}
        options={PERIOD_OPTIONS}
        onChange={(v) => updateParam("period", v)}
        placeholder="Periodo"
      />

      {hasActiveFilters && (
        <button
          onClick={clearAll}
          className="text-xs text-muted-foreground hover:text-foreground underline transition-colors"
        >
          Rimuovi filtri
        </button>
      )}
    </div>
  );
}

function FilterSelect({
  value,
  options,
  onChange,
  placeholder,
}: {
  value: string;
  options: { value: string; label: string }[];
  onChange: (v: string) => void;
  placeholder: string;
}) {
  return (
    <div className="relative">
      <select
        value={value}
        onChange={(e) => onChange(e.target.value)}
        className={cn(
          "h-8 rounded-md border border-border bg-card pl-3 pr-7 text-xs font-medium text-foreground",
          "appearance-none cursor-pointer hover:border-primary/50 focus:outline-none focus:ring-1 focus:ring-ring",
          "transition-colors",
          value && "border-primary/60 bg-accent/30 text-primary"
        )}
      >
        <option value="">{placeholder}</option>
        {options.slice(1).map((opt) => (
          <option key={opt.value} value={opt.value}>
            {opt.label}
          </option>
        ))}
      </select>
      <span className="pointer-events-none absolute right-2 top-1/2 -translate-y-1/2 text-muted-foreground">
        <svg className="h-3 w-3" fill="none" viewBox="0 0 24 24" stroke="currentColor">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
        </svg>
      </span>
    </div>
  );
}
