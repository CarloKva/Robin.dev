import { kindFor, type InboxKind } from './kindFor';

/**
 * Letter-shaped projection over a task + its event tail. Inputs are
 * deliberately loose-typed because the desktop client reads raw Supabase rows;
 * tighten once `projectLetter` moves into `packages/shared-types`.
 */

interface RepositoryEmbed {
  full_name?: string | null;
}

interface IterationEmbed {
  iteration_number?: number | null;
  status?: string | null;
  pr_url?: string | null;
  pr_number?: number | null;
  started_at?: string | null;
  completed_at?: string | null;
  summary?: string | null;
}

interface TaskRow {
  id: string;
  title: string;
  status: string;
  priority: string;
  assigned_agent_id: string | null;
  created_at: string | null;
  updated_at: string | null;
  repositories?: RepositoryEmbed | RepositoryEmbed[] | null;
  task_iterations?: IterationEmbed[] | null;
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

  const repo = pickRepo(task.repositories);
  const lastIter = pickLatestIteration(task.task_iterations);

  const failedEvent = [...events].reverse().find((e) => e.event_type === 'task.failed');
  const completedEvent = [...events].reverse().find((e) => e.event_type === 'task.completed');
  const failedPayload = (failedEvent?.payload ?? {}) as Record<string, unknown>;
  const completedPayload = (completedEvent?.payload ?? {}) as Record<string, unknown>;

  const prUrl = lastIter?.pr_url ?? null;
  const prNumber = lastIter?.pr_number ?? extractPrNumberFromUrl(prUrl);
  const errorMessage = (failedPayload['message'] as string | undefined) ?? null;

  const durationSeconds =
    (completedPayload['duration_seconds'] as number | undefined) ??
    (failedPayload['duration_seconds'] as number | undefined) ??
    diffSeconds(lastIter?.started_at, lastIter?.completed_at) ??
    null;

  const headline = task.title;
  const body = bodyFor({ kind, summary: lastIter?.summary ?? null, prNumber, errorMessage });
  const receivedAt =
    lastIter?.completed_at ??
    task.updated_at ??
    task.created_at ??
    new Date().toISOString();

  return {
    id: task.id,
    taskId: task.id,
    kind,
    headline,
    body,
    agentId: task.assigned_agent_id,
    repo,
    prUrl,
    prNumber,
    branch: null,
    errorMessage,
    durationSeconds,
    tokens: null,
    receivedAt,
    read: Boolean(readMap[task.id]) && readMap[task.id]! >= new Date(receivedAt).getTime(),
  };
}

function pickRepo(embed: TaskRow['repositories']): string | null {
  if (!embed) return null;
  if (Array.isArray(embed)) return embed[0]?.full_name ?? null;
  return embed.full_name ?? null;
}

function pickLatestIteration(iters: TaskRow['task_iterations']): IterationEmbed | null {
  if (!iters || iters.length === 0) return null;
  return [...iters].sort(
    (a, b) => (b.iteration_number ?? 0) - (a.iteration_number ?? 0),
  )[0] ?? null;
}

function extractPrNumberFromUrl(url: string | null): number | null {
  if (!url) return null;
  const m = url.match(/\/pull\/(\d+)/);
  return m ? Number(m[1]) : null;
}

function diffSeconds(start: string | null | undefined, end: string | null | undefined): number | null {
  if (!start || !end) return null;
  const ms = new Date(end).getTime() - new Date(start).getTime();
  return ms > 0 ? Math.round(ms / 1000) : null;
}

interface BodyContext {
  kind: InboxKind;
  summary: string | null;
  prNumber: number | null;
  errorMessage: string | null;
}

function bodyFor(ctx: BodyContext): string {
  if (ctx.summary && ctx.summary.trim().length > 0) {
    return ctx.summary;
  }
  switch (ctx.kind) {
    case 'shipped':
      return ctx.prNumber != null
        ? `I shipped this — PR #${ctx.prNumber} is open. Have a look when you can.`
        : 'I finished this work. Have a look when you can.';
    case 'review':
      return ctx.prNumber != null
        ? `Ready for your review — PR #${ctx.prNumber} is open.`
        : 'This is ready for your review.';
    case 'failed':
      return ctx.errorMessage
        ? `I hit a wall and stopped. Error: ${ctx.errorMessage}`
        : 'I hit a wall and stopped. Take a look when you have a moment.';
    case 'rejected':
      return 'You rejected the last attempt. Want me to try again or move on?';
  }
}
