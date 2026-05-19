import { Outlet, createRoute, useLocation, useNavigate, useRouter } from '@tanstack/react-router';

import { PopoverFooter } from '@/components/shell/PopoverFooter';
import { PopoverHeader } from '@/components/shell/PopoverHeader';
import { PopoverShell } from '@/components/shell/PopoverShell';
import { TabStrip } from '@/components/primitives/TabStrip';
import { useSession, useWorkspaceId } from '@/lib/session/SessionContext';
import { useAgentsRoster } from '@/lib/realtime/useAgentsRoster';
import { useUnreadCounts } from '@/lib/realtime/useUnreadCounts';
import { Route as RootRoute } from '../__root';

export const Route = createRoute({
  getParentRoute: () => RootRoute,
  path: '/popover',
  component: PopoverLayout,
});

function PopoverLayout() {
  return <PopoverShellWithChrome />;
}

function PopoverShellWithChrome() {
  const { session, loading, connection } = useSession();
  const navigate = useNavigate();
  const location = useLocation();
  const router = useRouter();
  const workspaceId = useWorkspaceId();
  const agents = useAgentsRoster(workspaceId);
  const counts = useUnreadCounts(workspaceId);

  if (loading) {
    return (
      <div className="flex h-full items-center justify-center bg-popover text-sm text-ink3">
        Loading…
      </div>
    );
  }

  if (!session) {
    // Soft redirect — child routes that need a session re-check on mount.
    if (!location.pathname.startsWith('/sign-in')) {
      void router.navigate({ to: '/sign-in' });
    }
    return null;
  }

  const activeTab = activeTabFromPath(location.pathname);

  return (
    <PopoverShell
      header={
        <>
          <PopoverHeader
            workspaceName={session.workspaceId ?? 'Workspace'}
            agents={agents}
            connected={connection === 'connected'}
            onOpenSettings={() =>
              navigate({ to: '/popover/settings' }).catch(() => undefined)
            }
          />
          {activeTab !== 'task' && activeTab !== 'settings' ? (
            <TabStrip
              tabs={[
                { id: 'inbox', label: 'Inbox', count: counts.inbox, urgent: counts.urgentInbox },
                { id: 'in-progress', label: 'In progress', count: counts.inProgress },
                { id: 'history', label: 'History' },
              ]}
              active={activeTab}
              onSelect={(id) => {
                if (id === 'inbox') void navigate({ to: '/popover/inbox' });
                if (id === 'in-progress') void navigate({ to: '/popover/in-progress' });
                if (id === 'history') void navigate({ to: '/popover/history' });
              }}
            />
          ) : null}
        </>
      }
      footer={
        <PopoverFooter
          left={<span>Robin v0.0.1</span>}
          right={
            <button
              type="button"
              className="text-2xs text-ink3 transition-colors hover:text-ink"
              onClick={() => {
                const base = import.meta.env['VITE_API_BASE_URL'] ?? 'https://app.robin.dev';
                window.open(base, '_blank', 'noopener,noreferrer');
              }}
            >
              Open web ↗
            </button>
          }
        />
      }
    >
      <Outlet />
    </PopoverShell>
  );
}

function activeTabFromPath(pathname: string): 'inbox' | 'in-progress' | 'history' | 'task' | 'settings' {
  if (pathname.startsWith('/popover/in-progress')) return 'in-progress';
  if (pathname.startsWith('/popover/history')) return 'history';
  if (pathname.startsWith('/popover/task')) return 'task';
  if (pathname.startsWith('/popover/settings')) return 'settings';
  return 'inbox';
}
