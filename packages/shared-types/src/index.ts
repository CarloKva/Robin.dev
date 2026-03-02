// ---------------------------------------------------------------
// Database enums
// ---------------------------------------------------------------

export type WorkspaceRole = "owner" | "member";

export type TaskStatus =
  | "backlog"
  | "sprint_ready"
  | "pending"
  | "queued"
  | "in_progress"
  | "in_review"
  | "rework"
  | "review_pending"
  | "approved"
  | "rejected"
  | "done"
  | "completed"
  | "failed"
  | "cancelled";

export type TaskPriority = "low" | "medium" | "high" | "urgent" | "critical";

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
  | "task.failed"
  | "task.pr_closed_without_merge"
  | "user.task.created"
  | "user.task.updated"
  | "user.task.deleted"
  | "user.rework.initiated";

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
    iteration_number?: number;
  };
  "task.failed": {
    error_code: string;
    message: string;
  };
  "task.pr_closed_without_merge": {
    pr_number: number;
    iteration_number: number;
  };
  "user.task.created": {
    title: string;
    description?: string;
    priority?: string;
    type?: string;
  };
  "user.task.updated": {
    before: Record<string, unknown>;
    after: Record<string, unknown>;
  };
  "user.task.deleted": {
    task_id: string;
    title?: string;
  };
  "user.rework.initiated": {
    reason?: string;
    iteration_number?: number;
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

export type TaskType = "bug" | "feature" | "docs" | "refactor" | "chore" | "accessibility" | "security";

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
  preferred_agent_id: string | null;
  sprint_id: string | null;
  repository_id: string | null;
  sprint_order: number | null;
  context: string | null;
  estimated_effort: "xs" | "s" | "m" | "l" | null;
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
  avatar_url: string | null;
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

// ---------------------------------------------------------------
// Sprint A — GitHub integration + Agent provisioning types
// ---------------------------------------------------------------

export type AgentProvisioningStatus =
  | "pending"
  | "provisioning"
  | "online"
  | "error"
  | "deprovisioning"
  | "deprovisioned";

/** GitHub App connection for a workspace */
export type GitHubConnection = {
  id: string;
  workspace_id: string;
  installation_id: number;
  github_account_id: number;
  github_account_login: string;
  github_account_type: "User" | "Organization";
  status: "connected" | "revoked" | "suspended";
  connected_at: string;
  last_validated_at: string | null;
  created_at: string;
  updated_at: string;
};

/** Repository enabled by the founder for Robin.dev agents */
export type Repository = {
  id: string;
  workspace_id: string;
  github_repo_id: number;
  full_name: string;          // e.g. "acme/frontend"
  default_branch: string;
  is_private: boolean;
  is_enabled: boolean;
  is_available: boolean;
  last_synced_at: string | null;
  created_at: string;
  updated_at: string;
};

/** Many-to-many between agents and repositories */
export type AgentRepository = {
  id: string;
  agent_id: string;
  repository_id: string;
  assigned_at: string;
};

/** Agent enriched with provisioning state and assigned repos */
export type AgentWithProvisioning = Agent & {
  provisioning_status: AgentProvisioningStatus;
  vps_id: number | null;
  vps_created_at: string | null;
  provisioned_at: string | null;
  provisioning_error: string | null;
  repositories: Pick<Repository, "id" | "full_name" | "default_branch">[];
};

/** Payload for agent-provisioning BullMQ job */
export type AgentProvisioningJobPayload = {
  agentId: string;
  workspaceId: string;
};

/** Payload for agent-deprovisioning BullMQ job */
export type AgentDeprovisioningJobPayload = {
  agentId: string;
  workspaceId: string;
  vpsId: number | null;
};

// ---------------------------------------------------------------
// Sprint B — Sprint management + Backlog types
// ---------------------------------------------------------------

export type SprintStatus = "planning" | "active" | "completed" | "cancelled";

export type EstimatedEffort = "xs" | "s" | "m" | "l";

export type Sprint = {
  id: string;
  workspace_id: string;
  name: string;
  goal: string | null;
  status: SprintStatus;
  started_at: string | null;
  completed_at: string | null;
  tasks_completed: number;
  tasks_failed: number;
  tasks_moved_back: number;
  avg_cycle_time_minutes: number | null;
  created_at: string;
  updated_at: string;
};

/** Sprint enriched with its tasks (used in planning and active views) */
export type SprintWithTasks = Sprint & {
  tasks: Task[];
};

export type TaskTemplate = {
  id: string;
  workspace_id: string;
  task_type: TaskType;
  template_body: string;
  is_default: boolean;
  created_at: string;
  updated_at: string;
};

export type WorkspaceSettings = {
  workspace_id: string;
  notify_email: string | null;
  notify_slack_webhook: string | null;
  created_at: string;
  updated_at: string;
};

/** Payload for sprint execution job in BullMQ (one job per repo queue) */
export type RepoQueueJobPayload = {
  taskId: string;
  workspaceId: string;
  repositoryId: string;
  sprintId: string;
  sprintOrder: number;
};

// ---------------------------------------------------------------
// Task iterations — history of execution attempts
// ---------------------------------------------------------------

export type IterationTrigger = "original" | "github_rework" | "dashboard_rework";

export type IterationStatus = "pending" | "running" | "completed" | "failed";

export type TaskIteration = {
  id: string;
  task_id: string;
  workspace_id: string;
  iteration_number: number;
  trigger: IterationTrigger;
  status: IterationStatus;
  started_at: string | null;
  completed_at: string | null;
  pr_url: string | null;
  summary: string | null;
  created_at: string;
  updated_at: string;
};

/** Default task description templates (seeded per-workspace on creation) */
export const DEFAULT_TASK_TEMPLATES: Record<TaskType, string> = {
  bug: `## Comportamento attuale\n[Descrivi cosa succede]\n\n## Comportamento atteso\n[Descrivi cosa dovrebbe succedere]\n\n## Passi per riprodurre\n1. ...\n\n## Contesto aggiuntivo\n[Screenshot, log, URL...]`,
  feature: `## Obiettivo\n[Descrivi la funzionalità da implementare]\n\n## Comportamento atteso\n[Come deve funzionare una volta implementata]\n\n## Criteri di accettazione\n- [ ] ...\n\n## Note tecniche\n[Dettagli implementativi, librerie, vincoli...]`,
  refactor: `## Motivazione\n[Perché è necessario il refactoring]\n\n## Scope\n[Quali file/moduli sono coinvolti]\n\n## Obiettivo finale\n[Come deve apparire il codice dopo]\n\n## Rischi\n[Cosa potrebbe rompersi]`,
  accessibility: `## Problema di accessibilità\n[Descrivi il problema (WCAG, screen reader, keyboard nav...)]\n\n## Componenti coinvolti\n[Lista dei componenti/pagine]\n\n## Standard di riferimento\n[WCAG 2.1 AA, ARIA...]\n\n## Criteri di accettazione\n- [ ] ...`,
  security: `## Vulnerabilità\n[Descrivi la vulnerabilità (OWASP category, CVE se nota...)]\n\n## Impatto\n[Cosa può essere compromesso]\n\n## Fix proposto\n[Soluzione tecnica]\n\n## Test di verifica\n[Come verificare che il fix funzioni]`,
  chore: `## Task\n[Descrivi cosa deve essere fatto]\n\n## Motivazione\n[Perché è necessario]\n\n## Definizione di fatto\n- [ ] ...`,
  docs: `## Documentazione da aggiornare\n[Quale doc / file README / ADR]\n\n## Contenuto richiesto\n[Cosa deve essere documentato]\n\n## Audience\n[A chi è rivolta la documentazione]`,
};
