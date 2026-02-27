export default function NewTaskLoading() {
  return (
    <div className="mx-auto max-w-5xl space-y-4">
      <div className="h-8 w-40 animate-pulse rounded bg-muted" />
      <div className="flex gap-6 lg:gap-8">
        <div className="flex-1 space-y-5">
          <div className="h-10 animate-pulse rounded-md bg-muted" />
          <div className="grid grid-cols-2 gap-4">
            <div className="h-10 animate-pulse rounded-md bg-muted" />
            <div className="h-10 animate-pulse rounded-md bg-muted" />
          </div>
          <div className="h-10 animate-pulse rounded-md bg-muted" />
          <div className="h-48 animate-pulse rounded-md bg-muted" />
        </div>
        <div className="hidden w-96 lg:block">
          <div className="h-64 animate-pulse rounded-lg bg-muted" />
        </div>
      </div>
    </div>
  );
}
