-- =============================================================================
-- Migration 0016 · Workspace environments — staging/production + auto-merge + env vars
-- =============================================================================
-- Adds workspace_environments table to configure per-repo deployment environments.
-- Each environment defines:
--   - A target Git branch for PRs
--   - Whether PRs should be auto-merged once CI passes
--   - Encrypted environment variables injected during agent execution
--
-- Constraint: one staging + one production per repo per workspace (UNIQUE).
-- =============================================================================

-- ─── 1. Table ─────────────────────────────────────────────────────────────────

CREATE TABLE workspace_environments (
  id              uuid        PRIMARY KEY DEFAULT gen_random_uuid(),
  workspace_id    uuid        NOT NULL REFERENCES workspaces(id)    ON DELETE CASCADE,
  repository_id   uuid        NOT NULL REFERENCES repositories(id)  ON DELETE CASCADE,
  name            text        NOT NULL,
  environment_type text       NOT NULL CHECK (environment_type IN ('staging', 'production')),
  target_branch   text        NOT NULL,
  auto_merge      boolean     NOT NULL DEFAULT false,
  env_vars_encrypted text,
  created_at      timestamptz NOT NULL DEFAULT now(),
  updated_at      timestamptz NOT NULL DEFAULT now(),

  CONSTRAINT workspace_environments_unique_type
    UNIQUE (workspace_id, repository_id, environment_type)
);

-- ─── 2. updated_at trigger ────────────────────────────────────────────────────

CREATE OR REPLACE FUNCTION update_workspace_environments_updated_at()
RETURNS trigger LANGUAGE plpgsql AS $$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END;
$$;

CREATE TRIGGER trg_workspace_environments_updated_at
  BEFORE UPDATE ON workspace_environments
  FOR EACH ROW
  EXECUTE FUNCTION update_workspace_environments_updated_at();

-- ─── 3. RLS ───────────────────────────────────────────────────────────────────

ALTER TABLE workspace_environments ENABLE ROW LEVEL SECURITY;

CREATE POLICY "workspace_environments: workspace members can manage"
  ON workspace_environments
  FOR ALL
  USING (workspace_id IN (SELECT get_my_workspace_ids()));
