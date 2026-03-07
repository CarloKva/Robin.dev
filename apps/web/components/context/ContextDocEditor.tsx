"use client";

import { useState } from "react";
import { X, Pencil } from "lucide-react";
import ReactMarkdown from "react-markdown";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import type { ContextDocument } from "@robin/shared-types";

type Mode = "view" | "edit";

interface ContextDocEditorProps {
  doc: ContextDocument | null;
  onClose: () => void;
  onSaved: (doc: ContextDocument) => void;
}

export function ContextDocEditor({ doc, onClose, onSaved }: ContextDocEditorProps) {
  const [mode, setMode] = useState<Mode>(doc === null ? "edit" : "view");
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

  const isNew = doc === null;
  const panelTitle = isNew ? "Nuovo documento" : mode === "view" ? doc.title : "Modifica documento";

  return (
    <div className="fixed inset-0 z-50 flex">
      {/* Backdrop */}
      <div className="absolute inset-0 bg-black/40" onClick={onClose} aria-hidden="true" />

      {/* Drawer panel (right side) */}
      <div className="relative z-10 ml-auto flex h-full w-full max-w-xl flex-col border-l border-border bg-background shadow-2xl">
        {/* Header */}
        <div className="flex items-center justify-between border-b border-border px-5 py-4 shrink-0">
          <h2 className="font-semibold text-base truncate pr-2">{panelTitle}</h2>
          <div className="flex items-center gap-2 shrink-0">
            {!isNew && mode === "view" && (
              <button
                onClick={() => setMode("edit")}
                className="flex items-center gap-1.5 rounded-md border border-border bg-background px-3 py-1.5 text-sm font-medium hover:bg-accent transition-colors"
              >
                <Pencil className="h-3.5 w-3.5" />
                Modifica
              </button>
            )}
            {mode === "edit" && !isNew && (
              <button
                onClick={() => setMode("view")}
                className="rounded-md px-3 py-1.5 text-sm text-muted-foreground hover:text-foreground transition-colors"
              >
                Annulla modifiche
              </button>
            )}
            <button
              onClick={onClose}
              className="rounded-md p-1 text-muted-foreground hover:text-foreground hover:bg-accent transition-colors"
              aria-label="Chiudi"
            >
              <X className="h-4 w-4" />
            </button>
          </div>
        </div>

        {/* Body */}
        {mode === "view" ? (
          /* ── READ-ONLY VIEW ───────────────────────────────────────────── */
          <div className="flex-1 overflow-y-auto px-6 py-5">
            {doc?.source_path && (
              <p className="mb-4 text-xs text-muted-foreground">
                Sorgente: {doc.source_repo_full_name}/{doc.source_path}
              </p>
            )}
            <article className="max-w-none text-sm text-foreground leading-relaxed">
              <ReactMarkdown
                components={{
                  h1: ({ children }) => <h1 className="text-xl font-bold mt-5 mb-2 border-b border-border pb-1">{children}</h1>,
                  h2: ({ children }) => <h2 className="text-lg font-semibold mt-4 mb-2">{children}</h2>,
                  h3: ({ children }) => <h3 className="text-base font-semibold mt-3 mb-1">{children}</h3>,
                  p: ({ children }) => <p className="mb-3 leading-relaxed">{children}</p>,
                  ul: ({ children }) => <ul className="list-disc pl-5 mb-3 space-y-1">{children}</ul>,
                  ol: ({ children }) => <ol className="list-decimal pl-5 mb-3 space-y-1">{children}</ol>,
                  li: ({ children }) => <li className="leading-relaxed">{children}</li>,
                  code: ({ children, className }) => {
                    const isBlock = Boolean(className?.includes("language-"));
                    return isBlock ? (
                      <code className="block bg-muted px-4 py-3 rounded-md font-mono text-xs overflow-x-auto whitespace-pre">{children}</code>
                    ) : (
                      <code className="bg-muted px-1.5 py-0.5 rounded font-mono text-xs">{children}</code>
                    );
                  },
                  pre: ({ children }) => <pre className="mb-3 rounded-md overflow-x-auto bg-muted">{children}</pre>,
                  blockquote: ({ children }) => <blockquote className="border-l-4 border-border pl-4 text-muted-foreground italic mb-3">{children}</blockquote>,
                  a: ({ children, href }) => <a href={href ?? "#"} className="text-primary underline hover:no-underline" target="_blank" rel="noreferrer">{children}</a>,
                  strong: ({ children }) => <strong className="font-semibold">{children}</strong>,
                  em: ({ children }) => <em className="italic">{children}</em>,
                  hr: () => <hr className="border-border my-4" />,
                }}
              >
                {doc?.content ?? ""}
              </ReactMarkdown>
            </article>
          </div>
        ) : (
          /* ── EDIT FORM ────────────────────────────────────────────────── */
          <div className="flex-1 overflow-y-auto px-5 py-4 space-y-4">
            <div>
              <label className="block text-sm font-medium mb-1.5">Titolo</label>
              <Input
                type="text"
                value={title}
                onChange={(e) => setTitle(e.target.value)}
                placeholder="es. Architettura del progetto"
              />
            </div>
            <div className="flex flex-col flex-1">
              <label className="block text-sm font-medium mb-1.5">Contenuto (Markdown)</label>
              <Textarea
                value={content}
                onChange={(e) => setContent(e.target.value)}
                placeholder={"# Descrizione\n\nInserisci qui il documento..."}
                className="min-h-[300px] font-mono"
              />
            </div>

            {error && (
              <p className="text-xs text-red-600 dark:text-red-400">{error}</p>
            )}
          </div>
        )}

        {/* Footer */}
        {mode === "edit" && (
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
        )}
      </div>
    </div>
  );
}
