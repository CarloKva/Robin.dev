export default function MetricsLoading() {
  return (
    <div className="mx-auto max-w-5xl space-y-6">
      <div className="h-8 w-32 animate-pulse rounded bg-muted" />
      <div className="h-8 w-56 animate-pulse rounded-lg bg-muted" />
      <div className="grid grid-cols-2 gap-4 sm:grid-cols-4">
        {Array.from({ length: 4 }).map((_, i) => (
          <div key={i} className="h-24 animate-pulse rounded-xl bg-muted" />
        ))}
      </div>
      <div className="h-64 animate-pulse rounded-xl bg-muted" />
    </div>
  );
}
