import type { TimelineEntry as TimelineEntryT } from '@robin/shared-types';

import { BranchTag } from '@/components/primitives/BranchTag';
import { RepoChip } from '@/components/primitives/RepoChip';
import { StatusBadge } from '@/components/primitives/StatusBadge';
import { projectTaskState } from '@/lib/db/projectTaskState';
import type { TaskHeader } from '@/lib/realtime/useTaskEventsFeed';
import { TimelineEntry } from './TimelineEntry';
import type { TaskEvent } from '@robin/shared-types';

interface TaskDetailViewProps {
  task: TaskHeader;
  events: TimelineEntryT[];
}

export function TaskDetailView({ task, events }: TaskDetailViewProps) {
  const projected = projectTaskState(events as unknown as TaskEvent[]);

  return (
    <div className="flex h-full flex-col">
      <div className="border-b border-divider px-3 py-3">
        <div className="flex items-center gap-2">
          <StatusBadge kind={projected.status} />
          {task.repo ? <RepoChip name={task.repo} /> : null}
          {task.branch ? <BranchTag branch={task.branch} /> : null}
        </div>
        {projected.currentPhase ? (
          <p className="mt-2 text-2xs uppercase tracking-wide text-ink3">
            Phase · <span className="text-ink">{projected.currentPhase}</span>
          </p>
        ) : null}
        {projected.blockedReason ? (
          <p className="mt-2 rounded-md border border-warning-border bg-warning-soft px-2 py-1.5 text-xs text-warning">
            {projected.blockedReason}
          </p>
        ) : null}
      </div>
      <div className="flex-1 overflow-y-auto py-2">
        {events.map((entry) => (
          <TimelineEntry key={entry.id} entry={entry} />
        ))}
      </div>
    </div>
  );
}
