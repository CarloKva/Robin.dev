import { cn } from '@/lib/cn';
import type { HistoryEntry } from '@/lib/realtime/useHistoryFeed';
import { useAgentsRoster } from '@/lib/realtime/useAgentsRoster';
import { useWorkspaceId } from '@/lib/session/SessionContext';

interface FilterProps {
  value: 'all' | string;
  onChange: (next: 'all' | string) => void;
  entries: HistoryEntry[];
}

export function Filter({ value, onChange, entries }: FilterProps) {
  const workspaceId = useWorkspaceId();
  const agents = useAgentsRoster(workspaceId);
  const activeAgentIds = new Set(
    entries.map((e) => e.agentId).filter((id): id is string => Boolean(id)),
  );
  const activeAgents = agents.filter((a) => activeAgentIds.has(a.id));

  return (
    <div className="flex items-center gap-1.5 overflow-x-auto border-b border-divider px-3.5 py-2">
      <Pill active={value === 'all'} onClick={() => onChange('all')}>
        All
      </Pill>
      {activeAgents.map((agent) => (
        <Pill
          key={agent.id}
          active={value === agent.id}
          onClick={() => onChange(agent.id)}
          hue={agent.hue}
        >
          {agent.name.split(' ')[0]}
        </Pill>
      ))}
    </div>
  );
}

function Pill({
  active,
  onClick,
  hue,
  children,
}: {
  active: boolean;
  onClick: () => void;
  hue?: number;
  children: React.ReactNode;
}) {
  const accentStyle =
    hue !== undefined && active
      ? ({
          background: `hsl(${hue}, 60%, 92%)`,
          color: `hsl(${hue}, 60%, 32%)`,
        } as React.CSSProperties)
      : undefined;
  return (
    <button
      type="button"
      onClick={onClick}
      style={accentStyle}
      className={cn(
        'inline-flex h-6 shrink-0 items-center whitespace-nowrap rounded-full px-2.5 text-xs transition-colors',
        active
          ? hue === undefined
            ? 'bg-accent-soft font-semibold text-accent'
            : 'font-semibold'
          : 'font-medium text-ink2 hover:bg-hover',
      )}
    >
      {children}
    </button>
  );
}
