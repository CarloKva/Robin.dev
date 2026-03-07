"use client";

import { useEffect, useRef, useState } from "react";
import { Check, Loader2, X, Zap } from "lucide-react";
import { useRouter } from "next/navigation";
import { getSupabaseBrowserClient } from "@/lib/supabase/client";
import { cn } from "@/lib/utils";
import type { AgentProvisioningStatus } from "@robin/shared-types";

// ─── Types ────────────────────────────────────────────────────────────────────

type StepStatus = "pending" | "in_progress" | "done" | "error";

interface Step {
  id: string;
  label: string;
}

const STEPS: Step[] = [
  { id: "vps_created", label: "Creazione VPS" },
  { id: "vps_online", label: "Configurazione sistema" },
  { id: "setup_running", label: "Installazione dipendenze" },
  { id: "health_check", label: "Test connessione" },
  { id: "ready", label: "Agente pronto" },
];

// Estimated seconds remaining when this step is in_progress
const STEP_ETA: Record<string, number> = {
  vps_created: 150,
  vps_online: 120,
  setup_running: 60,
  health_check: 30,
  ready: 0,
};

// ─── Status mapping ───────────────────────────────────────────────────────────

function provisioningStatusToStepStatuses(
  status: AgentProvisioningStatus,
  vpsCreatedAt: string | null,
  vpsOnlineAt: string | null,
  provisionedAt: string | null,
  provisioningError: string | null
): Record<string, StepStatus> {
  const PENDING: Record<string, StepStatus> = {
    vps_created: "pending",
    vps_online: "pending",
    setup_running: "pending",
    health_check: "pending",
    ready: "pending",
  };

  if (status === "pending") return PENDING;

  if (status === "error") {
    if (provisionedAt) {
      return { vps_created: "done", vps_online: "done", setup_running: "done", health_check: "error", ready: "pending" };
    }
    if (vpsOnlineAt) {
      return { vps_created: "done", vps_online: "done", setup_running: "pending", health_check: "error", ready: "pending" };
    }
    if (vpsCreatedAt) {
      const isHealthCheckFailure = /heartbeat|health|did not respond|orchestrator/i.test(provisioningError ?? "");
      if (isHealthCheckFailure) {
        return { vps_created: "done", vps_online: "done", setup_running: "pending", health_check: "error", ready: "pending" };
      }
      return { vps_created: "done", vps_online: "error", setup_running: "pending", health_check: "pending", ready: "pending" };
    }
    return { ...PENDING, vps_created: "error" };
  }

  if (status === "online") {
    return { vps_created: "done", vps_online: "done", setup_running: "done", health_check: "done", ready: "done" };
  }

  if (status === "provisioning") {
    if (vpsOnlineAt) {
      return { vps_created: "done", vps_online: "done", setup_running: "in_progress", health_check: "pending", ready: "pending" };
    }
    if (vpsCreatedAt) {
      return { vps_created: "done", vps_online: "in_progress", setup_running: "pending", health_check: "pending", ready: "pending" };
    }
    return { ...PENDING, vps_created: "in_progress" };
  }

  return PENDING;
}

// ─── Timestamp helpers ────────────────────────────────────────────────────────

function getStepCompletedAt(stepId: string, data: AgentProvisioningData): string | null {
  switch (stepId) {
    case "vps_created": return data.vps_created_at;
    case "vps_online": return data.vps_online_at;
    case "setup_running": return null;
    case "health_check": return null;
    case "ready": return data.provisioned_at;
    default: return null;
  }
}

function getStepStartedAt(stepId: string, data: AgentProvisioningData): string | null {
  switch (stepId) {
    case "vps_created": return null;
    case "vps_online": return data.vps_created_at;
    case "setup_running": return data.vps_online_at;
    case "health_check": return data.vps_online_at;
    case "ready": return null;
    default: return null;
  }
}

function formatCompletedAt(isoString: string): string {
  const date = new Date(isoString);
  const h = date.getHours().toString().padStart(2, "0");
  const m = date.getMinutes().toString().padStart(2, "0");
  return `completato alle ${h}:${m}`;
}

function formatElapsed(seconds: number): string {
  if (seconds < 60) return `in corso da ${seconds}s`;
  const m = Math.floor(seconds / 60);
  const s = seconds % 60;
  return `in corso da ${m}m ${s.toString().padStart(2, "0")}s`;
}

function formatEta(seconds: number): string {
  if (seconds >= 60) {
    const min = Math.ceil(seconds / 60);
    return `~${min} minut${min === 1 ? "o" : "i"} rimanent${min === 1 ? "e" : "i"}`;
  }
  if (seconds > 0) return `~${seconds}s rimanenti`;
  return "";
}

// ─── StepItem ─────────────────────────────────────────────────────────────────

interface StepItemProps {
  step: Step;
  stepIndex: number;
  status: StepStatus;
  isLast: boolean;
  completedAt: string | null;
  startedAt: string | null;
  isJustCompleted: boolean;
  errorMessage: string | null;
}

function StepItem({
  step,
  stepIndex,
  status,
  isLast,
  completedAt,
  startedAt,
  isJustCompleted,
  errorMessage,
}: StepItemProps) {
  const [elapsed, setElapsed] = useState(0);

  useEffect(() => {
    if (status !== "in_progress") return;
    const start = startedAt ? new Date(startedAt).getTime() : Date.now();
    const update = () => setElapsed(Math.floor((Date.now() - start) / 1000));
    update();
    const interval = setInterval(update, 1000);
    return () => clearInterval(interval);
  }, [status, startedAt]);

  const isReadyStep = step.id === "ready";

  return (
    <div className="flex gap-3">
      {/* Indicator column */}
      <div className="flex flex-col items-center">
        <div
          className={cn(
            "flex h-8 w-8 shrink-0 items-center justify-center rounded-full transition-colors duration-300",
            status === "done" && !isJustCompleted && "bg-[#34C759] text-white",
            status === "done" && isJustCompleted && "animate-step-complete text-white",
            status === "in_progress" && "animate-fade-in bg-[#007AFF] text-white",
            status === "error" && "bg-[#FF3B30] text-white",
            status === "pending" && "border-2 border-[#D1D1D6] bg-transparent dark:border-[#3A3A3C]"
          )}
        >
          {status === "done" && !isReadyStep && (
            <Check className="h-4 w-4" strokeWidth={2.5} />
          )}
          {status === "done" && isReadyStep && (
            <Zap className="h-4 w-4 fill-current" />
          )}
          {status === "in_progress" && (
            <Loader2 className="h-4 w-4 animate-spin" />
          )}
          {status === "error" && (
            <X className="h-4 w-4" strokeWidth={2.5} />
          )}
          {status === "pending" && (
            <span className="text-xs font-medium text-[#8E8E93]">{stepIndex + 1}</span>
          )}
        </div>

        {!isLast && (
          <div
            className={cn(
              "mt-1 w-0.5 flex-1 rounded-full transition-colors duration-300",
              status === "done" ? "bg-[#34C759]" : "bg-[#D1D1D6] dark:bg-[#3A3A3C]"
            )}
            style={{ minHeight: "28px" }}
          />
        )}
      </div>

      {/* Content */}
      <div className="min-w-0 flex-1 pb-5">
        <p
          className={cn(
            "text-sm font-medium",
            status === "done" && "text-[#34C759]",
            status === "in_progress" && "text-foreground",
            status === "error" && "text-[#FF3B30]",
            status === "pending" && "text-[#8E8E93]"
          )}
        >
          {step.label}
        </p>

        {status === "done" && completedAt && (
          <p className="mt-0.5 text-xs text-[#8E8E93]">{formatCompletedAt(completedAt)}</p>
        )}
        {status === "in_progress" && (
          <p className="mt-0.5 text-xs text-[#8E8E93]">{formatElapsed(elapsed)}</p>
        )}
        {status === "error" && errorMessage && (
          <p className="mt-0.5 text-xs text-[#FF3B30]">{errorMessage}</p>
        )}
      </div>
    </div>
  );
}

// ─── Main component ───────────────────────────────────────────────────────────

interface AgentProvisioningData {
  provisioning_status: AgentProvisioningStatus;
  vps_created_at: string | null;
  vps_online_at: string | null;
  provisioned_at: string | null;
  provisioning_error: string | null;
}

interface ProvisioningTimelineProps {
  agentId: string;
  workspaceId: string;
  initial: AgentProvisioningData;
}

export function ProvisioningTimeline({
  agentId,
  workspaceId: _workspaceId,
  initial,
}: ProvisioningTimelineProps) {
  const [data, setData] = useState<AgentProvisioningData>(initial);
  const [justCompleted, setJustCompleted] = useState<Set<string>>(new Set());
  const prevStatusesRef = useRef<Record<string, StepStatus>>({});
  const router = useRouter();

  // Subscribe to real-time changes on agents table
  useEffect(() => {
    const supabase = getSupabaseBrowserClient();

    const channel = supabase
      .channel(`agent-provisioning:${agentId}`)
      .on(
        "postgres_changes",
        {
          event: "UPDATE",
          schema: "public",
          table: "agents",
          filter: `id=eq.${agentId}`,
        },
        (payload: { new: unknown }) => {
          const row = payload.new as AgentProvisioningData;
          setData({
            provisioning_status: row.provisioning_status,
            vps_created_at: row.vps_created_at,
            vps_online_at: row.vps_online_at,
            provisioned_at: row.provisioned_at,
            provisioning_error: row.provisioning_error,
          });
        }
      )
      .subscribe();

    return () => {
      void supabase.removeChannel(channel);
    };
  }, [agentId]);

  const stepStatuses = provisioningStatusToStepStatuses(
    data.provisioning_status,
    data.vps_created_at,
    data.vps_online_at,
    data.provisioned_at,
    data.provisioning_error
  );

  // Detect steps transitioning in_progress → done for scale animation
  useEffect(() => {
    const newlyDone: string[] = [];
    for (const [stepId, status] of Object.entries(stepStatuses)) {
      if (status === "done" && prevStatusesRef.current[stepId] === "in_progress") {
        newlyDone.push(stepId);
      }
    }
    prevStatusesRef.current = stepStatuses;

    if (newlyDone.length === 0) return;

    setJustCompleted(prev => new Set([...prev, ...newlyDone]));
    const timer = setTimeout(() => {
      setJustCompleted(prev => {
        const next = new Set(prev);
        newlyDone.forEach(id => next.delete(id));
        return next;
      });
    }, 400);
    return () => clearTimeout(timer);
  }, [stepStatuses]);

  // Derive UI state
  const isAllDone = data.provisioning_status === "online";
  const isError = data.provisioning_status === "error";

  // Find the current in_progress step for ETA
  const currentStepId = STEPS.find(s => stepStatuses[s.id] === "in_progress")?.id ?? null;
  const etaSeconds = currentStepId ? STEP_ETA[currentStepId] : null;
  const etaLabel = etaSeconds != null ? formatEta(etaSeconds) : null;

  return (
    <div className="mx-auto max-w-md rounded-[22px] bg-white p-6 shadow-[0_4px_20px_rgba(0,0,0,0.10),0_1px_4px_rgba(0,0,0,0.06)] dark:bg-[#1C1C1E] dark:shadow-[0_4px_20px_rgba(0,0,0,0.40),0_1px_4px_rgba(0,0,0,0.20)]">
      {/* Header */}
      <div className="mb-5">
        {isAllDone ? (
          <p className="text-base font-semibold text-[#34C759]">Agente pronto!</p>
        ) : (
          <p className="text-base font-semibold text-foreground">
            Configurazione agente in corso...
          </p>
        )}
        {!isAllDone && !isError && etaLabel && (
          <p className="mt-1 text-sm text-[#8E8E93]">{etaLabel}</p>
        )}
      </div>

      {/* Step list */}
      <div>
        {STEPS.map((step, i) => (
          <StepItem
            key={step.id}
            step={step}
            stepIndex={i}
            status={stepStatuses[step.id] ?? "pending"}
            isLast={i === STEPS.length - 1}
            completedAt={getStepCompletedAt(step.id, data)}
            startedAt={getStepStartedAt(step.id, data)}
            isJustCompleted={justCompleted.has(step.id)}
            errorMessage={
              stepStatuses[step.id] === "error" ? (data.provisioning_error ?? null) : null
            }
          />
        ))}
      </div>

      {/* Final CTA */}
      {isAllDone && (
        <button
          onClick={() => router.refresh()}
          className="animate-fade-in mt-2 w-full rounded-xl bg-[#007AFF] py-2.5 text-sm font-semibold text-white transition-opacity hover:opacity-90 active:opacity-80"
        >
          Vai all&apos;agente
        </button>
      )}

      {/* Error CTA */}
      {isError && (
        <button
          onClick={() => router.refresh()}
          className="animate-fade-in mt-2 w-full rounded-xl border border-[#FF3B30] py-2.5 text-sm font-semibold text-[#FF3B30] transition-opacity hover:opacity-80 active:opacity-70"
        >
          Riprova
        </button>
      )}
    </div>
  );
}
