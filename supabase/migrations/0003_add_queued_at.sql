-- =============================================================================
-- Robin.dev — Add queued_at to tasks
-- Migration: 0003_add_queued_at.sql
--
-- Required by Sprint 2 polling strategy (ADR-05 / spike-07).
-- queued_at tracks when a task was enqueued in BullMQ.
-- NULL = not yet enqueued. Prevents duplicate job creation on re-poll.
-- =============================================================================

ALTER TABLE tasks ADD COLUMN queued_at timestamptz;

-- Partial index: only indexes rows not yet queued.
-- Makes the poller query fast: WHERE status = 'pending' AND queued_at IS NULL
CREATE INDEX ON tasks(status, queued_at) WHERE queued_at IS NULL;
