"use client";

import { useState } from "react";
import { X } from "lucide-react";
import type { ContextDocument } from "@robin/shared-types";

interface ContextDocCardProps {
  doc: ContextDocument;
  deleting: boolean;
  onEdit: () => void;
  onDelete: () => void;
}

export function ContextDocCard({ doc, deleting, onEdit, onDelete }: ContextDocCardProps) {
  const [confirmDelete, setConfirmDelete] = useState(false);

  const sourceLabel = doc.source_path
    ? `${doc.source_repo_full_name ?? ""}/${doc.source_path}`
    : "Manuale";

  const updatedAt = new Date(doc.updated_at).toLocaleDateString("it-IT", {
    day: "2-digit",
    month: "short",
    year: "numeric",
  });

  const preview = doc.content.slice(0, 100).replace(/[#*_`\n]/g, " ").trim();

  return (
    <div className="flex flex-col rounded-lg border border-border bg-card p-4 gap-2.5 hover:border-primary/30 transition-colors">
      {/* Header */}
      <div className="flex items-start justify-between gap-2">
        <h3 className="font-semibold text-sm leading-snug line-clamp-2 flex-1">{doc.title}</h3>
        <div className="flex items-center gap-1 shrink-0">
          <button
            onClick={onEdit}
            className="rounded px-2 py-0.5 text-xs text-muted-foreground hover:text-foreground hover:bg-accent transition-colors"
          >
            Modifica
          </button>
          {confirmDelete ? (
            <>
              <button
                onClick={() => { onDelete(); setConfirmDelete(false); }}
                disabled={deleting}
                className="rounded px-2 py-0.5 text-xs text-red-600 hover:bg-red-50 dark:hover:bg-red-950/30 transition-colors disabled:opacity-50"
              >
                {deleting ? "…" : "Conferma"}
              </button>
              <button
                onClick={() => setConfirmDelete(false)}
                className="rounded p-1 text-muted-foreground hover:bg-accent transition-colors"
                aria-label="Annulla"
              >
                <X className="h-3.5 w-3.5" />
              </button>
            </>
          ) : (
            <button
              onClick={() => setConfirmDelete(true)}
              className="rounded px-2 py-0.5 text-xs text-muted-foreground hover:text-red-600 hover:bg-red-50 dark:hover:bg-red-950/30 transition-colors"
            >
              Elimina
            </button>
          )}
        </div>
      </div>

      {/* Preview */}
      {preview && (
        <p className="text-xs text-muted-foreground line-clamp-2 leading-relaxed">
          {preview.length >= 100 ? preview + "…" : preview}
        </p>
      )}

      {/* Footer */}
      <div className="flex items-center gap-2 flex-wrap mt-auto">
        <span className="rounded px-1.5 py-0.5 text-xs bg-slate-100 dark:bg-slate-800 text-slate-600 dark:text-slate-300 font-mono truncate max-w-[180px]">
          {sourceLabel}
        </span>
        <span className="text-xs text-muted-foreground ml-auto shrink-0">{updatedAt}</span>
      </div>
    </div>
  );
}
