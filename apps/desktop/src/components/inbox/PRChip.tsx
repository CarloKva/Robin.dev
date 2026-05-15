import { GitPullRequest } from 'lucide-react';

interface PRChipProps {
  prNumber: number | null;
  prUrl: string | null;
}

export function PRChip({ prNumber, prUrl }: PRChipProps) {
  if (!prNumber && !prUrl) return null;
  const body = (
    <span className="inline-flex h-5 items-center gap-1 rounded-md border border-info-border bg-info-soft px-1.5 font-mono text-2xs text-info">
      <GitPullRequest size={10} aria-hidden="true" />
      {prNumber != null ? `#${prNumber}` : 'PR'}
    </span>
  );
  if (!prUrl) return body;
  return (
    <a href={prUrl} target="_blank" rel="noreferrer">
      {body}
    </a>
  );
}
