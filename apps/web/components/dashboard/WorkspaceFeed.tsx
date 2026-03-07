"use client";

import Link from "next/link";
import { useDashboardFeed } from "@/lib/realtime/useDashboardFeed";
import { useRelativeTime } from "@/lib/hooks/useRelativeTime";
import { FeedEventItem } from "./FeedEventItem";
import type { FeedEntry } from "@/lib/db/dashboard";

interface WorkspaceFeedProps {
  workspaceId: string;
  initialFeed: FeedEntry[];
}

/** Shows the timestamp of the most recent feed entry. */
function LastUpdatedLabel({ feed }: { feed: FeedEntry[] }) {
  const latestAt = feed[0]?.created_at ?? new Date().toISOString();
  const relative = useRelativeTime(latestAt);
  if (feed.length === 0) return null;
  return (
    <span className="text-xs text-muted-foreground">
      Aggiornato {relative}
    </span>
  );
}

/**
 * Real-time activity feed for the workspace.
 * Shows the last 10 events across all tasks, updating live via Supabase Realtime.
 * New events are prepended to the top of the list.
 */
export function WorkspaceFeed({ workspaceId, initialFeed }: WorkspaceFeedProps) {
  const { feed } = useDashboardFeed({
    workspaceId,
    initialFeed,
    limit: 10,
  });

  return (
    <section>
      <div className="mb-3 flex items-center justify-between">
        <h2 className="text-sm font-semibold text-foreground">Attività recente</h2>
        <div className="flex items-center gap-3">
          <LastUpdatedLabel feed={feed} />
          <Link
            href="/tasks"
            className="text-xs text-muted-foreground transition-colors hover:text-foreground"
          >
            Tutte le task →
          </Link>
        </div>
      </div>

      <div className="rounded-ios-lg shadow-ios-sm bg-white dark:bg-[#1C1C1E] overflow-hidden">
        {feed.length === 0 ? (
          <div className="flex items-center justify-center py-10">
            <p className="text-sm text-muted-foreground">Nessuna attività recente</p>
          </div>
        ) : (
          <div>
            {feed.map((entry, i) => (
              <FeedEventItem
                key={entry.id}
                entry={entry}
                isLast={i === feed.length - 1}
              />
            ))}
          </div>
        )}
      </div>
    </section>
  );
}

export function WorkspaceFeedSkeleton() {
  return (
    <section>
      <div className="mb-3 h-5 w-32 animate-pulse rounded bg-muted" />
      <div className="rounded-ios-lg shadow-ios-sm bg-white dark:bg-[#1C1C1E] overflow-hidden">
        {Array.from({ length: 5 }).map((_, i) => (
          <div
            key={i}
            className="flex items-center gap-3 px-4 py-3 animate-pulse border-b border-border last:border-0"
          >
            <div className="h-7 w-7 rounded-full bg-muted flex-shrink-0" />
            <div className="flex-1 space-y-1.5">
              <div className="h-4 w-4/5 rounded bg-muted" />
            </div>
            <div className="h-3 w-12 rounded bg-muted" />
          </div>
        ))}
      </div>
    </section>
  );
}
