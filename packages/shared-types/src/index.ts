// ---------------------------------------------------------------
// Database enums
// ---------------------------------------------------------------

export type WorkspaceRole = "owner" | "member";

export type TaskStatus =
  | "backlog"
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
  | "agent.pr.updated"
  | "agent.deploy.staging"
  | "agent.blocked"
  | "human.approved"
  | "human.rejected"
  | "human.commented"
  | "task.completed"
  | "task.failed";

export type ActorType = "agent" | "human";

// ---------------------------------------------------------------
// Sprint 3 — Event sourcing types
// ---------------------------------------------------------------

/**
 * Phases of the ADWP agent work cycle:
 * Analysis → Design → Write → Proof
 */
export type ADWPPhase = "analysis" | "design" | "write" | "proof";

/**
 * Discriminated union: maps each event_type to its strongly-typed payload shape.
 * Use for type-safe payload access in TypeScript projections and UI components.
 */
export type EventPayloadMap = {
  "task.created": {
    title: string;
    description: string;
    priority: TaskPriority;
  };
  "task.state.changed": {
    from: TaskStatus;
    to: TaskStatus;
    note?: string;
  };
  "agent.phase.started": {
    phase: ADWPPhase | string;
  };
  "agent.phase.completed": {
    phase: ADWPPhase | string;
    duration_seconds?: number;
  };
  "agent.commit.pushed": {
    commit_sha: string;
    branch: string;
    message?: string;
    additions?: number;
    deletions?: number;
  };
  "agent.pr.opened": {
    pr_url: string;
    pr_number?: number;
    title?: string;
    branch?: string;
    commit_sha?: string;
    additions?: number;
    deletions?: number;
    changed_files?: number;
    commits?: number;
  };
  "agent.pr.updated": {
    pr_url: string;
    pr_number?: number;
    /** New status of the PR */
    status?: "open" | "merged" | "closed" | "draft";
    additions?: number;
    deletions?: number;
    changed_files?: number;
  };
  "agent.deploy.staging": {
    deploy_url: string;
    deploy_status: "building" | "ready" | "error";
    error_message?: string;
  };
  "agent.blocked": {
    question: string;
  };
  "human.approved": {
    comment?: string;
  };
  "human.rejected": {
    reason?: string;
  };
  "human.commented": {
    comment: string;
  };
  "task.completed": {
    duration_seconds?: number;
  };
  "task.failed": {
    error_code: string;
    message: string;
  };
};

/**
 * Projected state calculated from the full event stream of a task.
 * Computed by `projectTaskState()` in `apps/web/lib/db/events.ts`.
 */
export type PRData = {
  pr_url: string;
  pr_number?: number;
  title?: string;
  branch?: string;
  additions?: number;
  deletions?: number;
  changed_files?: number;
  commits?: number;
  /** Derived from events — open by default, updated by agent.pr.updated */
  status: "open" | "merged" | "closed" | "draft";
};

export type DeployData = {
  deploy_url: string;
  deploy_status: "building" | "ready" | "error";
  error_message?: string;
};

export type TaskProjectedState = {
  status: TaskStatus;
  currentPhase: ADWPPhase | null;
  prUrl: string | null;
  prData: PRData | null;
  deployData: DeployData | null;
  commitSha: string | null;
  blockedReason: string | null;
  lastUpdated: string;
};

/**
 * A single event enriched with a human-readable narrative string.
 * Used in the timeline UI component.
 */
export type TimelineEntry = {
  id: string;
  event_type: TaskEventType;
  actor_type: ActorType;
  actor_id: string;
  payload: Record<string, unknown>;
  created_at: string;
  narrative: string;
};

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
  agentId: string;

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
  type: TaskType;
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

export type Agent = {
  id: string;
  workspace_id: string;
  name: string;
  type: string;
  slug: string | null;
  github_account: string | null;
  vps_ip: string | null;
  vps_region: string | null;
  last_seen_at: string | null;
  orchestrator_version: string | null;
  claude_code_version: string | null;
  created_at: string;
  updated_at: string;
};

/** Agent row joined with live status from agents_with_status view */
export type AgentWithStatus = Agent & {
  effective_status: AgentStatusEnum;
  raw_status: AgentStatusEnum | null;
  current_task_id: string | null;
  last_heartbeat: string | null;
};
