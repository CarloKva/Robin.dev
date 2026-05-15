import { createRoute } from '@tanstack/react-router';
import { Inbox as InboxIcon } from 'lucide-react';

import { EmptyState } from '@/components/shell/EmptyState';
import { InboxList } from '@/components/inbox/InboxList';
import { useInboxFeed } from '@/lib/realtime/useInboxFeed';
import { useWorkspaceId } from '@/lib/session/SessionContext';
import { Route as PopoverLayoutRoute } from './__layout';

export const Route = createRoute({
  getParentRoute: () => PopoverLayoutRoute,
  path: '/inbox',
  component: InboxPage,
});

function InboxPage() {
  const workspaceId = useWorkspaceId();
  const { letters, loading } = useInboxFeed(workspaceId);

  if (loading) {
    return <div className="px-3 py-4 text-sm text-ink3">Loading inbox…</div>;
  }
  if (letters.length === 0) {
    return (
      <EmptyState
        icon={<InboxIcon size={28} />}
        title="Nothing here yet"
        body="When your engineers finish a task they'll mail you a letter. Hire your first agent on the web to get started."
        cta={{
          label: 'Open web ↗',
          onClick: () => {
            const base = import.meta.env['VITE_API_BASE_URL'] ?? 'https://app.robin.dev';
            window.open(`${base}/agents`, '_blank', 'noopener,noreferrer');
          },
        }}
      />
    );
  }

  return <InboxList letters={letters} />;
}
