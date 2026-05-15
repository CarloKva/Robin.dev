import { createRoute, useNavigate, useParams } from '@tanstack/react-router';
import { ChevronLeft, ExternalLink } from 'lucide-react';

import { Btn } from '@/components/primitives/Btn';
import { IconBtn } from '@/components/primitives/IconBtn';
import { TaskDetailView } from '@/components/task-detail/TaskDetailView';
import { useTaskEventsFeed } from '@/lib/realtime/useTaskEventsFeed';
import { focusExpandedAgent } from '@/lib/expanded/openWindow';
import { Route as PopoverLayoutRoute } from './__layout';

export const Route = createRoute({
  getParentRoute: () => PopoverLayoutRoute,
  path: '/task/$taskId',
  component: TaskDetailPage,
});

function TaskDetailPage() {
  const params = useParams({ strict: false }) as { taskId?: string };
  const navigate = useNavigate();
  const taskId = params.taskId ?? '';
  const { task, events, loading } = useTaskEventsFeed(taskId);

  if (loading || !task) {
    return <div className="px-3 py-4 text-sm text-ink3">Loading task…</div>;
  }

  return (
    <div className="flex h-full flex-col">
      <div className="flex items-center justify-between border-b border-divider px-2 py-2">
        <div className="flex items-center gap-1.5">
          <IconBtn label="Back" onClick={() => navigate({ to: '/popover/inbox' })}>
            <ChevronLeft size={14} />
          </IconBtn>
          <span className="truncate text-xs font-semibold text-ink">{task.title}</span>
        </div>
        <Btn
          variant="ghost"
          size="sm"
          icon={<ExternalLink size={12} />}
          onClick={() => {
            if (task.assignedAgentId) {
              void focusExpandedAgent(task.assignedAgentId);
            }
          }}
        >
          Open chat
        </Btn>
      </div>
      <TaskDetailView task={task} events={events} />
    </div>
  );
}
