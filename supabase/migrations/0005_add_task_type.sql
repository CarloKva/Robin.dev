-- =============================================================================
-- Robin.dev — Sprint 4: Add task type column
-- Migration: 0005_add_task_type.sql
-- =============================================================================

-- Add task type column with a check constraint on allowed values.
-- Defaults to 'feature' for existing rows.
ALTER TABLE tasks
  ADD COLUMN type text NOT NULL DEFAULT 'feature'
    CHECK (type IN ('bug', 'feature', 'docs', 'refactor', 'chore'));

-- Index for filter queries on (workspace_id, type)
CREATE INDEX ON tasks(workspace_id, type);
