-- =============================================================================
-- Robin.dev — Agent Registry Extended + Backlog Status
-- Migration: 0006_agent_registry.sql
-- Sprint: 5 FASE B — EPIC-29 (agent registry) + EPIC-28 (backlog routing)
-- =============================================================================

-- -------------------------
-- Extend agents table with registry fields
-- -------------------------

ALTER TABLE agents
  ADD COLUMN IF NOT EXISTS slug             text UNIQUE,
  ADD COLUMN IF NOT EXISTS github_account   text,
  ADD COLUMN IF NOT EXISTS vps_ip           text,
  ADD COLUMN IF NOT EXISTS vps_region       text DEFAULT 'fsn1',
  ADD COLUMN IF NOT EXISTS last_seen_at     timestamptz,
  ADD COLUMN IF NOT EXISTS orchestrator_version  text,
  ADD COLUMN IF NOT EXISTS claude_code_version   text;

-- -------------------------
-- Index for fast online-agent lookup (find agent online for workspace)
-- -------------------------

CREATE INDEX IF NOT EXISTS idx_agents_workspace_last_seen
  ON agents(workspace_id, last_seen_at DESC NULLS LAST);

-- -------------------------
-- Add 'backlog' task status (when no agent is online at creation time)
-- -------------------------

ALTER TYPE task_status ADD VALUE IF NOT EXISTS 'backlog';

-- -------------------------
-- Helper function: mark stale agents offline
-- Called by heartbeat logic (also usable as a cron via pg_cron if needed)
-- An agent is considered stale if last_seen_at is null or > 2 minutes old
-- -------------------------

CREATE OR REPLACE FUNCTION mark_stale_agents_offline()
RETURNS integer
LANGUAGE sql
AS $$
  WITH updated AS (
    UPDATE agent_status
    SET status = 'offline', updated_at = now()
    WHERE agent_id IN (
      SELECT id FROM agents
      WHERE last_seen_at IS NULL
         OR last_seen_at < now() - interval '2 minutes'
    )
    AND status != 'offline'
    RETURNING agent_id
  )
  SELECT count(*)::integer FROM updated;
$$;

-- -------------------------
-- Helper view: agents with their live status and activity
-- Used by web app for the /agents page
-- -------------------------

CREATE OR REPLACE VIEW agents_with_status AS
SELECT
  a.id,
  a.workspace_id,
  a.name,
  a.type,
  a.slug,
  a.github_account,
  a.vps_ip,
  a.vps_region,
  a.last_seen_at,
  a.orchestrator_version,
  a.claude_code_version,
  a.created_at,
  a.updated_at,
  -- Derive effective status: stale heartbeat overrides DB status
  CASE
    WHEN a.last_seen_at IS NULL THEN 'offline'
    WHEN a.last_seen_at < now() - interval '2 minutes' THEN 'offline'
    ELSE COALESCE(s.status::text, 'idle')
  END AS effective_status,
  s.status         AS raw_status,
  s.current_task_id,
  s.last_heartbeat
FROM agents a
LEFT JOIN agent_status s ON s.agent_id = a.id;

-- -------------------------
-- RLS: apply existing workspace isolation to the view
-- (The view inherits SELECT security from the underlying agents table RLS)
-- Grant SELECT to authenticated role
-- -------------------------

GRANT SELECT ON agents_with_status TO authenticated;
