import type { TimelineEntry as TimelineEntryType } from "@robin/shared-types";
import { TimelineEntry } from "./TimelineEntry";

interface TimelineProps {
  entries: TimelineEntryType[];
  emptyMessage?: string;
}

export function Timeline({
  entries,
  emptyMessage = "No events yet.",
}: TimelineProps) {
  if (entries.length === 0) {
    return (
      <p className="py-6 text-center text-sm text-muted-foreground">
        {emptyMessage}
      </p>
    );
  }

  return (
    <div className="relative">
      {entries.map((entry, index) => (
        <TimelineEntry
          key={entry.id}
          entry={entry}
          isLast={index === entries.length - 1}
        />
      ))}
    </div>
  );
}
