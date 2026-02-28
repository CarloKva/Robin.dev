-- =============================================================================
-- Robin.dev — GitHub Integration + Agent Provisioning Data Model
-- Migration: 0007_github_integration.sql
-- Sprint: A — EPIC-A1 (STORY-A.02) + EPIC-A5 (STORY-A.09) + EPIC-A6
-- =============================================================================

-- -------------------------
-- Enum: provisioning lifecycle status for agents
-- Distinct from agent_status_enum (idle/busy/error/offline) which tracks
-- operational state. This tracks the VPS provisioning lifecycle.
-- -------------------------

CREATE TYPE agent_provisioning_status AS ENUM (
  'pending',        -- record created, job not yet started
  'provisioning',   -- Hetzner VPS creation in progress
  'online',         -- VPS + orchestrator healthy, ready for tasks
  'error',          -- provisioning failed (see task_events for details)
  'deprovisioning', -- deletion in progress
  'deprovisioned'   -- VPS deleted (record kept for task history)
);

-- -------------------------
-- Extend agents table with provisioning lifecycle fields
-- -------------------------

ALTER TABLE agents
  ADD COLUMN IF NOT EXISTS provisioning_status  agent_provisioning_status NOT NULL DEFAULT 'pending',
  ADD COLUMN IF NOT EXISTS vps_id               bigint,            -- Hetzner server ID (numeric)
  ADD COLUMN IF NOT EXISTS vps_created_at        timestamptz,      -- when Hetzner VPS was created
  ADD COLUMN IF NOT EXISTS provisioned_at        timestamptz,      -- when orchestrator first passed health check
  ADD COLUMN IF NOT EXISTS provisioning_error    text;             -- error message if provisioning failed

-- Note: vps_ip already exists from migration 0006

-- -------------------------
-- GitHub App connection per workspace
-- Stores the installation_id that identifies which GitHub account/org
-- has installed Robin.dev GitHub App.
-- The App private key lives in env vars — never in this table.
-- -------------------------

CREATE TABLE github_connections (
  id                  uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  workspace_id        uuid NOT NULL REFERENCES workspaces(id) ON DELETE CASCADE,
  -- GitHub App installation data
  installation_id     bigint NOT NULL,            -- GitHub App installation ID
  github_account_id   bigint NOT NULL,            -- GitHub account/org numeric ID
  github_account_login text NOT NULL,             -- GitHub username or org name (e.g. "acme")
  github_account_type text NOT NULL CHECK (github_account_type IN ('User', 'Organization')),
  -- Connection state
  status              text NOT NULL DEFAULT 'connected'
                        CHECK (status IN ('connected', 'revoked', 'suspended')),
  connected_at        timestamptz NOT NULL DEFAULT now(),
  last_validated_at   timestamptz,               -- last time we verified installation is still valid
  -- Timestamps
  created_at          timestamptz NOT NULL DEFAULT now(),
  updated_at          timestamptz NOT NULL DEFAULT now(),
  -- One active connection per workspace
  UNIQUE (workspace_id)
);

-- -------------------------
-- Repositories enabled by the founder for use with Robin.dev
-- These are repos the founder explicitly selected via the repository selector.
-- -------------------------

CREATE TABLE repositories (
  id                uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  workspace_id      uuid NOT NULL REFERENCES workspaces(id) ON DELETE CASCADE,
  -- GitHub repo identity
  github_repo_id    bigint NOT NULL,             -- GitHub's numeric repo ID (stable across renames)
  full_name         text NOT NULL,               -- e.g. "acme/frontend" (may change on rename)
  default_branch    text NOT NULL DEFAULT 'main',
  is_private        boolean NOT NULL DEFAULT true,
  -- State
  is_enabled        boolean NOT NULL DEFAULT true,   -- false = soft-disabled by founder
  is_available      boolean NOT NULL DEFAULT true,   -- false = repo deleted/inaccessible on GitHub
  last_synced_at    timestamptz,                 -- last time we verified repo exists on GitHub
  -- Timestamps
  created_at        timestamptz NOT NULL DEFAULT now(),
  updated_at        timestamptz NOT NULL DEFAULT now(),
  -- One record per workspace + GitHub repo
  UNIQUE (workspace_id, github_repo_id)
);

-- -------------------------
-- Many-to-many: agents ↔ repositories
-- An agent can work on multiple repos; a repo can be assigned to multiple agents.
-- -------------------------

CREATE TABLE agent_repositories (
  id              uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  agent_id        uuid NOT NULL REFERENCES agents(id) ON DELETE CASCADE,
  repository_id   uuid NOT NULL REFERENCES repositories(id) ON DELETE CASCADE,
  assigned_at     timestamptz NOT NULL DEFAULT now(),
  -- An agent can only be assigned to a repo once
  UNIQUE (agent_id, repository_id)
);

-- -------------------------
-- Extend task_events to support provisioning event types
-- -------------------------

ALTER TYPE task_event_type ADD VALUE IF NOT EXISTS 'agent.provisioning.started';
ALTER TYPE task_event_type ADD VALUE IF NOT EXISTS 'agent.provisioning.vps_created';
ALTER TYPE task_event_type ADD VALUE IF NOT EXISTS 'agent.provisioning.setup_running';
ALTER TYPE task_event_type ADD VALUE IF NOT EXISTS 'agent.provisioning.health_check';
ALTER TYPE task_event_type ADD VALUE IF NOT EXISTS 'agent.provisioning.completed';
ALTER TYPE task_event_type ADD VALUE IF NOT EXISTS 'agent.provisioning.failed';
ALTER TYPE task_event_type ADD VALUE IF NOT EXISTS 'agent.deprovisioned';

-- -------------------------
-- Indexes
-- -------------------------

-- Tenant isolation (RLS performance)
CREATE INDEX IF NOT EXISTS idx_github_connections_workspace ON github_connections(workspace_id);
CREATE INDEX IF NOT EXISTS idx_repositories_workspace ON repositories(workspace_id);
CREATE INDEX IF NOT EXISTS idx_agent_repositories_agent ON agent_repositories(agent_id);
CREATE INDEX IF NOT EXISTS idx_agent_repositories_repository ON agent_repositories(repository_id);

-- Lookup patterns
CREATE INDEX IF NOT EXISTS idx_repositories_github_repo_id ON repositories(github_repo_id);
CREATE INDEX IF NOT EXISTS idx_agents_provisioning_status ON agents(provisioning_status);

-- -------------------------
-- RLS Policies
-- -------------------------

ALTER TABLE github_connections ENABLE ROW LEVEL SECURITY;
ALTER TABLE repositories ENABLE ROW LEVEL SECURITY;
ALTER TABLE agent_repositories ENABLE ROW LEVEL SECURITY;

-- github_connections: workspace members can SELECT and UPDATE their own connection
CREATE POLICY "workspace_members_select_github_connections"
  ON github_connections FOR SELECT
  USING (
    workspace_id IN (
      SELECT workspace_id FROM workspace_members
      WHERE user_id = auth.jwt()->>'sub'
    )
  );

CREATE POLICY "workspace_members_insert_github_connections"
  ON github_connections FOR INSERT
  WITH CHECK (
    workspace_id IN (
      SELECT workspace_id FROM workspace_members
      WHERE user_id = auth.jwt()->>'sub'
    )
  );

CREATE POLICY "workspace_members_update_github_connections"
  ON github_connections FOR UPDATE
  USING (
    workspace_id IN (
      SELECT workspace_id FROM workspace_members
      WHERE user_id = auth.jwt()->>'sub'
    )
  );

CREATE POLICY "workspace_members_delete_github_connections"
  ON github_connections FOR DELETE
  USING (
    workspace_id IN (
      SELECT workspace_id FROM workspace_members
      WHERE user_id = auth.jwt()->>'sub'
    )
  );

-- repositories: workspace members can read/write their own repos
CREATE POLICY "workspace_members_select_repositories"
  ON repositories FOR SELECT
  USING (
    workspace_id IN (
      SELECT workspace_id FROM workspace_members
      WHERE user_id = auth.jwt()->>'sub'
    )
  );

CREATE POLICY "workspace_members_insert_repositories"
  ON repositories FOR INSERT
  WITH CHECK (
    workspace_id IN (
      SELECT workspace_id FROM workspace_members
      WHERE user_id = auth.jwt()->>'sub'
    )
  );

CREATE POLICY "workspace_members_update_repositories"
  ON repositories FOR UPDATE
  USING (
    workspace_id IN (
      SELECT workspace_id FROM workspace_members
      WHERE user_id = auth.jwt()->>'sub'
    )
  );

-- agent_repositories: accessible to workspace members of the agent's workspace
CREATE POLICY "workspace_members_select_agent_repositories"
  ON agent_repositories FOR SELECT
  USING (
    agent_id IN (
      SELECT id FROM agents
      WHERE workspace_id IN (
        SELECT workspace_id FROM workspace_members
        WHERE user_id = auth.jwt()->>'sub'
      )
    )
  );

CREATE POLICY "workspace_members_insert_agent_repositories"
  ON agent_repositories FOR INSERT
  WITH CHECK (
    agent_id IN (
      SELECT id FROM agents
      WHERE workspace_id IN (
        SELECT workspace_id FROM workspace_members
        WHERE user_id = auth.jwt()->>'sub'
      )
    )
  );

CREATE POLICY "workspace_members_delete_agent_repositories"
  ON agent_repositories FOR DELETE
  USING (
    agent_id IN (
      SELECT id FROM agents
      WHERE workspace_id IN (
        SELECT workspace_id FROM workspace_members
        WHERE user_id = auth.jwt()->>'sub'
      )
    )
  );

-- -------------------------
-- Grant to authenticated role
-- -------------------------

GRANT SELECT, INSERT, UPDATE, DELETE ON github_connections TO authenticated;
GRANT SELECT, INSERT, UPDATE ON repositories TO authenticated;
GRANT SELECT, INSERT, DELETE ON agent_repositories TO authenticated;
