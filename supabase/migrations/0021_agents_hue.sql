-- Robin.dev desktop client — per-agent hue source-of-truth.
-- See docs/desktop-implementation-plan.md §M5 + §Open question A.6.
--
-- Hue drives every per-agent colour cue in the desktop UI (avatar gradient,
-- history-lane line, specialty pills, send-button accent). Default is a
-- deterministic hash of the agent UUID so existing rows backfill without
-- manual choice; founder/admin can override later.

ALTER TABLE public.agents
  ADD COLUMN IF NOT EXISTS hue smallint
    NOT NULL
    DEFAULT (mod(abs(hashtext(id::text)), 360))
    CHECK (hue >= 0 AND hue < 360);

-- Backfill any rows that pre-existed the default (no-op if column was newly added).
UPDATE public.agents
SET hue = mod(abs(hashtext(id::text)), 360)
WHERE hue IS NULL;

-- Rebuild the agents_with_status view to surface the new column. The view's
-- definition lives across multiple migrations; we re-declare it here so the
-- desktop's `useAgentStatus` hook can `select('hue')` directly.
CREATE OR REPLACE VIEW public.agents_with_status AS
SELECT
  a.id,
  a.workspace_id,
  a.name,
  a.hue,
  a.avatar_url,
  a.specialty,
  a.created_at,
  a.updated_at,
  a.assigned_repository_ids,
  a.provisioning_status,
  a.vps_ip,
  a.vps_provider,
  s.status,
  s.last_seen_at,
  s.current_task_id,
  CASE
    WHEN s.status = 'offline'                                    THEN 'offline'::agent_status_enum
    WHEN s.last_seen_at IS NULL                                  THEN 'offline'::agent_status_enum
    WHEN NOW() - s.last_seen_at > INTERVAL '2 minutes'           THEN 'offline'::agent_status_enum
    ELSE s.status
  END AS effective_status
FROM public.agents a
LEFT JOIN public.agent_status s ON s.agent_id = a.id;
