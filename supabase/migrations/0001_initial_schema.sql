-- =============================================================================
-- Robin.dev — Initial Schema
-- Migration: 0001_initial_schema.sql
-- =============================================================================

-- -------------------------
-- Enums
-- -------------------------

CREATE TYPE workspace_role AS ENUM ('owner', 'member');

CREATE TYPE agent_status_enum AS ENUM ('idle', 'busy', 'error', 'offline');

CREATE TYPE task_status AS ENUM (
  'pending',
  'queued',
  'in_progress',
  'review_pending',
  'approved',
  'rejected',
  'completed',
  'failed',
  'cancelled'
);

CREATE TYPE task_priority AS ENUM ('low', 'medium', 'high', 'urgent');

CREATE TYPE artifact_type AS ENUM ('pr', 'commit', 'deploy_preview', 'test_report');

CREATE TYPE task_event_type AS ENUM (
  'task.created',
  'task.state.changed',
  'agent.phase.started',
  'agent.phase.completed',
  'agent.commit.pushed',
  'agent.pr.opened',
  'agent.blocked',
  'human.approved',
  'human.rejected',
  'human.commented',
  'task.completed',
  'task.failed'
);

CREATE TYPE actor_type AS ENUM ('agent', 'human');

-- -------------------------
-- Tables
-- -------------------------

-- Top-level tenant container
CREATE TABLE workspaces (
  id          uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  name        text NOT NULL,
  slug        text NOT NULL UNIQUE,
  created_at  timestamptz NOT NULL DEFAULT now(),
  updated_at  timestamptz NOT NULL DEFAULT now()
);

-- Maps Clerk users to workspaces with a role
CREATE TABLE workspace_members (
  id            uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  workspace_id  uuid NOT NULL REFERENCES workspaces(id) ON DELETE CASCADE,
  user_id       text NOT NULL,           -- Clerk user ID (e.g. user_abc123)
  role          workspace_role NOT NULL DEFAULT 'member',
  created_at    timestamptz NOT NULL DEFAULT now(),
  updated_at    timestamptz NOT NULL DEFAULT now(),
  UNIQUE (workspace_id, user_id)
);

-- AI agents that execute tasks
CREATE TABLE agents (
  id            uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  workspace_id  uuid NOT NULL REFERENCES workspaces(id) ON DELETE CASCADE,
  name          text NOT NULL,
  type          text NOT NULL,           -- Agent type identifier
  created_at    timestamptz NOT NULL DEFAULT now(),
  updated_at    timestamptz NOT NULL DEFAULT now()
);

-- Real-time status of each agent (1:1 with agents, separate to reduce lock contention)
CREATE TABLE agent_status (
  agent_id         uuid PRIMARY KEY REFERENCES agents(id) ON DELETE CASCADE,
  status           agent_status_enum NOT NULL DEFAULT 'offline',
  current_task_id  uuid,                -- FK to tasks added below (forward reference)
  last_heartbeat   timestamptz,
  updated_at       timestamptz NOT NULL DEFAULT now()
);

-- The central work unit
CREATE TABLE tasks (
  id                  uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  workspace_id        uuid NOT NULL REFERENCES workspaces(id) ON DELETE CASCADE,
  title               text NOT NULL,
  description         text NOT NULL DEFAULT '',
  status              task_status NOT NULL DEFAULT 'pending',
  priority            task_priority NOT NULL DEFAULT 'medium',
  assigned_agent_id   uuid REFERENCES agents(id) ON DELETE SET NULL,
  created_by_user_id  text NOT NULL,     -- Clerk user ID
  created_at          timestamptz NOT NULL DEFAULT now(),
  updated_at          timestamptz NOT NULL DEFAULT now()
);

-- Add the forward reference now that tasks exists
ALTER TABLE agent_status
  ADD CONSTRAINT agent_status_current_task_id_fkey
  FOREIGN KEY (current_task_id) REFERENCES tasks(id) ON DELETE SET NULL;

-- Outputs created during task execution
CREATE TABLE task_artifacts (
  id            uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  task_id       uuid NOT NULL REFERENCES tasks(id) ON DELETE CASCADE,
  workspace_id  uuid NOT NULL REFERENCES workspaces(id) ON DELETE CASCADE,
  type          artifact_type NOT NULL,
  url           text NOT NULL,
  title         text NOT NULL,
  created_at    timestamptz NOT NULL DEFAULT now(),
  updated_at    timestamptz NOT NULL DEFAULT now()
);

-- Append-only audit log (no UPDATE or DELETE allowed — enforced by RLS)
CREATE TABLE task_events (
  id            uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  task_id       uuid NOT NULL REFERENCES tasks(id) ON DELETE CASCADE,
  workspace_id  uuid NOT NULL REFERENCES workspaces(id) ON DELETE CASCADE,
  event_type    task_event_type NOT NULL,
  actor_type    actor_type NOT NULL,
  actor_id      text NOT NULL,           -- Agent ID (uuid as text) or Clerk user ID
  payload       jsonb NOT NULL DEFAULT '{}',
  created_at    timestamptz NOT NULL DEFAULT now()
);

-- -------------------------
-- Indexes
-- -------------------------

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
