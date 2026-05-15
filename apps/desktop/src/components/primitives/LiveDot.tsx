import type { ReactNode } from 'react';

import { cn } from '@/lib/cn';

interface LiveDotProps {
  size?: number;
  className?: string;
}

export function LiveDot({ size = 6, className }: LiveDotProps) {
  return (
    <span
      className={cn('relative inline-block', className)}
      style={{ width: size, height: size }}
      aria-hidden="true"
    >
      <span className="absolute inset-0 rounded-full bg-success" />
      <span className="absolute inset-0 animate-robin-pulse rounded-full bg-success" />
    </span>
  );
}

interface LiveLabelProps {
  size?: number;
  children?: ReactNode;
  className?: string;
}

export function LiveLabel({ size = 5, children = 'live', className }: LiveLabelProps) {
  return (
    <span
      className={cn(
        'inline-flex items-center gap-1.5 text-2xs font-medium text-ink3',
        className,
      )}
    >
      <LiveDot size={size} />
      {children}
    </span>
  );
}
