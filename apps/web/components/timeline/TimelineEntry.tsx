"use client";

import type { LucideIcon } from "lucide-react";
import {
  Plus,
  ArrowRight,
  Play,
  CheckCircle,
  GitCommit,
  GitPullRequest,
  GitMerge,
  Globe,
  AlertCircle,
  ThumbsUp,
  ThumbsDown,
  MessageSquare,
  CheckCheck,
  XCircle,
} from "lucide-react";
import type { TimelineEntry as TimelineEntryType, TaskEventType } from "@robin/shared-types";
import { useRelativeTime } from "@/lib/hooks/useRelativeTime";
import { cn } from "@/lib/utils";

interface TimelineEntryProps {
  entry: TimelineEntryType;
  isLast?: boolean;
}

type EventMeta = {
  icon: LucideIcon;
  iconClass: string;   // icon foreground color
  ringClass: string;   // icon background
  key: boolean;        // key events get bolder visual treatment
};

const EVENT_META: Record<TaskEventType, EventMeta> = {
  "task.created":          { icon: Plus,           iconClass: "text-blue-600",    ringClass: "bg-blue-100",    key: false },
  "task.state.changed":    { icon: ArrowRight,     iconClass: "text-slate-500",   ringClass: "bg-slate-100",   key: false },
  "agent.phase.started":   { icon: Play,           iconClass: "text-indigo-600",  ringClass: "bg-indigo-100",  key: false },
  "agent.phase.completed": { icon: CheckCircle,    iconClass: "text-indigo-400",  ringClass: "bg-indigo-50",   key: false },
  "agent.commit.pushed":   { icon: GitCommit,      iconClass: "text-emerald-600", ringClass: "bg-emerald-100", key: false },
  "agent.pr.opened":       { icon: GitPullRequest, iconClass: "text-green-700",   ringClass: "bg-green-100",   key: true  },
  "agent.pr.updated":      { icon: GitMerge,       iconClass: "text-green-600",   ringClass: "bg-green-50",    key: false },
  "agent.deploy.staging":  { icon: Globe,          iconClass: "text-cyan-600",    ringClass: "bg-cyan-100",    key: false },
  "agent.blocked":         { icon: AlertCircle,    iconClass: "text-amber-600",   ringClass: "bg-amber-100",   key: true  },
  "human.approved":        { icon: ThumbsUp,       iconClass: "text-green-600",   ringClass: "bg-green-100",   key: true  },
  "human.rejected":        { icon: ThumbsDown,     iconClass: "text-red-600",     ringClass: "bg-red-100",     key: true  },
  "human.commented":       { icon: MessageSquare,  iconClass: "text-purple-600",  ringClass: "bg-purple-100",  key: false },
  "task.completed":               { icon: CheckCheck,     iconClass: "text-emerald-700", ringClass: "bg-emerald-100", key: true  },
  "task.failed":                  { icon: XCircle,        iconClass: "text-red-700",     ringClass: "bg-red-100",     key: true  },
  "task.pr_closed_without_merge": { icon: XCircle,        iconClass: "text-orange-600",  ringClass: "bg-orange-100",  key: true  },
};

const DEFAULT_META: EventMeta = {
  icon: ArrowRight,
  iconClass: "text-slate-400",
  ringClass: "bg-slate-100",
  key: false,
};

export function TimelineEntry({ entry, isLast = false }: TimelineEntryProps) {
  const relativeTime = useRelativeTime(entry.created_at);
  const meta = EVENT_META[entry.event_type] ?? DEFAULT_META;
  const Icon = meta.icon;

  return (
    <div className="flex gap-3">
      {/* Icon column with spine */}
      <div className="flex flex-col items-center">
        <div
          className={cn(
            "mt-0.5 flex h-6 w-6 flex-shrink-0 items-center justify-center rounded-full",
            meta.ringClass,
            // Key events are slightly larger
            meta.key && "h-7 w-7"
          )}
        >
          <Icon
            className={cn(
              "h-3.5 w-3.5",
              meta.iconClass,
              meta.key && "h-4 w-4"
            )}
          />
        </div>
        {!isLast && (
          <div className="mt-1 w-px flex-1 bg-border" style={{ minHeight: "1.25rem" }} />
        )}
      </div>

      {/* Content */}
      <div className="pb-4 flex-1 min-w-0">
        <p
          className={cn(
            "text-sm",
            meta.key ? "font-medium text-foreground" : "text-foreground/80"
          )}
        >
          {entry.narrative}
        </p>
        <p className="mt-0.5 text-xs text-muted-foreground">
          <span title={new Date(entry.created_at).toLocaleString()}>
            {relativeTime}
          </span>
          {" · "}
          <span className="capitalize">{entry.actor_type}</span>
        </p>
      </div>
    </div>
  );
}
