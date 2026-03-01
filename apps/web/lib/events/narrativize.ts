import type { TaskEventType, EventPayloadMap } from "@robin/shared-types";

type NarrativizeInput = {
  event_type: TaskEventType;
  payload: Record<string, unknown>;
  actor_type: "agent" | "human";
  actor_id: string;
};

/**
 * Converts a raw task_event into a human-readable narrative string.
 * Used in the Timeline UI component.
 */
export function narrativize(event: NarrativizeInput): string {
  const { event_type, payload } = event;

  switch (event_type) {
    case "task.created": {
      const p = payload as EventPayloadMap["task.created"];
      return `Task "${p.title}" created with ${p.priority} priority`;
    }

    case "task.state.changed": {
      const p = payload as EventPayloadMap["task.state.changed"];
      const label: Record<string, string> = {
        pending: "Pending",
        queued: "Queued",
        in_progress: "In Progress",
        review_pending: "Review Pending",
        approved: "Approved",
        rejected: "Rejected",
        completed: "Completed",
        failed: "Failed",
        cancelled: "Cancelled",
      };
      const note = p.note ? ` — ${p.note}` : "";
      return `Status changed: ${label[p.from] ?? p.from} → ${label[p.to] ?? p.to}${note}`;
    }

    case "agent.phase.started": {
      const p = payload as EventPayloadMap["agent.phase.started"];
      const phaseLabel = capitalizePhase(p.phase);
      return `Agent started ${phaseLabel} phase`;
    }

    case "agent.phase.completed": {
      const p = payload as EventPayloadMap["agent.phase.completed"];
      const phaseLabel = capitalizePhase(p.phase);
      const duration = p.duration_seconds != null
        ? ` in ${formatDuration(p.duration_seconds)}`
        : "";
      return `Agent completed ${phaseLabel} phase${duration}`;
    }

    case "agent.commit.pushed": {
      const p = payload as EventPayloadMap["agent.commit.pushed"];
      const sha = p.commit_sha.slice(0, 7);
      const msg = p.message ? `: "${p.message}"` : "";
      return `Commit pushed (${sha} on ${p.branch})${msg}`;
    }

    case "agent.pr.opened": {
      const p = payload as EventPayloadMap["agent.pr.opened"];
      const num = p.pr_number != null ? ` #${p.pr_number}` : "";
      return `Pull Request${num} opened`;
    }

    case "agent.pr.updated": {
      const p = payload as EventPayloadMap["agent.pr.updated"];
      const num = p.pr_number != null ? ` #${p.pr_number}` : "";
      const status = p.status ? ` — ${p.status}` : "";
      return `Pull Request${num} updated${status}`;
    }

    case "agent.deploy.staging": {
      const p = payload as EventPayloadMap["agent.deploy.staging"];
      const statusLabel: Record<string, string> = {
        building: "building",
        ready: "ready",
        error: "failed",
      };
      return `Staging deploy ${statusLabel[p.deploy_status] ?? p.deploy_status}`;
    }

    case "agent.blocked": {
      const p = payload as EventPayloadMap["agent.blocked"];
      return `Agent blocked — needs input: "${p.question}"`;
    }

    case "human.approved": {
      const p = payload as EventPayloadMap["human.approved"];
      const comment = p.comment ? ` — "${p.comment}"` : "";
      return `Approved by reviewer${comment}`;
    }

    case "human.rejected": {
      const p = payload as EventPayloadMap["human.rejected"];
      const reason = p.reason ? ` — ${p.reason}` : "";
      return `Rejected by reviewer${reason}`;
    }

    case "human.commented": {
      const p = payload as EventPayloadMap["human.commented"];
      return `Comment: "${p.comment}"`;
    }

    case "task.completed": {
      const p = payload as EventPayloadMap["task.completed"];
      const duration = p.duration_seconds != null
        ? ` in ${formatDuration(p.duration_seconds)}`
        : "";
      return `Task completed${duration}`;
    }

    case "task.failed": {
      const p = payload as EventPayloadMap["task.failed"];
      return `Task failed: ${p.message} (${p.error_code})`;
    }

    case "task.pr_closed_without_merge": {
      const p = payload as EventPayloadMap["task.pr_closed_without_merge"];
      return `PR #${p.pr_number} chiusa senza merge — task tornata in review`;
    }

    default: {
      const exhaustive: never = event_type;
      return `Unknown event: ${exhaustive}`;
    }
  }
}

function capitalizePhase(phase: string): string {
  return phase.charAt(0).toUpperCase() + phase.slice(1);
}

function formatDuration(seconds: number): string {
  if (seconds < 60) return `${seconds}s`;
  const mins = Math.floor(seconds / 60);
  const secs = seconds % 60;
  return secs > 0 ? `${mins}m ${secs}s` : `${mins}m`;
}
