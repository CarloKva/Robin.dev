import { TaskRowSkeleton } from "@/components/backlog/TaskRow";

/**
 * Skeleton loading state for the backlog page.
 * Matches the layout of BacklogSprintTabs with tabs, filters, and task list.
 */
export default function BacklogLoading() {
  return (
    <div className="space-y-5">
      {/* Tab switcher skeleton */}
      <div className="flex rounded-lg border border-border bg-muted/40 p-1 w-fit animate-pulse">
        <div className="h-8 w-20 rounded-md bg-muted/60" />
        <div className="ml-1 h-8 w-24 rounded-md bg-muted/60" />
      </div>

      {/* Filters + import skeleton */}
      <div className="flex flex-wrap items-center gap-2">
        <div className="flex gap-2">
          {[1, 2, 3, 4].map((i) => (
            <div key={i} className="h-8 w-24 rounded-md bg-muted animate-pulse" />
          ))}
        </div>
        <div className="flex-1" />
        <div className="h-8 w-32 rounded-md bg-muted animate-pulse" />
      </div>

      {/* Stats row skeleton */}
      <div className="flex items-center gap-4">
        <div className="h-4 w-24 rounded bg-muted animate-pulse" />
        <div className="h-4 w-20 rounded bg-muted animate-pulse" />
      </div>

      {/* Task list skeleton */}
      <div className="rounded-lg border border-border bg-card overflow-hidden">
        <div className="flex items-center gap-3 border-b border-border px-3 py-2">
          <div className="h-4 w-4 rounded border border-border bg-muted animate-pulse" />
          <div className="h-4 w-24 rounded bg-muted animate-pulse" />
        </div>
        <div className="divide-y divide-border">
          {Array.from({ length: 6 }).map((_, i) => (
            <TaskRowSkeleton key={i} />
          ))}
        </div>
      </div>
    </div>
  );
}
