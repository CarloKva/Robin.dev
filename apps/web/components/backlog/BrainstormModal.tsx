"use client";

import { useState, useRef, useEffect } from "react";
import { Sparkles, X } from "lucide-react";
import { parseRobinMd } from "@/lib/robin-md-parser";
import { extractGeneratedTasks } from "@/lib/ai/brainstorm";
import { ImportPreviewCard } from "./ImportPreviewCard";
import type { Repository } from "@robin/shared-types";
import type { ParsedTask, ParseError } from "@/types/robin-md";

interface Message {
  role: "user" | "assistant";
  content: string;
}

interface BrainstormWidgetProps {
  repositories: Repository[];
  onImported: () => void;
}

type ImportData = {
  tasks: ParsedTask[];
  errors: ParseError[];
  truncated: boolean;
  originalCount: number;
};

export function BrainstormModal({ repositories, onImported }: BrainstormWidgetProps) {
  const [isOpen, setIsOpen] = useState(false);
  const [messages, setMessages] = useState<Message[]>([]);
  const [input, setInput] = useState("");
  const [streaming, setStreaming] = useState(false);
  const [importData, setImportData] = useState<ImportData | null>(null);
  const [imported, setImported] = useState(false);
  const messagesEndRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (isOpen) {
      messagesEndRef.current?.scrollIntoView({ behavior: "smooth" });
    }
  }, [messages, isOpen]);

  async function handleSend() {
    const text = input.trim();
    if (!text || streaming) return;

    const userMessage: Message = { role: "user", content: text };
    const newMessages = [...messages, userMessage];
    setMessages(newMessages);
    setInput("");
    setStreaming(true);
    setImportData(null);
    setImported(false);

    const assistantPlaceholder: Message = { role: "assistant", content: "" };
    setMessages([...newMessages, assistantPlaceholder]);

    try {
      const res = await fetch("/api/ai/brainstorm", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ messages: newMessages, contextDocIds: [] }),
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

      const tasksContent = extractGeneratedTasks(accumulated);
      if (tasksContent) {
        const result = parseRobinMd(tasksContent);
        if (result.tasks.length > 0 || result.errors.length > 0) {
          setImportData({
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
        next[next.length - 1] = { role: "assistant", content: "Errore di rete. Riprova." };
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

  return (
    <>
      {/* Chat panel */}
      {isOpen && (
        <div className="fixed bottom-20 right-4 z-50 flex w-[400px] max-h-[560px] flex-col rounded-2xl border border-border bg-white shadow-2xl overflow-hidden">
          {/* Header */}
          <div className="flex shrink-0 items-center justify-between border-b border-border px-4 py-3">
            <div className="flex items-center gap-2">
              <Sparkles className="h-3.5 w-3.5" />
              <span className="text-sm font-semibold">Genera task con AI</span>
            </div>
            <button
              onClick={() => setIsOpen(false)}
              className="rounded-md p-1 text-muted-foreground hover:text-foreground hover:bg-accent transition-colors"
              aria-label="Chiudi"
            >
              <X className="h-4 w-4" />
            </button>
          </div>

          {/* Messages */}
          <div className="flex-1 overflow-y-auto px-4 py-3 space-y-3">
            {messages.length === 0 && (
              <div className="flex flex-col items-center justify-center h-full py-8 text-center">
                <Sparkles className="h-8 w-8 text-muted-foreground mb-2" />
                <p className="text-sm font-medium">Descrivi la feature o il problema</p>
                <p className="text-xs text-muted-foreground mt-1">
                  Es. &quot;Aggiungi autenticazione con Google&quot;
                </p>
              </div>
            )}

            {messages.map((msg, i) => (
              <div
                key={i}
                className={`flex ${msg.role === "user" ? "justify-end" : "justify-start"}`}
              >
                <div
                  className={`max-w-[85%] rounded-xl px-3 py-2 text-sm leading-relaxed whitespace-pre-wrap ${
                    msg.role === "user"
                      ? "bg-primary text-primary-foreground"
                      : "bg-accent text-accent-foreground"
                  }`}
                >
                  {msg.content || (streaming && i === messages.length - 1 ? (
                    <span className="inline-flex gap-1 items-center text-muted-foreground">
                      <span className="animate-bounce">·</span>
                      <span className="animate-bounce delay-75">·</span>
                      <span className="animate-bounce delay-150">·</span>
                    </span>
                  ) : "")}
                </div>
              </div>
            ))}

            {/* Inline import card */}
            {!streaming && importData !== null && !imported && (
              <ImportPreviewCard
                tasks={importData.tasks}
                errors={importData.errors}
                truncated={importData.truncated}
                originalCount={importData.originalCount}
                repositories={repositories}
                onDismiss={() => setImportData(null)}
                onImported={() => {
                  setImported(true);
                  setImportData(null);
                  onImported();
                }}
              />
            )}

            {imported && (
              <div className="flex justify-start">
                <div className="rounded-xl border border-green-200 bg-green-50 px-3 py-2 text-sm text-green-700 dark:border-green-800 dark:bg-green-900/20 dark:text-green-300">
                  Task importate nel backlog.
                </div>
              </div>
            )}

            <div ref={messagesEndRef} />
          </div>

          {/* Input */}
          <div className="shrink-0 border-t border-border px-3 py-2.5">
            <div className="flex items-end gap-2">
              <textarea
                value={input}
                onChange={(e) => setInput(e.target.value)}
                onKeyDown={handleKeyDown}
                disabled={streaming}
                placeholder="Descrivi cosa vuoi implementare… (Invio per inviare)"
                rows={2}
                className="flex-1 resize-none rounded-lg border border-border bg-background px-3 py-2 text-sm focus:outline-none focus:ring-1 focus:ring-ring disabled:opacity-50"
              />
              <button
                onClick={() => void handleSend()}
                disabled={streaming || !input.trim()}
                className="shrink-0 rounded-lg bg-primary px-3 py-2 text-sm font-medium text-primary-foreground transition-colors hover:bg-primary/90 disabled:opacity-50"
              >
                {streaming ? "…" : "Invia"}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Floating trigger button */}
      <button
        onClick={() => setIsOpen((prev) => !prev)}
        className="fixed bottom-4 right-4 z-50 flex h-12 w-12 items-center justify-center rounded-full bg-foreground text-background shadow-lg transition-colors hover:bg-foreground/90"
        aria-label={isOpen ? "Chiudi AI brainstorm" : "Apri AI brainstorm"}
      >
        {isOpen ? <X className="h-5 w-5" /> : <Sparkles className="h-5 w-5" />}
      </button>
    </>
  );
}
