export type InboxKind = 'shipped' | 'review' | 'failed' | 'rejected';

interface EventRow {
  event_type: string;
}

export function kindFor(status: string, events: EventRow[]): InboxKind | null {
  if (status === 'completed') {
    const merged = events.some(
      (e) => e.event_type === 'agent.pr.updated' || e.event_type === 'task.completed',
    );
    return merged ? 'shipped' : 'shipped';
  }
  if (status === 'failed') return 'failed';
  if (status === 'rejected') return 'rejected';
  if (status === 'review_pending' || status === 'in_review') return 'review';
  return null;
}
