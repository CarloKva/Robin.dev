import type { ReactNode } from 'react';

import { cn } from '@/lib/cn';

interface KbdProps {
  children: ReactNode;
  className?: string;
}

export function Kbd({ children, className }: KbdProps) {
  return (
    <kbd
      className={cn(
        'inline-flex h-[18px] min-w-[18px] items-center justify-center rounded-sm border border-border bg-panel px-1 font-mono text-2xs text-ink2',
        className,
      )}
    >
      {children}
    </kbd>
  );
}
