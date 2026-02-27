export default function TaskDetailLoading() {
  return (
    <div className="space-y-4 animate-pulse">
      {/* Breadcrumb skeleton */}
      <div className="flex items-center gap-2">
        <div className="h-4 w-12 rounded bg-muted" />
        <span className="text-muted-foreground">/</span>
        <div className="h-4 w-40 rounded bg-muted" />
      </div>

      {/* 2-column layout skeleton */}
      <div className="grid grid-cols-1 gap-6 lg:grid-cols-[1fr_2fr]">
        {/* Left column */}
        <div className="space-y-5">
          <div className="h-32 rounded-xl bg-muted" />
          <div className="h-40 rounded-xl bg-muted" />
          <div className="h-24 rounded-xl bg-muted" />
        </div>

        {/* Right column (timeline) */}
        <div className="h-96 rounded-xl bg-muted" />
      </div>
    </div>
  );
}
