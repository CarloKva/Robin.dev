-- =============================================================================
-- Robin.dev — Event Sourcing: Indexes + Realtime Publication
-- Migration: 0004_event_sourcing.sql
-- =============================================================================

-- -------------------------
-- Composite index for Timeline queries
-- Fetching all events for a task ordered by time is the primary access pattern.
-- -------------------------

CREATE INDEX IF NOT EXISTS task_events_task_id_created_at_idx
  ON task_events (task_id, created_at ASC);

-- -------------------------
-- GIN index for pr_url lookups
-- Only agent.pr.opened events need payload-level queries (pr_url field).
-- A full-table GIN would be disproportionate.
-- -------------------------

CREATE INDEX IF NOT EXISTS task_events_pr_url_gin_idx
  ON task_events USING GIN (payload)
  WHERE event_type = 'agent.pr.opened';

-- -------------------------
-- Workspace-level feed index
-- Used by AgentStatusWidget real-time subscription (filters by workspace_id).
-- -------------------------

CREATE INDEX IF NOT EXISTS task_events_workspace_created_at_idx
  ON task_events (workspace_id, created_at DESC);

-- -------------------------
-- Event type index
-- Used to filter the timeline by category (e.g. show only agent events).
-- -------------------------

CREATE INDEX IF NOT EXISTS task_events_event_type_idx
  ON task_events (event_type);

-- -------------------------
-- Enable Realtime for task_events
-- Required for postgres_changes subscriptions in the frontend.
-- The publication already exists; we add the table to it.
-- -------------------------

ALTER PUBLICATION supabase_realtime ADD TABLE task_events;
