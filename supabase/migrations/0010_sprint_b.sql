-- =============================================================================
-- Migration 0010 · Sprint B — Backlog management + Sprint planning
-- =============================================================================
-- Adds: sprint_ready/in_review/rework/done statuses, critical priority,
-- accessibility/security task types, sprints table, task_templates table,
-- workspace_settings table, and extends tasks with backlog/sprint fields.
-- =============================================================================

-- ─── 1. Extend enums ─────────────────────────────────────────────────────────

-- task_status: add sprint lifecycle values
ALTER TYPE task_status ADD VALUE IF NOT EXISTS 'sprint_ready';
ALTER TYPE task_status ADD VALUE IF NOT EXISTS 'in_review';
ALTER TYPE task_status ADD VALUE IF NOT EXISTS 'rework';
ALTER TYPE task_status ADD VALUE IF NOT EXISTS 'done';

-- task_priority: add 'critical' above 'high'
ALTER TYPE task_priority ADD VALUE IF NOT EXISTS 'critical';

-- task_type: add accessibility and security (used in Sprint B templates)
-- task_type was added as a plain column with check constraint in 0005,
-- so we extend it here as an enum or just update the check.
-- Check existing definition first:
DO $$
BEGIN
  -- If task_type is a plain enum type, add values; otherwise do nothing
  IF EXISTS (
    SELECT 1 FROM pg_type WHERE typname = 'task_type'
  ) THEN
    ALTER TYPE task_type ADD VALUE IF NOT EXISTS 'accessibility';
    ALTER TYPE task_type ADD VALUE IF NOT EXISTS 'security';
  END IF;
END $$;

-- ─── 2. Sprint management table ──────────────────────────────────────────────

CREATE TABLE IF NOT EXISTS sprints (
  id              uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  workspace_id    uuid NOT NULL REFERENCES workspaces(id) ON DELETE CASCADE,
  name            text NOT NULL,
  goal            text,
  status          text NOT NULL DEFAULT 'planning'
                    CHECK (status IN ('planning', 'active', 'completed', 'cancelled')),
  started_at      timestamptz,
  completed_at    timestamptz,
  -- Aggregate metrics (populated on sprint close)
  tasks_completed int NOT NULL DEFAULT 0,
  tasks_failed    int NOT NULL DEFAULT 0,
  tasks_moved_back int NOT NULL DEFAULT 0,
  avg_cycle_time_minutes int,
  created_at      timestamptz NOT NULL DEFAULT now(),
  updated_at      timestamptz NOT NULL DEFAULT now()
);

-- ─── 3. Extend tasks table ───────────────────────────────────────────────────

-- Sprint linkage
ALTER TABLE tasks ADD COLUMN IF NOT EXISTS sprint_id       uuid REFERENCES sprints(id) ON DELETE SET NULL;

-- Repository target for this task (which repo the agent should work on)
ALTER TABLE tasks ADD COLUMN IF NOT EXISTS repository_id   uuid REFERENCES repositories(id) ON DELETE SET NULL;

-- Explicit agent assignment override (null = auto-routing)
ALTER TABLE tasks ADD COLUMN IF NOT EXISTS preferred_agent_id uuid REFERENCES agents(id) ON DELETE SET NULL;

-- Position within the sprint queue (ordering)
ALTER TABLE tasks ADD COLUMN IF NOT EXISTS sprint_order    int;

-- Additional context beyond description (links, screenshots, references)
ALTER TABLE tasks ADD COLUMN IF NOT EXISTS context         text;

-- Effort estimation
ALTER TABLE tasks ADD COLUMN IF NOT EXISTS estimated_effort text
  CHECK (estimated_effort IS NULL OR estimated_effort IN ('xs', 's', 'm', 'l'));

-- ─── 4. Task templates table ─────────────────────────────────────────────────

CREATE TABLE IF NOT EXISTS task_templates (
  id              uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  workspace_id    uuid NOT NULL REFERENCES workspaces(id) ON DELETE CASCADE,
  task_type       text NOT NULL,
  template_body   text NOT NULL,
  is_default      boolean NOT NULL DEFAULT false,
  created_at      timestamptz NOT NULL DEFAULT now(),
  updated_at      timestamptz NOT NULL DEFAULT now(),
  UNIQUE (workspace_id, task_type, is_default)
);

-- ─── 5. Workspace settings table ─────────────────────────────────────────────

CREATE TABLE IF NOT EXISTS workspace_settings (
  workspace_id        uuid PRIMARY KEY REFERENCES workspaces(id) ON DELETE CASCADE,
  notify_email        text,         -- Resend recipient; null = email off
  notify_slack_webhook text,        -- Slack incoming webhook URL; null = off
  created_at          timestamptz NOT NULL DEFAULT now(),
  updated_at          timestamptz NOT NULL DEFAULT now()
);

-- ─── 6. Indexes ──────────────────────────────────────────────────────────────

-- Backlog list: filter by workspace + status
CREATE INDEX IF NOT EXISTS idx_tasks_workspace_status
  ON tasks (workspace_id, status);

-- Sprint queue: tasks in sprint ordered
CREATE INDEX IF NOT EXISTS idx_tasks_sprint_order
  ON tasks (sprint_id, sprint_order)
  WHERE sprint_id IS NOT NULL;

-- Repo queue: tasks by repo + status for execution engine
CREATE INDEX IF NOT EXISTS idx_tasks_repo_status
  ON tasks (repository_id, status)
  WHERE repository_id IS NOT NULL;

-- Sprints by workspace
CREATE INDEX IF NOT EXISTS idx_sprints_workspace
  ON sprints (workspace_id, status);

-- ─── 7. Enable Realtime on sprints ──────────────────────────────────────────

ALTER PUBLICATION supabase_realtime ADD TABLE sprints;

-- ─── 8. RLS policies — sprints ───────────────────────────────────────────────

ALTER TABLE sprints ENABLE ROW LEVEL SECURITY;

CREATE POLICY "sprints_select" ON sprints
  FOR SELECT USING (workspace_id = ANY(get_my_workspace_ids()));

CREATE POLICY "sprints_insert" ON sprints
  FOR INSERT WITH CHECK (workspace_id = ANY(get_my_workspace_ids()));

CREATE POLICY "sprints_update" ON sprints
  FOR UPDATE USING (workspace_id = ANY(get_my_workspace_ids()));

CREATE POLICY "sprints_delete" ON sprints
  FOR DELETE USING (workspace_id = ANY(get_my_workspace_ids()));

-- ─── 9. RLS policies — task_templates ────────────────────────────────────────

ALTER TABLE task_templates ENABLE ROW LEVEL SECURITY;

CREATE POLICY "task_templates_select" ON task_templates
  FOR SELECT USING (workspace_id = ANY(get_my_workspace_ids()));

CREATE POLICY "task_templates_insert" ON task_templates
  FOR INSERT WITH CHECK (workspace_id = ANY(get_my_workspace_ids()));

CREATE POLICY "task_templates_update" ON task_templates
  FOR UPDATE USING (workspace_id = ANY(get_my_workspace_ids()));

CREATE POLICY "task_templates_delete" ON task_templates
  FOR DELETE USING (workspace_id = ANY(get_my_workspace_ids()));

-- ─── 10. RLS policies — workspace_settings ───────────────────────────────────

ALTER TABLE workspace_settings ENABLE ROW LEVEL SECURITY;

CREATE POLICY "workspace_settings_select" ON workspace_settings
  FOR SELECT USING (workspace_id = ANY(get_my_workspace_ids()));

CREATE POLICY "workspace_settings_insert" ON workspace_settings
  FOR INSERT WITH CHECK (workspace_id = ANY(get_my_workspace_ids()));

CREATE POLICY "workspace_settings_update" ON workspace_settings
  FOR UPDATE USING (workspace_id = ANY(get_my_workspace_ids()));

-- ─── 11. Insert default task templates ───────────────────────────────────────
-- These are workspace-agnostic defaults inserted at system level.
-- Workspace-specific overrides are stored with a workspace_id.
-- NOTE: workspace_id is NOT NULL so we skip system-level defaults here;
-- defaults are seeded per-workspace on first workspace creation (via webhook).

-- ─── 12. Updated_at trigger for new tables ──────────────────────────────────

CREATE OR REPLACE FUNCTION update_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER set_sprints_updated_at
  BEFORE UPDATE ON sprints
  FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

CREATE TRIGGER set_task_templates_updated_at
  BEFORE UPDATE ON task_templates
  FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

CREATE TRIGGER set_workspace_settings_updated_at
  BEFORE UPDATE ON workspace_settings
  FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();
