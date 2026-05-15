import type { TimelineEntry as TimelineEntryT } from '@robin/shared-types';

import { EventIcon } from './EventIcon';

interface TimelineEntryProps {
  entry: TimelineEntryT;
}

export function TimelineEntry({ entry }: TimelineEntryProps) {
  return (
    <div className="flex items-start gap-2 px-3 py-2">
      <EventIcon eventType={entry.event_type} />
      <div className="min-w-0 flex-1">
        <p className="text-xs text-ink">{entry.narrative}</p>
        <p className="mt-0.5 font-mono text-2xs text-ink3">{formatTime(entry.created_at)}</p>
      </div>
    </div>
  );
}

function formatTime(iso: string): string {
  const d = new Date(iso);
  return d.toLocaleString(undefined, {
    month: 'short',
    day: 'numeric',
    hour: 'numeric',
    minute: '2-digit',
  });
}
