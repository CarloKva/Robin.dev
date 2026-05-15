import type { ReactNode } from 'react';

interface WindowShellProps {
  title: string;
  subtitle?: string;
  toolbar?: ReactNode;
  children: ReactNode;
}

/**
 * Native window — title bar is rendered by macOS (traffic lights, drag area).
 * We render a thin secondary header below it.
 */
export function WindowShell({ title, subtitle, toolbar, children }: WindowShellProps) {
  return (
    <div className="flex h-screen flex-col bg-bg">
      <header className="flex items-center justify-between border-b border-divider bg-popover px-4 py-2.5">
        <div>
          <h1 className="text-sm font-semibold text-ink">{title}</h1>
          {subtitle ? <p className="text-2xs text-ink3">{subtitle}</p> : null}
        </div>
        {toolbar ? <div className="flex items-center gap-2">{toolbar}</div> : null}
      </header>
      <div className="flex-1 overflow-hidden">{children}</div>
    </div>
  );
}
