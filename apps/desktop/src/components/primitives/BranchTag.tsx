import { GitBranch } from 'lucide-react';

import { cn } from '@/lib/cn';

interface BranchTagProps {
  branch: string;
  size?: 'sm' | 'md';
  className?: string;
}

export function BranchTag({ branch, size = 'sm', className }: BranchTagProps) {
  return (
    <span
      className={cn(
        'inline-flex items-center gap-1 rounded-md border border-border bg-panel font-mono text-mono',
        size === 'sm' ? 'h-5 px-1.5 text-2xs' : 'h-6 px-2 text-xs',
        className,
      )}
    >
      <GitBranch size={10} aria-hidden="true" />
      {branch}
    </span>
  );
}
