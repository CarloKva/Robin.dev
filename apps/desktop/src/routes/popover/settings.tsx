import { createRoute, useNavigate } from '@tanstack/react-router';
import { ChevronLeft } from 'lucide-react';

import { IconBtn } from '@/components/primitives/IconBtn';
import { SettingsDrawer } from '@/components/settings-drawer/SettingsDrawer';
import { useWorkspaceId } from '@/lib/session/SessionContext';
import { showExpandedAtGithub } from '@/lib/expanded/openWindow';
import { Route as PopoverLayoutRoute } from './__layout';

export const Route = createRoute({
  getParentRoute: () => PopoverLayoutRoute,
  path: '/settings',
  component: SettingsPage,
});

function SettingsPage() {
  const navigate = useNavigate();
  const workspaceId = useWorkspaceId();

  return (
    <div className="flex h-full flex-col">
      <div className="flex items-center gap-1.5 border-b border-divider px-2 py-2">
        <IconBtn label="Back" onClick={() => navigate({ to: '/popover/inbox' })}>
          <ChevronLeft size={14} />
        </IconBtn>
        <span className="text-xs font-semibold text-ink">Settings</span>
      </div>
      <SettingsDrawer
        workspaceId={workspaceId}
        onOpenGithub={() => {
          void showExpandedAtGithub();
        }}
      />
    </div>
  );
}
