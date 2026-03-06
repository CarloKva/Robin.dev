"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { ContextDocEditor } from "@/components/context/ContextDocEditor";
import { SyncFromGitHubModal } from "@/components/context/SyncFromGitHubModal";
import type { ContextDocument, Repository } from "@robin/shared-types";

interface ContextPageClientProps {
  initialDocs: ContextDocument[];
  repositories: Repository[];
}

export function ContextPageClient({ initialDocs, repositories }: ContextPageClientProps) {
  const router = useRouter();
  const [, startTransition] = useTransition();

  const [docs, setDocs] = useState<ContextDocument[]>(initialDocs);
  const [editingDoc, setEditingDoc] = useState<ContextDocument | null | "new">(null);
  const [isSyncModalOpen, setIsSyncModalOpen] = useState(false);
  const [deletingId, setDeletingId] = useState<string | null>(null);

  function refresh() {
    startTransition(() => router.refresh());
  }

  async function handleDelete(docId: string) {
    setDeletingId(docId);
    try {
      const res = await fetch(`/api/context/${docId}`, { method: "DELETE" });
      if (res.ok) {
        setDocs((prev) => prev.filter((d) => d.id !== docId));
        refresh();
      }
    } finally {
      setDeletingId(null);
    }
  }

  function handleSaved(doc: ContextDocument) {
    setDocs((prev) => {
      const idx = prev.findIndex((d) => d.id === doc.id);
      if (idx === -1) return [doc, ...prev];
      const next = [...prev];
      next[idx] = doc;
      return next;
    });
    setEditingDoc(null);
    refresh();
  }

  function handleSyncDone() {
    setIsSyncModalOpen(false);
    refresh();
    fetch("/api/context")
      .then((r) => r.json())
      .then((data: { docs: ContextDocument[] }) => setDocs(data.docs))
      .catch(() => undefined);
  }

  return (
    <>
      {/* Action bar */}
      <div className="mb-4 flex items-center gap-2">
        <button
          onClick={() => setEditingDoc("new")}
          className="rounded-md bg-primary px-3 py-1.5 text-xs font-semibold text-primary-foreground hover:bg-primary/90 transition-colors"
        >
          + Nuovo documento
        </button>
        {repositories.length > 0 && (
          <button
            onClick={() => setIsSyncModalOpen(true)}
            className="rounded-md border border-border bg-background px-3 py-1.5 text-xs font-medium hover:bg-accent transition-colors"
          >
            ↻ Sincronizza da GitHub
          </button>
        )}
      </div>

      {/* Document table */}
      {docs.length === 0 ? (
        <div className="rounded-lg border border-dashed border-border bg-card px-6 py-12 text-center">
          <p className="text-sm text-muted-foreground">Nessun documento di contesto.</p>
          <p className="mt-1 text-xs text-muted-foreground">
            Crea documenti manuali o sincronizza file .md dalla tua repo GitHub.
          </p>
        </div>
      ) : (
        <div className="rounded-lg border border-border overflow-hidden">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-border bg-muted/40">
                <th className="px-4 py-2.5 text-left font-medium text-muted-foreground">Titolo</th>
                <th className="px-4 py-2.5 text-left font-medium text-muted-foreground hidden sm:table-cell">Sorgente</th>
                <th className="px-4 py-2.5 text-left font-medium text-muted-foreground hidden md:table-cell">Aggiornato</th>
                <th className="px-4 py-2.5 text-right font-medium text-muted-foreground">Azioni</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-border">
              {docs.map((doc) => {
                const sourceLabel = doc.source_path
                  ? `${doc.source_repo_full_name ?? ""}/${doc.source_path}`
                  : "Manuale";
                const updatedAt = new Date(doc.updated_at).toLocaleDateString("it-IT", {
                  day: "2-digit",
                  month: "short",
                  year: "numeric",
                });

                return (
                  <tr
                    key={doc.id}
                    className="hover:bg-accent/40 cursor-pointer transition-colors"
                    onClick={() => setEditingDoc(doc)}
                  >
                    <td className="px-4 py-3 font-medium text-foreground">{doc.title}</td>
                    <td className="px-4 py-3 text-muted-foreground hidden sm:table-cell">
                      <span className="inline-flex items-center rounded-full bg-muted px-2 py-0.5 text-xs">
                        {sourceLabel}
                      </span>
                    </td>
                    <td className="px-4 py-3 text-muted-foreground hidden md:table-cell tabular-nums">
                      {updatedAt}
                    </td>
                    <td className="px-4 py-3 text-right" onClick={(e) => e.stopPropagation()}>
                      <button
                        onClick={() => setEditingDoc(doc)}
                        className="rounded px-2 py-1 text-xs text-muted-foreground hover:text-foreground hover:bg-accent transition-colors"
                      >
                        Apri
                      </button>
                      <button
                        onClick={() => {
                          if (confirm("Eliminare questo documento?")) {
                            void handleDelete(doc.id);
                          }
                        }}
                        disabled={deletingId === doc.id}
                        className="ml-1 rounded px-2 py-1 text-xs text-red-600 hover:bg-red-50 dark:hover:bg-red-950/30 transition-colors disabled:opacity-50"
                      >
                        {deletingId === doc.id ? "…" : "Elimina"}
                      </button>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      )}

      {/* Editor / viewer drawer */}
      {editingDoc !== null && (
        <ContextDocEditor
          doc={editingDoc === "new" ? null : editingDoc}
          onClose={() => setEditingDoc(null)}
          onSaved={handleSaved}
        />
      )}

      {/* Sync modal */}
      {isSyncModalOpen && (
        <SyncFromGitHubModal
          repositories={repositories}
          onClose={() => setIsSyncModalOpen(false)}
          onSynced={handleSyncDone}
        />
      )}
    </>
  );
}
