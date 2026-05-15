import { useMemo } from 'react';

import { ChatBubble } from '@/components/primitives/ChatBubble';
import { ChatComposer } from '@/components/primitives/ChatComposer';
import type { TimelineEntry } from '@robin/shared-types';
import type { AgentWithStatus } from '@/lib/realtime/useAgentStatus';
import { postHumanComment } from '@/lib/api/tasks';

interface AgentChatPanelProps {
  agent: AgentWithStatus;
  events: TimelineEntry[];
  taskId: string | null;
}

/**
 * Per-agent chat surface. Reads `human.commented` events from the agent's
 * current task and posts new ones via `POST /api/tasks/[taskId]/events`. The
 * agent's response stream isn't surfaced from the orchestrator yet (see
 * spec §B.8) — completed events flow in via Realtime once the agent
 * acknowledges, but mid-stream tokens are not rendered.
 */
export function AgentChatPanel({ agent, events, taskId }: AgentChatPanelProps) {
  const messages = useMemo(() => events.filter((e) => isChattyEvent(e.event_type)), [events]);

  return (
    <section className="flex h-full min-w-0 flex-1 flex-col bg-bg">
      <header className="border-b border-divider bg-popover px-4 py-3">
        <p className="text-sm font-semibold text-ink">{agent.name}</p>
        <p className="text-2xs text-ink3">
          {agent.specialty?.join(' · ') || 'Engineer'}
        </p>
      </header>
      <div className="flex-1 overflow-y-auto px-4 py-4">
        {!taskId ? (
          <div className="mt-12 text-center text-sm text-ink3">
            {agent.name} isn&rsquo;t working on anything right now.
          </div>
        ) : messages.length === 0 ? (
          <div className="mt-12 text-center text-sm text-ink3">
            No conversation on this task yet.
          </div>
        ) : (
          <div className="flex flex-col gap-3">
            {messages.map((entry) => {
              const role = entry.actor_type === 'human' ? 'user' : 'agent';
              const payload = (entry.payload ?? {}) as Record<string, unknown>;
              const text = (payload['comment'] as string | undefined) ?? entry.narrative;
              return (
                <ChatBubble
                  key={entry.id}
                  role={role}
                  agentName={agent.name}
                  agentHue={agent.hue}
                  {...(agent.avatarUrl ? { agentAvatarUrl: agent.avatarUrl } : {})}
                  timestamp={formatTime(entry.created_at)}
                >
                  {text}
                </ChatBubble>
              );
            })}
          </div>
        )}
      </div>
      <div className="border-t border-divider bg-popover px-4 py-3">
        <ChatComposer
          placeholder={taskId ? `Message ${agent.name}…` : `${agent.name} is idle — start a task on the web first`}
          disabled={!taskId}
          agentHue={agent.hue}
          onSend={(value) => {
            if (!taskId) return;
            void postHumanComment({ taskId, comment: value }).catch((err) => {
              console.warn('postHumanComment failed', err);
            });
          }}
        />
      </div>
    </section>
  );
}

function isChattyEvent(eventType: TimelineEntry['event_type']): boolean {
  return (
    eventType === 'human.commented' ||
    eventType === 'human.approved' ||
    eventType === 'human.rejected' ||
    eventType === 'agent.blocked' ||
    eventType === 'agent.phase.completed' ||
    eventType === 'agent.pr.opened' ||
    eventType === 'task.completed' ||
    eventType === 'task.failed'
  );
}

function formatTime(iso: string): string {
  return new Date(iso).toLocaleTimeString(undefined, { hour: 'numeric', minute: '2-digit' });
}
