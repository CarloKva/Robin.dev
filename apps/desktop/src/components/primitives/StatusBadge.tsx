import type { ReactNode } from 'react';

import { cn } from '@/lib/cn';
import { statusConfig } from '@/lib/status';
import type { StatusTone } from '@/lib/status';

interface StatusBadgeProps {
  kind?: string;
  children?: ReactNode;
  mini?: boolean;
  className?: string;
}

const toneClass: Record<StatusTone, string> = {
  success: 'text-success bg-success-soft',
  warning: 'text-warning bg-warning-soft',
  info: 'text-info bg-info-soft',
  neutral: 'text-ink3 bg-neutral-soft',
  danger: 'text-danger bg-danger-soft',
};

const dotColour: Record<StatusTone, string> = {
  success: 'bg-success',
  warning: 'bg-warning',
  info: 'bg-info',
  neutral: 'bg-neutral',
  danger: 'bg-danger',
};

export function StatusBadge({ kind, children, mini, className }: StatusBadgeProps) {
  const cfg = statusConfig(kind);
  return (
    <span
      className={cn(
        'inline-flex items-center gap-1.5 whitespace-nowrap rounded-full font-medium',
        mini ? 'px-1.5 py-px text-2xs' : 'px-2 py-0.5 text-xs',
        toneClass[cfg.tone],
        className,
      )}
    >
      <span className={cn('h-1.5 w-1.5 rounded-full', dotColour[cfg.tone])} aria-hidden="true" />
      {children ?? cfg.label}
    </span>
  );
}
