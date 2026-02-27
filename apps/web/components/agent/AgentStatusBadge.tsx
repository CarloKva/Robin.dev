import { cn } from "@/lib/utils";
import type { AgentStatusEnum } from "@robin/shared-types";

interface AgentStatusBadgeProps {
  status: AgentStatusEnum;
  taskTitle?: string;
  isOffline?: boolean;
  className?: string;
}

const statusConfig: Record<
  AgentStatusEnum,
  { label: string; dotClass: string; badgeClass: string }
> = {
  idle: {
    label: "Idle",
    dotClass: "bg-slate-400",
    badgeClass: "bg-slate-100 text-slate-700 border-slate-200",
  },
  busy: {
    label: "Working",
    dotClass: "bg-emerald-500 animate-pulse",
    badgeClass: "bg-emerald-50 text-emerald-700 border-emerald-200",
  },
  error: {
    label: "Error",
    dotClass: "bg-red-500",
    badgeClass: "bg-red-50 text-red-700 border-red-200",
  },
  offline: {
    label: "Offline",
    dotClass: "bg-zinc-300",
    badgeClass: "bg-zinc-50 text-zinc-500 border-zinc-200",
  },
};

export function AgentStatusBadge({
  status,
  taskTitle,
  isOffline = false,
  className,
}: AgentStatusBadgeProps) {
  const displayStatus = isOffline ? "offline" : status;
  const config = statusConfig[displayStatus] ?? statusConfig.offline;

  return (
    <div
      className={cn(
        "inline-flex items-center gap-1.5 rounded-full border px-2.5 py-0.5 text-xs font-medium",
        config.badgeClass,
        className
      )}
      title={taskTitle ? `Working on: ${taskTitle}` : undefined}
    >
      <span className={cn("h-1.5 w-1.5 rounded-full", config.dotClass)} />
      <span>{isOffline ? "Realtime offline" : config.label}</span>
      {taskTitle && status === "busy" && !isOffline && (
        <span className="max-w-[12rem] truncate opacity-70" title={taskTitle}>
          — {taskTitle}
        </span>
      )}
    </div>
  );
}
