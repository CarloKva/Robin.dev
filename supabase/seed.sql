-- =============================================================================
-- Robin.dev — Seed Data (local development)
-- Run: supabase db reset
-- =============================================================================
-- Payloads aligned with Sprint 3 EventPayloadMap types.
-- task3 has a rich event stream (10 events, 7 distinct types) for Timeline UI testing.

DO $$
DECLARE
  ws_id            uuid := 'a0000000-0000-0000-0000-000000000001';
  seed_user_id     text := 'user_seed_dev_01';
  seed_agent_id    uuid := 'b0000000-0000-0000-0000-000000000001';
  task1_id       uuid := 'c0000000-0000-0000-0000-000000000001';
  task2_id       uuid := 'c0000000-0000-0000-0000-000000000002';
  task3_id       uuid := 'c0000000-0000-0000-0000-000000000003';
  task4_id       uuid := 'c0000000-0000-0000-0000-000000000004';
  task5_id       uuid := 'c0000000-0000-0000-0000-000000000005';
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
VALUES (ws_id, seed_user_id, 'owner')
ON CONFLICT (workspace_id, user_id) DO NOTHING;

-- -------------------------
-- Agent
-- -------------------------
INSERT INTO agents (id, workspace_id, name, type)
VALUES (seed_agent_id, ws_id, 'Robin Alpha', 'code-agent')
ON CONFLICT (id) DO NOTHING;

INSERT INTO agent_status (agent_id, status, last_heartbeat)
VALUES (seed_agent_id, 'busy', now())
ON CONFLICT (agent_id) DO NOTHING;

-- -------------------------
-- Tasks (5 different statuses)
-- -------------------------
INSERT INTO tasks (id, workspace_id, title, description, status, priority, assigned_agent_id, created_by_user_id)
VALUES
  (task1_id, ws_id, 'Setup project repository',       'Initialise monorepo with workspaces, CI, and base config.', 'completed',   'high',   seed_agent_id, seed_user_id),
  (task2_id, ws_id, 'Design database schema',          'Define all tables, enums, and RLS policies for Sprint 1.', 'completed',   'high',   seed_agent_id, seed_user_id),
  (task3_id, ws_id, 'Implement authentication flow',   'Integrate Clerk with Next.js App Router. Add sign-in, sign-up, and onboarding.', 'in_progress', 'high', seed_agent_id, seed_user_id),
  (task4_id, ws_id, 'Build task management UI',        'List, create, and filter tasks. Connect to Supabase RLS.', 'pending',     'medium', NULL, seed_user_id),
  (task5_id, ws_id, 'Deploy to Vercel',                'Connect GitHub repo to Vercel. Set environment variables. Verify build.', 'pending', 'low', NULL, seed_user_id)
ON CONFLICT (id) DO NOTHING;

-- -------------------------
-- Task Events
-- Payloads match Sprint 3 EventPayloadMap exactly.
-- Timestamps are staggered so the Timeline renders in chronological order.
-- -------------------------

INSERT INTO task_events (task_id, workspace_id, event_type, actor_type, actor_id, payload, created_at)
VALUES

  -- ── task1: completed (7 days ago) ─────────────────────────────────────────
  (task1_id, ws_id, 'task.created',
    'human', seed_user_id,
    '{"title": "Setup project repository", "description": "Initialise monorepo with workspaces, CI, and base config.", "priority": "high"}',
    NOW() - INTERVAL '7 days 5 hours'),

  (task1_id, ws_id, 'task.state.changed',
    'human', seed_user_id,
    '{"from": "pending", "to": "queued"}',
    NOW() - INTERVAL '7 days 4 hours 55 minutes'),

  (task1_id, ws_id, 'task.state.changed',
    'agent', seed_agent_id::text,
    '{"from": "queued", "to": "in_progress", "note": "job picked up by worker"}',
    NOW() - INTERVAL '7 days 4 hours 50 minutes'),

  (task1_id, ws_id, 'agent.phase.started',
    'agent', seed_agent_id::text,
    '{"phase": "analysis"}',
    NOW() - INTERVAL '7 days 4 hours 48 minutes'),

  (task1_id, ws_id, 'agent.phase.completed',
    'agent', seed_agent_id::text,
    '{"phase": "analysis", "duration_seconds": 480}',
    NOW() - INTERVAL '7 days 4 hours 40 minutes'),

  (task1_id, ws_id, 'agent.phase.started',
    'agent', seed_agent_id::text,
    '{"phase": "write"}',
    NOW() - INTERVAL '7 days 4 hours 38 minutes'),

  (task1_id, ws_id, 'agent.commit.pushed',
    'agent', seed_agent_id::text,
    '{"commit_sha": "a1b2c3d", "branch": "robindev/task-c0000001", "message": "feat: initialise monorepo with npm workspaces and CI"}',
    NOW() - INTERVAL '7 days 3 hours 30 minutes'),

  (task1_id, ws_id, 'agent.pr.opened',
    'agent', seed_agent_id::text,
    '{"pr_url": "https://github.com/CarloKva/Robin.dev/pull/1", "pr_number": 1, "commit_sha": "a1b2c3d"}',
    NOW() - INTERVAL '7 days 3 hours 25 minutes'),

  (task1_id, ws_id, 'task.state.changed',
    'agent', seed_agent_id::text,
    '{"from": "in_progress", "to": "review_pending"}',
    NOW() - INTERVAL '7 days 3 hours 24 minutes'),

  (task1_id, ws_id, 'human.approved',
    'human', seed_user_id,
    '{"comment": "Looks good, CI is green!"}',
    NOW() - INTERVAL '7 days 2 hours'),

  (task1_id, ws_id, 'task.completed',
    'agent', seed_agent_id::text,
    '{"duration_seconds": 10800}',
    NOW() - INTERVAL '7 days 1 hour 58 minutes'),

  -- ── task2: completed (5 days ago) ─────────────────────────────────────────
  (task2_id, ws_id, 'task.created',
    'human', seed_user_id,
    '{"title": "Design database schema", "description": "Define all tables, enums, and RLS policies for Sprint 1.", "priority": "high"}',
    NOW() - INTERVAL '5 days 6 hours'),

  (task2_id, ws_id, 'task.state.changed',
    'human', seed_user_id,
    '{"from": "pending", "to": "queued"}',
    NOW() - INTERVAL '5 days 5 hours 55 minutes'),

  (task2_id, ws_id, 'task.state.changed',
    'agent', seed_agent_id::text,
    '{"from": "queued", "to": "in_progress", "note": "job picked up by worker"}',
    NOW() - INTERVAL '5 days 5 hours 50 minutes'),

  (task2_id, ws_id, 'agent.phase.started',
    'agent', seed_agent_id::text,
    '{"phase": "design"}',
    NOW() - INTERVAL '5 days 5 hours 48 minutes'),

  (task2_id, ws_id, 'agent.phase.completed',
    'agent', seed_agent_id::text,
    '{"phase": "design", "duration_seconds": 900}',
    NOW() - INTERVAL '5 days 5 hours 33 minutes'),

  (task2_id, ws_id, 'agent.commit.pushed',
    'agent', seed_agent_id::text,
    '{"commit_sha": "e4f5g6h", "branch": "robindev/task-c0000002", "message": "feat: add all tables, enums, indexes and RLS policies"}',
    NOW() - INTERVAL '5 days 4 hours'),

  (task2_id, ws_id, 'agent.pr.opened',
    'agent', seed_agent_id::text,
    '{"pr_url": "https://github.com/CarloKva/Robin.dev/pull/2", "pr_number": 2, "commit_sha": "e4f5g6h"}',
    NOW() - INTERVAL '5 days 3 hours 58 minutes'),

  (task2_id, ws_id, 'task.state.changed',
    'agent', seed_agent_id::text,
    '{"from": "in_progress", "to": "review_pending"}',
    NOW() - INTERVAL '5 days 3 hours 57 minutes'),

  (task2_id, ws_id, 'human.approved',
    'human', seed_user_id,
    '{"comment": "Schema looks correct, RLS tests pass."}',
    NOW() - INTERVAL '5 days 2 hours'),

  (task2_id, ws_id, 'task.completed',
    'agent', seed_agent_id::text,
    '{"duration_seconds": 14400}',
    NOW() - INTERVAL '5 days 1 hour 58 minutes'),

  -- ── task3: in_progress — rich event stream for Timeline UI testing ─────────
  -- 10 events across 7 distinct event types: task.created, task.state.changed,
  -- agent.phase.started, agent.phase.completed, agent.commit.pushed, agent.blocked
  (task3_id, ws_id, 'task.created',
    'human', seed_user_id,
    '{"title": "Implement authentication flow", "description": "Integrate Clerk with Next.js App Router. Add sign-in, sign-up, and onboarding.", "priority": "high"}',
    NOW() - INTERVAL '2 hours 30 minutes'),

  (task3_id, ws_id, 'task.state.changed',
    'human', seed_user_id,
    '{"from": "pending", "to": "queued"}',
    NOW() - INTERVAL '2 hours 25 minutes'),

  (task3_id, ws_id, 'task.state.changed',
    'agent', seed_agent_id::text,
    '{"from": "queued", "to": "in_progress", "note": "job picked up by worker"}',
    NOW() - INTERVAL '2 hours 20 minutes'),

  (task3_id, ws_id, 'agent.phase.started',
    'agent', seed_agent_id::text,
    '{"phase": "analysis"}',
    NOW() - INTERVAL '2 hours 18 minutes'),

  (task3_id, ws_id, 'agent.phase.completed',
    'agent', seed_agent_id::text,
    '{"phase": "analysis", "duration_seconds": 720}',
    NOW() - INTERVAL '2 hours 6 minutes'),

  (task3_id, ws_id, 'agent.phase.started',
    'agent', seed_agent_id::text,
    '{"phase": "design"}',
    NOW() - INTERVAL '2 hours 4 minutes'),

  (task3_id, ws_id, 'agent.phase.completed',
    'agent', seed_agent_id::text,
    '{"phase": "design", "duration_seconds": 1080}',
    NOW() - INTERVAL '1 hour 46 minutes'),

  (task3_id, ws_id, 'agent.phase.started',
    'agent', seed_agent_id::text,
    '{"phase": "write"}',
    NOW() - INTERVAL '1 hour 44 minutes'),

  (task3_id, ws_id, 'agent.commit.pushed',
    'agent', seed_agent_id::text,
    '{"commit_sha": "7c8d9e0", "branch": "robindev/task-c0000003", "message": "feat: add Clerk middleware and sign-in/sign-up pages"}',
    NOW() - INTERVAL '55 minutes'),

  (task3_id, ws_id, 'agent.blocked',
    'agent', seed_agent_id::text,
    '{"question": "The onboarding redirect URL after sign-up should go to /onboarding or /dashboard? The CLAUDE.md does not specify the post-signup destination."}',
    NOW() - INTERVAL '20 minutes'),

  -- ── task4: pending (just created) ─────────────────────────────────────────
  (task4_id, ws_id, 'task.created',
    'human', seed_user_id,
    '{"title": "Build task management UI", "description": "List, create, and filter tasks. Connect to Supabase RLS.", "priority": "medium"}',
    NOW() - INTERVAL '1 hour'),

  -- ── task5: pending (just created) ─────────────────────────────────────────
  (task5_id, ws_id, 'task.created',
    'human', seed_user_id,
    '{"title": "Deploy to Vercel", "description": "Connect GitHub repo to Vercel. Set environment variables. Verify build.", "priority": "low"}',
    NOW() - INTERVAL '30 minutes')
;

END $$;