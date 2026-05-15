import type { ReactNode } from 'react';

import { cn } from '@/lib/cn';

interface SectionHeaderProps {
  children: ReactNode;
  right?: ReactNode;
  accent?: boolean;
  className?: string;
}

export function SectionHeader({ children, right, accent, className }: SectionHeaderProps) {
  return (
    <div
      className={cn(
        'flex items-center justify-between px-3 pb-1.5 pt-3 text-2xs font-semibold uppercase tracking-[0.08em]',
        accent ? 'text-accent' : 'text-ink3',
        className,
      )}
    >
      <span>{children}</span>
      {right ? <span className="text-ink3">{right}</span> : null}
    </div>
  );
}
