import { createRoute } from '@tanstack/react-router';
import { Inbox as InboxIcon } from 'lucide-react';
import { useCallback, useMemo } from 'react';

import { Btn } from '@/components/primitives/Btn';
import { EmptyState } from '@/components/shell/EmptyState';
import { InboxList } from '@/components/inbox/InboxList';
import { usePopoverFooterLeft } from '@/lib/popover/footerSlot';
import { useInboxFeed } from '@/lib/realtime/useInboxFeed';
import { useWorkspaceId } from '@/lib/session/SessionContext';
import { markAllRead } from '@/lib/storage/inboxRead';
import { Route as PopoverLayoutRoute } from './__layout';

export const Route = createRoute({
  getParentRoute: () => PopoverLayoutRoute,
  path: '/inbox',
  component: InboxPage,
});

function InboxPage() {
  const workspaceId = useWorkspaceId();
  const { letters, loading, refresh } = useInboxFeed(workspaceId);
  const unread = letters.filter((l) => !l.read).length;

  const handleMarkAll = useCallback(async () => {
    if (letters.length === 0) return;
    await markAllRead(letters.map((l) => l.taskId));
    void refresh();
  }, [letters, refresh]);

  const footerLeft = useMemo(
    () =>
      unread > 0 ? (
        <Btn variant="ghost" size="sm" onClick={handleMarkAll}>
          Mark all read
        </Btn>
      ) : null,
    [unread, handleMarkAll],
  );
  usePopoverFooterLeft(footerLeft);

  if (loading) {
    return <div className="px-4 py-6 text-sm text-ink3">Loading inbox…</div>;
  }

  if (letters.length === 0) {
    return (
      <>
        <Greeting unread={0} />
        <EmptyState
          icon={<InboxIcon size={28} />}
          title="You're caught up"
          body="When your engineers finish a task they'll mail you a letter here. Hire your first agent on the web to get started."
          cta={{
            label: 'Open web ↗',
            onClick: () => {
              const base = import.meta.env['VITE_API_BASE_URL'] ?? 'https://app.robin.dev';
              window.open(`${base}/agents`, '_blank', 'noopener,noreferrer');
            },
          }}
        />
      </>
    );
  }

  return (
    <>
      <Greeting unread={unread} />
      <InboxList letters={letters} />
    </>
  );
}

function Greeting({ unread }: { unread: number }) {
  return (
    <div className="px-4 pb-1.5 pt-3.5">
      <div className="mb-1 text-2xs font-medium text-ink3">Back to work.</div>
      <div className="text-lg font-semibold tracking-tight text-ink">Inbox</div>
      <p className="mt-1 text-xs leading-snug text-ink3">
        {unread > 0 ? (
          <>
            <b className="font-semibold text-ink2">{unread} new</b> from your team.
          </>
        ) : (
          <>You're caught up.</>
        )}
      </p>
    </div>
  );
}
