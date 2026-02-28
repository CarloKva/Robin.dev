-- -------------------------
-- Update agents_with_status view to include provisioning lifecycle fields
-- Added in 0007 but the view was not updated at that time.
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
  -- Provisioning lifecycle (added in 0007)
  a.provisioning_status,
  a.vps_id,
  a.vps_created_at,
  a.provisioned_at,
  a.provisioning_error,
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
