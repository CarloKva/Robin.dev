# Schema Design

**Last updated:** 2026-02-26

---

## Overview

Robin.dev uses a shared PostgreSQL schema (via Supabase) with Row-Level Security for multi-tenant isolation. See [ADR-01](./adr/ADR-01-multitenancy.md) for the decision rationale.

---

## Conventions

- All primary keys are `uuid` generated via `gen_random_uuid()`
- All tables have `created_at timestamptz DEFAULT now() NOT NULL`
- All mutable tables have `updated_at timestamptz DEFAULT now() NOT NULL`
- Append-only tables (`task_events`) have no `updated_at`
- All tenant tables have `workspace_id uuid NOT NULL REFERENCES workspaces(id) ON DELETE CASCADE`
- `user_id` columns store Clerk user IDs (strings like `user_abc123`)

---

## Tables

### `workspaces`
Top-level tenant container.

| Column | Type | Notes |
|--------|------|-------|
| id | uuid | PK |
| name | text | Display name |
| slug | text | Unique, URL-safe identifier |
| created_at | timestamptz | |
| updated_at | timestamptz | |

### `workspace_members`
Maps Clerk users to workspaces with a role.

| Column | Type | Notes |
|--------|------|-------|
| id | uuid | PK |
| workspace_id | uuid | FK → workspaces |
| user_id | text | Clerk user ID |
| role | workspace_role | 'owner' \| 'member' |
| created_at | timestamptz | |
| updated_at | timestamptz | |

Unique constraint: `(workspace_id, user_id)`

### `agents`
AI agents that execute tasks.

| Column | Type | Notes |
|--------|------|-------|
| id | uuid | PK |
| workspace_id | uuid | FK → workspaces |
| name | text | Display name |
| type | text | Agent type identifier |
| created_at | timestamptz | |
| updated_at | timestamptz | |

### `agent_status`
Real-time status of each agent. 1:1 with `agents`. Separate table to reduce lock contention during frequent heartbeats.

| Column | Type | Notes |
|--------|------|-------|
| agent_id | uuid | PK, FK → agents |
| status | agent_status_enum | Current state |
| current_task_id | uuid | FK → tasks, nullable |
| last_heartbeat | timestamptz | |
| updated_at | timestamptz | |

### `tasks`
The central work unit. Moves through phases (status).

| Column | Type | Notes |
|--------|------|-------|
| id | uuid | PK |
| workspace_id | uuid | FK → workspaces |
| title | text | |
| description | text | |
| status | task_status | Current phase |
| priority | task_priority | |
| assigned_agent_id | uuid | FK → agents, nullable |
| created_by_user_id | text | Clerk user ID |
| created_at | timestamptz | |
| updated_at | timestamptz | |

### `task_artifacts`
Outputs created during task execution.

| Column | Type | Notes |
|--------|------|-------|
| id | uuid | PK |
| task_id | uuid | FK → tasks |
| workspace_id | uuid | FK → workspaces (for RLS) |
| type | artifact_type | pr \| commit \| deploy_preview \| test_report |
| url | text | |
| title | text | |
| created_at | timestamptz | |
| updated_at | timestamptz | |

### `task_events`
Append-only audit log. No UPDATE or DELETE allowed.

| Column | Type | Notes |
|--------|------|-------|
| id | uuid | PK |
| task_id | uuid | FK → tasks |
| workspace_id | uuid | FK → workspaces (for RLS) |
| event_type | task_event_type | What happened |
| actor_type | actor_type | 'agent' \| 'human' |
| actor_id | text | Agent ID or Clerk user ID |
| payload | jsonb | Event-specific data |
| created_at | timestamptz | |

---

## Indexes

All indexes created in `0001_initial_schema.sql`:

```sql
-- RLS performance indexes
CREATE INDEX ON workspace_members(user_id);
CREATE INDEX ON workspace_members(workspace_id);

-- Tenant isolation
CREATE INDEX ON agents(workspace_id);
CREATE INDEX ON tasks(workspace_id);
CREATE INDEX ON task_artifacts(workspace_id);
CREATE INDEX ON task_events(workspace_id);

-- Query patterns
CREATE INDEX ON tasks(assigned_agent_id);
CREATE INDEX ON tasks(status);
CREATE INDEX ON task_events(task_id);
CREATE INDEX ON task_artifacts(task_id);
```

---

## RLS Policy Pattern

```sql
-- Enable RLS
ALTER TABLE tasks ENABLE ROW LEVEL SECURITY;

-- Policies reference the helper function
CREATE POLICY "tasks_select" ON tasks
  FOR SELECT USING (workspace_id IN (SELECT get_my_workspace_ids()));

CREATE POLICY "tasks_insert" ON tasks
  FOR INSERT WITH CHECK (workspace_id IN (SELECT get_my_workspace_ids()));

CREATE POLICY "tasks_update" ON tasks
  FOR UPDATE USING (workspace_id IN (SELECT get_my_workspace_ids()));

CREATE POLICY "tasks_delete" ON tasks
  FOR DELETE USING (workspace_id IN (SELECT get_my_workspace_ids()));
```

`task_events` has SELECT + INSERT only (append-only — no UPDATE/DELETE policies).

---

## Migration Files

| File | Contents |
|------|----------|
| `supabase/migrations/0001_initial_schema.sql` | Enums, tables, indexes |
| `supabase/migrations/0002_rls_policies.sql` | Helper function + all policies |
| `supabase/seed.sql` | Dev seed data |
