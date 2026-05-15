/**
 * Verbatim port of `apps/web/lib/db/projectTaskState.ts`.
 *
 * Promoting this to a shared package (e.g. `packages/projections`) is a v2
 * follow-up — duplicating it now keeps the desktop bundle decoupled from
 * server-only deps in the web app.
 */
import type {
  ADWPPhase,
  EventPayloadMap,
  TaskEvent,
  TaskEventType,
  TaskProjectedState,
  TaskStatus,
} from '@robin/shared-types';

export function projectTaskState(events: TaskEvent[]): TaskProjectedState {
  const initial: TaskProjectedState = {
    status: 'pending',
    currentPhase: null,
    prUrl: null,
    prData: null,
    deployData: null,
    commitSha: null,
    blockedReason: null,
    lastUpdated: events[0]?.created_at ?? new Date().toISOString(),
  };

  return events.reduce<TaskProjectedState>((state, event) => {
    const next: TaskProjectedState = { ...state, lastUpdated: event.created_at };

    switch (event.event_type as TaskEventType) {
      case 'task.state.changed': {
        const p = event.payload as EventPayloadMap['task.state.changed'];
        next.status = p.to as TaskStatus;
        break;
      }
      case 'agent.phase.started': {
        const p = event.payload as EventPayloadMap['agent.phase.started'];
        next.currentPhase = p.phase as ADWPPhase;
        break;
      }
      case 'agent.phase.completed': {
        next.currentPhase = null;
        break;
      }
      case 'agent.commit.pushed': {
        const p = event.payload as EventPayloadMap['agent.commit.pushed'];
        next.commitSha = p.commit_sha;
        break;
      }
      case 'agent.pr.opened': {
        const p = event.payload as EventPayloadMap['agent.pr.opened'];
        next.prUrl = p.pr_url;
        if (p.commit_sha) next.commitSha = p.commit_sha;
        next.prData = {
          pr_url: p.pr_url,
          status: 'open',
          ...(p.pr_number !== undefined && { pr_number: p.pr_number }),
          ...(p.title !== undefined && { title: p.title }),
          ...(p.branch !== undefined && { branch: p.branch }),
          ...(p.additions !== undefined && { additions: p.additions }),
          ...(p.deletions !== undefined && { deletions: p.deletions }),
          ...(p.changed_files !== undefined && { changed_files: p.changed_files }),
          ...(p.commits !== undefined && { commits: p.commits }),
        };
        break;
      }
      case 'agent.pr.updated': {
        const p = event.payload as EventPayloadMap['agent.pr.updated'];
        if (next.prData) {
          next.prData = {
            ...next.prData,
            pr_url: p.pr_url,
            ...(p.pr_number !== undefined && { pr_number: p.pr_number }),
            ...(p.status !== undefined && { status: p.status }),
            ...(p.additions !== undefined && { additions: p.additions }),
            ...(p.deletions !== undefined && { deletions: p.deletions }),
            ...(p.changed_files !== undefined && { changed_files: p.changed_files }),
          };
          next.prUrl = p.pr_url;
        }
        break;
      }
      case 'agent.deploy.staging': {
        const p = event.payload as EventPayloadMap['agent.deploy.staging'];
        next.deployData = {
          deploy_url: p.deploy_url,
          deploy_status: p.deploy_status,
          ...(p.error_message !== undefined && { error_message: p.error_message }),
        };
        break;
      }
      case 'agent.blocked': {
        const p = event.payload as EventPayloadMap['agent.blocked'];
        next.blockedReason = p.question;
        break;
      }
      case 'human.approved':
      case 'human.rejected': {
        next.blockedReason = null;
        break;
      }
      case 'task.completed': {
        next.status = 'completed';
        next.currentPhase = null;
        break;
      }
      case 'task.failed': {
        next.status = 'failed';
        next.currentPhase = null;
        break;
      }
      default:
        break;
    }

    return next;
  }, initial);
}
