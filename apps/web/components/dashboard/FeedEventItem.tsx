"use client";

import Link from "next/link";
import {
  GitPullRequest,
  GitCommit,
  CheckCircle,
  AlertCircle,
  Plus,
  type LucideIcon,
} from "lucide-react";
import { useRelativeTime } from "@/lib/hooks/useRelativeTime";
import { cn } from "@/lib/utils";
import type { TaskEventType } from "@robin/shared-types";
import type { FeedEntry } from "@/lib/db/dashboard";

// ─── Event type → icon + color config ────────────────────────────────────────

type EventConfig = {
  Icon: LucideIcon;
  dotClass: string;
  iconClass: string;
};

const eventConfig: Partial<Record<TaskEventType, EventConfig>> = {
  "agent.pr.opened": {
    Icon: GitPullRequest,
    dotClass: "bg-violet-500",
    iconClass: "text-violet-600 dark:text-violet-400",
  },
  "agent.commit.pushed": {
    Icon: GitCommit,
    dotClass: "bg-blue-500",
    iconClass: "text-blue-600 dark:text-blue-400",
  },
  "task.completed": {
    Icon: CheckCircle,
    dotClass: "bg-emerald-500",
    iconClass: "text-emerald-600 dark:text-emerald-400",
  },
  "human.approved": {
    Icon: CheckCircle,
    dotClass: "bg-emerald-500",
    iconClass: "text-emerald-600 dark:text-emerald-400",
  },
  "task.failed": {
    Icon: AlertCircle,
    dotClass: "bg-red-500",
    iconClass: "text-red-600 dark:text-red-400",
  },
  "agent.blocked": {
    Icon: AlertCircle,
    dotClass: "bg-amber-500",
    iconClass: "text-amber-600 dark:text-amber-400",
  },
  "human.rejected": {
    Icon: AlertCircle,
    dotClass: "bg-red-500",
    iconClass: "text-red-600 dark:text-red-400",
  },
  "task.created": {
    Icon: Plus,
    dotClass: "bg-zinc-400",
    iconClass: "text-zinc-500 dark:text-zinc-400",
  },
};

const defaultConfig: EventConfig = {
  Icon: Plus,
  dotClass: "bg-zinc-400",
  iconClass: "text-zinc-500 dark:text-zinc-400",
};

// ─── Component ────────────────────────────────────────────────────────────────

interface FeedEventItemProps {
  entry: FeedEntry;
  isLast: boolean;
}

export function FeedEventItem({ entry, isLast }: FeedEventItemProps) {
  const relative = useRelativeTime(entry.created_at);
  const config = eventConfig[entry.event_type] ?? defaultConfig;
  const { Icon, dotClass, iconClass } = config;

  return (
    <Link
      href={`/tasks/${entry.task_id}`}
      className="group flex items-start gap-0 px-4 py-3 transition-colors hover:bg-zinc-50 dark:hover:bg-zinc-800/50 cursor-pointer"
    >
      {/* Timeline column: dot + vertical line */}
      <div className="relative mr-3 flex flex-col items-center">
        {/* Icon circle */}
        <div
          className={cn(
            "flex h-7 w-7 flex-shrink-0 items-center justify-center rounded-full",
            dotClass,
            "bg-opacity-15 dark:bg-opacity-20"
          )}
        >
          <Icon className={cn("h-3.5 w-3.5", iconClass)} strokeWidth={2.5} />
        </div>
        {/* Vertical connector line */}
        {!isLast && (
          <div className="mt-1 w-px flex-1 bg-zinc-200 dark:bg-zinc-700" style={{ minHeight: "16px" }} />
        )}
      </div>

      {/* Content */}
      <div className="min-w-0 flex-1 pb-1">
        <p className="truncate text-sm text-foreground leading-snug">
          {entry.task_title ? (
            <>
              <span className="font-medium">{entry.task_title}</span>
              {" — "}
              <span className="text-muted-foreground">{entry.narrative}</span>
            </>
          ) : (
            entry.narrative
          )}
        </p>
      </div>

      {/* Relative timestamp */}
      <span className="ml-3 flex-shrink-0 text-xs text-muted-foreground tabular-nums">
        {relative}
      </span>
    </Link>
  );
}
