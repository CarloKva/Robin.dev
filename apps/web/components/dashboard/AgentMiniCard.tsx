"use client";

import { useRouter } from "next/navigation";
import { cn } from "@/lib/utils";
import type { AgentProvisioningStatus } from "@robin/shared-types";
import type { DashboardAgent } from "@/lib/db/dashboard";

// ─── Avatar color palette ─────────────────────────────────────────────────────

const AVATAR_COLORS = [
  "bg-blue-500",
  "bg-violet-500",
  "bg-emerald-500",
  "bg-amber-500",
  "bg-rose-500",
  "bg-cyan-500",
  "bg-indigo-500",
  "bg-pink-500",
];

function getAvatarColor(name: string): string {
  let hash = 0;
  for (let i = 0; i < name.length; i++) {
    hash = name.charCodeAt(i) + ((hash << 5) - hash);
  }
  return AVATAR_COLORS[Math.abs(hash) % AVATAR_COLORS.length] ?? AVATAR_COLORS[0]!;
}

function getInitials(name: string): string {
  const parts = name.trim().split(/\s+/);
  if (parts.length >= 2) {
    return (parts[0]![0]! + parts[1]![0]!).toUpperCase();
  }
  return name.slice(0, 2).toUpperCase();
}

// ─── Status badge config ──────────────────────────────────────────────────────

type StatusBadge = {
  label: string;
  dotClass: string;
  badgeClass: string;
  pulse: boolean;
};

const operationalBadge: Record<string, StatusBadge> = {
  idle: {
    label: "Online",
    dotClass: "bg-emerald-500",
    badgeClass: "bg-emerald-50 text-emerald-700 dark:bg-emerald-950/60 dark:text-emerald-400",
    pulse: true,
  },
  busy: {
    label: "In esecuzione",
    dotClass: "bg-blue-500",
    badgeClass: "bg-blue-50 text-blue-700 dark:bg-blue-950/60 dark:text-blue-400",
    pulse: true,
  },
  error: {
    label: "Errore",
    dotClass: "bg-red-500",
    badgeClass: "bg-red-50 text-red-700 dark:bg-red-950/60 dark:text-red-400",
    pulse: false,
  },
  offline: {
    label: "Offline",
    dotClass: "bg-zinc-400 dark:bg-zinc-600",
    badgeClass: "bg-zinc-100 text-zinc-500 dark:bg-zinc-800 dark:text-zinc-400",
    pulse: false,
  },
};

const provisioningBadge: Record<AgentProvisioningStatus, StatusBadge> = {
  pending: {
    label: "In coda",
    dotClass: "bg-zinc-400 dark:bg-zinc-600",
    badgeClass: "bg-zinc-100 text-zinc-500 dark:bg-zinc-800 dark:text-zinc-400",
    pulse: false,
  },
  provisioning: {
    label: "Provisioning…",
    dotClass: "bg-blue-500",
    badgeClass: "bg-blue-50 text-blue-700 dark:bg-blue-950/60 dark:text-blue-400",
    pulse: true,
  },
  online: {
    label: "Online",
    dotClass: "bg-emerald-500",
    badgeClass: "bg-emerald-50 text-emerald-700 dark:bg-emerald-950/60 dark:text-emerald-400",
    pulse: true,
  },
  error: {
    label: "Errore prov.",
    dotClass: "bg-red-500",
    badgeClass: "bg-red-50 text-red-700 dark:bg-red-950/60 dark:text-red-400",
    pulse: false,
  },
  deprovisioning: {
    label: "Eliminazione…",
    dotClass: "bg-amber-500",
    badgeClass: "bg-amber-50 text-amber-700 dark:bg-amber-950/60 dark:text-amber-400",
    pulse: true,
  },
  deprovisioned: {
    label: "Eliminato",
    dotClass: "bg-zinc-300 dark:bg-zinc-700",
    badgeClass: "bg-zinc-100 text-zinc-400 dark:bg-zinc-800 dark:text-zinc-600",
    pulse: false,
  },
};

// ─── Component ────────────────────────────────────────────────────────────────

export function AgentMiniCard({ agent }: { agent: DashboardAgent }) {
  const router = useRouter();

  const isProvisioning =
    agent.provisioning_status === "pending" ||
    agent.provisioning_status === "provisioning" ||
    agent.provisioning_status === "deprovisioning" ||
    agent.provisioning_status === "error";

  const badge = isProvisioning
    ? provisioningBadge[agent.provisioning_status]
    : (operationalBadge[agent.effective_status] ?? operationalBadge["offline"]!);

  // Task pill text: max 30 chars + ellipsis
  const taskLabel = agent.current_task_title
    ? agent.current_task_title.length > 30
      ? agent.current_task_title.slice(0, 30) + "…"
      : agent.current_task_title
    : null;

  const initials = getInitials(agent.name);
  const avatarColor = getAvatarColor(agent.name);

  return (
    <div
      role="button"
      tabIndex={0}
      onClick={() => router.push(`/agents/${agent.id}`)}
      onKeyDown={(e) => {
        if (e.key === "Enter") router.push(`/agents/${agent.id}`);
      }}
      className="cursor-pointer rounded-ios-lg shadow-ios-sm bg-white dark:bg-[#1C1C1E] p-4 transition-all duration-200 hover:scale-[1.02] hover:shadow-ios-md"
    >
      {/* Header row: avatar + name + badge */}
      <div className="flex items-center gap-3">
        {/* Avatar */}
        <div
          className={cn(
            "flex h-10 w-10 flex-shrink-0 items-center justify-center rounded-full text-xs font-bold text-white",
            avatarColor
          )}
        >
          {initials}
        </div>

        {/* Name + slug */}
        <div className="min-w-0 flex-1">
          <p className="truncate text-sm font-semibold text-foreground">{agent.name}</p>
          {agent.slug && (
            <p className="mt-0.5 truncate font-mono text-[11px] text-muted-foreground">
              {agent.slug}
            </p>
          )}
        </div>

        {/* Status badge */}
        <span
          className={cn(
            "inline-flex shrink-0 items-center gap-1.5 rounded-full px-2.5 py-1 text-[11px] font-medium",
            badge.badgeClass
          )}
        >
          <span
            className={cn(
              "h-1.5 w-1.5 rounded-full",
              badge.dotClass,
              badge.pulse && "animate-pulse"
            )}
          />
          {badge.label}
        </span>
      </div>

      {/* Task pill or idle label */}
      <div className="mt-3">
        {taskLabel ? (
          <span className="inline-block max-w-full rounded-full bg-zinc-100 px-3 py-1 text-[11px] font-medium text-zinc-600 dark:bg-zinc-800 dark:text-zinc-400">
            {taskLabel}
          </span>
        ) : (
          <span className="text-[11px] text-muted-foreground">In attesa</span>
        )}
      </div>
    </div>
  );
}
