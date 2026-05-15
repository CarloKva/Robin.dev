import { kindFor, type InboxKind } from './kindFor';

/**
 * Letter-shaped projection over a task + its event tail. v1 emits a literal
 * headline (the task title) and a templated body — true AI summarisation is
 * deferred (§Phase 2.2). Inputs are deliberately loose-typed because the
 * desktop client reads raw Supabase rows; tighten once `projectLetter` moves
 * into `packages/shared-types`.
 */

interface TaskRow {
  id: string;
  title: string;
  status: string;
  priority: string;
  assigned_agent_id: string | null;
  repo_full_name: string | null;
  created_at: string | null;
  updated_at: string | null;
  completed_at: string | null;
  failed_at: string | null;
}

interface EventRow {
  id: string;
  task_id: string;
  event_type: string;
  payload: Record<string, unknown> | null;
  created_at: string;
}

export interface InboxLetter {
  id: string;
  taskId: string;
  kind: InboxKind;
  headline: string;
  body: string;
  agentId: string | null;
  repo: string | null;
  prUrl: string | null;
  prNumber: number | null;
  branch: string | null;
  errorMessage: string | null;
  durationSeconds: number | null;
  tokens: number | null;
  receivedAt: string;
  read: boolean;
}

export function projectLetter(
  task: TaskRow,
  events: EventRow[],
  readMap: Record<string, number>,
): InboxLetter | null {
  const kind = kindFor(task.status, events);
  if (!kind) return null;

  const prEvent = [...events].reverse().find((e) =>
    e.event_type === 'agent.pr.opened' || e.event_type === 'agent.pr.updated',
  );
  const failedEvent = [...events].reverse().find((e) => e.event_type === 'task.failed');
  const completedEvent = [...events].reverse().find((e) => e.event_type === 'task.completed');
  const commitEvent = [...events].reverse().find((e) => e.event_type === 'agent.commit.pushed');

  const prPayload = (prEvent?.payload ?? {}) as Record<string, unknown>;
  const failedPayload = (failedEvent?.payload ?? {}) as Record<string, unknown>;
  const completedPayload = (completedEvent?.payload ?? {}) as Record<string, unknown>;

  const prUrl = (prPayload['pr_url'] as string | undefined) ?? null;
  const prNumber = (prPayload['pr_number'] as number | undefined) ?? null;
  const branch =
    (prPayload['branch'] as string | undefined) ??
    ((commitEvent?.payload as Record<string, unknown> | undefined)?.['branch'] as string | undefined) ??
    null;
  const errorMessage = (failedPayload['message'] as string | undefined) ?? null;
  const durationSeconds =
    (completedPayload['duration_seconds'] as number | undefined) ??
    (failedPayload['duration_seconds'] as number | undefined) ??
    null;
  const tokens =
    (completedPayload['tokens_used'] as number | undefined) ??
    (completedPayload['tokens'] as number | undefined) ??
    null;

  const headline = task.title;
  const body = bodyFor({ kind, task, prUrl, prNumber, branch, errorMessage });
  const receivedAt =
    task.completed_at ?? task.failed_at ?? task.updated_at ?? task.created_at ?? new Date().toISOString();

  return {
    id: task.id,
    taskId: task.id,
    kind,
    headline,
    body,
    agentId: task.assigned_agent_id,
    repo: task.repo_full_name,
    prUrl,
    prNumber,
    branch,
    errorMessage,
    durationSeconds,
    tokens,
    receivedAt,
    read: Boolean(readMap[task.id]) && readMap[task.id]! >= new Date(receivedAt).getTime(),
  };
}

interface BodyContext {
  kind: InboxKind;
  task: TaskRow;
  prUrl: string | null;
  prNumber: number | null;
  branch: string | null;
  errorMessage: string | null;
}

function bodyFor(ctx: BodyContext): string {
  switch (ctx.kind) {
    case 'shipped':
      if (ctx.prNumber != null) {
        return `I shipped this — PR #${ctx.prNumber} is open${ctx.branch ? ` on \`${ctx.branch}\`` : ''}. Have a look when you can.`;
      }
      return 'I finished this work. Have a look when you can.';
    case 'review':
      return 'This is ready for your review. Approve or reject when you have a moment.';
    case 'failed':
      return ctx.errorMessage
        ? `I hit a wall and stopped. Error: ${ctx.errorMessage}`
        : 'I hit a wall and stopped. Take a look when you have a moment.';
    case 'rejected':
      return 'You rejected the last attempt. Want me to try again or move on?';
  }
}
