# Spike 03: Domain Model — Entity Boundaries and ER Diagram

**Date:** 2026-02-26
**Author:** Carlo Ferrero

---

## Core Entities

### Workspace
The top-level tenant container. Everything belongs to a workspace.

```
workspace
├── id: uuid (PK)
├── name: text (e.g., "Acme Corp")
├── slug: text (unique, URL-safe, e.g., "acme-corp")
├── created_at: timestamptz
└── updated_at: timestamptz
```

### WorkspaceMember
Maps Clerk users to workspaces. The `user_id` is the Clerk user ID (string).

```
workspace_member
├── id: uuid (PK)
├── workspace_id: uuid (FK → workspace)
├── user_id: text (Clerk user ID)
├── role: workspace_role ('owner' | 'member')
├── created_at: timestamptz
└── updated_at: timestamptz
```

### User Profile (optional, future)
Extended user profile beyond what Clerk stores.

### Agent
An autonomous AI agent that executes tasks.

```
agent
├── id: uuid (PK)
├── workspace_id: uuid (FK → workspace)
├── name: text
├── type: text (e.g., 'developer', 'reviewer', 'tester')
├── created_at: timestamptz
└── updated_at: timestamptz
```

### AgentStatus
1:1 with Agent. Separate table to avoid lock contention on the agents table during frequent status updates.

```
agent_status
├── agent_id: uuid (PK, FK → agent)
├── status: agent_status_enum
├── current_task_id: uuid (FK → task, nullable)
├── last_heartbeat: timestamptz
└── updated_at: timestamptz
```

### Task
The central work unit. A task moves through phases, assigned to one agent.

```
task
├── id: uuid (PK)
├── workspace_id: uuid (FK → workspace)
├── title: text
├── description: text
├── status: task_status
├── priority: task_priority
├── assigned_agent_id: uuid (FK → agent, nullable)
├── created_by_user_id: text (Clerk user ID)
├── created_at: timestamptz
└── updated_at: timestamptz
```

### TaskArtifact
Outputs produced during task execution (PRs, commits, deploy previews, test reports).

```
task_artifact
├── id: uuid (PK)
├── task_id: uuid (FK → task)
├── workspace_id: uuid (FK → workspace, for RLS)
├── type: artifact_type
├── url: text
├── title: text
├── created_at: timestamptz
└── updated_at: timestamptz
```

### TaskEvent
Append-only audit log of everything that happens to a task.

```
task_event
├── id: uuid (PK)
├── task_id: uuid (FK → task)
├── workspace_id: uuid (FK → workspace, for RLS)
├── event_type: task_event_type
├── actor_type: actor_type
├── actor_id: text (agent_id or user_id)
├── payload: jsonb (event-specific data)
└── created_at: timestamptz
```

Note: No `updated_at` — events are immutable once written.

---

## ER Diagram (text)

```
workspace ──┬── workspace_member (user_id → Clerk)
            │
            ├── agent ── agent_status
            │
            ├── task ────┬── task_artifact
            │            └── task_event
            │
            └── (all tables carry workspace_id for RLS)
```

---

## Key Design Decisions

### Why `agent_status` is a separate table
The `agents` table stores relatively static data (name, type). Status changes very frequently — heartbeats every 30s, state transitions on every phase. Separating status avoids row-level lock contention and keeps `agents` queries fast.

### Why `task_events` is append-only
Task events are the audit trail. They must never be modified or deleted. This is enforced by:
1. No `updated_at` column (signals intent)
2. RLS policies: SELECT and INSERT only — no UPDATE or DELETE policies

### Why `workspace_id` on `task_artifacts` and `task_events`
These tables could join through `tasks` to get `workspace_id`, but adding `workspace_id` directly enables:
1. Simpler RLS policies (no subqueries through joins)
2. Faster RLS evaluation
3. Easier data partitioning in the future

### Task Status Flow

```
backlog → intake → analysis → planning → implementation → testing → documentation → review → deployment → reporting → completed
                                                                                                         ↘ failed
                                                                                              (any state) → blocked
```

---

## Enum Definitions Summary

| Enum | Values |
|------|--------|
| `workspace_role` | owner, member |
| `agent_status_enum` | idle, claiming, executing, reporting, error, offline |
| `task_status` | backlog, intake, analysis, planning, implementation, testing, documentation, review, deployment, reporting, completed, failed, blocked |
| `task_priority` | low, medium, high, critical |
| `artifact_type` | pr, commit, deploy_preview, test_report |
| `actor_type` | agent, human |
| `task_event_type` | task_created, task_state_changed, agent_phase_started, agent_phase_completed, agent_commit_pushed, agent_pr_opened, agent_blocked, human_approved, human_rejected, human_commented, task_completed, task_failed |
