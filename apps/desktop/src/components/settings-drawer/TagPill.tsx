import { cn } from '@/lib/cn';

interface TagPillProps {
  children: React.ReactNode;
  tone?: 'neutral' | 'success' | 'warning' | 'info';
}

const tones: Record<NonNullable<TagPillProps['tone']>, string> = {
  neutral: 'bg-panel text-ink3 border-border',
  success: 'bg-success-soft text-success border-success-border',
  warning: 'bg-warning-soft text-warning border-warning-border',
  info: 'bg-info-soft text-info border-info-border',
};

export function TagPill({ children, tone = 'neutral' }: TagPillProps) {
  return (
    <span className={cn('inline-flex h-5 items-center rounded-full border px-1.5 text-2xs', tones[tone])}>
      {children}
    </span>
  );
}
