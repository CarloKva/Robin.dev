import { apiFetch } from './client';

interface HumanCommentInput {
  taskId: string;
  comment: string;
}

export function postHumanComment({ taskId, comment }: HumanCommentInput): Promise<unknown> {
  return apiFetch(`/api/tasks/${taskId}/events`, {
    method: 'POST',
    body: JSON.stringify({ type: 'human.commented', payload: { comment } }),
  });
}
