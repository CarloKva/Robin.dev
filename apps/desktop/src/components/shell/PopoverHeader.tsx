import { Settings } from 'lucide-react';

import { AvatarStack } from '@/components/primitives/Avatar';
import { IconBtn } from '@/components/primitives/IconBtn';
import { LiveLabel } from '@/components/primitives/LiveDot';
import { cn } from '@/lib/cn';

interface PopoverHeaderProps {
  workspaceName: string;
  agents: Array<{ id: string; name: string; hue?: number; src?: string }>;
  connected?: boolean;
  onOpenSettings: () => void;
}

export function PopoverHeader({
  workspaceName,
  agents,
  connected = true,
  onOpenSettings,
}: PopoverHeaderProps) {
  return (
    <header className="flex items-center justify-between border-b border-divider px-3 py-2.5">
      <div className="flex items-center gap-2">
        <AvatarStack people={agents} max={4} />
        <div className="flex flex-col leading-tight">
          <span className="text-xs font-semibold text-ink">{workspaceName}</span>
          {connected ? (
            <LiveLabel>online</LiveLabel>
          ) : (
            <span
              className={cn(
                'inline-flex items-center gap-1.5 text-2xs font-medium text-danger',
              )}
            >
              <span className="h-1.5 w-1.5 rounded-full bg-danger" aria-hidden="true" />
              offline
            </span>
          )}
        </div>
      </div>
      <IconBtn label="Open settings" onClick={onOpenSettings}>
        <Settings size={14} />
      </IconBtn>
    </header>
  );
}
