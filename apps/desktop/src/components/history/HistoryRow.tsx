import { GitCommit, GitMerge, GitPullRequest, CheckCircle2 } from 'lucide-react';

import { cn } from '@/lib/cn';
import type { HistoryEntry } from '@/lib/realtime/useHistoryFeed';
import type { RosterAgent } from '@/lib/realtime/useAgentsRoster';

interface HistoryRowProps {
  entry: HistoryEntry;
  agent: RosterAgent | undefined;
  laneHue: number;
}

const meta: Record<
  HistoryEntry['kind'],
  { icon: typeof GitCommit; halo: boolean; label: string }
> = {
  'commit.pushed': { icon: GitCommit, halo: false, label: 'commit' },
  'pr.opened': { icon: GitPullRequest, halo: false, label: 'PR opened' },
  'pr.merged': { icon: GitMerge, halo: true, label: 'merged' },
  'task.completed': { icon: CheckCircle2, halo: false, label: 'task done' },
};

export function HistoryRow({ entry, agent, laneHue }: HistoryRowProps) {
  const m = meta[entry.kind];
  const Icon = m.icon;
  const laneColour = `hsl(${laneHue}, 55%, 48%)`;

  return (
    <div className="relative flex items-start gap-2 pl-3 pr-3 py-1.5">
      <span
        aria-hidden="true"
        className="absolute left-[14px] top-0 bottom-0 w-px"
        style={{ background: `${laneColour}33` }}
      />
      <span
        className={cn(
          'relative z-10 mt-1 inline-flex h-5 w-5 shrink-0 items-center justify-center rounded-full text-popover',
          m.halo && 'ring-2 ring-success-soft',
        )}
        style={{ background: laneColour }}
      >
        <Icon size={10} />
      </span>
      <div className="min-w-0 flex-1">
        <p className="truncate text-xs text-ink">
          {agent ? <span className="font-medium" style={{ color: laneColour }}>{agent.name}</span> : 'Agent'}{' '}
          <span className="text-ink3">{m.label}</span>
          {entry.message ? <span className="text-ink2"> — {entry.message}</span> : null}
        </p>
        <p className="font-mono text-2xs text-ink3">
          {entry.commitSha ? entry.commitSha.slice(0, 7) : entry.prNumber ? `#${entry.prNumber}` : ''}
          {entry.branch ? `  on ${entry.branch}` : ''}
        </p>
      </div>
      <time className="shrink-0 text-2xs text-ink3" dateTime={entry.createdAt}>
        {formatTime(entry.createdAt)}
      </time>
    </div>
  );
}

function formatTime(iso: string): string {
  const d = new Date(iso);
  return d.toLocaleTimeString(undefined, { hour: 'numeric', minute: '2-digit' });
}
