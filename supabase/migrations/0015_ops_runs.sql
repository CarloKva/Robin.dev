-- Migration 0015: ops_runs table for Ops Diagnostics Panel
-- Stores results of automated cross-tenant diagnostics runs.

CREATE TABLE ops_runs (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  workspace_id uuid REFERENCES workspaces(id) ON DELETE SET NULL,
  triggered_by_user_id text NOT NULL,
  scope text NOT NULL DEFAULT 'all' CHECK (scope IN ('all', 'workspace')),
  status text NOT NULL DEFAULT 'running'
    CHECK (status IN ('running', 'completed', 'failed')),
  progress int NOT NULL DEFAULT 0 CHECK (progress >= 0 AND progress <= 100),
  log jsonb NOT NULL DEFAULT '[]'::jsonb,
  raw_diagnostics jsonb,
  ai_analysis text,
  ai_recommendations jsonb,
  actions_taken jsonb NOT NULL DEFAULT '[]'::jsonb,
  created_at timestamptz NOT NULL DEFAULT now(),
  completed_at timestamptz
);

-- RLS: users can see runs for their own workspace, or global runs (scope=all, workspace_id=null)
-- Only service role can INSERT/UPDATE/DELETE (worker uses service role key)
ALTER TABLE ops_runs ENABLE ROW LEVEL SECURITY;

CREATE POLICY "ops_runs_select" ON ops_runs
  FOR SELECT USING (
    workspace_id IN (SELECT get_my_workspace_ids())
    OR workspace_id IS NULL
  );

CREATE INDEX idx_ops_runs_workspace ON ops_runs (workspace_id) WHERE workspace_id IS NOT NULL;
CREATE INDEX idx_ops_runs_status ON ops_runs (status) WHERE status = 'running';
CREATE INDEX idx_ops_runs_created ON ops_runs (created_at DESC);

-- Enable Realtime for live progress updates in the UI
ALTER PUBLICATION supabase_realtime ADD TABLE ops_runs;
