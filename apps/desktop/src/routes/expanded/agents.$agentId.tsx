import { createRoute, useParams } from '@tanstack/react-router';
import { useMemo } from 'react';

import { AgentChatPanel } from '@/components/expanded/AgentChatPanel';
import { LeaderboardRailStub } from '@/components/expanded/LeaderboardRailStub';
import { TeamRail } from '@/components/expanded/TeamRail';
import { WindowShell } from '@/components/expanded/WindowShell';
import { useAgentStatus } from '@/lib/realtime/useAgentStatus';
import { useTaskEventsFeed } from '@/lib/realtime/useTaskEventsFeed';
import { useWorkspaceId } from '@/lib/session/SessionContext';
import { Route as ExpandedRootRoute } from './__root';

export const Route = createRoute({
  getParentRoute: () => ExpandedRootRoute,
  path: '/agents/$agentId',
  component: ExpandedAgentPage,
});

function ExpandedAgentPage() {
  const params = useParams({ strict: false }) as { agentId?: string };
  const workspaceId = useWorkspaceId();
  const agents = useAgentStatus(workspaceId);

  const selected = useMemo(() => {
    if (!params.agentId || params.agentId === '-') return agents[0] ?? null;
    return agents.find((a) => a.id === params.agentId) ?? agents[0] ?? null;
  }, [agents, params.agentId]);

  const taskId = selected?.currentTaskId ?? '';
  const { events } = useTaskEventsFeed(taskId);

  return (
    <WindowShell title="Robin" subtitle={selected ? `Chatting with ${selected.name}` : 'No agents yet'}>
      <div className="flex h-full">
        <TeamRail agents={agents} activeId={selected?.id ?? null} />
        {selected ? (
          <AgentChatPanel agent={selected} events={events} taskId={selected.currentTaskId} />
        ) : (
          <div className="flex flex-1 items-center justify-center text-sm text-ink3">
            Hire your first agent on the web to get started.
          </div>
        )}
        <LeaderboardRailStub />
      </div>
    </WindowShell>
  );
}
