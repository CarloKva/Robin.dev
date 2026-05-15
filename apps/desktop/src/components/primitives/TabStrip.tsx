import type { ReactNode } from 'react';

import { cn } from '@/lib/cn';

export interface TabDef {
  id: string;
  label: string;
  count?: number;
  urgent?: boolean;
}

interface TabStripProps {
  tabs: TabDef[];
  active: string;
  onSelect: (id: string) => void;
  right?: ReactNode;
}

export function TabStrip({ tabs, active, onSelect, right }: TabStripProps) {
  return (
    <div className="flex items-center justify-between border-b border-divider px-3">
      <div className="flex items-center gap-1" role="tablist">
        {tabs.map((tab) => {
          const isActive = tab.id === active;
          return (
            <button
              key={tab.id}
              type="button"
              role="tab"
              aria-selected={isActive}
              onClick={() => onSelect(tab.id)}
              className={cn(
                'relative inline-flex items-center gap-1.5 px-2.5 py-2 text-xs font-medium transition-colors',
                isActive ? 'text-ink' : 'text-ink3 hover:text-ink2',
              )}
            >
              <span>{tab.label}</span>
              {typeof tab.count === 'number' && tab.count > 0 ? (
                <span
                  className={cn(
                    'inline-flex h-4 min-w-[16px] items-center justify-center rounded-full px-1 text-2xs font-medium',
                    tab.urgent
                      ? 'bg-warning-soft text-warning'
                      : 'bg-neutral-soft text-ink3',
                  )}
                >
                  {tab.count}
                </span>
              ) : null}
              {isActive ? (
                <span className="absolute inset-x-1 -bottom-px h-0.5 rounded-full bg-accent" aria-hidden="true" />
              ) : null}
            </button>
          );
        })}
      </div>
      {right ? <div className="flex items-center gap-1">{right}</div> : null}
    </div>
  );
}
