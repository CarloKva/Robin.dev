-- =============================================================================
-- Robin.dev — Maintenance Agents Phase 4 (customer rollout + kill switch)
-- =============================================================================

-- ─── 1. Workspace feature flag ──────────────────────────────────────────────

ALTER TABLE workspaces
  ADD COLUMN IF NOT EXISTS maintenance_enabled boolean NOT NULL DEFAULT false;

-- ─── 2. Global capability kill switch ───────────────────────────────────────

ALTER TABLE capability_definitions
  ADD COLUMN IF NOT EXISTS is_globally_disabled boolean NOT NULL DEFAULT false,
  ADD COLUMN IF NOT EXISTS globally_disabled_at timestamptz,
  ADD COLUMN IF NOT EXISTS globally_disabled_reason text;

-- ─── 3. Weekly health reviews ───────────────────────────────────────────────

CREATE TABLE IF NOT EXISTS capability_health_reviews (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  capability_definition_id text NOT NULL REFERENCES capability_definitions(id),
  week_starting date NOT NULL,
  total_findings int NOT NULL DEFAULT 0,
  rejected_findings int NOT NULL DEFAULT 0,
  prs_opened int NOT NULL DEFAULT 0,
  prs_merged int NOT NULL DEFAULT 0,
  total_cost_usd numeric(10, 4) NOT NULL DEFAULT 0,
  false_positive_rate numeric(5, 4),
  pr_merge_rate numeric(5, 4),
  cost_per_merged_pr_usd numeric(10, 2),
  fp_rate_breach boolean NOT NULL DEFAULT false,
  merge_rate_breach boolean NOT NULL DEFAULT false,
  cost_breach boolean NOT NULL DEFAULT false,
  any_breach boolean NOT NULL DEFAULT false,
  created_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (capability_definition_id, week_starting)
);

CREATE INDEX IF NOT EXISTS idx_capability_health_reviews_recent
  ON capability_health_reviews (capability_definition_id, week_starting DESC);

ALTER TABLE capability_health_reviews ENABLE ROW LEVEL SECURITY;
CREATE POLICY "capability_health_reviews_select" ON capability_health_reviews
  FOR SELECT USING (true);
GRANT SELECT ON capability_health_reviews TO authenticated;

-- ─── 4. Maintenance metrics view for the dashboard ──────────────────────────
--
-- One row per (workspace, repository, capability_definition) summarizing
-- findings + PRs + cost. The dashboard reads from this view; the kill switch
-- reads from agent_runs + findings + tasks directly so it can aggregate by
-- week.
-- ----------------------------------------------------------------------------

CREATE OR REPLACE VIEW maintenance_capability_metrics AS
WITH spec_findings_agg AS (
  SELECT
    workspace_id,
    repository_id,
    'spec_discovery' AS capability_definition_id,
    count(*) AS total_findings,
    count(*) FILTER (WHERE triage_state = 'rejected') AS rejected_findings,
    count(*) FILTER (WHERE triage_state = 'approved') AS approved_findings,
    count(*) FILTER (WHERE triage_state = 'implemented') AS implemented_findings
  FROM spec_findings
  GROUP BY workspace_id, repository_id
),
bug_findings_agg AS (
  SELECT
    workspace_id,
    repository_id,
    'bug_discovery' AS capability_definition_id,
    count(*) AS total_findings,
    count(*) FILTER (WHERE triage_state = 'rejected') AS rejected_findings,
    count(*) FILTER (WHERE triage_state = 'approved') AS approved_findings,
    count(*) FILTER (WHERE triage_state = 'implemented') AS implemented_findings
  FROM bug_findings
  GROUP BY workspace_id, repository_id
),
findings_combined AS (
  SELECT * FROM spec_findings_agg
  UNION ALL
  SELECT * FROM bug_findings_agg
),
runs_agg AS (
  SELECT
    workspace_id,
    repository_id,
    capability_definition_id,
    count(*) AS total_runs,
    count(*) FILTER (WHERE status = 'completed') AS completed_runs,
    count(*) FILTER (WHERE status = 'failed') AS failed_runs,
    coalesce(sum(tokens_used), 0) AS tokens_used,
    coalesce(sum(cost_usd), 0)::numeric(10, 4) AS cost_usd
  FROM agent_runs
  GROUP BY workspace_id, repository_id, capability_definition_id
)
SELECT
  coalesce(f.workspace_id, r.workspace_id) AS workspace_id,
  coalesce(f.repository_id, r.repository_id) AS repository_id,
  coalesce(f.capability_definition_id, r.capability_definition_id) AS capability_definition_id,
  coalesce(f.total_findings, 0) AS total_findings,
  coalesce(f.rejected_findings, 0) AS rejected_findings,
  coalesce(f.approved_findings, 0) AS approved_findings,
  coalesce(f.implemented_findings, 0) AS implemented_findings,
  coalesce(r.total_runs, 0) AS total_runs,
  coalesce(r.completed_runs, 0) AS completed_runs,
  coalesce(r.failed_runs, 0) AS failed_runs,
  coalesce(r.tokens_used, 0) AS tokens_used,
  coalesce(r.cost_usd, 0)::numeric(10, 4) AS cost_usd,
  CASE
    WHEN coalesce(f.total_findings, 0) = 0 THEN NULL
    ELSE round(coalesce(f.rejected_findings, 0)::numeric / f.total_findings, 4)
  END AS false_positive_rate
FROM findings_combined f
FULL OUTER JOIN runs_agg r
  ON f.workspace_id = r.workspace_id
  AND f.repository_id = r.repository_id
  AND f.capability_definition_id = r.capability_definition_id;

GRANT SELECT ON maintenance_capability_metrics TO authenticated;
