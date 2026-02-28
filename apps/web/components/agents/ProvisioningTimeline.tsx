"use client";

import { useEffect, useState } from "react";
import { getSupabaseBrowserClient } from "@/lib/supabase/client";
import { cn } from "@/lib/utils";
import type { AgentProvisioningStatus } from "@robin/shared-types";

// ─── Step definition ──────────────────────────────────────────────────────────

type StepStatus = "pending" | "in_progress" | "done" | "error";

interface Step {
  id: string;
  label: string;
  description: string;
}

const STEPS: Step[] = [
  {
    id: "vps_created",
    label: "VPS in creazione",
    description: "Richiesta al provider cloud in corso",
  },
  {
    id: "setup_running",
    label: "Setup in corso",
    description: "Installazione Node.js, Redis e orchestratore",
  },
  {
    id: "health_check",
    label: "Health check",
    description: "Verifica che l'orchestratore risponda",
  },
  {
    id: "ready",
    label: "Pronto",
    description: "L'agente è online e pronto per i task",
  },
];

function provisioningStatusToStepStatuses(
  status: AgentProvisioningStatus,
  vpsCreatedAt: string | null,
  provisionedAt: string | null,
  provisioningError: string | null
): Record<string, StepStatus> {
  if (status === "error") {
    // Show progress up to the step that failed
    if (provisionedAt) return { vps_created: "done", setup_running: "done", health_check: "error", ready: "pending" };
    if (vpsCreatedAt) return { vps_created: "done", setup_running: "error", health_check: "pending", ready: "pending" };
    return { vps_created: "error", setup_running: "pending", health_check: "pending", ready: "pending" };
  }

  if (status === "pending") {
    return { vps_created: "pending", setup_running: "pending", health_check: "pending", ready: "pending" };
  }

  if (status === "provisioning") {
    if (vpsCreatedAt) {
      return { vps_created: "done", setup_running: "in_progress", health_check: "pending", ready: "pending" };
    }
    return { vps_created: "in_progress", setup_running: "pending", health_check: "pending", ready: "pending" };
  }

  if (status === "online") {
    return { vps_created: "done", setup_running: "done", health_check: "done", ready: "done" };
  }

  return { vps_created: "pending", setup_running: "pending", health_check: "pending", ready: "pending" };
}

// ─── Step item ────────────────────────────────────────────────────────────────

function StepItem({
  step,
  status,
  isLast,
}: {
  step: Step;
  status: StepStatus;
  isLast: boolean;
}) {
  return (
    <div className="flex gap-4">
      {/* Indicator column */}
      <div className="flex flex-col items-center">
        <div
          className={cn(
            "flex h-7 w-7 shrink-0 items-center justify-center rounded-full border-2 text-xs font-semibold transition-colors",
            status === "done" && "border-emerald-500 bg-emerald-500 text-white",
            status === "in_progress" && "border-primary bg-primary text-primary-foreground",
            status === "error" && "border-red-500 bg-red-500 text-white",
            status === "pending" && "border-border bg-muted text-muted-foreground"
          )}
        >
          {status === "done" && (
            <svg width="14" height="14" viewBox="0 0 14 14" fill="none">
              <path d="M2 7l3.5 3.5L12 3.5" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" />
            </svg>
          )}
          {status === "in_progress" && (
            <span className="h-2 w-2 animate-pulse rounded-full bg-current" />
          )}
          {status === "error" && "✕"}
          {status === "pending" && "·"}
        </div>
        {!isLast && (
          <div
            className={cn(
              "mt-1 w-0.5 flex-1 rounded-full",
              status === "done" ? "bg-emerald-300 dark:bg-emerald-700" : "bg-border"
            )}
            style={{ minHeight: "20px" }}
          />
        )}
      </div>

      {/* Content */}
      <div className="pb-5">
        <p
          className={cn(
            "text-sm font-medium",
            status === "done" && "text-emerald-700 dark:text-emerald-400",
            status === "in_progress" && "text-foreground",
            status === "error" && "text-red-600 dark:text-red-400",
            status === "pending" && "text-muted-foreground"
          )}
        >
          {step.label}
        </p>
        <p className="mt-0.5 text-xs text-muted-foreground">{step.description}</p>
      </div>
    </div>
  );
}

// ─── Main component ───────────────────────────────────────────────────────────

interface AgentProvisioningData {
  provisioning_status: AgentProvisioningStatus;
  vps_created_at: string | null;
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
  workspaceId,
  initial,
}: ProvisioningTimelineProps) {
  const [data, setData] = useState<AgentProvisioningData>(initial);

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
    data.provisioned_at,
    data.provisioning_error
  );

  return (
    <div className="space-y-1">
      {data.provisioning_status === "online" && (
        <div className="mb-4 rounded-md border border-emerald-200 bg-emerald-50 px-4 py-3 text-sm font-medium text-emerald-700 dark:border-emerald-800 dark:bg-emerald-950 dark:text-emerald-400">
          L'agente è online e pronto per ricevere task.
        </div>
      )}

      {data.provisioning_status === "error" && data.provisioning_error && (
        <div className="mb-4 rounded-md border border-red-200 bg-red-50 px-4 py-3 text-sm dark:border-red-800 dark:bg-red-950">
          <p className="font-medium text-red-700 dark:text-red-400">Provisioning fallito</p>
          <p className="mt-1 text-xs text-red-600 dark:text-red-300">{data.provisioning_error}</p>
        </div>
      )}

      {STEPS.map((step, i) => (
        <StepItem
          key={step.id}
          step={step}
          status={stepStatuses[step.id] ?? "pending"}
          isLast={i === STEPS.length - 1}
        />
      ))}
    </div>
  );
}
