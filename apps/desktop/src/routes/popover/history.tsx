import { createRoute } from '@tanstack/react-router';
import { GitCommit } from 'lucide-react';
import { useState } from 'react';

import { EmptyState } from '@/components/shell/EmptyState';
import { HistoryList } from '@/components/history/HistoryList';
import { Filter } from '@/components/history/Filter';
import { useHistoryFeed } from '@/lib/realtime/useHistoryFeed';
import { useWorkspaceId } from '@/lib/session/SessionContext';
import { Route as PopoverLayoutRoute } from './__layout';

export const Route = createRoute({
  getParentRoute: () => PopoverLayoutRoute,
  path: '/history',
  component: HistoryPage,
});

function HistoryPage() {
  const workspaceId = useWorkspaceId();
  const [filter, setFilter] = useState<'all' | 'merges' | string>('all');
  const { entries, loading } = useHistoryFeed(workspaceId);

  if (loading) {
    return <div className="px-3 py-4 text-sm text-ink3">Loading…</div>;
  }
  if (entries.length === 0) {
    return (
      <EmptyState
        icon={<GitCommit size={28} />}
        title="No commits yet"
        body="When your engineers push code or open PRs you'll see a git-style log here, colour-coded per engineer."
      />
    );
  }

  const filtered =
    filter === 'all'
      ? entries
      : filter === 'merges'
        ? entries.filter((e) => e.kind === 'pr.merged' || e.kind === 'pr.opened')
        : entries.filter((e) => e.agentId === filter);

  return (
    <div className="flex h-full flex-col">
      <Filter value={filter} onChange={setFilter} entries={entries} />
      <HistoryList entries={filtered} />
    </div>
  );
}
