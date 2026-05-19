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
  label: string;
  entries: HistoryEntry[];
}

export function HistoryList({ entries }: HistoryListProps) {
  const workspaceId = useWorkspaceId();
  const agents = useAgentsRoster(workspaceId);
  const groups = useMemo(() => groupByDay(entries), [entries]);

  return (
    <div className="flex-1 overflow-y-auto pb-2">
      {groups.map((group, gi) => (
        <section key={group.label} className="mb-1">
          <SectionHeader {...(gi === 0 ? { className: 'pt-2' } : {})}>
            {group.label}
          </SectionHeader>
          {group.entries.map((entry, i) => {
            const agent = entry.agentId ? agents.find((a) => a.id === entry.agentId) : undefined;
            return (
              <HistoryRow
                key={entry.id}
                entry={entry}
                agent={agent}
                laneHue={agent?.hue ?? 0}
                isLast={i === group.entries.length - 1}
                repo={entry.repo}
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
      key === todayKey
        ? 'Today'
        : key === yesterdayKey
          ? 'Yesterday'
          : date.toLocaleDateString(undefined, { weekday: 'long', month: 'short', day: 'numeric' });
    let group = buckets.get(key);
    if (!group) {
      group = { label, entries: [] };
      buckets.set(key, group);
    }
    group.entries.push(entry);
  }
  return [...buckets.values()];
}
