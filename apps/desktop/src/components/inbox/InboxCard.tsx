import { Link } from '@tanstack/react-router';

import { Avatar } from '@/components/primitives/Avatar';
import { BranchTag } from '@/components/primitives/BranchTag';
import { RepoChip } from '@/components/primitives/RepoChip';
import { cn } from '@/lib/cn';
import type { InboxLetter } from '@/lib/inbox/projectLetter';
import { useAgentsRoster } from '@/lib/realtime/useAgentsRoster';
import { useWorkspaceId } from '@/lib/session/SessionContext';
import { CopyBtn } from './CopyBtn';
import { KindTag } from './KindTag';
import { PRChip } from './PRChip';

interface InboxCardProps {
  letter: InboxLetter;
  onMarkRead: (taskId: string) => void;
}

export function InboxCard({ letter, onMarkRead }: InboxCardProps) {
  const workspaceId = useWorkspaceId();
  const agents = useAgentsRoster(workspaceId);
  const agent = letter.agentId ? agents.find((a) => a.id === letter.agentId) : undefined;
  const copyPayload = [letter.headline, '', letter.body, letter.prUrl ?? '']
    .filter(Boolean)
    .join('\n');

  return (
    <article
      className={cn(
        'group relative mx-3 mb-2 rounded-xl border bg-popover-edge p-3 transition-shadow',
        letter.read
          ? 'border-divider opacity-80'
          : 'border-border shadow-card',
      )}
      onMouseEnter={() => {
        if (!letter.read) onMarkRead(letter.taskId);
      }}
    >
      <header className="mb-2 flex items-center justify-between gap-2">
        <div className="flex items-center gap-2 min-w-0">
          {agent ? (
            <Avatar name={agent.name} hue={agent.hue} size="sm" {...(agent.src ? { src: agent.src } : {})} />
          ) : null}
          <Link
            to="/popover/task/$taskId"
            params={{ taskId: letter.taskId }}
            className="truncate text-xs font-semibold text-ink hover:underline"
          >
            {letter.headline}
          </Link>
        </div>
        <div className="flex items-center gap-1.5">
          <KindTag kind={letter.kind} />
          <CopyBtn text={copyPayload} />
        </div>
      </header>
      <p
        className={cn(
          'mb-2 text-xs leading-relaxed',
          letter.kind === 'failed' && letter.errorMessage ? 'text-danger' : 'text-ink2',
        )}
      >
        {letter.body}
      </p>
      <footer className="flex flex-wrap items-center gap-1.5">
        {letter.repo ? <RepoChip name={letter.repo} /> : null}
        {letter.branch ? <BranchTag branch={letter.branch} /> : null}
        <PRChip prNumber={letter.prNumber} prUrl={letter.prUrl} />
        {letter.durationSeconds != null ? (
          <span className="font-mono text-2xs text-ink3">
            {formatDuration(letter.durationSeconds)}
          </span>
        ) : null}
        {letter.tokens != null ? (
          <span className="font-mono text-2xs text-ink3">
            {Math.round(letter.tokens / 1000)}k tok
          </span>
        ) : null}
        <span className="ml-auto text-2xs text-ink3">{formatTime(letter.receivedAt)}</span>
      </footer>
    </article>
  );
}

function formatDuration(seconds: number): string {
  if (seconds < 60) return `${seconds}s`;
  const mins = Math.floor(seconds / 60);
  return `${mins}m`;
}

function formatTime(iso: string): string {
  const date = new Date(iso);
  const diff = Date.now() - date.getTime();
  const minutes = Math.floor(diff / 60_000);
  if (minutes < 1) return 'just now';
  if (minutes < 60) return `${minutes}m`;
  const hours = Math.floor(minutes / 60);
  if (hours < 24) return `${hours}h`;
  return date.toLocaleDateString(undefined, { month: 'short', day: 'numeric' });
}
