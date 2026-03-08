"use client";

import { useState, useTransition, useCallback, useEffect, useRef } from "react";
import { useRouter } from "next/navigation";
import {
  Plus,
  Search,
  FileText,
  MousePointerClick,
  Pencil,
  Trash2,
  Github,
  Loader2,
  Check,
} from "lucide-react";
import { SyncFromGitHubModal } from "@/components/context/SyncFromGitHubModal";
import { Input } from "@/components/ui/input";
import type { ContextDocument, Repository } from "@robin/shared-types";
import { cn } from "@/lib/utils";

interface ContextPageClientProps {
  initialDocs: ContextDocument[];
  repositories: Repository[];
}

type SaveState = "idle" | "saving" | "saved";
type DocType = "file" | "url" | "text" | "snippet";

function getDocType(doc: ContextDocument): DocType {
  if (doc.source_path) return "file";
  if (doc.content.trimStart().startsWith("http")) return "url";
  if (doc.content.length < 200 && !doc.content.includes("\n")) return "snippet";
  return "text";
}

function getTypeBadgeClass(type: DocType): string {
  switch (type) {
    case "file":
      return "bg-zinc-100 text-zinc-700 dark:bg-zinc-800 dark:text-zinc-300";
    case "url":
      return "bg-blue-50 text-blue-700 dark:bg-blue-950 dark:text-blue-300";
    case "text":
      return "bg-violet-50 text-violet-700 dark:bg-violet-950 dark:text-violet-300";
    case "snippet":
      return "bg-amber-50 text-amber-700 dark:bg-amber-950 dark:text-amber-300";
  }
}

function formatSize(content: string): string {
  const bytes = new TextEncoder().encode(content).length;
  if (bytes < 1024) return `${bytes} B`;
  return `${(bytes / 1024).toFixed(1)} KB`;
}

function formatDate(dateStr: string): string {
  const d = new Date(dateStr);
  const now = new Date();
  const diff = now.getTime() - d.getTime();
  const days = Math.floor(diff / 86400000);
  if (days === 0) return "Oggi";
  if (days === 1) return "Ieri";
  if (days < 7) return `${days}g fa`;
  return d.toLocaleDateString("it-IT", { day: "2-digit", month: "short" });
}

export function ContextPageClient({ initialDocs, repositories }: ContextPageClientProps) {
  const router = useRouter();
  const [, startTransition] = useTransition();

  const [docs, setDocs] = useState<ContextDocument[]>(initialDocs);
  const [selectedDocId, setSelectedDocId] = useState<string | "new" | null>(null);
  const [isSyncModalOpen, setIsSyncModalOpen] = useState(false);
  const [searchQuery, setSearchQuery] = useState("");
  const [isEditMode, setIsEditMode] = useState(false);

  // Editor state
  const [editorTitle, setEditorTitle] = useState("");
  const [editorContent, setEditorContent] = useState("");
  const [saveState, setSaveState] = useState<SaveState>("idle");
  const [saveError, setError] = useState<string | null>(null);

  // Flag to open next selection in edit mode
  const editOnSelectRef = useRef(false);

  const isNewDoc = selectedDocId === "new";
  const selectedDoc =
    selectedDocId && selectedDocId !== "new"
      ? docs.find((d) => d.id === selectedDocId) ?? null
      : null;

  function refresh() {
    startTransition(() => router.refresh());
  }

  useEffect(() => {
    if (selectedDocId === "new") {
      setEditorTitle("");
      setEditorContent("");
      setSaveState("idle");
      setError(null);
      setIsEditMode(true);
    } else if (selectedDoc) {
      setEditorTitle(selectedDoc.title);
      setEditorContent(selectedDoc.content);
      setSaveState("idle");
      setError(null);
      setIsEditMode(editOnSelectRef.current);
      editOnSelectRef.current = false;
    }
  }, [selectedDocId]); // eslint-disable-line react-hooks/exhaustive-deps

  function selectDoc(docId: string | "new") {
    setSelectedDocId(docId);
  }

  function handleEditDoc(docId: string) {
    if (selectedDocId === docId) {
      setIsEditMode(true);
    } else {
      editOnSelectRef.current = true;
      setSelectedDocId(docId);
    }
  }

  const saveDoc = useCallback(
    async (title: string, content: string) => {
      if (!title.trim() || !content.trim()) return;
      setSaveState("saving");
      setError(null);
      try {
        const isNew = selectedDocId === "new";
        const url = isNew ? "/api/context" : `/api/context/${selectedDocId}`;
        const method = isNew ? "POST" : "PUT";
        const res = await fetch(url, {
          method,
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ title: title.trim(), content: content.trim() }),
        });
        const data = (await res.json()) as { doc?: ContextDocument; error?: string };
        if (!res.ok || !data.doc) {
          setError(data.error ?? "Errore durante il salvataggio.");
          setSaveState("idle");
          return;
        }
        const saved = data.doc;
        setDocs((prev) => {
          const idx = prev.findIndex((d) => d.id === saved.id);
          if (idx === -1) return [saved, ...prev];
          const next = [...prev];
          next[idx] = saved;
          return next;
        });
        if (isNew) setSelectedDocId(saved.id);
        setSaveState("saved");
        setIsEditMode(false);
        setTimeout(() => setSaveState("idle"), 2000);
        refresh();
      } catch {
        setError("Errore di rete.");
        setSaveState("idle");
      }
    },
    [selectedDocId], // eslint-disable-line react-hooks/exhaustive-deps
  );

  function handleCancel() {
    if (isNewDoc) {
      setSelectedDocId(null);
    } else if (selectedDoc) {
      setEditorTitle(selectedDoc.title);
      setEditorContent(selectedDoc.content);
      setIsEditMode(false);
    }
  }

  async function handleDelete(docId: string) {
    if (!confirm("Eliminare questo documento?")) return;
    const res = await fetch(`/api/context/${docId}`, { method: "DELETE" });
    if (res.ok) {
      setDocs((prev) => prev.filter((d) => d.id !== docId));
      if (selectedDocId === docId) setSelectedDocId(null);
      refresh();
    }
  }

  function handleSyncDone() {
    setIsSyncModalOpen(false);
    refresh();
    fetch("/api/context")
      .then((r) => r.json())
      .then((data: { docs: ContextDocument[] }) => setDocs(data.docs))
      .catch(() => undefined);
  }

  const filteredDocs = docs.filter((doc) => {
    if (!searchQuery.trim()) return true;
    const q = searchQuery.toLowerCase();
    return doc.title.toLowerCase().includes(q) || doc.content.toLowerCase().includes(q);
  });

  return (
    <div className="p-6 h-full overflow-auto flex flex-col gap-6">
      {/* Page header */}
      <div>
        <h1 className="text-xl font-semibold">Context</h1>
        <p className="text-sm text-muted-foreground">Documenti di contesto per gli agenti AI</p>
      </div>

      {/* Two-column grid */}
      <div className="grid grid-cols-3 gap-6 flex-1 min-h-0">
        {/* Left column — table */}
        <div className="col-span-1 flex flex-col gap-3">
          {/* Toolbar */}
          <div className="flex items-center justify-between gap-2 mb-3">
            <div className="relative w-full max-w-xs">
              <Search
                size={14}
                className="absolute left-2.5 top-1/2 -translate-y-1/2 text-muted-foreground"
              />
              <Input
                placeholder="Cerca contesto..."
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                className="pl-8 text-sm h-8"
              />
            </div>
            <div className="flex items-center gap-1 shrink-0">
              {repositories.length > 0 && (
                <button
                  onClick={() => setIsSyncModalOpen(true)}
                  className="flex items-center gap-1.5 rounded-md border border-input bg-background px-2.5 py-1.5 text-sm hover:bg-accent transition-colors"
                  title="Sincronizza da GitHub"
                >
                  <Github size={14} />
                </button>
              )}
              <button
                onClick={() => selectDoc("new")}
                className="flex items-center gap-1.5 rounded-md border border-input bg-background px-2.5 py-1.5 text-sm hover:bg-accent transition-colors"
              >
                <Plus size={14} />
                Add context
              </button>
            </div>
          </div>

          {/* Table */}
          <div className="border border-border rounded-md overflow-hidden">
            {/* Table header */}
            <div className="flex items-center px-3 py-2 bg-muted/50 border-b border-border">
              <div className="flex-1 text-xs font-medium text-muted-foreground">Nome</div>
              <div className="w-[72px] text-xs font-medium text-muted-foreground">Tipo</div>
              <div className="w-20 text-right text-xs font-medium text-muted-foreground">Dim.</div>
              <div className="w-24 text-right text-xs font-medium text-muted-foreground">
                Aggiornato
              </div>
              <div className="w-16" />
            </div>

            {/* Rows */}
            {filteredDocs.length === 0 ? (
              <div className="flex flex-col items-center justify-center py-12 gap-2">
                <FileText size={24} className="text-muted-foreground/50" />
                <p className="text-sm text-muted-foreground">Nessun contesto aggiunto</p>
              </div>
            ) : (
              <div className="overflow-y-auto">
                {filteredDocs.map((doc) => {
                  const isSelected = selectedDocId === doc.id;
                  const type = getDocType(doc);
                  return (
                    <div
                      key={doc.id}
                      onClick={() => selectDoc(doc.id)}
                      className={cn(
                        "flex items-center px-3 border-b border-border cursor-pointer transition-colors relative",
                        "h-11",
                        isSelected ? "bg-accent" : "hover:bg-accent/50",
                      )}
                    >
                      {isSelected && (
                        <span className="absolute left-0 top-0 h-full w-[2px] bg-foreground" />
                      )}
                      {/* Nome */}
                      <div className="flex-1 min-w-0 pr-2">
                        <span className="text-sm font-medium text-foreground truncate block">
                          {doc.title}
                        </span>
                      </div>
                      {/* Tipo */}
                      <div className="w-[72px]">
                        <span
                          className={cn(
                            "text-xs px-1.5 py-0.5 rounded font-medium",
                            getTypeBadgeClass(type),
                          )}
                        >
                          {type}
                        </span>
                      </div>
                      {/* Dimensione */}
                      <div className="w-20 text-right">
                        <span className="text-xs text-muted-foreground">
                          {formatSize(doc.content)}
                        </span>
                      </div>
                      {/* Aggiornato */}
                      <div className="w-24 text-right">
                        <span className="text-xs text-muted-foreground">
                          {formatDate(doc.updated_at)}
                        </span>
                      </div>
                      {/* Actions */}
                      <div
                        className="w-16 flex justify-end items-center gap-1"
                        onClick={(e) => e.stopPropagation()}
                      >
                        <button
                          className="rounded-md p-1.5 text-muted-foreground hover:text-foreground hover:bg-accent transition-colors"
                          onClick={() => handleEditDoc(doc.id)}
                          title="Modifica"
                        >
                          <Pencil size={14} />
                        </button>
                        <button
                          className="rounded-md p-1.5 text-muted-foreground hover:text-red-600 hover:bg-red-50 dark:hover:bg-red-950/20 transition-colors"
                          onClick={() => void handleDelete(doc.id)}
                          title="Elimina"
                        >
                          <Trash2 size={14} />
                        </button>
                      </div>
                    </div>
                  );
                })}
              </div>
            )}
          </div>
        </div>

        {/* Right column — preview/editor */}
        <div className="col-span-2 flex flex-col">
          {selectedDocId === null ? (
            /* Empty state */
            <div className="flex flex-col items-center justify-center h-full gap-3">
              <MousePointerClick size={32} className="text-muted-foreground/50" />
              <p className="text-sm text-muted-foreground">
                Seleziona un elemento per visualizzarlo
              </p>
            </div>
          ) : (
            /* Editor */
            <div className="flex flex-col h-full">
              {/* Editor header */}
              <div className="flex items-center gap-2">
                {!isNewDoc && selectedDoc ? (
                  <>
                    <span className="text-sm font-semibold">{selectedDoc.title}</span>
                    <span
                      className={cn(
                        "text-xs px-1.5 py-0.5 rounded font-medium",
                        getTypeBadgeClass(getDocType(selectedDoc)),
                      )}
                    >
                      {getDocType(selectedDoc)}
                    </span>
                    <span className="text-xs text-muted-foreground">
                      {formatSize(selectedDoc.content)}
                    </span>
                  </>
                ) : (
                  <span className="text-sm font-semibold text-muted-foreground">
                    Nuovo documento
                  </span>
                )}
              </div>

              <div className="border-b border-border my-3" />

              {/* Title input (edit mode or new doc) */}
              {(isEditMode || isNewDoc) && (
                <div className="mb-3">
                  <input
                    type="text"
                    value={editorTitle}
                    onChange={(e) => setEditorTitle(e.target.value)}
                    placeholder="Titolo documento"
                    className="w-full text-base font-semibold bg-transparent border border-border rounded-md px-3 py-2 outline-none focus:ring-1 focus:ring-ring placeholder:text-muted-foreground"
                  />
                </div>
              )}

              {/* Error */}
              {saveError && (
                <p className="mb-3 text-xs text-red-600 dark:text-red-400">{saveError}</p>
              )}

              {/* Content textarea */}
              <textarea
                value={isEditMode || isNewDoc ? editorContent : (selectedDoc?.content ?? "")}
                onChange={(e) => setEditorContent(e.target.value)}
                readOnly={!isEditMode && !isNewDoc}
                placeholder={
                  isEditMode || isNewDoc
                    ? "# Descrizione\n\nInserisci qui il documento in Markdown…"
                    : ""
                }
                className={cn(
                  "bg-muted rounded-md p-4 font-mono text-xs text-foreground",
                  "w-full min-h-[400px] resize-none border border-border",
                  !isEditMode && !isNewDoc && "cursor-default",
                )}
              />

              {/* Bottom toolbar */}
              <div className="flex items-center gap-2 mt-3">
                {saveState === "saving" && (
                  <div className="flex items-center gap-1 text-xs text-muted-foreground">
                    <Loader2 size={14} className="animate-spin" />
                    Salvataggio…
                  </div>
                )}
                {saveState === "saved" && (
                  <div className="flex items-center gap-1 text-xs text-green-600 dark:text-green-400">
                    <Check size={14} />
                    Salvato
                  </div>
                )}
                <div className="flex-1" />
                {!isEditMode && !isNewDoc ? (
                  <button
                    onClick={() => setIsEditMode(true)}
                    className="flex items-center gap-1.5 rounded-md border border-input bg-background px-3 py-1.5 text-sm hover:bg-accent transition-colors"
                  >
                    Modifica
                  </button>
                ) : (
                  <>
                    <button
                      onClick={handleCancel}
                      className="rounded-md px-3 py-1.5 text-sm text-muted-foreground hover:text-foreground hover:bg-accent transition-colors"
                    >
                      Annulla
                    </button>
                    <button
                      onClick={() => void saveDoc(editorTitle, editorContent)}
                      disabled={saveState === "saving"}
                      className="rounded-md bg-primary px-3 py-1.5 text-sm font-medium text-primary-foreground hover:bg-primary/90 transition-colors disabled:opacity-50"
                    >
                      Salva
                    </button>
                  </>
                )}
              </div>
            </div>
          )}
        </div>
      </div>

      {/* Sync modal */}
      {isSyncModalOpen && (
        <SyncFromGitHubModal
          repositories={repositories}
          onClose={() => setIsSyncModalOpen(false)}
          onSynced={handleSyncDone}
        />
      )}
    </div>
  );
}
