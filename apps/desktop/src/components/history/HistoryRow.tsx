import { Avatar } from '@/components/primitives/Avatar';
import { BranchTag } from '@/components/primitives/BranchTag';
import { cn } from '@/lib/cn';
import type { HistoryEntry } from '@/lib/realtime/useHistoryFeed';
import type { RosterAgent } from '@/lib/realtime/useAgentsRoster';

interface HistoryRowProps {
  entry: HistoryEntry;
  agent: RosterAgent | undefined;
  laneHue: number;
  isLast: boolean;
  repo: string | null;
}

export function HistoryRow({ entry, agent, laneHue, isLast, repo }: HistoryRowProps) {
  const lane = `hsl(${laneHue}, 60%, 50%)`;
  const firstName = (agent?.name?.split(' ')[0] ?? 'Robin') || 'Robin';
  const dotSize = 8;
  const merge = false;

  return (
    <div className="relative flex gap-3 px-4 py-2">
      <span
        aria-hidden="true"
        className="absolute top-0 w-px bg-divider"
        style={{
          left: 16 + 14,
          bottom: isLast ? '50%' : 0,
        }}
      />
      <span
        className="relative z-10 flex w-[30px] justify-center pt-1"
        aria-hidden="true"
      >
        <span
          className={cn(
            'inline-block rounded-full',
            merge && 'ring-2 ring-success-border',
          )}
          style={{
            width: dotSize,
            height: dotSize,
            background: lane,
            boxShadow: '0 0 0 2px var(--popover)',
          }}
        />
      </span>

      <div className="min-w-0 flex-1 pb-1">
        <div className="flex items-baseline gap-1.5">
          {agent ? (
            <Avatar
              name={agent.name}
              hue={agent.hue ?? 16}
              size="xs"
              {...(agent.src ? { src: agent.src } : {})}
            />
          ) : null}
          <span className="whitespace-nowrap text-xs font-semibold text-ink">
            {firstName}
          </span>
          {entry.prNumber != null ? (
            entry.prUrl ? (
              <a
                href={entry.prUrl}
                target="_blank"
                rel="noreferrer"
                className="whitespace-nowrap font-mono text-2xs text-info hover:underline"
              >
                #{entry.prNumber}
              </a>
            ) : (
              <span className="whitespace-nowrap font-mono text-2xs text-ink3">
                #{entry.prNumber}
              </span>
            )
          ) : entry.commitSha ? (
            <span className="whitespace-nowrap font-mono text-2xs text-ink3">
              {entry.commitSha.slice(0, 7)}
            </span>
          ) : null}
          <span className="flex-1" />
          <time className="whitespace-nowrap text-2xs text-ink4" dateTime={entry.createdAt}>
            {formatTime(entry.createdAt)}
          </time>
        </div>

        <div className="mt-1 flex items-baseline gap-1.5 text-xs leading-snug">
          <span className="whitespace-nowrap text-ink3">opened</span>
          <span className="line-clamp-1 text-ink2">{entry.taskTitle ?? entry.message}</span>
        </div>

        {(repo || entry.branch) ? (
          <div className="mt-1 flex items-center gap-1.5">
            {repo ? (
              <span className="font-mono text-2xs text-ink3">{shortRepo(repo)}</span>
            ) : null}
            {repo && entry.branch ? <span className="text-ink4">·</span> : null}
            {entry.branch ? <BranchTag branch={entry.branch} /> : null}
          </div>
        ) : null}
      </div>
    </div>
  );
}

function shortRepo(full: string): string {
  return full.includes('/') ? (full.split('/')[1] ?? full) : full;
}

function formatTime(iso: string): string {
  const date = new Date(iso);
  const diff = Date.now() - date.getTime();
  const secs = Math.floor(diff / 1000);
  if (secs < 60) return `${secs}s ago`;
  const mins = Math.floor(secs / 60);
  if (mins < 60) return `${mins}m ago`;
  const hours = Math.floor(mins / 60);
  if (hours < 24) return `${hours}h ago`;
  const days = Math.floor(hours / 24);
  if (days === 1) return 'yesterday';
  return date.toLocaleDateString(undefined, { month: 'short', day: 'numeric' });
}
