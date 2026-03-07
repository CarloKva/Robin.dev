"use client";

import { useState, useRef, useEffect, useCallback } from "react";
import { Sparkles, X, Bot, ArrowUp, Loader2 } from "lucide-react";
import ReactMarkdown from "react-markdown";
import { parseRobinMd } from "@/lib/robin-md-parser";
import { extractGeneratedTasks } from "@/lib/ai/brainstorm";
import { ImportPreviewCard } from "./ImportPreviewCard";
import type { Repository } from "@robin/shared-types";
import type { ParsedTask, ParseError } from "@/types/robin-md";

interface TokenUsage {
  inputTokens: number;
  outputTokens: number;
}

interface Message {
  role: "user" | "assistant";
  content: string;
  timestamp: Date;
  usage?: TokenUsage;
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

function formatTimestamp(date: Date): string {
  return date.toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" });
}

function LoadingDots() {
  return (
    <span className="inline-flex gap-1 items-center py-1">
      <span
        className="h-2 w-2 rounded-full bg-muted-foreground/50 animate-bounce"
        style={{ animationDelay: "0ms" }}
      />
      <span
        className="h-2 w-2 rounded-full bg-muted-foreground/50 animate-bounce"
        style={{ animationDelay: "150ms" }}
      />
      <span
        className="h-2 w-2 rounded-full bg-muted-foreground/50 animate-bounce"
        style={{ animationDelay: "300ms" }}
      />
    </span>
  );
}

function RobinAvatar() {
  return (
    <div className="shrink-0 h-7 w-7 rounded-full bg-foreground flex items-center justify-center">
      <Bot className="h-4 w-4 text-background" />
    </div>
  );
}

interface AssistantMessageProps {
  content: string;
  timestamp: Date;
  isStreaming: boolean;
  usage?: TokenUsage;
}

function AssistantMessage({ content, timestamp, isStreaming, usage }: AssistantMessageProps) {
  return (
    <div className="flex items-start gap-2.5">
      <RobinAvatar />
      <div className="flex flex-col gap-1 max-w-[85%]">
        <div className="rounded-2xl rounded-tl-sm bg-muted px-4 py-2.5 text-sm text-foreground">
          {content ? (
            <div className="prose-chat">
              <ReactMarkdown
                components={{
                  p: ({ children }) => (
                    <p className="mb-2 last:mb-0 leading-relaxed">{children}</p>
                  ),
                  h1: ({ children }) => (
                    <h1 className="text-base font-bold mb-2 mt-3 first:mt-0">{children}</h1>
                  ),
                  h2: ({ children }) => (
                    <h2 className="text-sm font-bold mb-1.5 mt-3 first:mt-0">{children}</h2>
                  ),
                  h3: ({ children }) => (
                    <h3 className="text-sm font-semibold mb-1 mt-2 first:mt-0">{children}</h3>
                  ),
                  ul: ({ children }) => (
                    <ul className="list-disc pl-4 mb-2 space-y-0.5">{children}</ul>
                  ),
                  ol: ({ children }) => (
                    <ol className="list-decimal pl-4 mb-2 space-y-0.5">{children}</ol>
                  ),
                  li: ({ children }) => (
                    <li className="leading-relaxed">{children}</li>
                  ),
                  strong: ({ children }) => (
                    <strong className="font-semibold">{children}</strong>
                  ),
                  em: ({ children }) => <em className="italic">{children}</em>,
                  code: ({ children, className }) => {
                    const isBlock = className?.startsWith("language-");
                    if (isBlock) {
                      return (
                        <code className="block bg-background/60 border border-border rounded-md px-3 py-2 text-xs font-mono overflow-x-auto whitespace-pre my-2">
                          {children}
                        </code>
                      );
                    }
                    return (
                      <code className="bg-background/60 border border-border rounded px-1 py-0.5 text-xs font-mono">
                        {children}
                      </code>
                    );
                  },
                  pre: ({ children }) => (
                    <pre className="bg-background/60 border border-border rounded-md p-3 overflow-x-auto my-2 text-xs font-mono">
                      {children}
                    </pre>
                  ),
                  blockquote: ({ children }) => (
                    <blockquote className="border-l-2 border-border pl-3 italic text-muted-foreground my-2">
                      {children}
                    </blockquote>
                  ),
                  hr: () => <hr className="border-border my-2" />,
                  a: ({ children, href }) => (
                    <a
                      href={href}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="text-primary underline hover:no-underline"
                    >
                      {children}
                    </a>
                  ),
                }}
              >
                {content}
              </ReactMarkdown>
            </div>
          ) : isStreaming ? (
            <LoadingDots />
          ) : null}
        </div>
        <span className="text-[10px] text-muted-foreground pl-1">
          Robin · {formatTimestamp(timestamp)}
          {usage && ` · ↑ ${usage.inputTokens} ↓ ${usage.outputTokens} tok`}
        </span>
      </div>
    </div>
  );
}

interface UserMessageProps {
  content: string;
  timestamp: Date;
}

function UserMessage({ content, timestamp }: UserMessageProps) {
  return (
    <div className="flex flex-col items-end gap-1">
      <div className="max-w-[85%] rounded-2xl rounded-tr-sm bg-primary px-4 py-2.5 text-sm text-primary-foreground leading-relaxed">
        {content}
      </div>
      <span className="text-[10px] text-muted-foreground pr-1">
        {formatTimestamp(timestamp)}
      </span>
    </div>
  );
}

function modelBadgeClass(model: string): string {
  const lc = model.toLowerCase();
  if (lc.includes("gpt") || lc.includes("openai")) {
    return "bg-green-100 text-green-700 dark:bg-green-900/30 dark:text-green-300";
  }
  return "bg-violet-100 text-violet-700 dark:bg-violet-900/30 dark:text-violet-300";
}

export function BrainstormModal({ repositories, onImported }: BrainstormWidgetProps) {
  const [isOpen, setIsOpen] = useState(false);
  const [messages, setMessages] = useState<Message[]>([]);
  const [input, setInput] = useState("");
  const [streaming, setStreaming] = useState(false);
  const [importData, setImportData] = useState<ImportData | null>(null);
  const [imported, setImported] = useState(false);
  const [modelName, setModelName] = useState<string | null>(null);
  const [sessionTokens, setSessionTokens] = useState<TokenUsage>({
    inputTokens: 0,
    outputTokens: 0,
  });
  const messagesEndRef = useRef<HTMLDivElement>(null);
  const textareaRef = useRef<HTMLTextAreaElement>(null);

  useEffect(() => {
    if (isOpen) {
      messagesEndRef.current?.scrollIntoView({ behavior: "smooth" });
    }
  }, [messages, isOpen]);

  // Auto-resize textarea: reset to auto then stretch to scrollHeight, capped at ~6 rows
  const adjustTextareaHeight = useCallback(() => {
    const el = textareaRef.current;
    if (!el) return;
    el.style.height = "auto";
    const lineHeight = 20; // px — matches text-sm leading
    const maxHeight = lineHeight * 6 + 16; // 6 lines + padding
    el.style.height = `${Math.min(el.scrollHeight, maxHeight)}px`;
  }, []);

  useEffect(() => {
    adjustTextareaHeight();
  }, [input, adjustTextareaHeight]);

  async function handleSend() {
    const text = input.trim();
    if (!text || streaming) return;

    const now = new Date();
    const userMessage: Message = { role: "user", content: text, timestamp: now };
    const newMessages = [...messages, userMessage];
    setMessages(newMessages);
    setInput("");
    setStreaming(true);
    setImportData(null);
    setImported(false);

    const assistantTimestamp = new Date();
    const assistantPlaceholder: Message = {
      role: "assistant",
      content: "",
      timestamp: assistantTimestamp,
    };
    setMessages([...newMessages, assistantPlaceholder]);

    let pendingInputTokens = 0;

    try {
      const res = await fetch("/api/ai/brainstorm", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          messages: newMessages.map(({ role, content }) => ({ role, content })),
          contextDocIds: [],
        }),
      });

      if (!res.ok || !res.body) {
        const errorData = (await res.json().catch(() => ({}))) as { error?: string };
        setMessages((prev) => {
          const next = [...prev];
          next[next.length - 1] = {
            role: "assistant",
            content: `Errore: ${errorData.error ?? "Impossibile contattare l'AI."}`,
            timestamp: assistantTimestamp,
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
            const parsed = JSON.parse(data) as {
              text?: string;
              error?: string;
              model?: string;
              inputTokens?: number;
              outputTokens?: number;
            };
            if (parsed.error) {
              accumulated += `\nErrore: ${parsed.error}`;
            } else if (parsed.model !== undefined) {
              setModelName(parsed.model);
              pendingInputTokens = parsed.inputTokens ?? 0;
            } else if (parsed.outputTokens !== undefined) {
              const out = parsed.outputTokens;
              const inp = pendingInputTokens;
              setMessages((prev) => {
                const next = [...prev];
                const cur = next[next.length - 1];
                if (cur === undefined) return next;
                next[next.length - 1] = {
                  role: cur.role,
                  content: cur.content,
                  timestamp: cur.timestamp,
                  usage: { inputTokens: inp, outputTokens: out },
                };
                return next;
              });
              setSessionTokens((prev) => ({
                inputTokens: prev.inputTokens + inp,
                outputTokens: prev.outputTokens + out,
              }));
            } else if (parsed.text) {
              accumulated += parsed.text;
            }
          } catch {
            // ignore malformed chunks
          }
        }

        setMessages((prev) => {
          const next = [...prev];
          const cur = next[next.length - 1];
          if (cur === undefined) return next;
          next[next.length - 1] = {
            role: "assistant",
            content: accumulated,
            timestamp: assistantTimestamp,
            ...(cur.usage !== undefined && { usage: cur.usage }),
          };
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
        next[next.length - 1] = {
          role: "assistant",
          content: "Errore di rete. Riprova.",
          timestamp: assistantTimestamp,
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

  return (
    <>
      {/* Chat panel */}
      {isOpen && (
        <div className="fixed bottom-20 right-4 z-50 flex w-[420px] max-h-[580px] flex-col rounded-2xl border border-border bg-background shadow-2xl overflow-hidden">
          {/* Header */}
          <div className="flex shrink-0 items-center justify-between border-b border-border bg-background px-4 py-3">
            <div className="flex items-center gap-2.5">
              <div className="h-7 w-7 rounded-full bg-foreground flex items-center justify-center">
                <Bot className="h-4 w-4 text-background" />
              </div>
              <div>
                <div className="flex items-center gap-1.5">
                  <p className="text-sm font-semibold leading-tight">Robin AI</p>
                  {modelName && (
                    <span
                      className={`rounded px-1.5 py-0.5 text-[10px] font-medium leading-none ${modelBadgeClass(modelName)}`}
                    >
                      {modelName}
                    </span>
                  )}
                </div>
                <p className="text-[10px] text-muted-foreground leading-tight">
                  {streaming ? "Sta scrivendo…" : "Online"}
                </p>
              </div>
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
          <div className="flex-1 overflow-y-auto px-4 py-4 space-y-4">
            {messages.length === 0 && (
              <div className="flex flex-col items-center justify-center h-full py-8 text-center">
                <div className="h-12 w-12 rounded-full bg-foreground/5 flex items-center justify-center mb-3">
                  <Sparkles className="h-6 w-6 text-foreground/40" />
                </div>
                <p className="text-sm font-medium text-foreground">Descrivi la feature o il problema</p>
                <p className="text-xs text-muted-foreground mt-1 max-w-[240px]">
                  Es. &quot;Aggiungi autenticazione con Google&quot;
                </p>
              </div>
            )}

            {messages.map((msg, i) => {
              const isLastAssistant = msg.role === "assistant" && i === messages.length - 1;
              if (msg.role === "user") {
                return <UserMessage key={i} content={msg.content} timestamp={msg.timestamp} />;
              }
              return (
                <AssistantMessage
                  key={i}
                  content={msg.content}
                  timestamp={msg.timestamp}
                  isStreaming={isLastAssistant && streaming}
                  {...(msg.usage !== undefined && { usage: msg.usage })}
                />
              );
            })}

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

          {/* Session token counter */}
          {(sessionTokens.inputTokens > 0 || sessionTokens.outputTokens > 0) && (
            <div className="shrink-0 border-t border-border px-4 py-1.5">
              <span className="text-[10px] text-muted-foreground">
                Sessione: ↑ {sessionTokens.inputTokens} · ↓ {sessionTokens.outputTokens} token
              </span>
            </div>
          )}

          {/* Input */}
          <div className="shrink-0 border-t border-border bg-background px-3 py-3">
            <div className="flex items-end gap-2 rounded-xl border border-border bg-background px-3 py-2 focus-within:ring-1 focus-within:ring-ring transition-shadow">
              <textarea
                ref={textareaRef}
                value={input}
                onChange={(e) => setInput(e.target.value)}
                onKeyDown={handleKeyDown}
                disabled={streaming}
                placeholder="Descrivi cosa vuoi implementare…"
                rows={1}
                style={{ height: "auto" }}
                className="flex-1 resize-none bg-transparent text-sm leading-5 focus:outline-none disabled:opacity-50 placeholder:text-muted-foreground"
              />
              <button
                onClick={() => void handleSend()}
                disabled={streaming || !input.trim()}
                aria-label="Invia messaggio"
                className="shrink-0 flex h-7 w-7 items-center justify-center rounded-lg bg-primary text-primary-foreground transition-all hover:bg-primary/90 disabled:opacity-40 disabled:cursor-not-allowed"
              >
                {streaming ? (
                  <Loader2 className="h-3.5 w-3.5 animate-spin" />
                ) : (
                  <ArrowUp className="h-3.5 w-3.5" />
                )}
              </button>
            </div>
            <p className="mt-1.5 text-center text-[10px] text-muted-foreground">
              Invio per inviare&nbsp;·&nbsp;Shift+Invio per andare a capo
            </p>
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
