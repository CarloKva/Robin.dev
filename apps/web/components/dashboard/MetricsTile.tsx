import { cn } from "@/lib/utils";

interface MetricsTileProps {
  value: number;
  label: string;
  /** If true, shows amber/red styling when value > 0. */
  isAttention?: boolean;
  className?: string;
}

/**
 * A single metric tile for the dashboard.
 * Shows a numeric value with a descriptive label.
 * When `isAttention` is true and value > 0, applies a warning style
 * to draw the user's eye immediately.
 */
export function MetricsTile({
  value,
  label,
  isAttention = false,
  className,
}: MetricsTileProps) {
  const hasIssues = isAttention && value > 0;

  return (
    <div
      className={cn(
        "rounded-xl border p-6 transition-colors",
        hasIssues
          ? "border-amber-300 bg-amber-50 dark:border-amber-800 dark:bg-amber-950/20"
          : "border-border bg-card",
        className
      )}
    >
      <p
        className={cn(
          "text-3xl font-bold",
          hasIssues
            ? "text-amber-700 dark:text-amber-400"
            : "text-foreground"
        )}
      >
        {value}
      </p>
      <p
        className={cn(
          "mt-1 text-sm font-medium",
          hasIssues
            ? "text-amber-600 dark:text-amber-500"
            : "text-muted-foreground"
        )}
      >
        {label}
      </p>
    </div>
  );
}

/** Skeleton placeholder shown during initial fetch. */
export function MetricsTileSkeleton({ className }: { className?: string }) {
  return (
    <div
      className={cn(
        "rounded-xl border border-border bg-card p-6 animate-pulse",
        className
      )}
    >
      <div className="h-9 w-16 rounded bg-muted" />
      <div className="mt-2 h-4 w-32 rounded bg-muted" />
    </div>
  );
}
