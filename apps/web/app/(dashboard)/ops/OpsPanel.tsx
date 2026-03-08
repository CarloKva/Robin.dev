"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { useAuth } from "@clerk/nextjs";
import ReactMarkdown from "react-markdown";
import {
  Play,
  Loader2,
  AlertTriangle,
  CheckCircle2,
  Terminal,
  Zap,
  Database,
  ChevronDown,
  ChevronRight,
  Search,
  RotateCcw,
  Square,
  Trash2,
  ArrowDown,
} from "lucide-react";
import { getSupabaseBrowserClient } from "@/lib/supabase/client";
import { cn } from "@/lib/utils";
import { Input } from "@/components/ui/input";
import type {
  OpsRun,
  OpsLogEntry,
  OpsRecommendation,
  VpsDiagnostics,
  AgentWithStatus,
} from "@robin/shared-types";

// ─── Types ────────────────────────────────────────────────────────────────────

interface OpsPanelProps {
  initialRun: OpsRun | null;
  initialAgents: AgentWithStatus[];
}

type ActiveTab = "analysis" | "recommendations" | "raw";
type LogLevel = "ALL" | "LOG" | "WARN" | "ERR";

// ─── Avatar helpers ───────────────────────────────────────────────────────────

function nameToHue(name: string): number {
  let hash = 0;
  for (let i = 0; i < name.length; i++) {
    hash = (hash * 31 + name.charCodeAt(i)) & 0xffffffff;
  }
  return Math.abs(hash) % 360;
}

function getInitials(name: string): string {
  return name
    .split(/\s+/)
    .slice(0, 2)
    .map((w) => w[0]?.toUpperCase() ?? "")
    .join("");
}

// ─── Agent card helpers ───────────────────────────────────────────────────────

function isAgentOnline(agent: AgentWithStatus): boolean {
  if (!agent.last_seen_at) return false;
  return Date.now() - new Date(agent.last_seen_at).getTime() < 2 * 60 * 1000;
}

// ─── Sub-components ───────────────────────────────────────────────────────────

function SeverityBadge({ severity }: { severity: OpsRecommendation["severity"] }) {
  if (severity === "safe") {
    return (
      <span className="inline-flex items-center rounded px-1.5 py-0.5 text-xs font-medium bg-emerald-100 text-emerald-700">
        SAFE
      </span>
    );
  }
  return (
    <span className="inline-flex items-center rounded px-1.5 py-0.5 text-xs font-medium bg-red-100 text-red-700">
      DESTRUCTIVE
    </span>
  );
}

function RecommendationCard({
  rec,
  runId,
}: {
  rec: OpsRecommendation;
  runId: string;
}) {
  const [executing, setExecuting] = useState(false);
  const [executeResult, setExecuteResult] = useState<{
    ok: boolean;
    message: string;
  } | null>(null);

  const canExecute =
    rec.severity === "safe" && rec.actionType !== "manual_only";

  const handleExecute = async () => {
    setExecuting(true);
    setExecuteResult(null);
    try {
      const res = await fetch(`/api/ops/runs/${runId}/execute`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ actionType: rec.actionType, params: rec.params }),
      });
      const data = (await res.json()) as { ok?: boolean; message?: string; error?: string };
      setExecuteResult({
        ok: res.ok,
        message: data.message ?? data.error ?? (res.ok ? "Queued" : "Error"),
      });
    } catch (err) {
      setExecuteResult({ ok: false, message: String(err) });
    } finally {
      setExecuting(false);
    }
  };

  return (
    <div className="rounded-md border border-border p-4 space-y-2">
      <div className="flex items-start justify-between gap-3">
        <div className="flex items-center gap-2 flex-wrap">
          <SeverityBadge severity={rec.severity} />
          <span className="text-sm font-medium">{rec.title}</span>
          {rec.workspace ? (
            <span className="text-xs text-muted-foreground bg-muted rounded px-1.5 py-0.5">
              {rec.workspace}
            </span>
          ) : null}
        </div>

        {canExecute ? (
          <button
            onClick={() => void handleExecute()}
            disabled={executing || executeResult?.ok === true}
            className="shrink-0 flex items-center gap-1.5 rounded-md border border-border bg-background px-3 py-1 text-xs font-medium transition-colors hover:bg-accent hover:text-accent-foreground disabled:pointer-events-none disabled:opacity-50"
          >
            {executing ? (
              <Loader2 className="h-3 w-3 animate-spin" />
            ) : (
              <Zap className="h-3 w-3" />
            )}
            {executing ? "Executing..." : "Execute"}
          </button>
        ) : (
          <span className="shrink-0 text-xs text-muted-foreground italic">
            Esecuzione manuale
          </span>
        )}
      </div>

      <p className="text-xs text-muted-foreground">{rec.description}</p>

      {executeResult ? (
        <div
          className={`rounded-md px-3 py-2 text-xs ${
            executeResult.ok
              ? "bg-emerald-50 text-emerald-700"
              : "bg-red-50 text-red-700"
          }`}
        >
          {executeResult.ok ? "✓" : "✗"} {executeResult.message}
        </div>
      ) : null}
    </div>
  );
}

function CollapsibleJson({ title, data }: { title: string; data: unknown }) {
  const [open, setOpen] = useState(false);
  return (
    <div className="rounded-md border border-border overflow-hidden">
      <button
        onClick={() => setOpen((p) => !p)}
        className="flex w-full items-center justify-between px-4 py-2 text-sm font-medium hover:bg-accent transition-colors"
      >
        <span>{title}</span>
        {open ? (
          <ChevronDown className="h-4 w-4 text-muted-foreground" />
        ) : (
          <ChevronRight className="h-4 w-4 text-muted-foreground" />
        )}
      </button>
      {open ? (
        <pre className="overflow-x-auto bg-muted/50 p-4 text-xs font-mono">
          {JSON.stringify(data, null, 2)}
        </pre>
      ) : null}
    </div>
  );
}

// ─── Agent sidebar card ───────────────────────────────────────────────────────

function AgentSidebarCard({
  agent,
  selected,
  onClick,
}: {
  agent: AgentWithStatus;
  selected: boolean;
  onClick: () => void;
}) {
  const hue = nameToHue(agent.name);
  const initials = getInitials(agent.name);
  const online = isAgentOnline(agent);

  return (
    <button
      onClick={onClick}
      className={cn(
        "w-full text-left border border-border rounded-lg p-3 bg-card transition-colors",
        "hover:border-zinc-400",
        selected && "border-foreground bg-accent"
      )}
    >
      <div className="flex items-center gap-2">
        {/* Avatar */}
        <div
          className="w-8 h-8 shrink-0 rounded-full flex items-center justify-center text-xs font-semibold select-none"
          style={{
            background: `hsl(${hue}, 65%, 50%)`,
            color: `hsl(${hue}, 65%, 95%)`,
          }}
        >
          {initials}
        </div>

        {/* Name + badge */}
        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-1.5 justify-between">
            <span className="text-sm font-medium truncate">{agent.name}</span>
            <span
              className={cn(
                "shrink-0 inline-flex items-center gap-1 rounded-full border px-1.5 py-0.5 text-xs font-medium",
                online
                  ? "bg-emerald-50 text-emerald-700 border-emerald-200 dark:bg-emerald-950 dark:text-emerald-400 dark:border-emerald-800"
                  : "bg-zinc-50 text-zinc-500 border-zinc-200 dark:bg-zinc-900 dark:text-zinc-500 dark:border-zinc-700"
              )}
            >
              <span
                className={cn(
                  "h-1.5 w-1.5 rounded-full",
                  online ? "bg-emerald-500 animate-pulse" : "bg-zinc-300 dark:bg-zinc-600"
                )}
              />
              {online ? "Online" : "Offline"}
            </span>
          </div>
          {agent.vps_ip && (
            <p className="text-xs font-mono text-muted-foreground mt-0.5 truncate">
              {agent.vps_ip}
            </p>
          )}
        </div>
      </div>
    </button>
  );
}

// ─── Log line terminal ────────────────────────────────────────────────────────

function TerminalLogLine({ entry }: { entry: OpsLogEntry }) {
  const timestamp = new Date().toLocaleTimeString("it-IT", {
    hour: "2-digit",
    minute: "2-digit",
    second: "2-digit",
  });

  const levelColor =
    entry.level === "warn"
      ? "text-amber-400"
      : entry.level === "error"
      ? "text-red-400"
      : "text-zinc-400";

  const levelLabel =
    entry.level === "warn" ? "WARN" : entry.level === "error" ? "ERR " : "LOG ";

  return (
    <div className="flex gap-2 leading-5">
      <span className="shrink-0 text-zinc-500">{timestamp}</span>
      <span className="shrink-0 text-zinc-400 font-medium">
        [{entry.source}]
      </span>
      <span className={cn("shrink-0 font-medium", levelColor)}>{levelLabel}</span>
      <span className="text-zinc-300 break-all">
        {entry.message}
        {entry.workspace ? (
          <span className="ml-1 text-zinc-500">({entry.workspace})</span>
        ) : null}
      </span>
    </div>
  );
}

// ─── Level filter dropdown ────────────────────────────────────────────────────

function LevelFilterButton({
  value,
  onChange,
}: {
  value: LogLevel;
  onChange: (v: LogLevel) => void;
}) {
  const [open, setOpen] = useState(false);
  const levels: LogLevel[] = ["ALL", "LOG", "WARN", "ERR"];

  return (
    <div className="relative">
      <button
        onClick={() => setOpen((p) => !p)}
        className="flex items-center gap-1.5 rounded-md border border-border bg-background px-3 py-1.5 text-sm transition-colors hover:bg-accent hover:text-accent-foreground"
      >
        {value}
        <ChevronDown className="h-3.5 w-3.5 text-muted-foreground" />
      </button>
      {open && (
        <div className="absolute left-0 top-full mt-1 z-10 min-w-[80px] rounded-md border border-border bg-background shadow-md">
          {levels.map((level) => (
            <button
              key={level}
              onClick={() => {
                onChange(level);
                setOpen(false);
              }}
              className={cn(
                "w-full text-left px-3 py-1.5 text-sm transition-colors hover:bg-accent hover:text-accent-foreground",
                value === level && "bg-accent text-accent-foreground"
              )}
            >
              {level}
            </button>
          ))}
        </div>
      )}
    </div>
  );
}

// ─── Main panel ───────────────────────────────────────────────────────────────

export function OpsPanel({ initialRun, initialAgents }: OpsPanelProps) {
  const { getToken } = useAuth();
  const [run, setRun] = useState<OpsRun | null>(initialRun);
  const [starting, setStarting] = useState(false);
  const [activeTab, setActiveTab] = useState<ActiveTab>("analysis");

  // Agent selection
  const [selectedAgentId, setSelectedAgentId] = useState<string | null>(null);

  // Log toolbar state
  const [logSearch, setLogSearch] = useState("");
  const [logLevel, setLogLevel] = useState<LogLevel>("ALL");
  const [logAgentFilter, setLogAgentFilter] = useState<string | null>(null);
  const [openAgentDropdown, setOpenAgentDropdown] = useState(false);

  // Auto-scroll state
  const logContainerRef = useRef<HTMLDivElement>(null);
  const bottomRef = useRef<HTMLDivElement>(null);
  const [isAutoScrollEnabled, setIsAutoScrollEnabled] = useState(true);

  const channelRef = useRef<ReturnType<typeof getSupabaseBrowserClient>["channel"] | null>(null);

  const isRunning = run?.status === "running";
  const selectedAgent = initialAgents.find((a) => a.id === selectedAgentId) ?? null;

  // Auto-scroll on new logs
  useEffect(() => {
    if (isAutoScrollEnabled) {
      bottomRef.current?.scrollIntoView({ behavior: "smooth" });
    }
  }, [run?.log, isAutoScrollEnabled]);

  // Scroll handler — disable auto-scroll if user scrolled up manually
  const handleScroll = () => {
    const el = logContainerRef.current;
    if (!el) return;
    const atBottom = el.scrollHeight - el.scrollTop - el.clientHeight < 40;
    setIsAutoScrollEnabled(atBottom);
  };

  const scrollToBottom = () => {
    bottomRef.current?.scrollIntoView({ behavior: "smooth" });
    setIsAutoScrollEnabled(true);
  };

  // Realtime subscription
  const subscribeToRun = useCallback(
    async (runId: string) => {
      const supabase = getSupabaseBrowserClient();

      if (channelRef.current) {
        await supabase.removeChannel(channelRef.current);
        channelRef.current = null;
      }

      const token = await getToken({ template: "supabase" });
      if (token) {
        supabase.realtime.setAuth(token);
      }

      const channel = supabase
        .channel(`ops-run-${runId}`)
        .on(
          "postgres_changes",
          {
            event: "UPDATE",
            schema: "public",
            table: "ops_runs",
            filter: `id=eq.${runId}`,
          },
          (payload: { new: Record<string, unknown> }) => {
            const updated = payload.new;
            setRun((prev) => {
              if (!prev || prev.id !== runId) return prev;
              return {
                ...prev,
                status: (updated["status"] as OpsRun["status"]) ?? prev.status,
                progress: (updated["progress"] as number) ?? prev.progress,
                log: (updated["log"] as OpsRun["log"]) ?? prev.log,
                rawDiagnostics:
                  (updated["raw_diagnostics"] as OpsRun["rawDiagnostics"]) ??
                  prev.rawDiagnostics,
                aiAnalysis:
                  (updated["ai_analysis"] as string | null) ?? prev.aiAnalysis,
                aiRecommendations:
                  (updated["ai_recommendations"] as OpsRun["aiRecommendations"]) ??
                  prev.aiRecommendations,
                completedAt:
                  (updated["completed_at"] as string | null) ?? prev.completedAt,
              };
            });
          }
        )
        .subscribe();

      channelRef.current = channel as unknown as ReturnType<typeof supabase.channel>;
    },
    [getToken]
  );

  useEffect(() => {
    if (run?.id) {
      void subscribeToRun(run.id);
    }

    return () => {
      if (channelRef.current) {
        const supabase = getSupabaseBrowserClient();
        void supabase.removeChannel(channelRef.current as Parameters<typeof supabase.removeChannel>[0]);
        channelRef.current = null;
      }
    };
  }, [run?.id, subscribeToRun]);

  const handleRunDiagnostics = async () => {
    setStarting(true);
    try {
      const res = await fetch("/api/ops/run-diagnostics", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ scope: "all" }),
      });
      const data = (await res.json()) as { opsRunId?: string; error?: string };
      if (!res.ok || !data.opsRunId) {
        console.error("Failed to start diagnostics:", data.error);
        return;
      }
      const runRes = await fetch(`/api/ops/runs/${data.opsRunId}`);
      const runData = (await runRes.json()) as { run?: OpsRun };
      if (runData.run) {
        setRun(runData.run);
        setActiveTab("analysis");
      }
    } finally {
      setStarting(false);
    }
  };

  // ─── Log filtering ────────────────────────────────────────────────────────

  const filteredLogs: OpsLogEntry[] = (run?.log ?? []).filter((entry) => {
    // Level filter
    if (logLevel !== "ALL") {
      const levelMap: Record<LogLevel, string> = { ALL: "", LOG: "info", WARN: "warn", ERR: "error" };
      if (entry.level !== levelMap[logLevel]) return false;
    }

    // Agent filter (from toolbar dropdown, only shown when "Tutti" selected)
    if (selectedAgentId === null && logAgentFilter !== null) {
      const agent = initialAgents.find((a) => a.id === logAgentFilter);
      if (agent && entry.workspace !== agent.name && entry.source !== agent.slug) {
        return false;
      }
    }

    // Agent card selection filter
    if (selectedAgentId !== null && selectedAgent) {
      if (entry.workspace !== selectedAgent.name && entry.source !== selectedAgent.slug) {
        return false;
      }
    }

    // Search filter
    if (logSearch.trim()) {
      const q = logSearch.toLowerCase();
      if (
        !entry.message.toLowerCase().includes(q) &&
        !entry.source.toLowerCase().includes(q) &&
        !(entry.workspace?.toLowerCase().includes(q) ?? false)
      ) {
        return false;
      }
    }

    return true;
  });

  const lastRunTime = run?.completedAt
    ? formatRelative(run.completedAt)
    : run?.createdAt
    ? formatRelative(run.createdAt)
    : null;

  const statusIcon =
    run?.status === "running" ? (
      <Loader2 className="h-4 w-4 animate-spin text-amber-500" />
    ) : run?.status === "completed" ? (
      <CheckCircle2 className="h-4 w-4 text-emerald-500" />
    ) : run?.status === "failed" ? (
      <AlertTriangle className="h-4 w-4 text-red-500" />
    ) : null;

  return (
    <div className="space-y-4">
      {/* ── Page header ─────────────────────────────────────────────────── */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-xl font-semibold">Ops Diagnostics</h1>
          <p className="text-sm text-muted-foreground mt-0.5">
            {lastRunTime
              ? run?.status === "running"
                ? "In esecuzione..."
                : `Ultima esecuzione: ${lastRunTime}`
              : "Nessuna esecuzione precedente"}
          </p>
        </div>

        <div className="flex items-center gap-3">
          {/* Live indicator */}
          <div className="flex items-center gap-1.5">
            <span className="w-2 h-2 rounded-full bg-emerald-500 animate-pulse" />
            <span className="text-xs text-muted-foreground">Live</span>
          </div>

          {statusIcon}

          <button
            onClick={() => void handleRunDiagnostics()}
            disabled={isRunning || starting}
            className="flex items-center gap-2 rounded-md bg-foreground px-4 py-2 text-sm font-medium text-background transition-colors hover:opacity-90 disabled:pointer-events-none disabled:opacity-50"
          >
            {starting ? (
              <Loader2 className="h-4 w-4 animate-spin" />
            ) : (
              <Play className="h-4 w-4" />
            )}
            {isRunning ? "In esecuzione..." : "Run Diagnostics"}
          </button>
        </div>
      </div>

      {/* ── Main grid ───────────────────────────────────────────────────── */}
      <div className="grid grid-cols-3 gap-6">

        {/* ── Left column: Agent cards ─────────────────────────────────── */}
        <div className="col-span-1 space-y-2">
          {/* "Tutti gli agenti" option */}
          <button
            onClick={() => setSelectedAgentId(null)}
            className={cn(
              "w-full text-left border border-border rounded-lg p-3 bg-card transition-colors hover:border-zinc-400",
              selectedAgentId === null && "border-foreground bg-accent"
            )}
          >
            <div className="flex items-center gap-2">
              <div className="w-8 h-8 shrink-0 rounded-full bg-zinc-200 dark:bg-zinc-700 flex items-center justify-center">
                <Terminal className="h-4 w-4 text-zinc-500 dark:text-zinc-400" />
              </div>
              <div>
                <span className="text-sm font-medium">Tutti gli agenti</span>
                <p className="text-xs text-muted-foreground">Log aggregati</p>
              </div>
            </div>
          </button>

          {/* Agent cards */}
          {initialAgents.map((agent) => (
            <AgentSidebarCard
              key={agent.id}
              agent={agent}
              selected={selectedAgentId === agent.id}
              onClick={() => {
                setSelectedAgentId(agent.id);
                setLogAgentFilter(null);
              }}
            />
          ))}

          {initialAgents.length === 0 && (
            <p className="text-xs text-muted-foreground px-1">Nessun agente configurato</p>
          )}
        </div>

        {/* ── Right column: toolbar + terminal ─────────────────────────── */}
        <div className="col-span-2 flex flex-col gap-3">

          {/* Progress bar (shown while running) */}
          {run && isRunning ? (
            <div className="flex items-center gap-3">
              <div className="flex-1 h-1.5 rounded-full bg-muted overflow-hidden">
                <div
                  className="h-full rounded-full bg-foreground transition-all duration-500"
                  style={{ width: `${run.progress}%` }}
                />
              </div>
              <span className="text-xs text-muted-foreground w-8 text-right">
                {run.progress}%
              </span>
            </div>
          ) : null}

          {/* ── Toolbar ──────────────────────────────────────────────────── */}
          <div className="flex items-center gap-2 flex-wrap">
            {/* Search */}
            <div className="relative w-48">
              <Search className="absolute left-2.5 top-1/2 -translate-y-1/2 h-3.5 w-3.5 text-muted-foreground pointer-events-none" />
              <Input
                value={logSearch}
                onChange={(e) => setLogSearch(e.target.value)}
                placeholder="Filtra log..."
                className="pl-8 h-8 text-sm rounded-md"
              />
            </div>

            {/* Level filter */}
            <LevelFilterButton value={logLevel} onChange={setLogLevel} />

            {/* Agent filter dropdown — only visible when "Tutti" selected */}
            {selectedAgentId === null && (
              <div className="relative">
                <button
                  onClick={() => setOpenAgentDropdown((p) => !p)}
                  className="flex items-center gap-1.5 rounded-md border border-border bg-background px-3 py-1.5 text-sm transition-colors hover:bg-accent hover:text-accent-foreground"
                >
                  {logAgentFilter
                    ? (initialAgents.find((a) => a.id === logAgentFilter)?.name ?? "Agente")
                    : "Tutti gli agenti"}
                  <ChevronDown className="h-3.5 w-3.5 text-muted-foreground" />
                </button>
                {openAgentDropdown && (
                  <div className="absolute left-0 top-full mt-1 z-10 min-w-[160px] rounded-md border border-border bg-background shadow-md">
                    <button
                      onClick={() => { setLogAgentFilter(null); setOpenAgentDropdown(false); }}
                      className={cn(
                        "w-full text-left px-3 py-1.5 text-sm transition-colors hover:bg-accent",
                        logAgentFilter === null && "bg-accent text-accent-foreground"
                      )}
                    >
                      Tutti gli agenti
                    </button>
                    {initialAgents.map((agent) => (
                      <button
                        key={agent.id}
                        onClick={() => { setLogAgentFilter(agent.id); setOpenAgentDropdown(false); }}
                        className={cn(
                          "w-full text-left px-3 py-1.5 text-sm transition-colors hover:bg-accent",
                          logAgentFilter === agent.id && "bg-accent text-accent-foreground"
                        )}
                      >
                        {agent.name}
                      </button>
                    ))}
                  </div>
                )}
              </div>
            )}

            {/* Restart agent */}
            <button
              disabled={selectedAgentId === null}
              className="flex items-center gap-1.5 rounded-md border border-border bg-background px-3 py-1.5 text-sm transition-colors hover:bg-accent hover:text-accent-foreground disabled:pointer-events-none disabled:opacity-40"
              title="Restart agent"
            >
              <RotateCcw className="h-3.5 w-3.5" />
              Restart
            </button>

            {/* Stop agent */}
            <button
              disabled={selectedAgentId === null}
              className="flex items-center gap-1.5 rounded-md border border-border bg-background px-3 py-1.5 text-sm transition-colors hover:bg-accent hover:text-accent-foreground disabled:pointer-events-none disabled:opacity-40"
              title="Stop agent"
            >
              <Square className="h-3.5 w-3.5" />
              Stop
            </button>

            {/* Clear log */}
            <button
              onClick={() => setRun((prev) => prev ? { ...prev, log: [] } : prev)}
              className="ml-auto flex items-center gap-1.5 rounded-md px-3 py-1.5 text-sm transition-colors hover:bg-accent hover:text-accent-foreground"
              title="Clear log"
            >
              <Trash2 className="h-3.5 w-3.5" />
              Clear
            </button>
          </div>

          {/* ── Terminal log area ─────────────────────────────────────────── */}
          <div className="relative">
            <div
              ref={logContainerRef}
              onScroll={handleScroll}
              className="bg-zinc-950 rounded-lg border border-zinc-800 font-mono text-xs h-[calc(100vh-280px)] overflow-y-auto p-4 space-y-1"
            >
              {filteredLogs.length === 0 ? (
                <p className="text-zinc-500 text-xs text-center pt-8">
                  Nessun log disponibile
                </p>
              ) : (
                filteredLogs.map((entry, i) => {
                  const prev = filteredLogs[i - 1];
                  const showDivider =
                    i > 0 && prev !== undefined && prev.workspace !== entry.workspace && entry.workspace != null;
                  return (
                    <div key={i}>
                      {showDivider && (
                        <div className="border-t border-zinc-800 my-2" />
                      )}
                      <TerminalLogLine entry={entry} />
                    </div>
                  );
                })
              )}
              <div ref={bottomRef} />
            </div>

            {/* Scroll to bottom button */}
            {!isAutoScrollEnabled && (
              <button
                onClick={scrollToBottom}
                className="absolute bottom-4 right-4 flex items-center gap-1.5 rounded-md bg-zinc-800 border border-zinc-700 px-2.5 py-1.5 text-xs text-zinc-300 transition-colors hover:bg-zinc-700"
              >
                <ArrowDown className="h-3.5 w-3.5" />
                Scorri in fondo
              </button>
            )}
          </div>

          {/* ── Results section (non-running runs) ──────────────────────── */}
          {run && run.status !== "running" && (
            <div className="space-y-4 mt-2">
              {/* Tabs */}
              <div className="flex border-b border-border">
                {(
                  [
                    { id: "analysis" as const, label: "AI Analysis", icon: Terminal },
                    { id: "recommendations" as const, label: "Actions", icon: Zap },
                    { id: "raw" as const, label: "Raw Data", icon: Database },
                  ] as const
                ).map(({ id, label, icon: Icon }) => (
                  <button
                    key={id}
                    onClick={() => setActiveTab(id)}
                    className={`flex items-center gap-1.5 px-4 py-2 text-sm font-medium border-b-2 transition-colors ${
                      activeTab === id
                        ? "border-foreground text-foreground"
                        : "border-transparent text-muted-foreground hover:text-foreground"
                    }`}
                  >
                    <Icon className="h-3.5 w-3.5" />
                    {label}
                    {id === "recommendations" && (run.aiRecommendations?.length ?? 0) > 0 ? (
                      <span className="ml-1 rounded-full bg-muted px-1.5 py-0.5 text-xs">
                        {run.aiRecommendations!.length}
                      </span>
                    ) : null}
                  </button>
                ))}
              </div>

              {/* Tab: AI Analysis */}
              {activeTab === "analysis" ? (
                <div>
                  {run.aiAnalysis ? (
                    <div className="prose prose-sm max-w-none text-foreground">
                      <ReactMarkdown>{run.aiAnalysis}</ReactMarkdown>
                    </div>
                  ) : run.status === "failed" ? (
                    <p className="text-sm text-muted-foreground">
                      Run failed — check Raw Data for details.
                    </p>
                  ) : (
                    <p className="text-sm text-muted-foreground">No AI analysis available.</p>
                  )}
                </div>
              ) : null}

              {/* Tab: Recommended Actions */}
              {activeTab === "recommendations" ? (
                <div className="space-y-3">
                  {(run.aiRecommendations ?? []).length === 0 ? (
                    <p className="text-sm text-muted-foreground">No recommendations.</p>
                  ) : (
                    (run.aiRecommendations ?? []).map((rec, i) => (
                      <RecommendationCard key={i} rec={rec} runId={run.id} />
                    ))
                  )}
                </div>
              ) : null}

              {/* Tab: Raw Diagnostics */}
              {activeTab === "raw" ? (
                <div className="space-y-3">
                  {run.rawDiagnostics ? (
                    <>
                      <CollapsibleJson
                        title={`Supabase — ${run.rawDiagnostics.supabase.stuckTasks.length} stuck tasks, ${run.rawDiagnostics.supabase.offlineAgents.length} offline agents`}
                        data={run.rawDiagnostics.supabase}
                      />
                      <CollapsibleJson
                        title={`Hetzner — ${run.rawDiagnostics.hetzner.length} servers`}
                        data={run.rawDiagnostics.hetzner}
                      />
                      {run.rawDiagnostics.vps.map((vps: VpsDiagnostics) => (
                        <CollapsibleJson
                          key={vps.slug}
                          title={`VPS ${vps.slug} (${vps.vpsIp}) — ${vps.sshReachable ? "reachable" : "unreachable"}`}
                          data={vps}
                        />
                      ))}
                    </>
                  ) : (
                    <p className="text-sm text-muted-foreground">No raw diagnostics available.</p>
                  )}

                  {run.log.length > 0 ? (
                    <CollapsibleJson title="Run log" data={run.log} />
                  ) : null}
                </div>
              ) : null}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}

// ─── Helpers ──────────────────────────────────────────────────────────────────

function formatRelative(isoString: string): string {
  const diff = Date.now() - new Date(isoString).getTime();
  const mins = Math.floor(diff / 60_000);
  if (mins < 1) return "just now";
  if (mins < 60) return `${mins} min ago`;
  const hrs = Math.floor(mins / 60);
  if (hrs < 24) return `${hrs}h ago`;
  return `${Math.floor(hrs / 24)}d ago`;
}
