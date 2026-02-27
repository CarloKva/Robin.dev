import { TaskCardSkeleton } from "@/components/tasks/TaskCard";

export default function TasksLoading() {
  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between gap-4">
        <div className="space-y-1.5 animate-pulse">
          <div className="h-7 w-24 rounded bg-muted" />
          <div className="h-4 w-16 rounded bg-muted" />
        </div>
        <div className="h-9 w-28 rounded-lg bg-muted animate-pulse" />
      </div>

      {/* Filter bar skeleton */}
      <div className="flex gap-2 animate-pulse">
        {[80, 70, 90, 80].map((w, i) => (
          <div key={i} className={`h-8 w-${w === 80 ? "20" : w === 70 ? "16" : "24"} rounded-md bg-muted`} />
        ))}
      </div>

      {/* Cards skeleton */}
      <div className="space-y-1.5">
        {Array.from({ length: 8 }).map((_, i) => (
          <TaskCardSkeleton key={i} />
        ))}
      </div>
    </div>
  );
}
