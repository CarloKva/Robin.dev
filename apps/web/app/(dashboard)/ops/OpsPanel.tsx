"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { useAuth } from "@clerk/nextjs";
import ReactMarkdown from "react-markdown";
import { Play, Loader2, AlertTriangle, CheckCircle2, Terminal, Zap, Database, ChevronDown, ChevronRight } from "lucide-react";
import { getSupabaseBrowserClient } from "@/lib/supabase/client";
import type {
  OpsRun,
  OpsLogEntry,
  OpsRecommendation,
  VpsDiagnostics,
} from "@robin/shared-types";

interface OpsPanelProps {
  initialRun: OpsRun | null;
}

type ActiveTab = "analysis" | "recommendations" | "raw";

// ─── Sub-components ───────────────────────────────────────────────────────────

function LogLine({ entry }: { entry: OpsLogEntry }) {
  const colors: Record<string, string> = {
    info: "text-muted-foreground",
    warn: "text-amber-600",
    error: "text-red-600",
  };
  const sourceColors: Record<string, string> = {
    hetzner: "text-orange-500",
    supabase: "text-green-600",
    ssh: "text-blue-500",
    ai: "text-purple-500",
    system: "text-muted-foreground",
  };

  return (
    <div className={`flex gap-2 font-mono text-xs ${colors[entry.level] ?? "text-muted-foreground"}`}>
      <span className={`w-16 shrink-0 ${sourceColors[entry.source] ?? ""}`}>
        [{entry.source}]
      </span>
      <span className="break-all">
        {entry.message}
        {entry.workspace ? (
          <span className="ml-1 text-muted-foreground">({entry.workspace})</span>
        ) : null}
      </span>
    </div>
  );
}

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

// ─── Main panel ───────────────────────────────────────────────────────────────

export function OpsPanel({ initialRun }: OpsPanelProps) {
  const { getToken } = useAuth();
  const [run, setRun] = useState<OpsRun | null>(initialRun);
  const [starting, setStarting] = useState(false);
  const [activeTab, setActiveTab] = useState<ActiveTab>("analysis");
  const logEndRef = useRef<HTMLDivElement>(null);
  const channelRef = useRef<ReturnType<typeof getSupabaseBrowserClient>["channel"] | null>(null);

  const isRunning = run?.status === "running";

  // Auto-scroll logs
  useEffect(() => {
    if (isRunning) {
      logEndRef.current?.scrollIntoView({ behavior: "smooth" });
    }
  }, [run?.log, isRunning]);

  // Realtime subscription
  const subscribeToRun = useCallback(
    async (runId: string) => {
      const supabase = getSupabaseBrowserClient();

      // Clean up previous channel
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

  // Subscribe when there's a running run
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
      // Fetch the newly created run
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
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-lg font-semibold">Ops Diagnostics</h2>
          {lastRunTime ? (
            <p className="text-xs text-muted-foreground mt-0.5">
              {run?.status === "running" ? "Running..." : `Last run: ${lastRunTime}`}
            </p>
          ) : (
            <p className="text-xs text-muted-foreground mt-0.5">No previous runs</p>
          )}
        </div>

        <div className="flex items-center gap-3">
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
            {isRunning ? "Running..." : "Run Diagnostics"}
          </button>
        </div>
      </div>

      {/* Live run section */}
      {run && isRunning ? (
        <div className="rounded-md border border-border p-4 space-y-3">
          {/* Progress bar */}
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

          {/* Log entries */}
          <div className="bg-muted/40 rounded-md p-3 max-h-64 overflow-y-auto space-y-1">
            {run.log.length === 0 ? (
              <p className="text-xs text-muted-foreground">Waiting for logs...</p>
            ) : (
              run.log.map((entry, i) => <LogLine key={i} entry={entry} />)
            )}
            <div ref={logEndRef} />
          </div>
        </div>
      ) : null}

      {/* Results section */}
      {run && run.status !== "running" && (
        <div className="space-y-4">
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

              {/* Run log */}
              {run.log.length > 0 ? (
                <CollapsibleJson title="Run log" data={run.log} />
              ) : null}
            </div>
          ) : null}
        </div>
      )}
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

