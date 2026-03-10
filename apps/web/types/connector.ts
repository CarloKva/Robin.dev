// =============================================================================
// Robin.dev — KVA Room Connector types
// Contract-level types shared across all connector API routes.
// =============================================================================

// ---------------------------------------------------------------------------
// SSO
// ---------------------------------------------------------------------------

/** JWT payload emitted by the KVA SSO provider and verified by withKVAAuth. */
export type KVASSOPayload = {
  /** KVA-side user identifier (sub claim). */
  sub: string;
  email: string;
  name: string;
  role: "admin" | "member" | "viewer";
  /** Venture identifier — always "robin-dev" for this connector. */
  kvaVentureId: string;
  /** Optional: Robin Dev workspace UUID that this user belongs to. */
  workspaceId: string | undefined;
  /** JWT standard claims. */
  iat: number;
  exp: number;
};

/** Local DB record synced from SSO on first login. */
export type KVAConnectorUser = {
  id: string;
  kva_user_id: string;
  email: string;
  name: string;
  role: string;
  kva_venture_id: string;
  workspace_id: string | null;
  created_at: string;
  updated_at: string;
};

// ---------------------------------------------------------------------------
// Connector Manifest
// ---------------------------------------------------------------------------

export type ConnectorManifest = {
  id: "robin-dev";
  name: string;
  version: string;
  description: string;
  capabilities: string[];
  endpoints: {
    health: string;
    entities: string;
    actions: string;
    events: string;
  };
  widgetSlots: string[];
  authRequired: boolean;
  kvaRoomCompatible: boolean;
};

// ---------------------------------------------------------------------------
// Knowledge Object (KO-compatible entity)
// ---------------------------------------------------------------------------

export type KOEntityType = "Project" | "Agent" | "Session" | "Output" | "Investment";

export type KORelationType =
  | "SUPPORTS"
  | "DERIVES_FROM"
  | "ENABLES"
  | "SUPERSEDES"
  | "PRECEDES";

export type KORelation = {
  type: KORelationType;
  targetId: string;
  targetType: string;
};

export type KOEntityMetadata = {
  source: "robin-dev";
  createdAt: string;
  updatedAt: string;
  ownerId: string;
  tags: string[];
  status: string;
};

export type KOCompatibleEntity = {
  id: string;
  type: KOEntityType;
  title: string;
  /** Human-readable summary, max 500 chars, used for embedding. */
  summary: string;
  content: string | undefined;
  metadata: KOEntityMetadata;
  relations: KORelation[] | undefined;
};

export type EntitiesResponse = {
  data: KOCompatibleEntity[];
  cursor: string | null;
  total: number;
};

// ---------------------------------------------------------------------------
// Actions
// ---------------------------------------------------------------------------

export type ActionName =
  // Legacy actions (kept for backward compatibility)
  | "create_project"
  | "get_project_summary"
  | "run_agent"
  | "get_agent_output"
  // Task operations
  | "list_tasks"
  | "get_task"
  | "create_task"
  | "update_task"
  | "delete_task"
  // Sprint operations
  | "list_sprints"
  | "get_sprint"
  | "create_sprint"
  | "start_sprint"
  | "complete_sprint"
  // Agent operations
  | "list_agents"
  | "get_agent"
  // Repository operations
  | "list_repositories"
  // Task events
  | "get_task_events";

export type ActionRequest = {
  action: ActionName;
  params: Record<string, unknown>;
  requestedBy: string;
  sessionToken: string;
};

export type ActionResponse = {
  action: ActionName;
  success: boolean;
  data: unknown;
  error: string | undefined;
};

// ─── Legacy action param types ───────────────────────────────────────────────

export type CreateProjectParams = {
  title: string;
  description: string | undefined;
  priority: "low" | "medium" | "high" | "urgent" | undefined;
  repository_id: string | undefined;
};

export type GetProjectSummaryParams = {
  task_id: string;
};

export type RunAgentParams = {
  task_id: string;
  agent_id: string | undefined;
};

export type GetAgentOutputParams = {
  task_id: string;
};

// ─── Task param types ────────────────────────────────────────────────────────

export type ListTasksParams = {
  status?: string;
  repository_id?: string;
  sprint_id?: string;
  priority?: string;
  page?: number;
  pageSize?: number;
};

export type GetTaskParams = {
  task_id: string;
};

export type CreateTaskParams = {
  title: string;
  description?: string;
  priority?: "low" | "medium" | "high" | "urgent" | "critical";
  type?: "bug" | "feature" | "docs" | "refactor" | "chore" | "accessibility" | "security";
  repository_id?: string;
  sprint_id?: string;
  estimated_effort?: "xs" | "s" | "m" | "l";
};

export type UpdateTaskParams = {
  task_id: string;
  title?: string;
  description?: string;
  status?: string;
  priority?: string;
  type?: string;
  sprint_id?: string | null;
  estimated_effort?: string;
};

export type DeleteTaskParams = {
  task_id: string;
};

// ─── Sprint param types ──────────────────────────────────────────────────────

export type ListSprintsParams = {
  status?: "planning" | "active" | "completed" | "cancelled";
};

export type GetSprintParams = {
  sprint_id: string;
};

export type CreateSprintParams = {
  name: string;
  goal?: string;
};

export type StartSprintParams = {
  sprint_id: string;
};

export type CompleteSprintParams = {
  sprint_id: string;
};

// ─── Agent param types ───────────────────────────────────────────────────────

export type ListAgentsParams = Record<string, never>;

export type GetAgentParams = {
  agent_id: string;
};

// ─── Repository param types ──────────────────────────────────────────────────

export type ListRepositoriesParams = Record<string, never>;

// ─── Task events param types ─────────────────────────────────────────────────

export type GetTaskEventsParams = {
  task_id: string;
};

// ---------------------------------------------------------------------------
// Events
// ---------------------------------------------------------------------------

export type ConnectorEventType =
  | "project.created"
  | "agent.completed"
  | "output.ready";

export type ConnectorEvent = {
  event: ConnectorEventType;
  entityId: string;
  entityType: string;
  payload: Record<string, unknown>;
  timestamp: string;
  source: "robin-dev";
};

export type WebhookSubscription = {
  id: string;
  url: string;
  events: string[];
  active: boolean;
  created_at: string;
  updated_at: string;
};

export type SubscribeRequest = {
  url: string;
  events: ConnectorEventType[];
};

export type SubscribeResponse = {
  subscription: WebhookSubscription;
};

// ---------------------------------------------------------------------------
// Health
// ---------------------------------------------------------------------------

export type HealthResponse = {
  status: "ok" | "degraded";
  connector: "robin-dev";
  version: string;
  db: "connected" | "error";
  timestamp: string;
};
