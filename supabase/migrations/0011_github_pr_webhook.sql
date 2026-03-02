-- =============================================================================
-- Migration 0011 · GitHub PR webhook — task auto-completion on merge
-- =============================================================================
-- Adds task.pr_closed_without_merge event type so the orchestrator can record
-- when a PR is closed without being merged and track the task back to review.
-- =============================================================================

-- ─── 1. New task_event_type value ────────────────────────────────────────────

ALTER TYPE task_event_type ADD VALUE IF NOT EXISTS 'task.pr_closed_without_merge';
