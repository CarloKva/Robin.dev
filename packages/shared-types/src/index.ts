// Workspace roles
export type WorkspaceRole = "owner" | "member";

// Task lifecycle statuses
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

// Task priorities
export type TaskPriority = "low" | "medium" | "high" | "urgent";

// Agent operational states
export type AgentStatusEnum = "idle" | "busy" | "error" | "offline";

// Types of artifacts agents produce
export type ArtifactType = "pr" | "commit" | "deploy_preview" | "test_report";

// Event types in the task audit log
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

// Who triggered an event
export type ActorType = "agent" | "human";

// ---------------------------------------------------------------
// Shared entity shape types (mirrors DB rows — non-exhaustive)
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
