"use client";

import Link from "next/link";
import { useDashboardFeed } from "@/lib/realtime/useDashboardFeed";
import { FeedEventItem } from "./FeedEventItem";
import type { FeedEntry } from "@/lib/db/dashboard";

interface WorkspaceFeedProps {
  workspaceId: string;
  initialFeed: FeedEntry[];
}

/**
 * Real-time activity feed for the workspace.
 * Shows the last 10 events across all tasks, updating live via Supabase Realtime.
 * New events are prepended to the top of the list.
 */
export function WorkspaceFeed({
  workspaceId,
  initialFeed,
}: WorkspaceFeedProps) {
  const { feed } = useDashboardFeed({
    workspaceId,
    initialFeed,
    limit: 10,
  });

  return (
    <section>
      <div className="mb-3 flex items-center justify-between">
        <h2 className="text-sm font-semibold text-foreground">
          Attività recente
        </h2>
        <Link
          href="/tasks"
          className="text-xs text-muted-foreground hover:text-foreground transition-colors"
        >
          Tutte le task →
        </Link>
      </div>

      <div className="rounded-xl border border-border bg-card overflow-hidden">
        {feed.length === 0 ? (
          <div className="px-4 py-8 text-center text-sm text-muted-foreground">
            Nessuna attività ancora — crea la tua prima task.
          </div>
        ) : (
          <div className="divide-y divide-border">
            {feed.map((entry) => (
              <FeedEventItem key={entry.id} entry={entry} />
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
      <div className="mb-3 h-5 w-32 rounded bg-muted animate-pulse" />
      <div className="rounded-xl border border-border bg-card overflow-hidden">
        {Array.from({ length: 5 }).map((_, i) => (
          <div
            key={i}
            className="flex items-center gap-3 px-3 py-3 animate-pulse border-b border-border last:border-0"
          >
            <div className="h-2 w-2 rounded-full bg-muted flex-shrink-0" />
            <div className="flex-1 space-y-1.5">
              <div className="h-4 w-4/5 rounded bg-muted" />
              <div className="h-3 w-1/3 rounded bg-muted" />
            </div>
            <div className="h-3 w-12 rounded bg-muted" />
          </div>
        ))}
      </div>
    </section>
  );
}
