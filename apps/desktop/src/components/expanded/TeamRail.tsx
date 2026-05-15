import { useNavigate } from '@tanstack/react-router';

import { Avatar } from '@/components/primitives/Avatar';
import { StatusBadge } from '@/components/primitives/StatusBadge';
import { cn } from '@/lib/cn';
import type { AgentWithStatus } from '@/lib/realtime/useAgentStatus';

interface TeamRailProps {
  agents: AgentWithStatus[];
  activeId: string | null;
}

/**
 * Left rail of the expanded window. Sort policy (Open question B.9):
 * working > available > onboarding > off, then by name. v1 doesn't honour
 * "most-recently-active first" yet — we leave that as a small follow-up so
 * the founder can confirm the ordering.
 */
export function TeamRail({ agents, activeId }: TeamRailProps) {
  const navigate = useNavigate();
  const sorted = [...agents].sort(byStatusThenName);

  return (
    <aside className="flex h-full w-64 shrink-0 flex-col border-r border-divider bg-popover">
      <div className="border-b border-divider px-4 py-3 text-xs font-semibold text-ink">Team</div>
      <ul className="flex-1 overflow-y-auto py-1">
        {sorted.map((agent) => {
          const isActive = agent.id === activeId;
          return (
            <li key={agent.id}>
              <button
                type="button"
                onClick={() => navigate({ to: '/expanded/agents/$agentId', params: { agentId: agent.id } })}
                className={cn(
                  'flex w-full items-center gap-2 px-3 py-2 text-left text-xs transition-colors',
                  isActive ? 'bg-hover' : 'hover:bg-hover',
                )}
                style={
                  isActive
                    ? {
                        borderLeft: `3px solid hsl(${agent.hue}, 60%, 50%)`,
                        paddingLeft: 9,
                      }
                    : undefined
                }
              >
                <Avatar
                  name={agent.name}
                  hue={agent.hue}
                  size="sm"
                  status={agent.effectiveStatus === 'busy' ? 'working' : agent.effectiveStatus}
                  {...(agent.avatarUrl ? { src: agent.avatarUrl } : {})}
                />
                <div className="min-w-0 flex-1">
                  <p className="truncate font-medium text-ink">{agent.name}</p>
                  <p className="truncate text-2xs text-ink3">
                    {agent.specialty?.[0] ?? 'engineer'}
                  </p>
                </div>
                <StatusBadge kind={statusKind(agent.effectiveStatus)} mini />
              </button>
            </li>
          );
        })}
      </ul>
    </aside>
  );
}

function byStatusThenName(a: AgentWithStatus, b: AgentWithStatus): number {
  return rank(a.effectiveStatus) - rank(b.effectiveStatus) || a.name.localeCompare(b.name);
}

function rank(status: AgentWithStatus['effectiveStatus']): number {
  switch (status) {
    case 'busy':
      return 0;
    case 'idle':
      return 1;
    case 'error':
      return 2;
    case 'offline':
      return 3;
    default:
      return 4;
  }
}

function statusKind(status: AgentWithStatus['effectiveStatus']): string {
  switch (status) {
    case 'busy':
      return 'working';
    case 'idle':
      return 'available';
    case 'error':
      return 'blocked';
    case 'offline':
      return 'off';
    default:
      return 'available';
  }
}
