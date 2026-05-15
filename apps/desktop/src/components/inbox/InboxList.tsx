import { useCallback } from 'react';

import { Btn } from '@/components/primitives/Btn';
import { SectionHeader } from '@/components/primitives/SectionHeader';
import { markAllRead, markRead } from '@/lib/storage/inboxRead';
import type { InboxLetter } from '@/lib/inbox/projectLetter';
import { InboxCard } from './InboxCard';

interface InboxListProps {
  letters: InboxLetter[];
}

export function InboxList({ letters }: InboxListProps) {
  const unreadCount = letters.filter((l) => !l.read).length;
  const onMarkRead = useCallback((taskId: string) => {
    void markRead(taskId);
  }, []);
  const onMarkAll = useCallback(() => {
    void markAllRead(letters.map((l) => l.taskId));
  }, [letters]);

  return (
    <div className="py-2">
      <SectionHeader
        right={
          unreadCount > 0 ? (
            <Btn variant="ghost" size="sm" onClick={onMarkAll}>
              Mark all read
            </Btn>
          ) : null
        }
      >
        {unreadCount > 0 ? `${unreadCount} unread` : 'Inbox'}
      </SectionHeader>
      {letters.map((letter) => (
        <InboxCard key={letter.id} letter={letter} onMarkRead={onMarkRead} />
      ))}
    </div>
  );
}
