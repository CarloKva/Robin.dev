import { createRoute } from '@tanstack/react-router';
import { Activity } from 'lucide-react';
import { useMemo } from 'react';

import { EmptyState } from '@/components/shell/EmptyState';
import { LiveLabel } from '@/components/primitives/LiveDot';
import { WipList } from '@/components/wip/WipList';
import { usePopoverFooterLeft } from '@/lib/popover/footerSlot';
import { useInProgressTasks } from '@/lib/realtime/useInProgressTasks';
import { useWorkspaceId } from '@/lib/session/SessionContext';
import { Route as PopoverLayoutRoute } from './__layout';

export const Route = createRoute({
  getParentRoute: () => PopoverLayoutRoute,
  path: '/in-progress',
  component: InProgressPage,
});

function InProgressPage() {
  const workspaceId = useWorkspaceId();
  const { tasks, loading } = useInProgressTasks(workspaceId);
  const liveCount = tasks.filter((t) => t.status === 'in_progress').length;

  const footerLeft = useMemo(
    () => (tasks.length > 0 ? <LiveLabel>streaming</LiveLabel> : null),
    [tasks.length],
  );
  usePopoverFooterLeft(footerLeft);

  if (loading) {
    return <div className="px-4 py-6 text-sm text-ink3">Loading…</div>;
  }

  if (tasks.length === 0) {
    return (
      <>
        <Greeting count={0} liveCount={0} />
        <EmptyState
          icon={<Activity size={28} />}
          title="No work in flight"
          body="When tasks are queued or running you'll see live cards here with the branch, repo, and current activity."
        />
      </>
    );
  }

  return (
    <>
      <Greeting count={tasks.length} liveCount={liveCount} />
      <WipList tasks={tasks} />
    </>
  );
}

function Greeting({ count, liveCount }: { count: number; liveCount: number }) {
  const subline = subtitleFor(count, liveCount);
  return (
    <div className="px-4 pb-1.5 pt-3.5">
      <div className="text-lg font-semibold tracking-tight text-ink">In progress</div>
      <p className="mt-1 text-xs leading-snug text-ink3">{subline}</p>
    </div>
  );
}

function subtitleFor(count: number, liveCount: number): string {
  if (count === 0) return 'Nothing in flight right now.';
  if (liveCount === 0) return `${count} task${count === 1 ? '' : 's'} queued — none actively shipping yet.`;
  return `${liveCount} engineer${liveCount === 1 ? '' : 's'} actively shipping.`;
}
