"use client";

import { useState, useTransition, useCallback, useEffect, useRef } from "react";
import { useRouter } from "next/navigation";
import {
  Plus,
  Search,
  FileText,
  Code,
  FileCode,
  ChevronLeft,
  Bold,
  Italic,
  Link2,
  Code2,
  Loader2,
  Check,
  Github,
  FileInput,
} from "lucide-react";
import { SyncFromGitHubModal } from "@/components/context/SyncFromGitHubModal";
import type { ContextDocument, Repository } from "@robin/shared-types";
import { cn } from "@/lib/utils";

interface ContextPageClientProps {
  initialDocs: ContextDocument[];
  repositories: Repository[];
}

type SaveState = "idle" | "saving" | "saved";

function getDocIcon(doc: ContextDocument) {
  if (doc.source_path) {
    const ext = doc.source_path.split(".").pop()?.toLowerCase();
    if (ext === "md" || ext === "mdx") return <FileCode className="h-4 w-4 shrink-0 text-[#8E8E93]" />;
    if (ext === "ts" || ext === "tsx" || ext === "js" || ext === "jsx") {
      return <Code className="h-4 w-4 shrink-0 text-[#8E8E93]" />;
    }
  }
  return <FileText className="h-4 w-4 shrink-0 text-[#8E8E93]" />;
}

function formatDate(dateStr: string) {
  const d = new Date(dateStr);
  const now = new Date();
  const diff = now.getTime() - d.getTime();
  const days = Math.floor(diff / 86400000);
  if (days === 0) return "Oggi";
  if (days === 1) return "Ieri";
  if (days < 7) return `${days}g fa`;
  return d.toLocaleDateString("it-IT", { day: "2-digit", month: "short" });
}

function getContentSnippet(content: string) {
  return content.replace(/[#*_`\[\]>]/g, "").replace(/\n+/g, " ").trim().slice(0, 120);
}

export function ContextPageClient({ initialDocs, repositories }: ContextPageClientProps) {
  const router = useRouter();
  const [, startTransition] = useTransition();

  const [docs, setDocs] = useState<ContextDocument[]>(initialDocs);
  const [selectedDocId, setSelectedDocId] = useState<string | "new" | null>(null);
  const [isSyncModalOpen, setIsSyncModalOpen] = useState(false);
  const [searchQuery, setSearchQuery] = useState("");
  // Mobile: 'list' shows left panel, 'editor' shows right panel
  const [mobileView, setMobileView] = useState<"list" | "editor">("list");

  // Editor state
  const [editorTitle, setEditorTitle] = useState("");
  const [editorContent, setEditorContent] = useState("");
  const [saveState, setSaveState] = useState<SaveState>("idle");
  const [saveError, setError] = useState<string | null>(null);
  const saveTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const savedTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const isNewDoc = selectedDocId === "new";

  const selectedDoc = selectedDocId && selectedDocId !== "new"
    ? docs.find((d) => d.id === selectedDocId) ?? null
    : null;

  function refresh() {
    startTransition(() => router.refresh());
  }

  // Load doc into editor when selection changes
  useEffect(() => {
    if (selectedDocId === "new") {
      setEditorTitle("");
      setEditorContent("");
      setSaveState("idle");
      setError(null);
    } else if (selectedDoc) {
      setEditorTitle(selectedDoc.title);
      setEditorContent(selectedDoc.content);
      setSaveState("idle");
      setError(null);
    }
    // Clear any pending save timers on selection change
    if (saveTimerRef.current) clearTimeout(saveTimerRef.current);
    if (savedTimerRef.current) clearTimeout(savedTimerRef.current);
  }, [selectedDocId]); // eslint-disable-line react-hooks/exhaustive-deps

  function selectDoc(docId: string | "new") {
    setSelectedDocId(docId);
    setMobileView("editor");
  }

  const saveDoc = useCallback(async (title: string, content: string) => {
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
      if (savedTimerRef.current) clearTimeout(savedTimerRef.current);
      savedTimerRef.current = setTimeout(() => setSaveState("idle"), 2000);
      refresh();
    } catch {
      setError("Errore di rete.");
      setSaveState("idle");
    }
  }, [selectedDocId]); // eslint-disable-line react-hooks/exhaustive-deps

  // Auto-save on content/title change (debounced 1.5s)
  useEffect(() => {
    if (!selectedDocId) return;
    if (!editorTitle.trim() || !editorContent.trim()) return;
    // Don't auto-save if content matches saved doc (no change)
    if (
      selectedDoc &&
      editorTitle.trim() === selectedDoc.title &&
      editorContent.trim() === selectedDoc.content
    ) return;

    if (saveTimerRef.current) clearTimeout(saveTimerRef.current);
    saveTimerRef.current = setTimeout(() => {
      void saveDoc(editorTitle, editorContent);
    }, 1500);

    return () => {
      if (saveTimerRef.current) clearTimeout(saveTimerRef.current);
    };
  }, [editorTitle, editorContent]); // eslint-disable-line react-hooks/exhaustive-deps

  async function handleDelete(docId: string) {
    if (!confirm("Eliminare questo documento?")) return;
    const res = await fetch(`/api/context/${docId}`, { method: "DELETE" });
    if (res.ok) {
      setDocs((prev) => prev.filter((d) => d.id !== docId));
      if (selectedDocId === docId) {
        setSelectedDocId(null);
        setMobileView("list");
      }
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

  function insertMarkdown(syntax: string) {
    const textarea = document.getElementById("context-editor") as HTMLTextAreaElement | null;
    if (!textarea) return;
    const start = textarea.selectionStart;
    const end = textarea.selectionEnd;
    const before = editorContent.slice(0, start);
    const selected = editorContent.slice(start, end);
    const after = editorContent.slice(end);
    const newContent = before + syntax + selected + syntax + after;
    setEditorContent(newContent);
    setTimeout(() => {
      textarea.focus();
      const newPos = start + syntax.length;
      textarea.setSelectionRange(newPos, newPos + selected.length);
    }, 0);
  }

  function insertCodeBlock() {
    const textarea = document.getElementById("context-editor") as HTMLTextAreaElement | null;
    if (!textarea) return;
    const start = textarea.selectionStart;
    const before = editorContent.slice(0, start);
    const after = editorContent.slice(start);
    const newContent = before + "\n```\n\n```\n" + after;
    setEditorContent(newContent);
    setTimeout(() => {
      textarea.focus();
      textarea.setSelectionRange(start + 5, start + 5);
    }, 0);
  }

  function insertLink() {
    const textarea = document.getElementById("context-editor") as HTMLTextAreaElement | null;
    if (!textarea) return;
    const start = textarea.selectionStart;
    const end = textarea.selectionEnd;
    const selected = editorContent.slice(start, end);
    const before = editorContent.slice(0, start);
    const after = editorContent.slice(end);
    const link = `[${selected || "testo"}](url)`;
    setEditorContent(before + link + after);
    setTimeout(() => {
      textarea.focus();
      const urlStart = start + link.length - 4;
      textarea.setSelectionRange(urlStart, urlStart + 3);
    }, 0);
  }

  return (
    <div className="flex h-full overflow-hidden">
      {/* ── LEFT PANEL ──────────────────────────────────────────────────── */}
      <div
        className={cn(
          "flex flex-col border-r border-[#D1D1D6] dark:border-[#38383A] bg-background overflow-hidden",
          "w-full md:w-[30%]",
          // Mobile: hide left panel when in editor view
          mobileView === "editor" ? "hidden md:flex" : "flex",
        )}
      >
        {/* Panel header */}
        <div className="flex items-center justify-between px-4 py-3 shrink-0 border-b border-[#D1D1D6]/60 dark:border-[#38383A]/60">
          <h2 className="font-semibold text-base">Context</h2>
          <div className="flex items-center gap-1">
            {repositories.length > 0 && (
              <button
                onClick={() => setIsSyncModalOpen(true)}
                className="rounded-lg p-1.5 text-[#8E8E93] hover:text-foreground hover:bg-gray-100 dark:hover:bg-[#2C2C2E] transition-colors"
                title="Sincronizza da GitHub"
              >
                <Github className="h-4 w-4" />
              </button>
            )}
            <button
              onClick={() => selectDoc("new")}
              className="rounded-lg p-1.5 text-[#007AFF] hover:bg-[#007AFF]/10 transition-colors"
              title="Nuovo documento"
            >
              <Plus className="h-4 w-4" />
            </button>
          </div>
        </div>

        {/* Search bar */}
        <div className="px-3 py-2 shrink-0">
          <div className="relative">
            <Search className="absolute left-2.5 top-1/2 -translate-y-1/2 h-3.5 w-3.5 text-[#8E8E93]" />
            <input
              type="text"
              placeholder="Cerca documenti…"
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="h-9 w-full rounded-xl bg-gray-100 dark:bg-[#2C2C2E] pl-8 pr-3 text-sm text-foreground placeholder:text-[#8E8E93] border-none outline-none focus:ring-1 focus:ring-[#007AFF]/40 transition-colors"
            />
          </div>
        </div>

        {/* Doc list */}
        <div className="flex-1 overflow-y-auto">
          {filteredDocs.length === 0 ? (
            <div className="flex flex-col items-center justify-center h-full px-6 text-center gap-3">
              {docs.length === 0 ? (
                <>
                  <FileInput className="h-10 w-10 text-[#C7C7CC]" />
                  <p className="text-sm text-[#8E8E93]">Nessun documento</p>
                  <button
                    onClick={() => selectDoc("new")}
                    className="text-xs text-[#007AFF] hover:underline"
                  >
                    Crea il primo documento
                  </button>
                </>
              ) : (
                <p className="text-sm text-[#8E8E93]">Nessun risultato per &ldquo;{searchQuery}&rdquo;</p>
              )}
            </div>
          ) : (
            <ul className="divide-y divide-[#D1D1D6]/40 dark:divide-[#38383A]/40">
              {filteredDocs.map((doc) => {
                const isSelected = selectedDocId === doc.id;
                const snippet = getContentSnippet(doc.content);
                return (
                  <li key={doc.id}>
                    <button
                      onClick={() => selectDoc(doc.id)}
                      className={cn(
                        "w-full text-left px-4 py-3 transition-colors relative",
                        isSelected
                          ? "bg-[#007AFF]/10 dark:bg-[#007AFF]/15"
                          : "hover:bg-gray-50 dark:hover:bg-[#2C2C2E]/50",
                      )}
                    >
                      {isSelected && (
                        <span className="absolute left-0 top-0 h-full w-0.5 bg-[#007AFF] rounded-r" />
                      )}
                      <div className="flex items-start gap-2.5">
                        {getDocIcon(doc)}
                        <div className="flex-1 min-w-0">
                          <div className="flex items-center justify-between gap-2">
                            <span className="font-medium text-sm truncate text-foreground">
                              {doc.title}
                            </span>
                            <span className="text-xs text-[#8E8E93] shrink-0">
                              {formatDate(doc.updated_at)}
                            </span>
                          </div>
                          {snippet && (
                            <p className="text-xs text-[#8E8E93] mt-0.5 line-clamp-2 leading-relaxed">
                              {snippet}
                            </p>
                          )}
                        </div>
                      </div>
                    </button>
                  </li>
                );
              })}
            </ul>
          )}
        </div>
      </div>

      {/* ── RIGHT PANEL ─────────────────────────────────────────────────── */}
      <div
        className={cn(
          "flex flex-col flex-1 overflow-hidden bg-background",
          // Mobile: hide right panel when in list view
          mobileView === "list" ? "hidden md:flex" : "flex",
        )}
      >
        {selectedDocId !== null ? (
          <>
            {/* Editor toolbar */}
            <div className="flex items-center gap-1 px-4 py-2 border-b border-[#D1D1D6]/60 dark:border-[#38383A]/60 shrink-0">
              {/* Mobile back button */}
              <button
                onClick={() => setMobileView("list")}
                className="md:hidden flex items-center gap-1 text-[#007AFF] text-sm mr-2"
              >
                <ChevronLeft className="h-4 w-4" />
                Lista
              </button>

              {/* Formatting buttons */}
              <button
                onClick={() => insertMarkdown("**")}
                className="rounded-md p-1.5 text-[#8E8E93] hover:text-foreground hover:bg-gray-100 dark:hover:bg-[#2C2C2E] transition-colors"
                title="Grassetto"
              >
                <Bold className="h-3.5 w-3.5" />
              </button>
              <button
                onClick={() => insertMarkdown("_")}
                className="rounded-md p-1.5 text-[#8E8E93] hover:text-foreground hover:bg-gray-100 dark:hover:bg-[#2C2C2E] transition-colors"
                title="Corsivo"
              >
                <Italic className="h-3.5 w-3.5" />
              </button>
              <button
                onClick={insertLink}
                className="rounded-md p-1.5 text-[#8E8E93] hover:text-foreground hover:bg-gray-100 dark:hover:bg-[#2C2C2E] transition-colors"
                title="Link"
              >
                <Link2 className="h-3.5 w-3.5" />
              </button>

              <div className="w-px h-4 bg-[#D1D1D6] dark:bg-[#38383A] mx-1" />

              <button
                onClick={insertCodeBlock}
                className="rounded-md p-1.5 text-[#8E8E93] hover:text-foreground hover:bg-gray-100 dark:hover:bg-[#2C2C2E] transition-colors"
                title="Blocco codice"
              >
                <Code2 className="h-3.5 w-3.5" />
              </button>

              {/* Spacer */}
              <div className="flex-1" />

              {/* Delete button */}
              {!isNewDoc && selectedDoc && (
                <button
                  onClick={() => void handleDelete(selectedDoc.id)}
                  className="text-xs text-[#8E8E93] hover:text-red-500 transition-colors px-2 py-1 rounded-md hover:bg-red-50 dark:hover:bg-red-950/20"
                >
                  Elimina
                </button>
              )}

              {/* Auto-save indicator */}
              <div className="flex items-center gap-1 ml-2 min-w-[80px] justify-end">
                {saveState === "saving" && (
                  <>
                    <Loader2 className="h-3.5 w-3.5 text-[#8E8E93] animate-spin" />
                    <span className="text-xs text-[#8E8E93]">Salvataggio…</span>
                  </>
                )}
                {saveState === "saved" && (
                  <>
                    <Check className="h-3.5 w-3.5 text-[#34C759]" />
                    <span className="text-xs text-[#34C759]">Salvato</span>
                  </>
                )}
              </div>
            </div>

            {/* Editor content */}
            <div className="flex-1 overflow-y-auto flex flex-col px-6 md:px-10 py-6">
              {/* Error */}
              {saveError && (
                <p className="mb-3 text-xs text-red-600 dark:text-red-400">{saveError}</p>
              )}

              {/* Title input */}
              <input
                type="text"
                value={editorTitle}
                onChange={(e) => setEditorTitle(e.target.value)}
                placeholder="Titolo documento"
                className="w-full text-xl font-bold text-foreground bg-transparent border-none outline-none placeholder:text-[#C7C7CC] mb-4"
              />

              {/* Content textarea */}
              <textarea
                id="context-editor"
                value={editorContent}
                onChange={(e) => setEditorContent(e.target.value)}
                placeholder={"# Descrizione\n\nInserisci qui il documento in Markdown…"}
                className="flex-1 w-full min-h-[400px] resize-none bg-transparent border-none outline-none text-sm text-foreground font-mono placeholder:text-[#C7C7CC] leading-relaxed"
              />
            </div>
          </>
        ) : (
          /* Empty state */
          <div className="flex flex-col items-center justify-center h-full gap-4 text-center px-8">
            <FileText className="h-14 w-14 text-[#C7C7CC]" />
            <div>
              <p className="text-base font-medium text-foreground">Seleziona un documento</p>
              <p className="text-sm text-[#8E8E93] mt-1">
                Scegli un documento dalla lista o creane uno nuovo per iniziare.
              </p>
            </div>
            <button
              onClick={() => selectDoc("new")}
              className="flex items-center gap-1.5 rounded-xl bg-[#007AFF] px-4 py-2 text-sm font-medium text-white hover:bg-[#007AFF]/90 transition-colors"
            >
              <Plus className="h-4 w-4" />
              Nuovo documento
            </button>
          </div>
        )}
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
