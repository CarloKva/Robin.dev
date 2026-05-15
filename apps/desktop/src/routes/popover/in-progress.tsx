import { createRoute } from '@tanstack/react-router';
import { Activity } from 'lucide-react';

import { EmptyState } from '@/components/shell/EmptyState';
import { WipList } from '@/components/wip/WipList';
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

  if (loading) {
    return <div className="px-3 py-4 text-sm text-ink3">Loading…</div>;
  }
  if (tasks.length === 0) {
    return (
      <EmptyState
        icon={<Activity size={28} />}
        title="No work in flight"
        body="When tasks are queued or running you'll see live cards here with the branch, repo, and current activity."
      />
    );
  }
  return <WipList tasks={tasks} />;
}
