import type { ReactNode } from 'react';
import { ChevronRight, ExternalLink } from 'lucide-react';

import { cn } from '@/lib/cn';

interface SettingsCardProps {
  title: string;
  subtitle?: string;
  icon?: ReactNode;
  cta?: 'open' | 'external';
  disabled?: boolean;
  badge?: string;
  onOpen?: () => void;
  children?: ReactNode;
}

export function SettingsCard({
  title,
  subtitle,
  icon,
  cta = 'open',
  disabled,
  badge,
  onOpen,
  children,
}: SettingsCardProps) {
  return (
    <button
      type="button"
      onClick={onOpen}
      disabled={disabled}
      className={cn(
        'group flex w-full items-start gap-3 rounded-xl border border-divider bg-popover-edge p-3 text-left transition-colors',
        disabled ? 'cursor-default opacity-70' : 'hover:bg-hover',
      )}
    >
      {icon ? (
        <span className="flex h-7 w-7 shrink-0 items-center justify-center rounded-md bg-panel text-ink2">
          {icon}
        </span>
      ) : null}
      <div className="min-w-0 flex-1">
        <div className="flex items-center gap-2">
          <span className="text-xs font-semibold text-ink">{title}</span>
          {badge ? (
            <span className="rounded-full bg-warning-soft px-1.5 py-px text-2xs font-medium text-warning">
              {badge}
            </span>
          ) : null}
        </div>
        {subtitle ? <p className="text-2xs text-ink3">{subtitle}</p> : null}
        {children ? <div className="mt-2">{children}</div> : null}
      </div>
      {disabled ? null : cta === 'external' ? (
        <ExternalLink size={14} className="mt-0.5 shrink-0 text-ink3" />
      ) : (
        <ChevronRight size={14} className="mt-0.5 shrink-0 text-ink3" />
      )}
    </button>
  );
}
