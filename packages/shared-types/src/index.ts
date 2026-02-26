// ---------------------------------------------------------------
// Database enums
// ---------------------------------------------------------------

export type WorkspaceRole = "owner" | "member";

export type TaskStatus =
  | "pending"
  | "queued"
  | "in_progress"
  | "review_pending"
  | "approved"
  | "rejected"
  | "completed"
  | "failed"
  | "cancelled";

export type TaskPriority = "low" | "medium" | "high" | "urgent";

export type AgentStatusEnum = "idle" | "busy" | "error" | "offline";

export type ArtifactType = "pr" | "commit" | "deploy_preview" | "test_report";

export type TaskEventType =
  | "task.created"
  | "task.state.changed"
  | "agent.phase.started"
  | "agent.phase.completed"
  | "agent.commit.pushed"
  | "agent.pr.opened"
  | "agent.blocked"
  | "human.approved"
  | "human.rejected"
  | "human.commented"
  | "task.completed"
  | "task.failed";

export type ActorType = "agent" | "human";

// ---------------------------------------------------------------
// Orchestrator types (Sprint 2)
// ---------------------------------------------------------------

export type TaskType = "bug" | "feature" | "docs" | "refactor" | "chore";

/** Internal agent state — more granular than AgentStatusEnum for orchestrator use */
export type AgentState =
  | "idle"
  | "claiming"
  | "executing"
  | "reporting"
  | "blocked"
  | "error";

/**
 * Payload passed from the BullMQ queue to ClaudeRunner.
 * Contains everything the agent needs — no further DB lookups during execution.
 */
export type JobPayload = {
  // Identity
  taskId: string;
  workspaceId: string;

  // Repository
  repositoryUrl: string;
  branch: string;
  repositoryPath: string;

  // Task specification
  taskTitle: string;
  taskDescription: string;
  taskType: TaskType;
  priority: TaskPriority;

  // Execution config
  timeoutMinutes: number;
  claudeMdPath: string;
};

/**
 * Returned by ClaudeRunner.run() on successful completion.
 */
export type JobResult = {
  status: "completed" | "in_review" | "blocked";

  prUrl?: string;
  prNumber?: number;
  commitSha?: string;
  commitBranch?: string;

  startedAt: string;
  completedAt: string;
  durationSeconds: number;

  blockedReason?: string;
  stdoutTail: string;
};

/**
 * Error codes for structured error handling.
 * `retryable` determines whether BullMQ retries the job.
 */
export type JobErrorCode =
  | "AGENT_TIMEOUT"
  | "API_RATE_LIMIT"
  | "NETWORK_ERROR"
  | "AGENT_BLOCKED"
  | "INSUFFICIENT_SPEC"
  | "REPO_ACCESS_ERROR";

// ---------------------------------------------------------------
// DB entity shape types (mirrors DB rows — non-exhaustive)
// ---------------------------------------------------------------

export type Workspace = {
  id: string;
  name: string;
  slug: string;
  created_at: string;
  updated_at: string;
};

export type WorkspaceMember = {
  id: string;
  workspace_id: string;
  user_id: string;
  role: WorkspaceRole;
  created_at: string;
  updated_at: string;
};

export type Task = {
  id: string;
  workspace_id: string;
  title: string;
  description: string;
  status: TaskStatus;
  priority: TaskPriority;
  assigned_agent_id: string | null;
  created_by_user_id: string;
  queued_at: string | null;
  created_at: string;
  updated_at: string;
};

export type TaskEvent = {
  id: string;
  task_id: string;
  workspace_id: string;
  event_type: TaskEventType;
  actor_type: ActorType;
  actor_id: string;
  payload: Record<string, unknown>;
  created_at: string;
};
