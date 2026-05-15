import { useMemo } from 'react';

import { SectionHeader } from '@/components/primitives/SectionHeader';
import type { HistoryEntry } from '@/lib/realtime/useHistoryFeed';
import { useAgentsRoster } from '@/lib/realtime/useAgentsRoster';
import { useWorkspaceId } from '@/lib/session/SessionContext';
import { HistoryRow } from './HistoryRow';

interface HistoryListProps {
  entries: HistoryEntry[];
}

interface DayGroup {
  label: 'Today' | 'Yesterday' | string;
  entries: HistoryEntry[];
}

export function HistoryList({ entries }: HistoryListProps) {
  const workspaceId = useWorkspaceId();
  const agents = useAgentsRoster(workspaceId);
  const groups = useMemo(() => groupByDay(entries), [entries]);

  return (
    <div className="py-2">
      {groups.map((group) => (
        <section key={group.label} className="mb-2">
          <SectionHeader>{group.label}</SectionHeader>
          {group.entries.map((entry) => {
            const agent = entry.agentId ? agents.find((a) => a.id === entry.agentId) : undefined;
            return (
              <HistoryRow
                key={entry.id}
                entry={entry}
                agent={agent}
                laneHue={agent?.hue ?? 0}
              />
            );
          })}
        </section>
      ))}
    </div>
  );
}

function groupByDay(entries: HistoryEntry[]): DayGroup[] {
  const today = new Date();
  const todayKey = today.toDateString();
  const yesterday = new Date(today);
  yesterday.setDate(yesterday.getDate() - 1);
  const yesterdayKey = yesterday.toDateString();

  const buckets = new Map<string, DayGroup>();
  for (const entry of entries) {
    const date = new Date(entry.createdAt);
    const key = date.toDateString();
    const label =
      key === todayKey ? 'Today' : key === yesterdayKey ? 'Yesterday' : date.toLocaleDateString(undefined, { weekday: 'long', month: 'short', day: 'numeric' });
    let group = buckets.get(key);
    if (!group) {
      group = { label, entries: [] };
      buckets.set(key, group);
    }
    group.entries.push(entry);
  }
  return [...buckets.values()];
}
