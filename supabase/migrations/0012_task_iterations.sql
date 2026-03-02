-- =============================================================================
-- Migration 0012 · Task iterations — rework cycle tracking
-- =============================================================================
-- Adds: iteration_trigger enum, iteration_status enum, task_iterations table,
-- iteration_number column on task_events, and rework tracking columns on tasks.
-- This is the data foundation for Phase B rework flows.
-- =============================================================================

-- ─── 1. New enums ────────────────────────────────────────────────────────────

CREATE TYPE iteration_trigger AS ENUM ('initial', 'github_comment', 'dashboard');

CREATE TYPE iteration_status AS ENUM ('pending', 'running', 'completed', 'failed');

-- ─── 2. task_iterations table ────────────────────────────────────────────────

CREATE TABLE task_iterations (
  id                    uuid        PRIMARY KEY DEFAULT gen_random_uuid(),
  task_id               uuid        NOT NULL REFERENCES tasks(id) ON DELETE CASCADE,
  iteration_number      integer     NOT NULL,
  trigger               iteration_trigger NOT NULL,
  triggered_by_user_id  text,                         -- null when triggered by GitHub webhook
  github_comment_ids    integer[],                    -- IDs of GitHub comments that triggered rework
  pr_url                text,
  pr_number             integer,
  started_at            timestamptz,
  completed_at          timestamptz,
  status                iteration_status NOT NULL DEFAULT 'pending',
  context_snapshot_url  text,
  summary               text,
  created_at            timestamptz NOT NULL DEFAULT now(),
  updated_at            timestamptz NOT NULL DEFAULT now()
);

-- ─── 3. Extend tasks table ───────────────────────────────────────────────────

ALTER TABLE tasks ADD COLUMN IF NOT EXISTS current_iteration      integer NOT NULL DEFAULT 1;
ALTER TABLE tasks ADD COLUMN IF NOT EXISTS rework_count           integer NOT NULL DEFAULT 0;
ALTER TABLE tasks ADD COLUMN IF NOT EXISTS last_rework_trigger    iteration_trigger;
ALTER TABLE tasks ADD COLUMN IF NOT EXISTS pending_rework_comments jsonb;

-- ─── 4. Extend task_events table ─────────────────────────────────────────────
-- Add iteration_number as a dedicated column for structured querying.

ALTER TABLE task_events ADD COLUMN IF NOT EXISTS iteration_number integer;

-- ─── 5. Indexes ──────────────────────────────────────────────────────────────

-- Task iterations by task (primary access pattern)
CREATE INDEX IF NOT EXISTS idx_task_iterations_task_id
  ON task_iterations (task_id, iteration_number);

-- Task iterations by status (for orchestrator queries)
CREATE INDEX IF NOT EXISTS idx_task_iterations_status
  ON task_iterations (status)
  WHERE status IN ('pending', 'running');

-- Task events by iteration (for per-iteration timelines)
CREATE INDEX IF NOT EXISTS idx_task_events_iteration
  ON task_events (task_id, iteration_number)
  WHERE iteration_number IS NOT NULL;

-- ─── 6. updated_at trigger for task_iterations ───────────────────────────────

CREATE TRIGGER set_task_iterations_updated_at
  BEFORE UPDATE ON task_iterations
  FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

-- ─── 7. Enable Realtime on task_iterations ───────────────────────────────────

ALTER PUBLICATION supabase_realtime ADD TABLE task_iterations;

-- ─── 8. RLS on task_iterations ───────────────────────────────────────────────
-- workspace_id is derived from the associated task.

ALTER TABLE task_iterations ENABLE ROW LEVEL SECURITY;

CREATE POLICY "task_iterations_select" ON task_iterations
  FOR SELECT USING (
    task_id IN (
      SELECT id FROM tasks WHERE workspace_id IN (SELECT get_my_workspace_ids())
    )
  );

CREATE POLICY "task_iterations_insert" ON task_iterations
  FOR INSERT WITH CHECK (
    task_id IN (
      SELECT id FROM tasks WHERE workspace_id IN (SELECT get_my_workspace_ids())
    )
  );

CREATE POLICY "task_iterations_update" ON task_iterations
  FOR UPDATE USING (
    task_id IN (
      SELECT id FROM tasks WHERE workspace_id IN (SELECT get_my_workspace_ids())
    )
  );

CREATE POLICY "task_iterations_delete" ON task_iterations
  FOR DELETE USING (
    task_id IN (
      SELECT id FROM tasks WHERE workspace_id IN (SELECT get_my_workspace_ids())
    )
  );
