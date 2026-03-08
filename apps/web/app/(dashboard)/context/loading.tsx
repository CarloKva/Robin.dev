export default function ContextLoading() {
  return (
    <div className="flex h-full overflow-hidden">
      {/* Left panel skeleton */}
      <div className="flex flex-col w-full md:w-[30%] border-r border-[#D1D1D6] dark:border-[#38383A] overflow-hidden">
        <div className="flex items-center justify-between px-4 py-3 border-b border-[#D1D1D6]/60 dark:border-[#38383A]/60">
          <div className="h-5 w-20 rounded bg-accent animate-pulse" />
          <div className="h-7 w-7 rounded-lg bg-accent animate-pulse" />
        </div>
        <div className="px-3 py-2">
          <div className="h-9 rounded-xl bg-accent animate-pulse" />
        </div>
        <div className="flex-1 px-3 space-y-1 pt-1">
          {Array.from({ length: 8 }).map((_, i) => (
            <div
              key={i}
              className="h-16 rounded-lg bg-accent/60 animate-pulse"
              style={{ animationDelay: `${i * 60}ms` }}
            />
          ))}
        </div>
      </div>

      {/* Right panel skeleton */}
      <div className="hidden md:flex flex-col flex-1 overflow-hidden px-10 py-6 gap-4">
        <div className="h-8 w-64 rounded bg-accent animate-pulse" />
        <div className="h-4 w-full rounded bg-accent/60 animate-pulse" />
        <div className="h-4 w-5/6 rounded bg-accent/60 animate-pulse" />
        <div className="h-4 w-4/6 rounded bg-accent/60 animate-pulse" />
      </div>
    </div>
  );
}
