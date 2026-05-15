-- =============================================================================
-- Robin.dev — Maintenance Capabilities Phase 0
-- Adds built-in maintenance capability catalog, per-repository execution config,
-- run history, findings, and maintenance event stream.
-- =============================================================================

-- ─── 1. Existing table extensions ───────────────────────────────────────────

ALTER TABLE workspaces
  ADD COLUMN IF NOT EXISTS timezone text NOT NULL DEFAULT 'UTC';

ALTER TABLE tasks
  ADD COLUMN IF NOT EXISTS source_finding_type text
    CHECK (source_finding_type IS NULL OR source_finding_type IN ('spec', 'bug')),
  ADD COLUMN IF NOT EXISTS source_finding_id uuid,
  ADD COLUMN IF NOT EXISTS plan_json jsonb,
  ADD COLUMN IF NOT EXISTS tokens_used int NOT NULL DEFAULT 0,
  ADD COLUMN IF NOT EXISTS cost_usd numeric(10,4) NOT NULL DEFAULT 0;

CREATE INDEX IF NOT EXISTS idx_tasks_source_finding
  ON tasks(source_finding_type, source_finding_id)
  WHERE source_finding_type IS NOT NULL AND source_finding_id IS NOT NULL;

-- ─── 2. Capability catalog ──────────────────────────────────────────────────

CREATE TABLE IF NOT EXISTS capability_definitions (
  id text PRIMARY KEY,
  display_name text NOT NULL,
  description text NOT NULL,
  kind text NOT NULL CHECK (kind IN ('discovery', 'implementation')),
  default_enabled boolean NOT NULL,
  default_schedule jsonb NOT NULL,
  daily_token_budget_default int NOT NULL CHECK (daily_token_budget_default > 0),
  per_run_token_cap_default int NOT NULL CHECK (per_run_token_cap_default > 0),
  profile_path text NOT NULL,
  created_at timestamptz NOT NULL DEFAULT now()
);

-- ─── 3. Per-repository capability execution policy ──────────────────────────

CREATE TABLE IF NOT EXISTS workspace_capability_configs (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  workspace_id uuid NOT NULL REFERENCES workspaces(id) ON DELETE CASCADE,
  repository_id uuid NOT NULL REFERENCES repositories(id) ON DELETE CASCADE,
  capability_definition_id text NOT NULL REFERENCES capability_definitions(id),
  enabled boolean NOT NULL,
  schedule jsonb NOT NULL,
  daily_token_budget int NOT NULL CHECK (daily_token_budget > 0),
  per_run_token_cap int NOT NULL CHECK (per_run_token_cap > 0),
  auto_implement boolean NOT NULL DEFAULT false,
  auto_implement_min_confidence numeric(3,2)
    CHECK (auto_implement_min_confidence IS NULL OR auto_implement_min_confidence BETWEEN 0 AND 1),
  protected_paths text[] NOT NULL DEFAULT ARRAY[
    '.env*',
    'supabase/migrations/**',
    '.github/workflows/**'
  ]::text[],
  spec_paths text[] NOT NULL DEFAULT ARRAY['docs/spec.md']::text[],
  bug_noise_allowlist text[] NOT NULL DEFAULT ARRAY[]::text[],
  bug_source_config jsonb NOT NULL DEFAULT '{}'::jsonb,
  last_run_at timestamptz,
  next_run_at timestamptz,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE(workspace_id, repository_id, capability_definition_id)
);

CREATE INDEX IF NOT EXISTS idx_workspace_capability_configs_next_run
  ON workspace_capability_configs(next_run_at)
  WHERE enabled = true;

CREATE INDEX IF NOT EXISTS idx_workspace_capability_configs_repo
  ON workspace_capability_configs(workspace_id, repository_id);

-- ─── 4. Run history and maintenance events ──────────────────────────────────

CREATE TABLE IF NOT EXISTS agent_runs (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  workspace_id uuid NOT NULL REFERENCES workspaces(id) ON DELETE CASCADE,
  repository_id uuid NOT NULL REFERENCES repositories(id) ON DELETE CASCADE,
  workspace_capability_config_id uuid REFERENCES workspace_capability_configs(id) ON DELETE SET NULL,
  capability_definition_id text NOT NULL REFERENCES capability_definitions(id),
  runner_agent_id uuid REFERENCES agents(id) ON DELETE SET NULL,
  status text NOT NULL CHECK (
    status IN (
      'queued',
      'running',
      'completed',
      'failed',
      'cancelled',
      'budget_exceeded',
      'no_agent',
      'validation_failed',
      'skipped'
    )
  ),
  started_at timestamptz,
  completed_at timestamptz,
  tokens_used int NOT NULL DEFAULT 0,
  cost_usd numeric(10,4) NOT NULL DEFAULT 0,
  findings_created int NOT NULL DEFAULT 0,
  error_message text,
  trigger text NOT NULL CHECK (trigger IN ('schedule', 'manual', 'webhook', 'auto')),
  triggered_by text,
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_agent_runs_workspace_recent
  ON agent_runs(workspace_id, created_at DESC);

CREATE INDEX IF NOT EXISTS idx_agent_runs_repo_recent
  ON agent_runs(repository_id, created_at DESC);

CREATE INDEX IF NOT EXISTS idx_agent_runs_budget
  ON agent_runs(workspace_id, repository_id, capability_definition_id, created_at);

CREATE TABLE IF NOT EXISTS maintenance_events (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  workspace_id uuid NOT NULL REFERENCES workspaces(id) ON DELETE CASCADE,
  repository_id uuid REFERENCES repositories(id) ON DELETE CASCADE,
  agent_run_id uuid REFERENCES agent_runs(id) ON DELETE SET NULL,
  event_type text NOT NULL CHECK (
    event_type IN (
      'agent.run.scheduled',
      'agent.run.started',
      'agent.run.completed',
      'agent.run.failed',
      'agent.run.budget_exceeded',
      'finding.created',
      'finding.triaged',
      'finding.auto_implemented'
    )
  ),
  actor_type text NOT NULL CHECK (actor_type IN ('agent', 'human', 'system')),
  actor_id text NOT NULL,
  payload jsonb NOT NULL DEFAULT '{}'::jsonb,
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_maintenance_events_workspace_recent
  ON maintenance_events(workspace_id, created_at DESC);

CREATE INDEX IF NOT EXISTS idx_maintenance_events_run
  ON maintenance_events(agent_run_id)
  WHERE agent_run_id IS NOT NULL;

-- ─── 5. Findings ────────────────────────────────────────────────────────────

CREATE TABLE IF NOT EXISTS spec_findings (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  workspace_id uuid NOT NULL REFERENCES workspaces(id) ON DELETE CASCADE,
  repository_id uuid NOT NULL REFERENCES repositories(id) ON DELETE CASCADE,
  agent_run_id uuid NOT NULL REFERENCES agent_runs(id) ON DELETE CASCADE,
  requirement_text text NOT NULL,
  requirement_source_path text NOT NULL,
  requirement_source_line int,
  requirement_source_end_line int,
  status text NOT NULL CHECK (status IN ('implemented', 'partial', 'missing', 'drifted')),
  evidence_paths text[] NOT NULL DEFAULT ARRAY[]::text[],
  suggested_action text,
  confidence numeric(3,2) NOT NULL CHECK (confidence BETWEEN 0 AND 1),
  triage_state text NOT NULL DEFAULT 'pending'
    CHECK (triage_state IN ('pending', 'approved', 'rejected', 'snoozed', 'implemented')),
  triaged_by text,
  triaged_at timestamptz,
  triage_note text,
  snoozed_until timestamptz,
  dedup_hash text NOT NULL,
  task_id uuid REFERENCES tasks(id) ON DELETE SET NULL,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE(repository_id, dedup_hash)
);

CREATE INDEX IF NOT EXISTS idx_spec_findings_triage
  ON spec_findings(workspace_id, repository_id, triage_state);

CREATE INDEX IF NOT EXISTS idx_spec_findings_task
  ON spec_findings(task_id)
  WHERE task_id IS NOT NULL;

CREATE TABLE IF NOT EXISTS bug_findings (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  workspace_id uuid NOT NULL REFERENCES workspaces(id) ON DELETE CASCADE,
  repository_id uuid NOT NULL REFERENCES repositories(id) ON DELETE CASCADE,
  agent_run_id uuid NOT NULL REFERENCES agent_runs(id) ON DELETE CASCADE,
  title text NOT NULL,
  description text NOT NULL,
  severity text NOT NULL CHECK (severity IN ('P0', 'P1', 'P2', 'P3')),
  hypothesis text NOT NULL,
  repro_steps text,
  evidence jsonb NOT NULL,
  affected_paths text[] NOT NULL,
  suggested_fix_outline text,
  confidence numeric(3,2) NOT NULL CHECK (confidence BETWEEN 0 AND 1),
  source text NOT NULL CHECK (source IN ('sentry', 'static_analysis', 'commit_correlation')),
  source_ref text,
  external_issue_url text,
  triage_state text NOT NULL DEFAULT 'pending'
    CHECK (triage_state IN ('pending', 'approved', 'rejected', 'snoozed', 'implemented')),
  triaged_by text,
  triaged_at timestamptz,
  triage_note text,
  snoozed_until timestamptz,
  dedup_hash text NOT NULL,
  task_id uuid REFERENCES tasks(id) ON DELETE SET NULL,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE(repository_id, dedup_hash)
);

CREATE INDEX IF NOT EXISTS idx_bug_findings_triage
  ON bug_findings(workspace_id, repository_id, triage_state);

CREATE INDEX IF NOT EXISTS idx_bug_findings_severity
  ON bug_findings(workspace_id, repository_id, severity, triage_state);

CREATE INDEX IF NOT EXISTS idx_bug_findings_source_ref
  ON bug_findings(repository_id, source, source_ref)
  WHERE source_ref IS NOT NULL;

-- ─── 6. Updated-at triggers ─────────────────────────────────────────────────

CREATE OR REPLACE FUNCTION update_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS set_workspace_capability_configs_updated_at ON workspace_capability_configs;
CREATE TRIGGER set_workspace_capability_configs_updated_at
  BEFORE UPDATE ON workspace_capability_configs
  FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

DROP TRIGGER IF EXISTS set_spec_findings_updated_at ON spec_findings;
CREATE TRIGGER set_spec_findings_updated_at
  BEFORE UPDATE ON spec_findings
  FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

DROP TRIGGER IF EXISTS set_bug_findings_updated_at ON bug_findings;
CREATE TRIGGER set_bug_findings_updated_at
  BEFORE UPDATE ON bug_findings
  FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

-- ─── 7. Seed built-in capability definitions ────────────────────────────────

INSERT INTO capability_definitions (
  id,
  display_name,
  description,
  kind,
  default_enabled,
  default_schedule,
  daily_token_budget_default,
  per_run_token_cap_default,
  profile_path
) VALUES
('spec_discovery',
  'Spec Coverage',
  'Compares configured spec files to the repository and surfaces missing or drifted requirements.',
  'discovery',
  true,
  '{"mode": "always_on", "interval_minutes": 360}',
  2000000,
  500000,
  'apps/orchestrator/profiles/spec-discovery'),
('spec_impl',
  'Spec Implementation',
  'Implements approved spec findings with tests and opens a PR.',
  'implementation',
  false,
  '{"mode": "always_on", "interval_minutes": 60}',
  5000000,
  1000000,
  'apps/orchestrator/profiles/spec-impl'),
('bug_discovery',
  'Bug Discovery',
  'Finds bugs using Sentry and high-confidence static analysis.',
  'discovery',
  true,
  '{"mode": "always_on", "interval_minutes": 720}',
  2000000,
  500000,
  'apps/orchestrator/profiles/bug-discovery'),
('bug_impl',
  'Bug Fix Implementation',
  'Fixes approved bug findings with a regression test and opens a PR.',
  'implementation',
  false,
  '{"mode": "always_on", "interval_minutes": 60}',
  3000000,
  500000,
  'apps/orchestrator/profiles/bug-impl')
ON CONFLICT (id) DO UPDATE SET
  display_name = EXCLUDED.display_name,
  description = EXCLUDED.description,
  kind = EXCLUDED.kind,
  default_enabled = EXCLUDED.default_enabled,
  default_schedule = EXCLUDED.default_schedule,
  daily_token_budget_default = EXCLUDED.daily_token_budget_default,
  per_run_token_cap_default = EXCLUDED.per_run_token_cap_default,
  profile_path = EXCLUDED.profile_path;

-- ─── 8. Bootstrap configs for repositories ─────────────────────────────────

CREATE OR REPLACE FUNCTION bootstrap_repository_capability_configs()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  INSERT INTO workspace_capability_configs (
    workspace_id,
    repository_id,
    capability_definition_id,
    enabled,
    schedule,
    daily_token_budget,
    per_run_token_cap,
    next_run_at
  )
  SELECT
    NEW.workspace_id,
    NEW.id,
    cd.id,
    cd.default_enabled,
    cd.default_schedule,
    cd.daily_token_budget_default,
    cd.per_run_token_cap_default,
    now() + ((random() * 30)::int || ' minutes')::interval
  FROM capability_definitions cd
  ON CONFLICT (workspace_id, repository_id, capability_definition_id) DO NOTHING;

  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_bootstrap_repository_capability_configs ON repositories;
CREATE TRIGGER trg_bootstrap_repository_capability_configs
  AFTER INSERT OR UPDATE OF is_enabled ON repositories
  FOR EACH ROW
  WHEN (NEW.is_enabled = true)
  EXECUTE FUNCTION bootstrap_repository_capability_configs();

INSERT INTO workspace_capability_configs (
  workspace_id,
  repository_id,
  capability_definition_id,
  enabled,
  schedule,
  daily_token_budget,
  per_run_token_cap,
  next_run_at
)
SELECT
  r.workspace_id,
  r.id,
  cd.id,
  cd.default_enabled,
  cd.default_schedule,
  cd.daily_token_budget_default,
  cd.per_run_token_cap_default,
  now() + ((random() * 30)::int || ' minutes')::interval
FROM repositories r
CROSS JOIN capability_definitions cd
WHERE r.is_enabled = true
ON CONFLICT (workspace_id, repository_id, capability_definition_id) DO NOTHING;

-- ─── 9. RLS ─────────────────────────────────────────────────────────────────

CREATE OR REPLACE FUNCTION get_my_owned_workspace_ids()
RETURNS SETOF uuid
LANGUAGE sql
SECURITY DEFINER
STABLE
AS $$
  SELECT workspace_id
  FROM workspace_members
  WHERE user_id = (auth.jwt() ->> 'sub')::text
    AND role = 'owner';
$$;

ALTER TABLE capability_definitions ENABLE ROW LEVEL SECURITY;
ALTER TABLE workspace_capability_configs ENABLE ROW LEVEL SECURITY;
ALTER TABLE agent_runs ENABLE ROW LEVEL SECURITY;
ALTER TABLE maintenance_events ENABLE ROW LEVEL SECURITY;
ALTER TABLE spec_findings ENABLE ROW LEVEL SECURITY;
ALTER TABLE bug_findings ENABLE ROW LEVEL SECURITY;

CREATE POLICY "capability_definitions_select" ON capability_definitions
  FOR SELECT USING (true);

CREATE POLICY "workspace_capability_configs_select" ON workspace_capability_configs
  FOR SELECT USING (workspace_id IN (SELECT get_my_workspace_ids()));

CREATE POLICY "workspace_capability_configs_update_owner" ON workspace_capability_configs
  FOR UPDATE USING (workspace_id IN (SELECT get_my_owned_workspace_ids()))
  WITH CHECK (workspace_id IN (SELECT get_my_owned_workspace_ids()));

CREATE POLICY "agent_runs_select" ON agent_runs
  FOR SELECT USING (workspace_id IN (SELECT get_my_workspace_ids()));

CREATE POLICY "agent_runs_insert_owner" ON agent_runs
  FOR INSERT WITH CHECK (workspace_id IN (SELECT get_my_owned_workspace_ids()));

CREATE POLICY "maintenance_events_select" ON maintenance_events
  FOR SELECT USING (workspace_id IN (SELECT get_my_workspace_ids()));

CREATE POLICY "maintenance_events_insert_owner" ON maintenance_events
  FOR INSERT WITH CHECK (workspace_id IN (SELECT get_my_owned_workspace_ids()));

CREATE POLICY "spec_findings_select" ON spec_findings
  FOR SELECT USING (workspace_id IN (SELECT get_my_workspace_ids()));

CREATE POLICY "spec_findings_update_owner" ON spec_findings
  FOR UPDATE USING (workspace_id IN (SELECT get_my_owned_workspace_ids()))
  WITH CHECK (workspace_id IN (SELECT get_my_owned_workspace_ids()));

CREATE POLICY "bug_findings_select" ON bug_findings
  FOR SELECT USING (workspace_id IN (SELECT get_my_workspace_ids()));

CREATE POLICY "bug_findings_update_owner" ON bug_findings
  FOR UPDATE USING (workspace_id IN (SELECT get_my_owned_workspace_ids()))
  WITH CHECK (workspace_id IN (SELECT get_my_owned_workspace_ids()));

GRANT SELECT ON capability_definitions TO authenticated;
GRANT SELECT, UPDATE ON workspace_capability_configs TO authenticated;
GRANT SELECT, INSERT ON agent_runs TO authenticated;
GRANT SELECT, INSERT ON maintenance_events TO authenticated;
GRANT SELECT, UPDATE ON spec_findings TO authenticated;
GRANT SELECT, UPDATE ON bug_findings TO authenticated;

-- ─── 10. Realtime publication ───────────────────────────────────────────────

ALTER PUBLICATION supabase_realtime ADD TABLE agent_runs;
ALTER PUBLICATION supabase_realtime ADD TABLE maintenance_events;
ALTER PUBLICATION supabase_realtime ADD TABLE spec_findings;
ALTER PUBLICATION supabase_realtime ADD TABLE bug_findings;
