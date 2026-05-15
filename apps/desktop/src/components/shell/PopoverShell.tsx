import type { ReactNode } from 'react';

import { cn } from '@/lib/cn';

interface PopoverShellProps {
  header?: ReactNode;
  footer?: ReactNode;
  children: ReactNode;
  className?: string;
}

/**
 * Popover surface used inside the macOS menu-bar window. The shell is
 * frameless (decorations off at the Tauri level) so we paint the border +
 * shadow + top highlight ourselves.
 */
export function PopoverShell({ header, footer, children, className }: PopoverShellProps) {
  return (
    <div
      className={cn(
        'surface-popover relative flex h-full flex-col overflow-hidden rounded-2xl',
        className,
      )}
    >
      {header}
      <div className="flex-1 overflow-y-auto">{children}</div>
      {footer}
    </div>
  );
}
