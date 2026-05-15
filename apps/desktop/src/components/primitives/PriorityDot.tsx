import { cn } from '@/lib/cn';

type Priority = 'low' | 'medium' | 'high' | 'urgent';

interface PriorityDotProps {
  priority: Priority;
  className?: string;
}

const colour: Record<Priority, string> = {
  low: 'bg-neutral',
  medium: 'bg-info',
  high: 'bg-warning',
  urgent: 'bg-danger',
};

const label: Record<Priority, string> = {
  low: 'Low priority',
  medium: 'Medium priority',
  high: 'High priority',
  urgent: 'Urgent',
};

export function PriorityDot({ priority, className }: PriorityDotProps) {
  return (
    <span
      role="img"
      aria-label={label[priority]}
      title={label[priority]}
      className={cn('inline-block h-2 w-2 shrink-0 rounded-full', colour[priority], className)}
    />
  );
}
