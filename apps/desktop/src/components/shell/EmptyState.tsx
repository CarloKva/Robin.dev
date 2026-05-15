import type { ReactNode } from 'react';

import { Btn } from '@/components/primitives/Btn';

interface EmptyStateProps {
  title: string;
  body: string;
  cta?: { label: string; onClick: () => void };
  icon?: ReactNode;
}

export function EmptyState({ title, body, cta, icon }: EmptyStateProps) {
  return (
    <div className="flex h-full flex-col items-center justify-center gap-3 px-6 py-12 text-center">
      {icon ? <div className="text-ink3">{icon}</div> : null}
      <h2 className="text-base font-semibold text-ink">{title}</h2>
      <p className="max-w-[260px] text-sm text-ink3">{body}</p>
      {cta ? (
        <Btn variant="secondary" size="sm" onClick={cta.onClick}>
          {cta.label}
        </Btn>
      ) : null}
    </div>
  );
}
