"use client";

import { useState, useRef, useEffect, useCallback } from "react";
import { Sparkles, X, Bot, ArrowUp, Loader2, FileText, Zap, Pause, Play, CheckCircle2, Paperclip } from "lucide-react";
import ReactMarkdown from "react-markdown";
import { cn } from "@/lib/utils";
import { parseRobinMd } from "@/lib/robin-md-parser";
import {
  extractGeneratedTasks,
  extractBatchManifest,
  type BatchManifest,
} from "@/lib/ai/brainstorm";
import { ImportPreviewCard } from "./ImportPreviewCard";
import { validateImageFiles, MAX_IMAGE_FILES, ALLOWED_IMAGE_TYPES } from "@/lib/utils/image-validation";
import type { Repository, ContextDocument } from "@robin/shared-types";
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
  imageUrls?: string[];
}

interface SelectedImage {
  dataUrl: string;
  name: string;
}

interface BrainstormDrawerProps {
  isOpen: boolean;
  onClose: () => void;
  repositories: Repository[];
  contextDocs?: ContextDocument[];
  onImported: () => void;
}

type ImportData = {
  tasks: ParsedTask[];
  errors: ParseError[];
  truncated: boolean;
  originalCount: number;
};

type BatchPhase = "idle" | "manifest_ready" | "generating" | "batch_ready" | "done";

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
  imageUrls: string[] | undefined;
}

function UserMessage({ content, timestamp, imageUrls }: UserMessageProps) {
  return (
    <div className="flex flex-col items-end gap-1">
      <div className="max-w-[85%] rounded-2xl rounded-tr-sm bg-primary px-4 py-2.5 text-sm text-primary-foreground leading-relaxed">
        {imageUrls && imageUrls.length > 0 && (
          <div className="flex flex-wrap gap-1.5 mb-2">
            {imageUrls.map((url, i) => (
              // eslint-disable-next-line @next/next/no-img-element
              <img
                key={i}
                src={url}
                alt={`Allegato ${i + 1}`}
                className="h-20 w-20 rounded-lg object-cover border border-primary-foreground/20"
              />
            ))}
          </div>
        )}
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

// ─── Batch sub-components ─────────────────────────────────────────────────────

interface BatchManifestPreviewProps {
  manifest: BatchManifest;
  autoApprove: boolean;
  onToggleAutoApprove: () => void;
  onStart: () => void;
  onCancel: () => void;
}

function BatchManifestPreview({
  manifest,
  autoApprove,
  onToggleAutoApprove,
  onStart,
  onCancel,
}: BatchManifestPreviewProps) {
  return (
    <div className="w-full rounded-xl border border-border bg-background shadow-sm overflow-hidden">
      <div className="flex items-center justify-between px-3 py-2.5 border-b border-border bg-accent/30">
        <div className="flex items-center gap-2">
          <Zap className="h-3.5 w-3.5 text-blue-600 dark:text-blue-400" />
          <span className="text-xs font-semibold">
            Piano generato — {manifest.total_tasks} task in {manifest.batches.length} batch
          </span>
        </div>
      </div>

      <ul className="divide-y divide-border max-h-52 overflow-y-auto">
        {manifest.batches.map((batch) => (
          <li key={batch.batch_id} className="flex items-start gap-2.5 px-3 py-2.5 text-xs">
            <span className="shrink-0 flex h-5 w-5 items-center justify-center rounded-full bg-blue-100 text-blue-700 font-semibold text-[10px] dark:bg-blue-900/30 dark:text-blue-300">
              {batch.batch_id}
            </span>
            <div className="flex-1 min-w-0">
              <p className="font-medium truncate">{batch.title}</p>
              <p className="text-muted-foreground truncate">{batch.description}</p>
            </div>
            <span className="shrink-0 rounded-full bg-muted px-1.5 py-0.5 text-[10px] text-muted-foreground">
              {batch.task_count} task
            </span>
          </li>
        ))}
      </ul>

      <div className="border-t border-border px-3 py-2.5 space-y-2.5">
        {/* Auto-approve toggle */}
        <label className="flex items-center gap-2 cursor-pointer select-none">
          <button
            type="button"
            role="switch"
            aria-checked={autoApprove}
            onClick={onToggleAutoApprove}
            className={cn(
              "relative inline-flex h-4 w-7 shrink-0 items-center rounded-full transition-colors",
              autoApprove ? "bg-blue-600" : "bg-muted-foreground/30"
            )}
          >
            <span
              className={cn(
                "inline-block h-3 w-3 rounded-full bg-white shadow transition-transform",
                autoApprove ? "translate-x-3.5" : "translate-x-0.5"
              )}
            />
          </button>
          <span className="text-xs text-foreground">
            Importa ogni batch automaticamente
          </span>
        </label>

        <div className="flex items-center gap-2">
          <button
            onClick={onStart}
            className="flex items-center gap-1 rounded-md bg-primary px-3 py-1.5 text-xs font-semibold text-primary-foreground hover:bg-primary/90 transition-colors"
          >
            <Play className="h-3 w-3" />
            Avvia il piano
          </button>
          <button
            onClick={onCancel}
            className="rounded-md px-3 py-1.5 text-xs text-muted-foreground hover:bg-accent hover:text-foreground transition-colors"
          >
            Annulla
          </button>
        </div>
      </div>
    </div>
  );
}

interface BatchProgressBarProps {
  manifest: BatchManifest;
  currentBatchIndex: number;
  totalImported: number;
  phase: BatchPhase;
  paused: boolean;
  onResume: () => void;
}

function BatchProgressBar({
  manifest,
  currentBatchIndex,
  totalImported,
  phase,
  paused,
  onResume,
}: BatchProgressBarProps) {
  const completedBatches = phase === "done" ? manifest.batches.length : currentBatchIndex;
  const pct = Math.round((completedBatches / manifest.batches.length) * 100);
  const currentBatch = manifest.batches[currentBatchIndex];

  return (
    <div className="w-full rounded-xl border border-border bg-background shadow-sm px-3 py-2.5 space-y-1.5">
      <div className="flex items-center justify-between text-xs">
        <span className="font-medium text-foreground">
          {phase === "done" ? (
            <span className="flex items-center gap-1 text-green-700 dark:text-green-400">
              <CheckCircle2 className="h-3.5 w-3.5" />
              Piano completato — {totalImported} task importate
            </span>
          ) : paused ? (
            <span className="text-amber-600 dark:text-amber-400">In pausa</span>
          ) : (
            <>
              Batch {currentBatchIndex + 1}/{manifest.batches.length}
              {currentBatch && (
                <span className="ml-1 text-muted-foreground font-normal">
                  · {currentBatch.title}
                </span>
              )}
            </>
          )}
        </span>
        <span className="text-muted-foreground">{totalImported} importate</span>
      </div>

      <div className="h-1.5 w-full overflow-hidden rounded-full bg-muted">
        <div
          className={cn(
            "h-full rounded-full transition-all duration-500",
            phase === "done" ? "bg-green-500" : "bg-blue-500"
          )}
          style={{ width: `${pct}%` }}
        />
      </div>

      {paused && phase !== "done" && (
        <button
          onClick={onResume}
          className="flex items-center gap-1 rounded-md bg-primary px-2.5 py-1 text-xs font-medium text-primary-foreground hover:bg-primary/90 transition-colors"
        >
          <Play className="h-3 w-3" />
          Riprendi
        </button>
      )}
    </div>
  );
}

/** Matches `/context` optionally followed by a space and a filter word, at the end of the string. */
const SLASH_CONTEXT_RE = /\/context(\s+(\S*))?$/;

function fileToDataUrl(file: File): Promise<string> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => resolve(reader.result as string);
    reader.onerror = reject;
    reader.readAsDataURL(file);
  });
}

const AI_MODEL_NAME = "claude-sonnet-4-6";

export function BrainstormModal({
  isOpen,
  onClose,
  repositories,
  contextDocs = [],
  onImported,
}: BrainstormDrawerProps) {
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
  const [selectedDocs, setSelectedDocs] = useState<ContextDocument[]>([]);
  const [showDropdown, setShowDropdown] = useState(false);
  const [dropdownFilter, setDropdownFilter] = useState("");
  const [highlightedIdx, setHighlightedIdx] = useState(0);
  const [selectedImages, setSelectedImages] = useState<SelectedImage[]>([]);
  const [imageErrors, setImageErrors] = useState<string[]>([]);
  const messagesEndRef = useRef<HTMLDivElement>(null);
  const textareaRef = useRef<HTMLTextAreaElement>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);

  // ── Image attachments ───────────────────────────────────────────────────────
  // Images staged in the input area before sending
  const [attachedImages, setAttachedImages] = useState<File[]>([]);
  // Images captured at send time, held until import completes or is discarded
  const pendingImagesRef = useRef<File[]>([]);

  // ── Batch state ────────────────────────────────────────────────────────────
  const [batchManifest, setBatchManifest] = useState<BatchManifest | null>(null);
  const [batchPhase, setBatchPhase] = useState<BatchPhase>("idle");
  const [currentBatchIndex, setCurrentBatchIndex] = useState(0);
  const [totalImported, setTotalImported] = useState(0);
  const [autoApprove, setAutoApprove] = useState(false);
  const [paused, setPaused] = useState(false);
  const [confirmNewChat, setConfirmNewChat] = useState(false);
  // Ref so async sendMessage can read latest manifest without stale closure
  const batchManifestRef = useRef<BatchManifest | null>(null);
  // Signals to the response handler that a batch (not a manifest) is expected
  const isBatchGeneratingRef = useRef(false);

  // Load auto-approve preference from localStorage
  useEffect(() => {
    const stored = localStorage.getItem("robin-brainstorm-auto-approve");
    if (stored === "true") setAutoApprove(true);
  }, []);

  useEffect(() => {
    if (isOpen) {
      messagesEndRef.current?.scrollIntoView({ behavior: "smooth" });
    }
  }, [messages, isOpen]);

  // Focus textarea when drawer opens
  useEffect(() => {
    if (isOpen) {
      setTimeout(() => textareaRef.current?.focus(), 300);
    }
  }, [isOpen]);

  // Close on Escape key
  useEffect(() => {
    if (!isOpen) return;
    function handleEscape(e: KeyboardEvent) {
      if (e.key === "Escape") onClose();
    }
    document.addEventListener("keydown", handleEscape);
    return () => document.removeEventListener("keydown", handleEscape);
  }, [isOpen, onClose]);

  // Auto-resize textarea
  const adjustTextareaHeight = useCallback(() => {
    const el = textareaRef.current;
    if (!el) return;
    el.style.height = "auto";
    const lineHeight = 20;
    const maxHeight = lineHeight * 6 + 16;
    el.style.height = `${Math.min(el.scrollHeight, maxHeight)}px`;
  }, []);

  useEffect(() => {
    adjustTextareaHeight();
  }, [input, adjustTextareaHeight]);

  // Reset highlighted index when filter or dropdown visibility changes
  useEffect(() => {
    setHighlightedIdx(0);
  }, [dropdownFilter, showDropdown]);

  const filteredDocs = contextDocs.filter((doc) => {
    if (selectedDocs.some((d) => d.id === doc.id)) return false;
    if (!dropdownFilter) return true;
    return doc.title.toLowerCase().includes(dropdownFilter.toLowerCase());
  });

  function handleInputChange(e: React.ChangeEvent<HTMLTextAreaElement>) {
    const val = e.target.value;
    setInput(val);
    adjustTextareaHeight();

    const match = SLASH_CONTEXT_RE.exec(val);
    if (match) {
      setShowDropdown(true);
      setDropdownFilter(match[2] ?? "");
    } else {
      setShowDropdown(false);
      setDropdownFilter("");
    }
  }

  function selectDoc(doc: ContextDocument) {
    setInput((prev) => prev.replace(SLASH_CONTEXT_RE, "").trimEnd());
    setSelectedDocs((prev) => [...prev, doc]);
    setShowDropdown(false);
    setDropdownFilter("");
    textareaRef.current?.focus();
  }

  function removeDoc(docId: string) {
    setSelectedDocs((prev) => prev.filter((d) => d.id !== docId));
  }

  function resetChat() {
    setMessages([]);
    setInput("");
    setImportData(null);
    setImported(false);
    setSelectedDocs([]);
    setShowDropdown(false);
    setBatchManifest(null);
    batchManifestRef.current = null;
    setBatchPhase("idle");
    setCurrentBatchIndex(0);
    setTotalImported(0);
    setPaused(false);
    isBatchGeneratingRef.current = false;
    setConfirmNewChat(false);
    setSelectedImages([]);
    setImageErrors([]);
    setAttachedImages([]);
    pendingImagesRef.current = [];
  }

  function handleNewChat() {
    const isBatchActive =
      batchPhase !== "idle" && batchPhase !== "done" && batchManifest !== null;
    if (isBatchActive) {
      setConfirmNewChat(true);
    } else {
      resetChat();
    }
  }

  async function uploadImagesToTasks(images: File[], taskIds: string[]) {
    try {
      const formData = new FormData();
      formData.append("taskIds", JSON.stringify(taskIds));
      images.forEach((img, i) => formData.append(`file_${i}`, img));
      const res = await fetch("/api/tasks/attachments", {
        method: "POST",
        body: formData,
      });
      if (!res.ok) {
        console.error("[BrainstormModal] attachment upload failed:", res.status);
      }
    } catch (err) {
      console.error("[BrainstormModal] attachment upload error:", err);
    }
  }

  async function sendMessage(text: string, isProgrammatic = false, images?: SelectedImage[]) {
    if (!text && !images?.length) return;
    if (streaming) return;

    // Capture images for this turn (only for user-initiated messages)
    if (isProgrammatic) {
      pendingImagesRef.current = [];
    } else {
      pendingImagesRef.current = attachedImages;
      setAttachedImages([]);
    }

    const now = new Date();
    const imageUrls = images?.length ? images.map((img) => img.dataUrl) : undefined;
    const userMessage: Message = {
      role: "user",
      content: text,
      timestamp: now,
      ...(imageUrls !== undefined && { imageUrls }),
    };
    const newMessages = [...messages, userMessage];
    setMessages(newMessages);
    if (!isProgrammatic) {
      setInput("");
      setSelectedImages([]);
      setImageErrors([]);
    }
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
          messages: newMessages.map(({ role, content, imageUrls: imgs }) => ({
            role,
            content,
            ...(imgs !== undefined && { images: imgs }),
          })),
          contextDocIds: selectedDocs.map((d) => d.id),
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

      // Try manifest first; fall back to tasks extraction
      const manifest = extractBatchManifest(accumulated);
      if (manifest) {
        batchManifestRef.current = manifest;
        setBatchManifest(manifest);
        setBatchPhase("manifest_ready");
        isBatchGeneratingRef.current = false;
        // Batch mode: discard pending images (multi-turn flow, not associable per-turn)
        pendingImagesRef.current = [];
      } else {
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
            if (isBatchGeneratingRef.current) {
              setBatchPhase("batch_ready");
              isBatchGeneratingRef.current = false;
            }
            // pendingImagesRef.current stays — will be uploaded after import
          } else {
            // No valid tasks parsed: discard pending images
            pendingImagesRef.current = [];
          }
        } else {
          // No tasks in response (conversational reply): discard pending images
          pendingImagesRef.current = [];
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

  async function handleSend() {
    const images = selectedImages.length > 0 ? selectedImages : undefined;
    await sendMessage(input.trim(), false, images);
  }

  function handleAttachClick() {
    fileInputRef.current?.click();
  }

  async function handleFileChange(e: React.ChangeEvent<HTMLInputElement>) {
    const files = Array.from(e.target.files ?? []);
    e.target.value = "";
    if (files.length === 0) return;

    const { valid, errors } = validateImageFiles(files, selectedImages.length);

    if (errors.length > 0) {
      setImageErrors(errors);
      setTimeout(() => setImageErrors([]), 5000);
    }

    if (valid.length === 0) return;

    const newImages = await Promise.all(
      valid.map(async (file) => ({
        dataUrl: await fileToDataUrl(file),
        name: file.name,
      }))
    );
    setSelectedImages((prev) => [...prev, ...newImages]);
  }

  function handleRemoveImage(index: number) {
    setSelectedImages((prev) => prev.filter((_, i) => i !== index));
  }

  function triggerBatch(index: number) {
    const manifest = batchManifestRef.current;
    if (!manifest) return;
    const batch = manifest.batches[index];
    if (!batch) return;
    setCurrentBatchIndex(index);
    setBatchPhase("generating");
    isBatchGeneratingRef.current = true;
    void sendMessage(`Genera batch ${batch.batch_id}: ${batch.title}`, true);
  }

  function handleBatchImported(importedCount: number) {
    const manifest = batchManifestRef.current;
    const nextIndex = currentBatchIndex + 1;

    setTotalImported((prev) => prev + importedCount);
    setCurrentBatchIndex(nextIndex);
    setImported(true);
    setImportData(null);
    onImported();

    if (!manifest) return;

    if (nextIndex >= manifest.batches.length) {
      setBatchPhase("done");
    } else if (!paused) {
      triggerBatch(nextIndex);
    }
    // If paused: batchPhase stays where it is; BatchProgressBar shows "Riprendi"
  }

  function handleKeyDown(e: React.KeyboardEvent<HTMLTextAreaElement>) {
    if (showDropdown) {
      if (e.key === "ArrowDown") {
        e.preventDefault();
        setHighlightedIdx((prev) => Math.min(prev + 1, filteredDocs.length - 1));
        return;
      }
      if (e.key === "ArrowUp") {
        e.preventDefault();
        setHighlightedIdx((prev) => Math.max(prev - 1, 0));
        return;
      }
      if (e.key === "Enter") {
        e.preventDefault();
        const doc = filteredDocs[highlightedIdx];
        if (doc) selectDoc(doc);
        return;
      }
      if (e.key === "Escape") {
        e.preventDefault();
        setShowDropdown(false);
        setDropdownFilter("");
        setInput((prev) => prev.replace(SLASH_CONTEXT_RE, "").trimEnd());
        return;
      }
    }

    if (e.key === "Enter" && !e.shiftKey) {
      e.preventDefault();
      void handleSend();
    }
  }

  const displayModelName = modelName ?? AI_MODEL_NAME;

  return (
    <div
      className={cn(
        "fixed right-0 top-0 z-40 h-screen w-full md:w-[480px]",
        "flex flex-col border-l border-border bg-background shadow-2xl",
        "transition-transform duration-300 ease-in-out",
        isOpen ? "translate-x-0" : "translate-x-full"
      )}
      aria-hidden={!isOpen}
    >
      {/* Header */}
      <div className="flex shrink-0 items-center justify-between border-b border-border bg-background px-4 py-3">
        <div className="flex items-center gap-2.5">
          <div className="h-7 w-7 rounded-full bg-foreground flex items-center justify-center">
            <Bot className="h-4 w-4 text-background" />
          </div>
          <div>
            <div className="flex items-center gap-1.5">
              <p className="text-sm font-semibold leading-tight">Robin AI</p>
              <span
                className={`rounded px-1.5 py-0.5 text-[10px] font-medium leading-none ${modelBadgeClass(displayModelName)}`}
              >
                {displayModelName}
              </span>
            </div>
            <p className="text-[10px] text-muted-foreground leading-tight">
              {streaming ? "Sta scrivendo…" : "Online"}
            </p>
          </div>
        </div>
        <div className="flex items-center gap-1">
          {/* Auto-approve toggle — visible once batch has started */}
          {batchManifest !== null && batchPhase !== "done" && (
            <button
              onClick={() => {
                const next = !autoApprove;
                setAutoApprove(next);
                localStorage.setItem("robin-brainstorm-auto-approve", String(next));
                // If we just enabled auto-approve while paused, un-pause and trigger next
                if (next && paused && batchPhase !== "generating") {
                  setPaused(false);
                  triggerBatch(currentBatchIndex);
                }
              }}
              title={autoApprove ? "Auto-approve attivo — clicca per disattivare" : "Attiva auto-approve"}
              className={cn(
                "flex items-center gap-1 rounded-md px-2 py-1 text-xs transition-colors",
                autoApprove
                  ? "bg-blue-100 text-blue-700 hover:bg-blue-200 dark:bg-blue-900/30 dark:text-blue-300"
                  : "text-muted-foreground hover:bg-accent hover:text-foreground"
              )}
            >
              <Zap className="h-3 w-3" />
              {autoApprove ? "Auto" : "Auto"}
            </button>
          )}
          {/* Pausa / Riprendi — visible during active batch execution */}
          {batchManifest !== null && batchPhase !== "idle" && batchPhase !== "manifest_ready" && batchPhase !== "done" && (
            <button
              onClick={() => {
                if (paused) {
                  setPaused(false);
                  triggerBatch(currentBatchIndex);
                } else {
                  setPaused(true);
                }
              }}
              title={paused ? "Riprendi esecuzione batch" : "Pausa dopo il batch corrente"}
              className="rounded-md p-1.5 text-muted-foreground hover:bg-accent hover:text-foreground transition-colors"
            >
              {paused ? <Play className="h-3.5 w-3.5" /> : <Pause className="h-3.5 w-3.5" />}
            </button>
          )}
          {/* Nuova chat / confirm */}
          {messages.length > 0 && !confirmNewChat && (
            <button
              onClick={handleNewChat}
              className="rounded-md px-2 py-1 text-xs text-muted-foreground hover:text-foreground hover:bg-accent transition-colors"
            >
              Nuova chat
            </button>
          )}
          {confirmNewChat && (
            <div className="flex items-center gap-1">
              <span className="text-xs text-muted-foreground">Sei sicuro?</span>
              <button
                onClick={resetChat}
                className="rounded-md px-2 py-1 text-xs text-red-600 hover:bg-red-50 dark:hover:bg-red-900/20 transition-colors"
              >
                Sì
              </button>
              <button
                onClick={() => setConfirmNewChat(false)}
                className="rounded-md px-2 py-1 text-xs text-muted-foreground hover:bg-accent transition-colors"
              >
                No
              </button>
            </div>
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
            {contextDocs.length > 0 && (
              <p className="text-xs text-muted-foreground mt-1">
                Digita{" "}
                <code className="bg-accent rounded px-1">/context</code>
                {" "}per allegare documenti
              </p>
            )}
          </div>
        )}

        {messages.map((msg, i) => {
          const isLastAssistant = msg.role === "assistant" && i === messages.length - 1;
          if (msg.role === "user") {
            return (
              <UserMessage
                key={i}
                content={msg.content}
                timestamp={msg.timestamp}
                imageUrls={msg.imageUrls}
              />
            );
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

        {/* Batch manifest preview */}
        {batchPhase === "manifest_ready" && batchManifest !== null && (
          <BatchManifestPreview
            manifest={batchManifest}
            autoApprove={autoApprove}
            onToggleAutoApprove={() => {
              const next = !autoApprove;
              setAutoApprove(next);
              localStorage.setItem("robin-brainstorm-auto-approve", String(next));
            }}
            onStart={() => triggerBatch(0)}
            onCancel={() => {
              setBatchPhase("idle");
              setBatchManifest(null);
              batchManifestRef.current = null;
            }}
          />
        )}

        {/* Batch progress bar (generating / batch_ready / done) */}
        {batchManifest !== null && batchPhase !== "idle" && batchPhase !== "manifest_ready" && (
          <BatchProgressBar
            manifest={batchManifest}
            currentBatchIndex={currentBatchIndex}
            totalImported={totalImported}
            phase={batchPhase}
            paused={paused}
            onResume={() => {
              setPaused(false);
              triggerBatch(currentBatchIndex);
            }}
          />
        )}

        {/* Inline import card */}
        {!streaming && importData !== null && !imported && (
          <ImportPreviewCard
            tasks={importData.tasks}
            errors={importData.errors}
            truncated={importData.truncated}
            originalCount={importData.originalCount}
            repositories={repositories}
            onDismiss={() => {
              setImportData(null);
              // User dismissed import without creating tasks: discard pending images
              pendingImagesRef.current = [];
              if (batchManifest) setBatchPhase("batch_ready");
            }}
            onImported={(taskIds) => {
              // Upload any pending images and associate them with the created tasks
              if (pendingImagesRef.current.length > 0 && taskIds.length > 0) {
                void uploadImagesToTasks(pendingImagesRef.current, taskIds);
              }
              pendingImagesRef.current = [];

              if (batchManifest) {
                handleBatchImported(importData.tasks.length);
              } else {
                setImported(true);
                setImportData(null);
                onImported();
              }
            }}
            {...(autoApprove && batchManifest !== null && !paused
              ? { autoApproveCountdownSeconds: 3 }
              : {})}
          />
        )}

        {/* Non-batch import success */}
        {imported && batchManifest === null && (
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

      {/* Input area */}
      <div className="shrink-0 border-t border-border bg-background px-3 py-3">
        {/* Hidden file input for image selection */}
        <input
          ref={fileInputRef}
          type="file"
          accept="image/jpeg,image/png,image/gif,image/webp"
          multiple
          className="hidden"
          onChange={(e) => {
            const files = Array.from(e.target.files ?? []);
            if (files.length > 0) {
              setAttachedImages((prev) => [...prev, ...files]);
            }
            if (fileInputRef.current) fileInputRef.current.value = "";
          }}
        />

        {/* Selected context doc chips */}
        {selectedDocs.length > 0 && (
          <div className="flex flex-wrap gap-1 mb-2">
            {selectedDocs.map((doc) => (
              <span
                key={doc.id}
                className="inline-flex items-center gap-1 rounded-full bg-accent px-2 py-0.5 text-xs text-accent-foreground"
              >
                <FileText className="h-3 w-3 shrink-0" />
                <span className="max-w-[140px] truncate">{doc.title}</span>
                <button
                  onClick={() => removeDoc(doc.id)}
                  className="ml-0.5 rounded-full hover:text-foreground text-muted-foreground transition-colors"
                  aria-label={`Rimuovi ${doc.title}`}
                >
                  <X className="h-3 w-3" />
                </button>
              </span>
            ))}
          </div>
        )}

        {/* Attached image chips */}
        {attachedImages.length > 0 && (
          <div className="flex flex-wrap gap-1 mb-2">
            {attachedImages.map((img, i) => (
              <span
                key={i}
                className="inline-flex items-center gap-1 rounded-full bg-accent px-2 py-0.5 text-xs text-accent-foreground"
              >
                <Paperclip className="h-3 w-3 shrink-0" />
                <span className="max-w-[120px] truncate">{img.name}</span>
                <button
                  onClick={() => setAttachedImages((prev) => prev.filter((_, j) => j !== i))}
                  className="ml-0.5 rounded-full hover:text-foreground text-muted-foreground transition-colors"
                  aria-label={`Rimuovi ${img.name}`}
                >
                  <X className="h-3 w-3" />
                </button>
              </span>
            ))}
          </div>
        )}

        {/* Context document dropdown */}
        {showDropdown && (
          <div className="mb-2 rounded-lg border border-border bg-background shadow-md max-h-48 overflow-y-auto">
            {filteredDocs.length === 0 ? (
              <div className="px-3 py-2 text-xs text-muted-foreground">
                Nessun documento trovato
              </div>
            ) : (
              filteredDocs.map((doc, idx) => (
                <button
                  key={doc.id}
                  onMouseDown={(e) => {
                    e.preventDefault();
                    selectDoc(doc);
                  }}
                  className={`w-full flex items-center gap-2 px-3 py-2 text-left text-sm transition-colors ${
                    idx === highlightedIdx
                      ? "bg-accent text-accent-foreground"
                      : "hover:bg-accent/50"
                  }`}
                >
                  <FileText className="h-3.5 w-3.5 shrink-0 text-muted-foreground" />
                  <span className="truncate">{doc.title}</span>
                </button>
              ))
            )}
          </div>
        )}

        {/* Image validation errors */}
        {imageErrors.length > 0 && (
          <div className="mb-2 rounded-lg border border-destructive/30 bg-destructive/5 px-3 py-2">
            {imageErrors.map((err, i) => (
              <p key={i} className="text-xs text-destructive">{err}</p>
            ))}
          </div>
        )}

        {/* Image thumbnail previews */}
        {selectedImages.length > 0 && (
          <div className="flex flex-wrap gap-1.5 mb-2">
            {selectedImages.map((img, i) => (
              <div key={i} className="relative">
                {/* eslint-disable-next-line @next/next/no-img-element */}
                <img
                  src={img.dataUrl}
                  alt={img.name}
                  className="h-16 w-16 rounded-lg object-cover border border-border"
                />
                <button
                  onClick={() => handleRemoveImage(i)}
                  className="absolute -top-1 -right-1 h-4 w-4 rounded-full bg-foreground text-background flex items-center justify-center hover:bg-foreground/80 transition-colors"
                  aria-label={`Rimuovi ${img.name}`}
                >
                  <X className="h-2.5 w-2.5" />
                </button>
              </div>
            ))}
          </div>
        )}

        {/* Hidden file input */}
        <input
          ref={fileInputRef}
          type="file"
          accept={ALLOWED_IMAGE_TYPES.join(",")}
          multiple
          className="hidden"
          onChange={(e) => void handleFileChange(e)}
        />

        <div className="rounded-2xl border border-border bg-background focus-within:ring-1 focus-within:ring-ring transition-shadow">
          <textarea
            ref={textareaRef}
            value={input}
            onChange={handleInputChange}
            onKeyDown={handleKeyDown}
            disabled={streaming}
            placeholder="Descrivi cosa vuoi implementare…"
            rows={1}
            style={{ height: "auto" }}
            className="w-full px-4 pt-3.5 pb-2 resize-none bg-transparent text-sm leading-5 focus:outline-none disabled:opacity-50 placeholder:text-muted-foreground"
          />
          <div className="flex items-center gap-2 px-3 pb-3">
            {/* Attach image button */}
            <button
              onClick={handleAttachClick}
              disabled={streaming || selectedImages.length >= MAX_IMAGE_FILES}
              aria-label="Allega immagine"
              title="Allega immagine (PNG, JPEG, WEBP · max 5 MB · max 3)"
              className="flex h-7 w-7 items-center justify-center rounded-lg text-muted-foreground hover:text-foreground hover:bg-accent transition-colors disabled:opacity-40 disabled:cursor-not-allowed"
            >
              <Paperclip className="h-3.5 w-3.5" />
            </button>
            {contextDocs.length > 0 && (
              <button
                onMouseDown={(e) => {
                  e.preventDefault();
                  setInput((prev) => (prev ? `${prev} /context ` : "/context "));
                  setTimeout(() => textareaRef.current?.focus(), 0);
                }}
                title="Allega documento di contesto (/context)"
                className="flex h-7 w-7 items-center justify-center rounded-lg bg-accent text-accent-foreground hover:bg-accent/80 transition-colors"
              >
                <FileText className="h-3.5 w-3.5" />
              </button>
            )}
            <button
              type="button"
              onMouseDown={(e) => {
                e.preventDefault();
                fileInputRef.current?.click();
              }}
              title="Allega immagini"
              className="flex h-7 w-7 items-center justify-center rounded-lg bg-accent text-accent-foreground hover:bg-accent/80 transition-colors"
            >
              <Paperclip className="h-3.5 w-3.5" />
            </button>
            <div className="flex-1" />
            <span className={`rounded-md px-2 py-0.5 text-[10px] font-medium ${modelBadgeClass(displayModelName)}`}>
              {displayModelName}
            </span>
            <button
              onClick={() => void handleSend()}
              disabled={streaming || (!input.trim() && selectedImages.length === 0)}
              aria-label="Invia messaggio"
              className="shrink-0 flex h-8 w-8 items-center justify-center rounded-xl bg-primary text-primary-foreground transition-all hover:bg-primary/90 disabled:opacity-40 disabled:cursor-not-allowed"
            >
              {streaming ? (
                <Loader2 className="h-4 w-4 animate-spin" />
              ) : (
                <ArrowUp className="h-4 w-4" />
              )}
            </button>
          </div>
        </div>
        <p className="mt-2 text-center text-[10px] text-muted-foreground">
          Invio per inviare&nbsp;·&nbsp;Shift+Invio per andare a capo
        </p>
      </div>
    </div>
  );
}
