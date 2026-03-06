-- =============================================================================
-- Migration 0014 · Add workspace_id to task_iterations
-- =============================================================================
-- The orchestrator inserts workspace_id when creating iteration records for
-- denormalized access and future RLS queries without task joins.
-- workspace_id is nullable to allow backfilling existing rows.
-- =============================================================================

ALTER TABLE task_iterations
  ADD COLUMN IF NOT EXISTS workspace_id uuid REFERENCES workspaces(id) ON DELETE CASCADE;

-- Backfill existing rows from the parent task
UPDATE task_iterations ti
SET workspace_id = t.workspace_id
FROM tasks t
WHERE ti.task_id = t.id
  AND ti.workspace_id IS NULL;

-- Index for workspace-scoped queries
CREATE INDEX IF NOT EXISTS idx_task_iterations_workspace_id
  ON task_iterations (workspace_id);
