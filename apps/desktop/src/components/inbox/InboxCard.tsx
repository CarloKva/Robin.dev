import { Link } from '@tanstack/react-router';

import { Avatar } from '@/components/primitives/Avatar';
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
  const firstName = (agent?.name?.split(' ')[0] ?? 'Robin') || 'Robin';
  const copyPayload = composeCopyText(letter);

  return (
    <article
      className={cn(
        'group relative rounded-xl border bg-popover px-3 py-3 transition-shadow',
        letter.read ? 'border-divider opacity-90' : 'border-border',
      )}
      onMouseEnter={() => {
        if (!letter.read) onMarkRead(letter.taskId);
      }}
    >
      <header className="flex items-start gap-2.5">
        {agent ? (
          <Avatar
            name={agent.name}
            hue={agent.hue ?? 16}
            size="sm"
            {...(agent.src ? { src: agent.src } : {})}
          />
        ) : (
          <Avatar name={firstName} hue={16} size="sm" />
        )}
        <div className="min-w-0 flex-1">
          <div className="mb-0.5 flex items-baseline gap-1.5">
            <span className="text-sm font-semibold text-ink">{firstName}</span>
            <KindTag kind={letter.kind} />
            <span className="flex-1" />
            <span className="whitespace-nowrap text-2xs text-ink3">
              {formatTime(letter.receivedAt)}
            </span>
          </div>
          <Link
            to="/popover/task/$taskId"
            params={{ taskId: letter.taskId }}
            className="block text-xs font-semibold leading-snug text-ink hover:underline"
          >
            {letter.headline}
          </Link>
        </div>
      </header>

      <p className="mt-1.5 text-xs leading-relaxed text-ink2">{letter.body}</p>

      {letter.kind === 'failed' && letter.errorMessage ? (
        <div className="mt-2 rounded-md bg-danger-soft px-2.5 py-2 font-mono text-2xs leading-snug text-danger">
          {letter.errorMessage}
        </div>
      ) : null}

      <footer className="mt-2.5 flex flex-wrap items-center gap-1.5 border-t border-divider pt-2.5">
        {letter.repo ? <RepoChip name={letter.repo} /> : null}
        {letter.durationSeconds != null ? (
          <span className="whitespace-nowrap text-2xs text-ink3">
            took {formatDuration(letter.durationSeconds)}
          </span>
        ) : null}
        {letter.tokens != null ? (
          <span className="whitespace-nowrap font-mono text-2xs text-ink3">
            {formatTokens(letter.tokens)} tok
          </span>
        ) : null}
        <span className="flex-1" />
        <PRChip prNumber={letter.prNumber} prUrl={letter.prUrl} />
        <CopyBtn text={copyPayload} />
      </footer>
    </article>
  );
}

function composeCopyText(letter: InboxLetter): string {
  const parts = [letter.headline, '', letter.body];
  if (letter.prUrl) parts.push('', `PR: ${letter.prUrl}`);
  if (letter.errorMessage) parts.push('', `Error: ${letter.errorMessage}`);
  const meta: string[] = [];
  if (letter.durationSeconds != null) meta.push(`Time: ${formatDuration(letter.durationSeconds)}`);
  if (letter.tokens != null) meta.push(`Tokens: ${formatTokens(letter.tokens)}`);
  if (meta.length) parts.push('', meta.join(' · '));
  return parts.join('\n');
}

function formatDuration(seconds: number): string {
  if (seconds < 60) return `${seconds}s`;
  const mins = Math.floor(seconds / 60);
  if (mins < 60) return `${mins} m`;
  const hours = Math.floor(mins / 60);
  const rem = mins % 60;
  return rem ? `${hours} h ${rem} m` : `${hours} h`;
}

function formatTokens(tokens: number): string {
  if (tokens >= 1_000_000) return `${(tokens / 1_000_000).toFixed(1)} M`;
  if (tokens >= 1_000) return `${Math.round(tokens / 1_000)} K`;
  return String(tokens);
}

function formatTime(iso: string): string {
  const date = new Date(iso);
  const diff = Date.now() - date.getTime();
  const minutes = Math.floor(diff / 60_000);
  if (minutes < 1) return 'just now';
  if (minutes < 60) return `${minutes} minutes ago`;
  const hours = Math.floor(minutes / 60);
  if (hours < 24) return `${hours} hours ago`;
  const days = Math.floor(hours / 24);
  if (days === 1) return 'yesterday';
  return date.toLocaleDateString(undefined, { month: 'short', day: 'numeric' });
}
