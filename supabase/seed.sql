-- =============================================================================
-- Robin.dev — Seed Data (local development)
-- Run: supabase db reset
-- =============================================================================

-- Use a fixed UUID so re-seeding is idempotent
DO $$
DECLARE
  ws_id      uuid := 'a0000000-0000-0000-0000-000000000001';
  user_id    text := 'user_seed_dev_01';
  agent_id   uuid := 'b0000000-0000-0000-0000-000000000001';
  task1_id   uuid := 'c0000000-0000-0000-0000-000000000001';
  task2_id   uuid := 'c0000000-0000-0000-0000-000000000002';
  task3_id   uuid := 'c0000000-0000-0000-0000-000000000003';
  task4_id   uuid := 'c0000000-0000-0000-0000-000000000004';
  task5_id   uuid := 'c0000000-0000-0000-0000-000000000005';
BEGIN

-- -------------------------
-- Workspace
-- -------------------------
INSERT INTO workspaces (id, name, slug)
VALUES (ws_id, 'Dev Workspace', 'dev-workspace')
ON CONFLICT (id) DO NOTHING;

-- -------------------------
-- Workspace member
-- -------------------------
INSERT INTO workspace_members (workspace_id, user_id, role)
VALUES (ws_id, user_id, 'owner')
ON CONFLICT (workspace_id, user_id) DO NOTHING;

-- -------------------------
-- Agent
-- -------------------------
INSERT INTO agents (id, workspace_id, name, type)
VALUES (agent_id, ws_id, 'Robin Alpha', 'code-agent')
ON CONFLICT (id) DO NOTHING;

INSERT INTO agent_status (agent_id, status, last_heartbeat)
VALUES (agent_id, 'idle', now())
ON CONFLICT (agent_id) DO NOTHING;

-- -------------------------
-- Tasks (5 different statuses)
-- -------------------------
INSERT INTO tasks (id, workspace_id, title, description, status, priority, assigned_agent_id, created_by_user_id)
VALUES
  (task1_id, ws_id, 'Setup project repository', 'Initialise monorepo with workspaces, CI, and base config.', 'completed', 'high', agent_id, user_id),
  (task2_id, ws_id, 'Design database schema', 'Define all tables, enums, and RLS policies for Sprint 1.', 'completed', 'high', agent_id, user_id),
  (task3_id, ws_id, 'Implement authentication flow', 'Integrate Clerk with Next.js App Router. Add sign-in, sign-up, and onboarding.', 'in_progress', 'high', agent_id, user_id),
  (task4_id, ws_id, 'Build task management UI', 'List, create, and filter tasks. Connect to Supabase RLS.', 'pending', 'medium', NULL, user_id),
  (task5_id, ws_id, 'Deploy to Vercel', 'Connect GitHub repo to Vercel. Set environment variables. Verify build.', 'pending', 'low', NULL, user_id)
ON CONFLICT (id) DO NOTHING;

-- -------------------------
-- Task Events (10+ entries across tasks)
-- -------------------------
INSERT INTO task_events (task_id, workspace_id, event_type, actor_type, actor_id, payload)
VALUES
  -- task1: completed
  (task1_id, ws_id, 'task.created',       'human', user_id,    '{"message": "Task created by user"}'),
  (task1_id, ws_id, 'task.state.changed', 'human', user_id,    '{"from": "pending", "to": "queued"}'),
  (task1_id, ws_id, 'agent.phase.started','agent', agent_id::text, '{"phase": "scaffold"}'),
  (task1_id, ws_id, 'agent.commit.pushed','agent', agent_id::text, '{"sha": "abc123", "branch": "feat/init-scaffold"}'),
  (task1_id, ws_id, 'agent.pr.opened',    'agent', agent_id::text, '{"pr_number": 1, "url": "https://github.com/org/repo/pull/1"}'),
  (task1_id, ws_id, 'human.approved',     'human', user_id,    '{"comment": "Looks good!"}'),
  (task1_id, ws_id, 'task.completed',     'agent', agent_id::text, '{"duration_seconds": 312}'),

  -- task2: completed
  (task2_id, ws_id, 'task.created',       'human', user_id,    '{"message": "Task created by user"}'),
  (task2_id, ws_id, 'task.state.changed', 'human', user_id,    '{"from": "pending", "to": "in_progress"}'),
  (task2_id, ws_id, 'agent.phase.completed','agent', agent_id::text, '{"phase": "schema-design", "tables": 7}'),
  (task2_id, ws_id, 'task.completed',     'agent', agent_id::text, '{"duration_seconds": 489}'),

  -- task3: in progress
  (task3_id, ws_id, 'task.created',       'human', user_id,    '{"message": "Task created by user"}'),
  (task3_id, ws_id, 'task.state.changed', 'human', user_id,    '{"from": "pending", "to": "in_progress"}'),
  (task3_id, ws_id, 'agent.phase.started','agent', agent_id::text, '{"phase": "clerk-integration"}'),

  -- task4: pending
  (task4_id, ws_id, 'task.created',       'human', user_id,    '{"message": "Task created by user"}'),

  -- task5: pending
  (task5_id, ws_id, 'task.created',       'human', user_id,    '{"message": "Task created by user"}')
;

END $$;
