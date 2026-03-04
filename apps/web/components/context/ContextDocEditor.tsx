"use client";

import { useState } from "react";
import { X } from "lucide-react";
import type { ContextDocument } from "@robin/shared-types";

interface ContextDocEditorProps {
  doc: ContextDocument | null;
  onClose: () => void;
  onSaved: (doc: ContextDocument) => void;
}

export function ContextDocEditor({ doc, onClose, onSaved }: ContextDocEditorProps) {
  const [title, setTitle] = useState(doc?.title ?? "");
  const [content, setContent] = useState(doc?.content ?? "");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function handleSave() {
    if (!title.trim() || !content.trim()) {
      setError("Titolo e contenuto sono obbligatori.");
      return;
    }
    setError(null);
    setLoading(true);
    try {
      const isNew = doc === null;
      const url = isNew ? "/api/context" : `/api/context/${doc.id}`;
      const method = isNew ? "POST" : "PUT";
      const res = await fetch(url, {
        method,
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ title: title.trim(), content: content.trim() }),
      });
      const data = (await res.json()) as { doc?: ContextDocument; error?: string };
      if (!res.ok || !data.doc) {
        setError(data.error ?? "Errore durante il salvataggio.");
        return;
      }
      onSaved(data.doc);
    } catch {
      setError("Errore di rete.");
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="fixed inset-0 z-50 flex">
      {/* Backdrop */}
      <div className="absolute inset-0 bg-black/40" onClick={onClose} aria-hidden="true" />

      {/* Drawer panel (right side) */}
      <div className="relative z-10 ml-auto flex h-full w-full max-w-xl flex-col border-l border-border bg-background shadow-2xl">
        {/* Header */}
        <div className="flex items-center justify-between border-b border-border px-5 py-4 shrink-0">
          <h2 className="font-semibold text-base">
            {doc === null ? "Nuovo documento" : "Modifica documento"}
          </h2>
          <button
            onClick={onClose}
            className="rounded-md p-1 text-muted-foreground hover:text-foreground hover:bg-accent transition-colors"
            aria-label="Chiudi"
          >
            <X className="h-4 w-4" />
          </button>
        </div>

        {/* Body */}
        <div className="flex-1 overflow-y-auto px-5 py-4 space-y-4">
          <div>
            <label className="block text-sm font-medium mb-1.5">Titolo</label>
            <input
              type="text"
              value={title}
              onChange={(e) => setTitle(e.target.value)}
              placeholder="es. Architettura del progetto"
              className="w-full rounded-md border border-border bg-background px-3 py-2 text-sm focus:outline-none focus:ring-1 focus:ring-ring"
            />
          </div>
          <div className="flex flex-col flex-1">
            <label className="block text-sm font-medium mb-1.5">Contenuto (Markdown)</label>
            <textarea
              value={content}
              onChange={(e) => setContent(e.target.value)}
              placeholder="# Descrizione&#10;&#10;Inserisci qui il documento..."
              className="w-full rounded-md border border-border bg-background px-3 py-2 text-sm font-mono resize-y focus:outline-none focus:ring-1 focus:ring-ring min-h-[300px]"
            />
          </div>

          {error && (
            <p className="text-xs text-red-600 dark:text-red-400">{error}</p>
          )}
        </div>

        {/* Footer */}
        <div className="border-t border-border px-5 py-4 shrink-0 flex gap-2 justify-end">
          <button
            onClick={onClose}
            disabled={loading}
            className="rounded-md border border-border bg-background px-4 py-2 text-sm font-medium hover:bg-accent transition-colors disabled:opacity-50"
          >
            Annulla
          </button>
          <button
            onClick={() => void handleSave()}
            disabled={loading}
            className="rounded-md bg-primary px-4 py-2 text-sm font-medium text-primary-foreground hover:bg-primary/90 transition-colors disabled:opacity-50"
          >
            {loading ? "Salvando…" : "Salva"}
          </button>
        </div>
      </div>
    </div>
  );
}
