"use client";

import { useRouter, useSearchParams, usePathname } from "next/navigation";
import { useCallback } from "react";
import type { Repository } from "@robin/shared-types";

const TASK_TYPES = [
  { value: "", label: "Tutti i tipi" },
  { value: "bug", label: "Bug" },
  { value: "feature", label: "Feature" },
  { value: "refactor", label: "Refactor" },
  { value: "chore", label: "Chore" },
  { value: "docs", label: "Docs" },
  { value: "accessibility", label: "Accessibility" },
  { value: "security", label: "Security" },
];

const PRIORITIES = [
  { value: "", label: "Tutte le priorità" },
  { value: "critical", label: "Critical" },
  { value: "high", label: "High" },
  { value: "medium", label: "Medium" },
  { value: "low", label: "Low" },
];

const EFFORTS = [
  { value: "", label: "Tutti gli effort" },
  { value: "xs", label: "XS" },
  { value: "s", label: "S" },
  { value: "m", label: "M" },
  { value: "l", label: "L" },
];

interface BacklogFiltersProps {
  repositories: Repository[];
}

export function BacklogFilters({ repositories }: BacklogFiltersProps) {
  const router = useRouter();
  const pathname = usePathname();
  const searchParams = useSearchParams();

  const updateParam = useCallback(
    (key: string, value: string) => {
      const params = new URLSearchParams(searchParams.toString());
      if (value) {
        params.set(key, value);
      } else {
        params.delete(key);
      }
      params.delete("page");
      router.push(`${pathname}?${params.toString()}`);
    },
    [router, pathname, searchParams]
  );

  const selectClass =
    "rounded-md border border-border bg-background px-2.5 py-1.5 text-sm text-foreground transition-colors hover:border-muted-foreground/40 focus:outline-none focus:ring-1 focus:ring-ring focus:border-transparent";

  return (
    <div className="flex flex-wrap items-center gap-2">
      <select
        value={searchParams.get("type") ?? ""}
        onChange={(e) => updateParam("type", e.target.value)}
        className={selectClass}
      >
        {TASK_TYPES.map((t) => (
          <option key={t.value} value={t.value}>
            {t.label}
          </option>
        ))}
      </select>

      <select
        value={searchParams.get("priority") ?? ""}
        onChange={(e) => updateParam("priority", e.target.value)}
        className={selectClass}
      >
        {PRIORITIES.map((p) => (
          <option key={p.value} value={p.value}>
            {p.label}
          </option>
        ))}
      </select>

      <select
        value={searchParams.get("effort") ?? ""}
        onChange={(e) => updateParam("effort", e.target.value)}
        className={selectClass}
      >
        {EFFORTS.map((e) => (
          <option key={e.value} value={e.value}>
            {e.label}
          </option>
        ))}
      </select>

      {repositories.length > 0 && (
        <select
          value={searchParams.get("repositoryId") ?? ""}
          onChange={(e) => updateParam("repositoryId", e.target.value)}
          className={selectClass}
        >
          <option value="">Tutte le repo</option>
          {repositories.map((r) => (
            <option key={r.id} value={r.id}>
              {r.full_name}
            </option>
          ))}
        </select>
      )}

      {(searchParams.get("type") || searchParams.get("priority") || searchParams.get("effort") || searchParams.get("repositoryId")) && (
        <button
          onClick={() => {
            const params = new URLSearchParams(searchParams.toString());
            ["type", "priority", "effort", "repositoryId", "page"].forEach((k) => params.delete(k));
            router.push(`${pathname}?${params.toString()}`);
          }}
          className="text-xs text-muted-foreground transition-colors hover:text-foreground"
        >
          Rimuovi filtri
        </button>
      )}
    </div>
  );
}
