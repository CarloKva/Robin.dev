import type { ReactNode } from 'react';

import { cn } from '@/lib/cn';
import { Avatar } from './Avatar';
import { RobinGlyph } from './RobinGlyph';

export type ChatRole = 'user' | 'robin' | 'agent';

interface ChatBubbleProps {
  role: ChatRole;
  children: ReactNode;
  agentName?: string;
  agentHue?: number;
  agentAvatarUrl?: string;
  timestamp?: string;
}

export function ChatBubble({
  role,
  children,
  agentName,
  agentHue,
  agentAvatarUrl,
  timestamp,
}: ChatBubbleProps) {
  if (role === 'user') {
    return (
      <div className="flex flex-col items-end gap-1">
        <div
          className={cn(
            'max-w-[85%] rounded-2xl rounded-br-md bg-ink px-3 py-2 text-sm text-popover',
          )}
        >
          {children}
        </div>
        {timestamp ? <span className="text-2xs text-ink3">{timestamp}</span> : null}
      </div>
    );
  }
  if (role === 'robin') {
    return (
      <div className="flex items-start gap-2">
        <span className="mt-0.5 flex h-6 w-6 shrink-0 items-center justify-center rounded-full bg-accent-soft text-accent">
          <RobinGlyph size={12} color="currentColor" />
        </span>
        <div className="max-w-[85%] rounded-2xl rounded-bl-md bg-accent-soft px-3 py-2 text-sm text-ink">
          {children}
        </div>
      </div>
    );
  }
  return (
    <div className="flex items-start gap-2">
      {agentName ? (
        <Avatar
          name={agentName}
          hue={agentHue ?? 16}
          size="sm"
          {...(agentAvatarUrl ? { src: agentAvatarUrl } : {})}
        />
      ) : null}
      <div className="max-w-[85%] rounded-2xl rounded-bl-md bg-panel px-3 py-2 text-sm text-ink">
        {children}
        {timestamp ? <div className="mt-1 text-2xs text-ink3">{timestamp}</div> : null}
      </div>
    </div>
  );
}
