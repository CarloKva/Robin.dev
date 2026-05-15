import { cn } from '@/lib/cn';

interface RepoChipProps {
  owner?: string;
  name: string;
  size?: 'sm' | 'md';
  className?: string;
}

export function RepoChip({ owner, name, size = 'sm', className }: RepoChipProps) {
  return (
    <span
      className={cn(
        'inline-flex items-center gap-1 rounded-md border border-border bg-panel font-mono text-mono',
        size === 'sm' ? 'h-5 px-1.5 text-2xs' : 'h-6 px-2 text-xs',
        className,
      )}
    >
      {owner ? <span className="text-ink3">{owner}/</span> : null}
      <span>{name}</span>
    </span>
  );
}
