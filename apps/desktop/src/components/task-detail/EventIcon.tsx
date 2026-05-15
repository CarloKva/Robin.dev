import {
  AlertCircle,
  CheckCircle2,
  Circle,
  GitCommit,
  GitPullRequest,
  MessageCircle,
  Sparkles,
  Upload,
  XCircle,
} from 'lucide-react';

import type { TaskEventType } from '@robin/shared-types';
import { cn } from '@/lib/cn';

interface EventIconProps {
  eventType: TaskEventType;
  className?: string;
}

interface IconMeta {
  icon: typeof CheckCircle2;
  tone: 'success' | 'warning' | 'info' | 'neutral' | 'danger' | 'accent';
}

const map: Partial<Record<TaskEventType, IconMeta>> = {
  'task.created': { icon: Sparkles, tone: 'accent' },
  'task.state.changed': { icon: Circle, tone: 'neutral' },
  'agent.phase.started': { icon: Circle, tone: 'info' },
  'agent.phase.completed': { icon: CheckCircle2, tone: 'success' },
  'agent.commit.pushed': { icon: GitCommit, tone: 'success' },
  'agent.pr.opened': { icon: GitPullRequest, tone: 'info' },
  'agent.pr.updated': { icon: GitPullRequest, tone: 'info' },
  'agent.deploy.staging': { icon: Upload, tone: 'info' },
  'agent.blocked': { icon: AlertCircle, tone: 'warning' },
  'human.approved': { icon: CheckCircle2, tone: 'success' },
  'human.rejected': { icon: XCircle, tone: 'danger' },
  'human.commented': { icon: MessageCircle, tone: 'neutral' },
  'task.completed': { icon: CheckCircle2, tone: 'success' },
  'task.failed': { icon: XCircle, tone: 'danger' },
};

const toneClass: Record<IconMeta['tone'], string> = {
  success: 'text-success bg-success-soft',
  warning: 'text-warning bg-warning-soft',
  info: 'text-info bg-info-soft',
  neutral: 'text-ink3 bg-neutral-soft',
  danger: 'text-danger bg-danger-soft',
  accent: 'text-accent bg-accent-soft',
};

export function EventIcon({ eventType, className }: EventIconProps) {
  const meta = map[eventType] ?? { icon: Circle, tone: 'neutral' as const };
  const Icon = meta.icon;
  return (
    <span
      className={cn(
        'inline-flex h-6 w-6 shrink-0 items-center justify-center rounded-full',
        toneClass[meta.tone],
        className,
      )}
    >
      <Icon size={12} />
    </span>
  );
}
