import { TaskRowSkeleton } from "@/components/backlog/TaskRow";

/**
 * Skeleton loading state for the sprint detail page.
 */
export default function SprintDetailLoading() {
  return (
    <div className="space-y-6">
      {/* Header skeleton */}
      <div className="flex items-start justify-between gap-4">
        <div className="min-w-0 space-y-2">
          <div className="h-4 w-32 rounded bg-muted animate-pulse" />
          <div className="h-7 w-40 rounded bg-muted animate-pulse" />
        </div>
      </div>

      {/* Sprint info bar skeleton */}
      <div className="rounded-lg border border-border bg-card p-4 animate-pulse">
        <div className="flex items-center justify-between gap-4">
          <div className="h-4 w-48 rounded bg-muted" />
          <div className="flex gap-2">
            <div className="h-10 w-36 rounded-md bg-muted" />
            <div className="h-10 w-28 rounded-md bg-muted" />
          </div>
        </div>
      </div>

      {/* Task list skeleton */}
      <div className="rounded-lg border border-border bg-card overflow-hidden">
        {Array.from({ length: 4 }).map((_, i) => (
          <TaskRowSkeleton key={i} />
        ))}
      </div>
    </div>
  );
}
