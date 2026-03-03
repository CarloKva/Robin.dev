"use client";

import { useState, useRef, useEffect } from "react";
import Link from "next/link";
import { parseRobinMd } from "@/lib/robin-md-parser";
import { extractGeneratedTasks } from "@/lib/ai/brainstorm";
import { ImportPreviewModal } from "./ImportPreviewModal";
import type { ContextDocument, Repository } from "@robin/shared-types";
import type { ParsedTask, ParseError } from "@/types/robin-md";

interface Message {
  role: "user" | "assistant";
  content: string;
}

interface BrainstormModalProps {
  repositories: Repository[];
  onClose: () => void;
  onImported: () => void;
}

type ImportModal = {
  tasks: ParsedTask[];
  errors: ParseError[];
  truncated: boolean;
  originalCount: number;
};

export function BrainstormModal({ repositories, onClose, onImported }: BrainstormModalProps) {
  const [messages, setMessages] = useState<Message[]>([]);
  const [input, setInput] = useState("");
  const [streaming, setStreaming] = useState(false);
  const [contextDocs, setContextDocs] = useState<ContextDocument[]>([]);
  const [selectedDocIds, setSelectedDocIds] = useState<Set<string>>(new Set());
  const [loadingDocs, setLoadingDocs] = useState(true);
  const [importModal, setImportModal] = useState<ImportModal | null>(null);
  const messagesEndRef = useRef<HTMLDivElement>(null);
  const textareaRef = useRef<HTMLTextAreaElement>(null);

  // Load context docs on mount
  useEffect(() => {
    fetch("/api/context")
      .then((r) => r.json())
      .then((data: { docs: ContextDocument[] }) => setContextDocs(data.docs ?? []))
      .catch(() => undefined)
      .finally(() => setLoadingDocs(false));
  }, []);

  // Auto-scroll
  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [messages]);

  function toggleDocId(id: string) {
    setSelectedDocIds((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  }

  async function handleSend() {
    const text = input.trim();
    if (!text || streaming) return;

    const userMessage: Message = { role: "user", content: text };
    const newMessages = [...messages, userMessage];
    setMessages(newMessages);
    setInput("");
    setStreaming(true);

    // Placeholder for assistant response
    const assistantPlaceholder: Message = { role: "assistant", content: "" };
    setMessages([...newMessages, assistantPlaceholder]);

    try {
      const res = await fetch("/api/ai/brainstorm", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          messages: newMessages,
          contextDocIds: [...selectedDocIds],
        }),
      });

      if (!res.ok || !res.body) {
        const errorData = (await res.json().catch(() => ({}))) as { error?: string };
        setMessages((prev) => {
          const next = [...prev];
          next[next.length - 1] = {
            role: "assistant",
            content: `Errore: ${errorData.error ?? "Impossibile contattare l'AI."}`,
          };
          return next;
        });
        return;
      }

      const reader = res.body.getReader();
      const decoder = new TextDecoder();
      let accumulated = "";

      while (true) {
        const { done, value } = await reader.read();
        if (done) break;

        const chunk = decoder.decode(value, { stream: true });
        const lines = chunk.split("\n");

        for (const line of lines) {
          if (!line.startsWith("data: ")) continue;
          const data = line.slice(6).trim();
          if (data === "[DONE]") break;
          try {
            const parsed = JSON.parse(data) as { text?: string; error?: string };
            if (parsed.error) {
              accumulated += `\nErrore: ${parsed.error}`;
            } else if (parsed.text) {
              accumulated += parsed.text;
            }
          } catch {
            // ignore malformed chunks
          }
        }

        setMessages((prev) => {
          const next = [...prev];
          next[next.length - 1] = { role: "assistant", content: accumulated };
          return next;
        });
      }

      // Check for generated tasks in the final response
      const tasksContent = extractGeneratedTasks(accumulated);
      if (tasksContent) {
        const result = parseRobinMd(tasksContent);
        if (result.tasks.length > 0 || result.errors.length > 0) {
          setImportModal({
            tasks: result.tasks,
            errors: result.errors,
            truncated: result.truncated === true,
            originalCount: result.originalCount ?? result.tasks.length + result.errors.length,
          });
        }
      }
    } catch {
      setMessages((prev) => {
        const next = [...prev];
        next[next.length - 1] = {
          role: "assistant",
          content: "Errore di rete. Riprova.",
        };
        return next;
      });
    } finally {
      setStreaming(false);
    }
  }

  function handleKeyDown(e: React.KeyboardEvent<HTMLTextAreaElement>) {
    if (e.key === "Enter" && !e.shiftKey) {
      e.preventDefault();
      void handleSend();
    }
  }

  // Find the last assistant message to see if it has tasks
  const lastAssistantMsg = [...messages].reverse().find((m) => m.role === "assistant");
  const lastMsgHasTasks = lastAssistantMsg
    ? extractGeneratedTasks(lastAssistantMsg.content) !== null
    : false;

  return (
    <>
      <div className="fixed inset-0 z-50 flex items-end justify-center sm:items-center">
        {/* Backdrop */}
        <div className="absolute inset-0 bg-black/50" onClick={onClose} aria-hidden="true" />

        {/* Modal */}
        <div className="relative z-10 mx-0 sm:mx-4 w-full sm:max-w-4xl max-h-[95vh] flex flex-col rounded-t-xl sm:rounded-xl border border-border bg-card shadow-2xl">
          {/* Header */}
          <div className="flex items-center justify-between border-b border-border px-5 py-4 shrink-0">
            <div>
              <h2 className="font-semibold text-base">✦ Genera task con AI</h2>
              <p className="text-xs text-muted-foreground mt-0.5">
                Descrivi cosa vuoi implementare — Robin genererà le task.
              </p>
            </div>
            <button
              onClick={onClose}
              className="rounded-md p-1 text-muted-foreground hover:text-foreground hover:bg-accent transition-colors"
              aria-label="Chiudi"
            >
              ✕
            </button>
          </div>

          {/* Body: two-panel layout */}
          <div className="flex flex-1 min-h-0 gap-0 overflow-hidden">
            {/* Chat panel */}
            <div className="flex flex-col flex-1 min-w-0">
              {/* Messages */}
              <div className="flex-1 overflow-y-auto px-4 py-4 space-y-3">
                {messages.length === 0 && (
                  <div className="flex flex-col items-center justify-center h-full text-center py-8">
                    <p className="text-4xl mb-3">✦</p>
                    <p className="text-sm font-medium">Inizia descrivendo la feature o il problema</p>
                    <p className="text-xs text-muted-foreground mt-1">
                      Es. &quot;Voglio aggiungere l&apos;autenticazione con Google al progetto&quot;
                    </p>
                  </div>
                )}

                {messages.map((msg, i) => (
                  <div
                    key={i}
                    className={`flex ${msg.role === "user" ? "justify-end" : "justify-start"}`}
                  >
                    <div
                      className={`max-w-[85%] rounded-xl px-3.5 py-2.5 text-sm leading-relaxed whitespace-pre-wrap ${
                        msg.role === "user"
                          ? "bg-primary text-primary-foreground"
                          : "bg-accent text-accent-foreground"
                      }`}
                    >
                      {msg.content || (streaming && i === messages.length - 1 ? (
                        <span className="inline-flex gap-1 items-center text-muted-foreground">
                          <span className="animate-bounce delay-0">·</span>
                          <span className="animate-bounce delay-75">·</span>
                          <span className="animate-bounce delay-150">·</span>
                        </span>
                      ) : "")}
                    </div>
                  </div>
                ))}

                {/* Import button after last AI message with tasks */}
                {!streaming && lastMsgHasTasks && importModal === null && (
                  <div className="flex justify-start">
                    <button
                      onClick={() => {
                        const tasksContent = extractGeneratedTasks(lastAssistantMsg!.content);
                        if (!tasksContent) return;
                        const result = parseRobinMd(tasksContent);
                        setImportModal({
                          tasks: result.tasks,
                          errors: result.errors,
                          truncated: result.truncated === true,
                          originalCount: result.originalCount ?? result.tasks.length + result.errors.length,
                        });
                      }}
                      className="rounded-lg border border-primary/40 bg-primary/10 px-3.5 py-2 text-sm font-medium text-primary hover:bg-primary/20 transition-colors"
                    >
                      📋 Vedi e importa task
                    </button>
                  </div>
                )}

                <div ref={messagesEndRef} />
              </div>

              {/* Input area */}
              <div className="border-t border-border px-4 py-3 shrink-0">
                <div className="flex gap-2 items-end">
                  <textarea
                    ref={textareaRef}
                    value={input}
                    onChange={(e) => setInput(e.target.value)}
                    onKeyDown={handleKeyDown}
                    disabled={streaming}
                    placeholder="Descrivi cosa vuoi implementare… (Invio per inviare, Shift+Invio per a-capo)"
                    rows={2}
                    className="flex-1 rounded-lg border border-border bg-background px-3 py-2 text-sm resize-none focus:outline-none focus:ring-1 focus:ring-ring disabled:opacity-50"
                  />
                  <button
                    onClick={() => void handleSend()}
                    disabled={streaming || !input.trim()}
                    className="rounded-lg bg-primary px-3 py-2 text-sm font-medium text-primary-foreground hover:bg-primary/90 transition-colors disabled:opacity-50 shrink-0"
                  >
                    {streaming ? "…" : "Invia"}
                  </button>
                </div>
              </div>
            </div>

            {/* Context panel */}
            <div className="hidden sm:flex flex-col w-64 shrink-0 border-l border-border">
              <div className="flex items-center justify-between px-4 py-3 border-b border-border shrink-0">
                <span className="text-xs font-semibold text-muted-foreground uppercase tracking-wide">
                  Contesto
                </span>
                {selectedDocIds.size > 0 && (
                  <span className="rounded-full bg-primary/10 text-primary text-xs px-2 py-0.5 font-medium">
                    {selectedDocIds.size} selezionati
                  </span>
                )}
              </div>

              <div className="flex-1 overflow-y-auto px-3 py-2">
                {loadingDocs && (
                  <p className="text-xs text-muted-foreground animate-pulse px-1 py-2">Caricamento…</p>
                )}
                {!loadingDocs && contextDocs.length === 0 && (
                  <div className="px-1 py-2 text-center">
                    <p className="text-xs text-muted-foreground">Nessun documento di contesto.</p>
                    <Link
                      href="/context"
                      target="_blank"
                      className="text-xs text-primary underline hover:no-underline mt-1 block"
                    >
                      Aggiungi documenti →
                    </Link>
                  </div>
                )}
                {!loadingDocs && contextDocs.map((doc) => (
                  <label
                    key={doc.id}
                    className="flex items-start gap-2 rounded-md px-2 py-2 cursor-pointer hover:bg-accent/40 transition-colors"
                  >
                    <input
                      type="checkbox"
                      checked={selectedDocIds.has(doc.id)}
                      onChange={() => toggleDocId(doc.id)}
                      className="mt-0.5 h-3.5 w-3.5 rounded border-border accent-primary shrink-0"
                    />
                    <div className="min-w-0">
                      <p className="text-xs font-medium leading-snug line-clamp-2">{doc.title}</p>
                      {doc.source_path && (
                        <p className="text-xs text-muted-foreground font-mono truncate mt-0.5">
                          {doc.source_path}
                        </p>
                      )}
                    </div>
                  </label>
                ))}
              </div>

              {contextDocs.length > 0 && (
                <div className="px-3 py-2 border-t border-border shrink-0">
                  <Link
                    href="/context"
                    target="_blank"
                    className="text-xs text-muted-foreground hover:text-foreground underline hover:no-underline"
                  >
                    Gestisci documenti →
                  </Link>
                </div>
              )}
            </div>
          </div>
        </div>
      </div>

      {/* Import preview modal */}
      {importModal !== null && (
        <ImportPreviewModal
          tasks={importModal.tasks}
          errors={importModal.errors}
          truncated={importModal.truncated}
          originalCount={importModal.originalCount}
          repositories={repositories}
          onClose={() => setImportModal(null)}
          onImported={() => {
            setImportModal(null);
            onImported();
            onClose();
          }}
        />
      )}
    </>
  );
}
