-- =============================================================================
-- Robin.dev — Add vps_online_at to agents
-- Migration: 0009_add_vps_online_at.sql
-- Tracks the moment when the Hetzner VPS reaches 'running' state,
-- enabling the ProvisioningTimeline to show 5 distinct steps:
--   1. VPS in creazione  (vps_created_at set)
--   2. VPS online        (vps_online_at set)  ← new
--   3. Setup in corso    (vps_online_at set, provisioned_at null)
--   4. Health check      (implicit — waiting for heartbeat)
--   5. Agente pronto     (provisioning_status = 'online')
-- =============================================================================

ALTER TABLE agents
  ADD COLUMN IF NOT EXISTS vps_online_at timestamptz;

-- -------------------------
-- Rebuild agents_with_status view to include vps_online_at
-- -------------------------

DROP VIEW IF EXISTS agents_with_status;
CREATE VIEW agents_with_status AS
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
  -- Provisioning lifecycle fields
  a.provisioning_status,
  a.vps_id,
  a.vps_created_at,
  a.vps_online_at,
  a.provisioned_at,
  a.provisioning_error,
  -- Derive effective status: stale heartbeat overrides DB status
  CASE
    WHEN a.last_seen_at IS NULL THEN 'offline'
    WHEN a.last_seen_at < now() - interval '2 minutes' THEN 'offline'
    ELSE COALESCE(s.status::text, 'idle')
  END AS effective_status,
  s.status          AS raw_status,
  s.current_task_id,
  s.last_heartbeat
FROM agents a
LEFT JOIN agent_status s ON s.agent_id = a.id;
