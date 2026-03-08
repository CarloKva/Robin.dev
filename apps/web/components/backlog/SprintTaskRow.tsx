"use client";

import { useRouter } from "next/navigation";
import { Clock, Loader, Eye, CheckCircle, XCircle, X } from "lucide-react";
import { cn } from "@/lib/utils";
import { useRelativeTime } from "@/lib/hooks/useRelativeTime";
import type { Task, Repository } from "@robin/shared-types";

interface Agent {
  id: string;
  name: string;
}

interface SprintTaskRowProps {
  task: Task;
  repositories: Repository[];
  agents: Agent[];
  onRemove?: () => void;
}

type StatusIconConfig = { icon: React.ElementType; className: string; spin?: boolean };

const STATUS_ICON_MAP: Record<string, StatusIconConfig> = {
  queued: { icon: Clock, className: "text-[#8E8E93]" },
  in_progress: { icon: Loader, className: "text-[#007AFF]", spin: true },
  in_review: { icon: Eye, className: "text-[#FFCC00]" },
  done: { icon: CheckCircle, className: "text-[#34C759]" },
  completed: { icon: CheckCircle, className: "text-[#34C759]" },
  failed: { icon: XCircle, className: "text-[#FF3B30]" },
  // fallback for other statuses
  sprint_ready: { icon: Clock, className: "text-[#8E8E93]" },
  pending: { icon: Clock, className: "text-[#8E8E93]" },
  rework: { icon: Loader, className: "text-[#FF9500]", spin: true },
  review_pending: { icon: Eye, className: "text-[#FFCC00]" },
  approved: { icon: CheckCircle, className: "text-[#34C759]" },
  rejected: { icon: XCircle, className: "text-[#FF3B30]" },
  cancelled: { icon: XCircle, className: "text-[#8E8E93]" },
  backlog: { icon: Clock, className: "text-[#8E8E93]" },
};

type PriorityBadgeConfig = { label: string; className: string };

const PRIORITY_BADGE: Record<string, PriorityBadgeConfig> = {
  critical: {
    label: "Critical",
    className:
      "bg-red-100 text-red-700 dark:bg-red-950/40 dark:text-red-400",
  },
  high: {
    label: "High",
    className:
      "bg-orange-100 text-orange-700 dark:bg-orange-950/40 dark:text-orange-400",
  },
  medium: {
    label: "Medium",
    className:
      "bg-yellow-100 text-yellow-700 dark:bg-yellow-950/40 dark:text-yellow-400",
  },
  low: {
    label: "Low",
    className:
      "bg-slate-100 text-slate-500 dark:bg-slate-800 dark:text-slate-400",
  },
};

function getInitials(name: string): string {
  return name
    .split(" ")
    .map((part) => part[0] ?? "")
    .slice(0, 2)
    .join("")
    .toUpperCase();
}

function RelativeTimestamp({ isoString }: { isoString: string }) {
  const relative = useRelativeTime(isoString);
  return (
    <span className="shrink-0 text-xs text-[#8E8E93] tabular-nums">
      {relative}
    </span>
  );
}

export function SprintTaskRow({
  task,
  repositories,
  agents,
  onRemove,
}: SprintTaskRowProps) {
  const router = useRouter();

  const defaultStatusConfig: StatusIconConfig = { icon: Clock, className: "text-[#8E8E93]" };
  const statusConfig: StatusIconConfig =
    STATUS_ICON_MAP[task.status] ?? defaultStatusConfig;
  const StatusIcon = statusConfig.icon;

  const defaultPriority: PriorityBadgeConfig = {
    label: "Medium",
    className: "bg-yellow-100 text-yellow-700 dark:bg-yellow-950/40 dark:text-yellow-400",
  };
  const priority: PriorityBadgeConfig =
    PRIORITY_BADGE[task.priority] ?? defaultPriority;

  const repo = repositories.find((r) => r.id === task.repository_id);
  const repoName = repo
    ? (repo.full_name.split("/")[1] ?? repo.full_name)
    : null;

  const agent = task.assigned_agent_id
    ? agents.find((a) => a.id === task.assigned_agent_id)
    : null;

  return (
    <div
      role="button"
      tabIndex={0}
      onClick={() => router.push(`/tasks/${task.id}`)}
      onKeyDown={(e) => {
        if (e.key === "Enter" || e.key === " ") {
          e.preventDefault();
          router.push(`/tasks/${task.id}`);
        }
      }}
      className={cn(
        "group flex items-center gap-3 border-b border-[#F2F2F7] px-4 py-3",
        "cursor-pointer transition-colors duration-150",
        "hover:bg-gray-50/80",
        "dark:border-[#2C2C2E] dark:hover:bg-[#2C2C2E]/50"
      )}
    >
      {/* Status icon */}
      <StatusIcon
        className={cn(
          "h-5 w-5 shrink-0",
          statusConfig.className,
          statusConfig.spin && "animate-spin"
        )}
        aria-label={task.status}
      />

      {/* Title */}
      <span className="min-w-0 flex-1 truncate text-sm font-medium">
        {task.title}
      </span>

      {/* Priority badge */}
      <span
        className={cn(
          "shrink-0 rounded px-1.5 py-0.5 text-xs font-medium",
          priority.className
        )}
      >
        {priority.label}
      </span>

      {/* Repository pill */}
      {repoName && (
        <span className="max-w-[96px] shrink-0 truncate rounded-full bg-gray-100 px-2 py-0.5 text-xs dark:bg-[#2C2C2E]">
          {repoName}
        </span>
      )}

      {/* Assignee avatar */}
      {agent && (
        <span
          title={agent.name}
          className="flex h-6 w-6 shrink-0 items-center justify-center rounded-full bg-[#007AFF] text-[10px] font-semibold text-white"
        >
          {getInitials(agent.name)}
        </span>
      )}

      {/* Relative timestamp */}
      <RelativeTimestamp isoString={task.updated_at} />

      {/* Remove from sprint button (planning mode only) */}
      {onRemove && (
        <button
          onClick={(e) => {
            e.stopPropagation();
            onRemove();
          }}
          className="shrink-0 text-muted-foreground opacity-0 transition-opacity group-hover:opacity-100 hover:text-destructive"
          aria-label="Rimuovi dallo sprint"
        >
          <X className="h-3.5 w-3.5" />
        </button>
      )}
    </div>
  );
}
