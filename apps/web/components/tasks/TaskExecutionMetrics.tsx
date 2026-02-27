import type { TimelineEntry } from "@robin/shared-types";

interface TaskExecutionMetricsProps {
  events: TimelineEntry[];
  createdAt: string;
}

/**
 * Execution metrics computed from the event stream.
 * Shows phases completed, total commits, and total duration.
 */
export function TaskExecutionMetrics({
  events,
  createdAt,
}: TaskExecutionMetricsProps) {
  const phasesCompleted = events.filter(
    (e) => e.event_type === "agent.phase.completed"
  ).length;

  const totalCommits = events.filter(
    (e) => e.event_type === "agent.commit.pushed"
  ).length;

  const lastEvent = events[events.length - 1];
  let duration = "—";
  if (lastEvent) {
    const ms =
      new Date(lastEvent.created_at).getTime() - new Date(createdAt).getTime();
    const mins = Math.floor(ms / 60_000);
    const hours = Math.floor(mins / 60);
    if (hours > 0) {
      duration = `${hours}h ${mins % 60}m`;
    } else if (mins > 0) {
      duration = `${mins}m`;
    } else {
      duration = "< 1m";
    }
  }

  const metrics = [
    { label: "Fasi completate", value: `${phasesCompleted}/4` },
    { label: "Commit totali", value: String(totalCommits) },
    { label: "Durata totale", value: duration },
  ];

  if (events.length === 0) return null;

  return (
    <div>
      <h3 className="mb-2 text-xs font-semibold uppercase tracking-wide text-muted-foreground">
        Metriche esecuzione
      </h3>
      <div className="grid grid-cols-3 gap-2">
        {metrics.map(({ label, value }) => (
          <div
            key={label}
            className="rounded-lg border border-border bg-card p-3 text-center"
          >
            <p className="text-lg font-bold text-foreground">{value}</p>
            <p className="mt-0.5 text-xs text-muted-foreground">{label}</p>
          </div>
        ))}
      </div>
    </div>
  );
}
