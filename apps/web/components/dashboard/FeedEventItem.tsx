"use client";

import Link from "next/link";
import { useRelativeTime } from "@/lib/hooks/useRelativeTime";
import { cn } from "@/lib/utils";
import type { TaskEventType } from "@robin/shared-types";
import type { FeedEntry } from "@/lib/db/dashboard";

/** Maps event types to a colored dot for quick visual scanning. */
const eventDotClass: Partial<Record<TaskEventType, string>> = {
  "task.created": "bg-sky-400",
  "task.completed": "bg-emerald-500",
  "task.failed": "bg-red-500",
  "agent.pr.opened": "bg-brand-500",
  "agent.commit.pushed": "bg-brand-400",
  "agent.blocked": "bg-amber-500",
  "human.approved": "bg-emerald-400",
  "human.rejected": "bg-red-400",
  "agent.phase.started": "bg-purple-400",
  "agent.phase.completed": "bg-purple-300",
  "task.state.changed": "bg-slate-400",
};

interface FeedEventItemProps {
  entry: FeedEntry;
}

/**
 * A single row in the workspace activity feed.
 * Shows a colored dot, narrative text, task chip, and relative timestamp.
 * The row links to the relevant task detail page.
 */
export function FeedEventItem({ entry }: FeedEventItemProps) {
  const relative = useRelativeTime(entry.created_at);
  const dot = eventDotClass[entry.event_type] ?? "bg-slate-300";

  return (
    <Link
      href={`/tasks/${entry.task_id}`}
      className="flex items-start gap-3 rounded-lg px-3 py-2.5 transition-colors hover:bg-accent/50"
    >
      <span
        className={cn("mt-1.5 h-2 w-2 flex-shrink-0 rounded-full", dot)}
      />
      <div className="min-w-0 flex-1">
        <p className="truncate text-sm text-foreground">{entry.narrative}</p>
        {entry.task_title && (
          <p className="mt-0.5 truncate text-xs text-muted-foreground">
            {entry.task_title}
          </p>
        )}
      </div>
      <span className="flex-shrink-0 text-xs text-muted-foreground tabular-nums">
        {relative}
      </span>
    </Link>
  );
}
