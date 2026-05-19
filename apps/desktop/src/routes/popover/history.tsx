import { createRoute } from '@tanstack/react-router';
import { GitCommit } from 'lucide-react';
import { useMemo, useState } from 'react';

import { EmptyState } from '@/components/shell/EmptyState';
import { HistoryList } from '@/components/history/HistoryList';
import { Filter } from '@/components/history/Filter';
import { LiveLabel } from '@/components/primitives/LiveDot';
import { usePopoverFooterLeft } from '@/lib/popover/footerSlot';
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
  const [filter, setFilter] = useState<'all' | string>('all');
  const { entries, loading } = useHistoryFeed(workspaceId);

  const footerLeft = useMemo(
    () => (entries.length > 0 ? <LiveLabel>streaming</LiveLabel> : null),
    [entries.length],
  );
  usePopoverFooterLeft(footerLeft);

  if (loading) {
    return <div className="px-4 py-6 text-sm text-ink3">Loading…</div>;
  }

  if (entries.length === 0) {
    return (
      <>
        <Greeting />
        <EmptyState
          icon={<GitCommit size={28} />}
          title="No commits yet"
          body="When your engineers push code or open PRs you'll see a git-style log here, colour-coded per engineer."
        />
      </>
    );
  }

  const filtered = filter === 'all' ? entries : entries.filter((e) => e.agentId === filter);

  return (
    <div className="flex h-full flex-col">
      <Greeting />
      <Filter value={filter} onChange={setFilter} entries={entries} />
      <HistoryList entries={filtered} />
    </div>
  );
}

function Greeting() {
  return (
    <div className="px-4 pb-1.5 pt-3.5">
      <div className="text-lg font-semibold tracking-tight text-ink">History</div>
      <p className="mt-1 text-xs leading-snug text-ink3">
        Every commit your team has pushed.
      </p>
    </div>
  );
}
