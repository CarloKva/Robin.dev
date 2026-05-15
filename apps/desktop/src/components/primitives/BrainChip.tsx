import { cn } from '@/lib/cn';

interface BrainChipProps {
  brain: string;
  className?: string;
}

function familyTone(brain: string): 'accent' | 'info' | 'success' | 'neutral' {
  const lower = brain.toLowerCase();
  if (lower.includes('opus')) return 'accent';
  if (lower.includes('sonnet')) return 'success';
  if (lower.includes('haiku')) return 'info';
  return 'neutral';
}

const toneClass: Record<ReturnType<typeof familyTone>, string> = {
  accent: 'text-accent bg-accent-soft border-accent-border',
  info: 'text-info bg-info-soft border-info-border',
  success: 'text-success bg-success-soft border-success-border',
  neutral: 'text-ink3 bg-neutral-soft border-border',
};

export function BrainChip({ brain, className }: BrainChipProps) {
  return (
    <span
      className={cn(
        'inline-flex h-5 items-center rounded-md border px-1.5 font-mono text-2xs',
        toneClass[familyTone(brain)],
        className,
      )}
    >
      {brain}
    </span>
  );
}
