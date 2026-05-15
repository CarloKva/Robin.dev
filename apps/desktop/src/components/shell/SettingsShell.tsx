import type { ReactNode } from 'react';
import { Link } from '@tanstack/react-router';

import { cn } from '@/lib/cn';

export interface SettingsNavItem {
  id: string;
  label: string;
  href: string;
  disabled?: boolean;
}

export const SETTINGS_NAV: SettingsNavItem[] = [
  { id: 'general', label: 'General', href: '/expanded/settings/general', disabled: true },
  { id: 'team', label: 'Team', href: '/expanded/settings/team', disabled: true },
  { id: 'brains', label: 'Brains', href: '/expanded/settings/brains', disabled: true },
  { id: 'capabilities', label: 'Capabilities', href: '/expanded/settings/capabilities', disabled: true },
  { id: 'github', label: 'GitHub', href: '/expanded/settings/github' },
  { id: 'infrastructure', label: 'Infrastructure', href: '/expanded/settings/infrastructure', disabled: true },
  { id: 'workspace', label: 'Workspace', href: '/expanded/settings/workspace', disabled: true },
  { id: 'billing', label: 'Billing', href: '/expanded/settings/billing', disabled: true },
  { id: 'danger', label: 'Danger zone', href: '/expanded/settings/danger', disabled: true },
];

interface SettingsShellProps {
  activeId: string;
  title: string;
  subtitle?: string;
  toolbar?: ReactNode;
  children: ReactNode;
}

export function SettingsShell({ activeId, title, subtitle, toolbar, children }: SettingsShellProps) {
  return (
    <div className="grid h-full grid-cols-[210px_1fr]">
      <aside className="border-r border-divider bg-popover py-3">
        <nav>
          <ul>
            {SETTINGS_NAV.map((item) => {
              const isActive = item.id === activeId;
              if (item.disabled) {
                return (
                  <li key={item.id}>
                    <span
                      className={cn(
                        'flex items-center justify-between px-4 py-1.5 text-xs',
                        'text-ink4 cursor-not-allowed',
                      )}
                      title="Coming in v2"
                    >
                      {item.label}
                      <span className="rounded-full bg-info-soft px-1.5 py-px text-2xs text-info">v2</span>
                    </span>
                  </li>
                );
              }
              return (
                <li key={item.id}>
                  <Link
                    to={item.href}
                    className={cn(
                      'flex items-center px-4 py-1.5 text-xs transition-colors',
                      isActive ? 'bg-hover font-medium text-ink' : 'text-ink2 hover:bg-hover hover:text-ink',
                    )}
                  >
                    {item.label}
                  </Link>
                </li>
              );
            })}
          </ul>
        </nav>
      </aside>
      <section className="flex flex-col overflow-hidden bg-bg">
        <header className="flex items-center justify-between border-b border-divider bg-popover px-5 py-3">
          <div>
            <h2 className="text-sm font-semibold text-ink">{title}</h2>
            {subtitle ? <p className="text-2xs text-ink3">{subtitle}</p> : null}
          </div>
          {toolbar ? <div className="flex items-center gap-2">{toolbar}</div> : null}
        </header>
        <div className="flex-1 overflow-y-auto px-5 py-5">{children}</div>
      </section>
    </div>
  );
}
