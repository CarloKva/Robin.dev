"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { ContextDocCard } from "@/components/context/ContextDocCard";
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
    // Re-fetch docs optimistically from server
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

      {/* Document grid */}
      {docs.length === 0 ? (
        <div className="rounded-lg border border-dashed border-border bg-card px-6 py-12 text-center">
          <p className="text-sm text-muted-foreground">Nessun documento di contesto.</p>
          <p className="mt-1 text-xs text-muted-foreground">
            Crea documenti manuali o sincronizza file .md dalla tua repo GitHub.
          </p>
        </div>
      ) : (
        <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-3">
          {docs.map((doc) => (
            <ContextDocCard
              key={doc.id}
              doc={doc}
              deleting={deletingId === doc.id}
              onEdit={() => setEditingDoc(doc)}
              onDelete={() => void handleDelete(doc.id)}
            />
          ))}
        </div>
      )}

      {/* Editor drawer */}
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
