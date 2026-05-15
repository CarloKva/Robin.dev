import { CheckCircle2, Eye, X, RotateCcw } from 'lucide-react';

import { cn } from '@/lib/cn';
import type { InboxKind } from '@/lib/inbox/kindFor';

interface KindTagProps {
  kind: InboxKind;
}

const meta: Record<InboxKind, { label: string; tone: string; icon: typeof CheckCircle2 }> = {
  shipped: { label: 'Shipped', tone: 'text-success bg-success-soft', icon: CheckCircle2 },
  review: { label: 'Review', tone: 'text-info bg-info-soft', icon: Eye },
  failed: { label: 'Failed', tone: 'text-danger bg-danger-soft', icon: X },
  rejected: { label: 'Rejected', tone: 'text-warning bg-warning-soft', icon: RotateCcw },
};

export function KindTag({ kind }: KindTagProps) {
  const m = meta[kind];
  const Icon = m.icon;
  return (
    <span
      className={cn(
        'inline-flex items-center gap-1 rounded-full px-2 py-0.5 text-2xs font-medium',
        m.tone,
      )}
    >
      <Icon size={10} aria-hidden="true" />
      {m.label}
    </span>
  );
}
