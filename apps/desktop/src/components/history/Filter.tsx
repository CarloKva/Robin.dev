import { cn } from '@/lib/cn';
import type { HistoryEntry } from '@/lib/realtime/useHistoryFeed';
import { useAgentsRoster } from '@/lib/realtime/useAgentsRoster';
import { useWorkspaceId } from '@/lib/session/SessionContext';

interface FilterProps {
  value: 'all' | 'merges' | string;
  onChange: (next: 'all' | 'merges' | string) => void;
  entries: HistoryEntry[];
}

export function Filter({ value, onChange, entries }: FilterProps) {
  const workspaceId = useWorkspaceId();
  const agents = useAgentsRoster(workspaceId);
  const activeAgentIds = new Set(entries.map((e) => e.agentId).filter((id): id is string => Boolean(id)));
  const activeAgents = agents.filter((a) => activeAgentIds.has(a.id));

  return (
    <div className="flex gap-1 overflow-x-auto border-b border-divider px-3 py-2">
      <Pill active={value === 'all'} onClick={() => onChange('all')}>All</Pill>
      <Pill active={value === 'merges'} onClick={() => onChange('merges')}>Merges</Pill>
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
          background: `hsl(${hue}, 55%, 92%)`,
          color: `hsl(${hue}, 55%, 32%)`,
          borderColor: `hsl(${hue}, 55%, 75%)`,
        } as React.CSSProperties)
      : undefined;
  return (
    <button
      type="button"
      onClick={onClick}
      style={accentStyle}
      className={cn(
        'inline-flex h-6 shrink-0 items-center rounded-full border px-2.5 text-2xs font-medium transition-colors',
        active
          ? 'border-ink bg-ink text-popover'
          : 'border-border bg-panel text-ink2 hover:bg-hover',
      )}
    >
      {children}
    </button>
  );
}
