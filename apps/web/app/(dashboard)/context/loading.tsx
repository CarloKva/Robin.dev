export default function ContextLoading() {
  return (
    <div>
      <div className="mb-6">
        <div className="h-8 w-32 rounded bg-accent animate-pulse" />
        <div className="mt-1.5 h-4 w-64 rounded bg-accent animate-pulse" />
      </div>
      <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-3">
        {Array.from({ length: 6 }).map((_, i) => (
          <div key={i} className="h-32 rounded-lg border border-border bg-card animate-pulse" />
        ))}
      </div>
    </div>
  );
}
