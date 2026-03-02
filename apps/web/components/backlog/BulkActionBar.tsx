"use client";

import { useState } from "react";
import type { Sprint } from "@robin/shared-types";

interface BulkActionBarProps {
  selectedIds: string[];
  sprints: Sprint[];
  onDone: () => void;
}

export function BulkActionBar({ selectedIds, sprints, onDone }: BulkActionBarProps) {
  const [activeAction, setActiveAction] = useState<string | null>(null);
  const [selectedSprint, setSelectedSprint] = useState<string>("");

  if (selectedIds.length === 0) return null;

  const isLoading = activeAction !== null;

  async function bulkAction(action: string, payload?: Record<string, unknown>) {
    setActiveAction(action);
    try {
      await fetch("/api/tasks/bulk", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ action, taskIds: selectedIds, payload: payload ?? {} }),
      });
      onDone();
    } finally {
      setActiveAction(null);
    }
  }

  const planningOrActive = sprints.filter((s) => s.status === "planning" || s.status === "active");

  return (
    <div className="fixed inset-x-4 bottom-20 z-50 mx-auto max-w-2xl md:bottom-6">
      <div className="flex items-center gap-2 rounded-xl border border-border bg-popover px-4 py-3 shadow-lg">
        <span className="text-sm font-medium text-foreground inline-flex items-center gap-2">
          {isLoading && (
            <span className="h-3.5 w-3.5 animate-spin rounded-full border-2 border-current border-t-transparent" />
          )}
          {selectedIds.length} task selezionate
        </span>

        <div className="flex flex-1 flex-wrap items-center justify-end gap-2">
          {planningOrActive.length > 0 && (
            <div className="flex items-center gap-1">
              <select
                value={selectedSprint}
                onChange={(e) => setSelectedSprint(e.target.value)}
                disabled={isLoading}
                className="rounded border border-border bg-background px-2 py-1 text-xs disabled:opacity-50"
              >
                <option value="">Seleziona sprint...</option>
                {planningOrActive.map((s) => (
                  <option key={s.id} value={s.id}>
                    {s.name}
                  </option>
                ))}
              </select>
              <button
                onClick={() => {
                  if (!selectedSprint) return;
                  void bulkAction("add_to_sprint", { sprintId: selectedSprint });
                }}
                disabled={isLoading || !selectedSprint}
                className="rounded bg-primary px-2 py-1 text-xs font-medium text-primary-foreground hover:bg-primary/90 disabled:opacity-50"
              >
                {activeAction === "add_to_sprint" ? "Aggiungendo..." : "Aggiungi a sprint"}
              </button>
            </div>
          )}

          <button
            onClick={() => void bulkAction("set_priority", { priority: "high" })}
            disabled={isLoading}
            className="rounded border border-border bg-background px-2 py-1 text-xs hover:bg-accent disabled:opacity-50"
          >
            {activeAction === "set_priority" ? "Aggiornando..." : "→ High"}
          </button>

          <button
            onClick={() => void bulkAction("move_to_backlog")}
            disabled={isLoading}
            className="rounded border border-border bg-background px-2 py-1 text-xs hover:bg-accent disabled:opacity-50"
          >
            {activeAction === "move_to_backlog" ? "Rimuovendo..." : "Togli da sprint"}
          </button>

          <button
            onClick={() => {
              if (!confirm(`Cancellare ${selectedIds.length} task? Questa azione non è reversibile.`)) return;
              void bulkAction("cancel");
            }}
            disabled={isLoading}
            className="rounded bg-destructive px-2 py-1 text-xs font-medium text-destructive-foreground hover:bg-destructive/90 disabled:opacity-50"
          >
            {activeAction === "cancel" ? "Cancellando..." : "Cancella"}
          </button>
        </div>
      </div>
    </div>
  );
}
