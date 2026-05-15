import { Link } from '@tanstack/react-router';
import { ChevronDown, ChevronRight } from 'lucide-react';
import { useState } from 'react';

import { Avatar } from '@/components/primitives/Avatar';
import { BranchTag } from '@/components/primitives/BranchTag';
import { LiveLabel } from '@/components/primitives/LiveDot';
import { PriorityDot } from '@/components/primitives/PriorityDot';
import { RepoChip } from '@/components/primitives/RepoChip';
import { StatusBadge } from '@/components/primitives/StatusBadge';
import { useAgentsRoster } from '@/lib/realtime/useAgentsRoster';
import { useWorkspaceId } from '@/lib/session/SessionContext';
import { cn } from '@/lib/cn';
import type { WipTask } from '@/lib/realtime/useInProgressTasks';

interface WipCardProps {
  task: WipTask;
}

export function WipCard({ task }: WipCardProps) {
  const [open, setOpen] = useState(false);
  const workspaceId = useWorkspaceId();
  const agents = useAgentsRoster(workspaceId);
  const agent = task.agentId ? agents.find((a) => a.id === task.agentId) : undefined;

  return (
    <article className="mx-3 mb-2 rounded-xl border border-border bg-popover-edge p-3 shadow-card">
      <header className="flex items-start justify-between gap-2">
        <div className="flex flex-1 items-start gap-2 min-w-0">
          {agent ? (
            <Avatar
              name={agent.name}
              hue={agent.hue}
              size="sm"
              status="working"
              {...(agent.src ? { src: agent.src } : {})}
            />
          ) : null}
          <div className="min-w-0 flex-1">
            <Link
              to="/popover/task/$taskId"
              params={{ taskId: task.id }}
              className="block truncate text-xs font-semibold text-ink hover:underline"
            >
              {task.title}
            </Link>
            {task.currentActivity ? (
              <p className="mt-0.5 truncate text-2xs text-ink2">{task.currentActivity}</p>
            ) : null}
          </div>
        </div>
        <div className="flex shrink-0 items-center gap-1.5">
          <PriorityDot priority={(task.priority === 'critical' ? 'urgent' : task.priority) as 'urgent' | 'high' | 'medium' | 'low'} />
          <StatusBadge kind={task.status} mini />
        </div>
      </header>

      <div className="mt-2 flex flex-wrap items-center gap-1.5">
        {task.repo ? <RepoChip name={task.repo} /> : null}
        {task.branch ? <BranchTag branch={task.branch} /> : null}
        {task.status === 'in_progress' ? <LiveLabel>working</LiveLabel> : null}
        {task.description ? (
          <button
            type="button"
            onClick={() => setOpen((o) => !o)}
            className="ml-auto inline-flex items-center gap-0.5 text-2xs text-ink3 hover:text-ink"
          >
            {open ? <ChevronDown size={10} /> : <ChevronRight size={10} />}
            details
          </button>
        ) : null}
      </div>

      {open && task.description ? (
        <p className={cn('mt-2 text-xs leading-relaxed text-ink2')}>{task.description}</p>
      ) : null}

      {task.progress != null ? (
        <div className="mt-2 h-1 overflow-hidden rounded-full bg-inset">
          <div
            className="h-full bg-accent transition-all duration-300"
            style={{ width: `${Math.max(0, Math.min(100, task.progress))}%` }}
          />
        </div>
      ) : null}
    </article>
  );
}
