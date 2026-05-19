import { Link } from '@tanstack/react-router';
import { useState } from 'react';

import { Avatar } from '@/components/primitives/Avatar';
import { BranchTag } from '@/components/primitives/BranchTag';
import { PriorityDot } from '@/components/primitives/PriorityDot';
import { RepoChip } from '@/components/primitives/RepoChip';
import { cn } from '@/lib/cn';
import { useAgentsRoster } from '@/lib/realtime/useAgentsRoster';
import { useWorkspaceId } from '@/lib/session/SessionContext';
import type { WipTask } from '@/lib/realtime/useInProgressTasks';

interface WipCardProps {
  task: WipTask;
}

export function WipCard({ task }: WipCardProps) {
  const [expanded, setExpanded] = useState(false);
  const workspaceId = useWorkspaceId();
  const agents = useAgentsRoster(workspaceId);
  const agent = task.agentId ? agents.find((a) => a.id === task.agentId) : undefined;
  const firstName = (agent?.name?.split(' ')[0] ?? 'Robin') || 'Robin';
  const priority = mapPriority(task.priority);

  return (
    <article className="rounded-xl border border-divider bg-popover px-3 py-3">
      <header className="mb-2 flex items-start gap-2.5">
        {agent ? (
          <Avatar
            name={agent.name}
            hue={agent.hue ?? 16}
            size="sm"
            status="working"
            {...(agent.src ? { src: agent.src } : {})}
          />
        ) : (
          <Avatar name={firstName} hue={16} size="sm" />
        )}
        <div className="min-w-0 flex-1">
          <div className="mb-0.5 flex items-baseline gap-1.5">
            <span className="text-sm font-semibold text-ink">{firstName}</span>
            <span className="text-xs text-ink3">working on</span>
            <span className="flex-1" />
            {priority ? <PriorityDot priority={priority} /> : null}
          </div>
          <Link
            to="/popover/task/$taskId"
            params={{ taskId: task.id }}
            className="block text-xs font-medium leading-snug text-ink hover:underline"
          >
            {task.title}
          </Link>
        </div>
      </header>

      {task.description ? (
        <div className="mb-2.5">
          <p
            className={cn(
              'text-xs leading-relaxed text-ink2',
              !expanded && 'line-clamp-2',
            )}
          >
            {task.description}
          </p>
          <button
            type="button"
            onClick={() => setExpanded((o) => !o)}
            className="mt-1 text-xs font-medium text-accent transition-colors hover:text-accent-hover"
          >
            {expanded ? 'Hide' : 'View all'}
          </button>
        </div>
      ) : null}

      {task.currentActivity ? (
        <p className="mb-2 text-2xs italic text-ink3">{task.currentActivity}</p>
      ) : null}

      <div className="flex flex-wrap items-center gap-1.5">
        {task.repo ? <RepoChip name={task.repo} /> : null}
        {task.branch ? <BranchTag branch={task.branch} /> : null}
        {task.prUrl ? (
          <a
            href={task.prUrl}
            target="_blank"
            rel="noreferrer"
            className="inline-flex items-center gap-1 whitespace-nowrap rounded-full bg-info-soft px-2 py-0.5 text-2xs font-semibold text-info"
          >
            {task.prNumber != null ? `PR #${task.prNumber}` : 'PR'} ↗
          </a>
        ) : null}
        <span className="flex-1" />
        {task.startedAt ? (
          <span className="whitespace-nowrap text-2xs text-ink3">
            started {formatRelative(task.startedAt)}
          </span>
        ) : null}
      </div>

      {task.progress != null ? (
        <div className="mt-2.5 h-1 overflow-hidden rounded-full bg-inset">
          <div
            className="h-full bg-accent transition-all duration-300"
            style={{ width: `${Math.max(0, Math.min(100, task.progress))}%` }}
          />
        </div>
      ) : null}
    </article>
  );
}

function mapPriority(p: string | null | undefined): 'high' | 'medium' | 'low' | 'urgent' | null {
  if (!p) return null;
  switch (p) {
    case 'critical':
      return 'urgent';
    case 'high':
    case 'medium':
    case 'low':
      return p;
    default:
      return null;
  }
}

function formatRelative(iso: string): string {
  const date = new Date(iso);
  const diff = Date.now() - date.getTime();
  const minutes = Math.floor(diff / 60_000);
  if (minutes < 1) return 'just now';
  if (minutes < 60) return `${minutes} min ago`;
  const hours = Math.floor(minutes / 60);
  if (hours < 24) return `${hours} h ago`;
  const days = Math.floor(hours / 24);
  if (days === 1) return 'yesterday';
  return `${days} d ago`;
}
