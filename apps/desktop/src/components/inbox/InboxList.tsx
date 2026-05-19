import { useCallback } from 'react';

import { markRead } from '@/lib/storage/inboxRead';
import type { InboxLetter } from '@/lib/inbox/projectLetter';
import { InboxCard } from './InboxCard';

interface InboxListProps {
  letters: InboxLetter[];
}

export function InboxList({ letters }: InboxListProps) {
  const onMarkRead = useCallback((taskId: string) => {
    void markRead(taskId);
  }, []);

  return (
    <div className="flex flex-col gap-2 px-3 pb-3">
      {letters.map((letter) => (
        <InboxCard key={letter.id} letter={letter} onMarkRead={onMarkRead} />
      ))}
      <div className="px-1 py-3 text-center text-2xs text-ink4">
        That's everything from the last 7 days
      </div>
    </div>
  );
}
