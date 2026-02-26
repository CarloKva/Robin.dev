-- =============================================================================
-- Robin.dev — RLS Isolation Test
-- STORY-01.12, TASK-01.12.2
--
-- Purpose: verify that user A cannot read data belonging to user B's workspace.
--
-- How to run:
--   1. supabase db reset   (applies migrations + seed)
--   2. Open Supabase Dashboard → SQL Editor
--   3. Paste and run this script section by section
--   OR run against local Supabase: psql postgresql://postgres:postgres@localhost:54322/postgres
-- =============================================================================

-- -------------------------
-- SETUP: create two isolated workspaces
-- -------------------------

DO $$
DECLARE
  ws_a  uuid := 'test0000-0000-0000-0000-00000000000a';
  ws_b  uuid := 'test0000-0000-0000-0000-00000000000b';
  user_a text := 'user_test_alice';
  user_b text := 'user_test_bob';
BEGIN
  -- Workspace A (Alice)
  INSERT INTO workspaces (id, name, slug)
  VALUES (ws_a, 'Alice Workspace', 'alice-ws')
  ON CONFLICT (id) DO NOTHING;

  INSERT INTO workspace_members (workspace_id, user_id, role)
  VALUES (ws_a, user_a, 'owner')
  ON CONFLICT (workspace_id, user_id) DO NOTHING;

  INSERT INTO tasks (workspace_id, title, description, status, priority, created_by_user_id)
  VALUES (ws_a, 'Alice secret task', 'Only Alice should see this', 'pending', 'high', user_a)
  ON CONFLICT DO NOTHING;

  -- Workspace B (Bob)
  INSERT INTO workspaces (id, name, slug)
  VALUES (ws_b, 'Bob Workspace', 'bob-ws')
  ON CONFLICT (id) DO NOTHING;

  INSERT INTO workspace_members (workspace_id, user_id, role)
  VALUES (ws_b, user_b, 'owner')
  ON CONFLICT (workspace_id, user_id) DO NOTHING;

  INSERT INTO tasks (workspace_id, title, description, status, priority, created_by_user_id)
  VALUES (ws_b, 'Bob secret task', 'Only Bob should see this', 'pending', 'medium', user_b)
  ON CONFLICT DO NOTHING;
END $$;

-- -------------------------
-- TEST 1: Alice can see her own tasks
-- Expected: 1 row (Alice secret task)
-- -------------------------

SET LOCAL request.jwt.claims = '{"sub": "user_test_alice", "aud": "authenticated"}';

SELECT 'TEST 1 — Alice sees own tasks' AS test,
       COUNT(*) AS row_count,
       CASE WHEN COUNT(*) = 1 THEN 'PASS' ELSE 'FAIL' END AS result
FROM tasks
WHERE workspace_id = 'test0000-0000-0000-0000-00000000000a';

-- -------------------------
-- TEST 2: Alice cannot see Bob's tasks
-- Expected: 0 rows
-- -------------------------

SET LOCAL request.jwt.claims = '{"sub": "user_test_alice", "aud": "authenticated"}';

SELECT 'TEST 2 — Alice cannot see Bob tasks' AS test,
       COUNT(*) AS row_count,
       CASE WHEN COUNT(*) = 0 THEN 'PASS' ELSE 'FAIL' END AS result
FROM tasks
WHERE workspace_id = 'test0000-0000-0000-0000-00000000000b';

-- -------------------------
-- TEST 3: Bob can see his own tasks
-- Expected: 1 row (Bob secret task)
-- -------------------------

SET LOCAL request.jwt.claims = '{"sub": "user_test_bob", "aud": "authenticated"}';

SELECT 'TEST 3 — Bob sees own tasks' AS test,
       COUNT(*) AS row_count,
       CASE WHEN COUNT(*) = 1 THEN 'PASS' ELSE 'FAIL' END AS result
FROM tasks
WHERE workspace_id = 'test0000-0000-0000-0000-00000000000b';

-- -------------------------
-- TEST 4: Bob cannot see Alice's tasks
-- Expected: 0 rows
-- -------------------------

SET LOCAL request.jwt.claims = '{"sub": "user_test_bob", "aud": "authenticated"}';

SELECT 'TEST 4 — Bob cannot see Alice tasks' AS test,
       COUNT(*) AS row_count,
       CASE WHEN COUNT(*) = 0 THEN 'PASS' ELSE 'FAIL' END AS result
FROM tasks
WHERE workspace_id = 'test0000-0000-0000-0000-00000000000a';

-- -------------------------
-- TEST 5: Full table SELECT leaks nothing across tenants
-- Each user should only see their OWN tasks total
-- Alice: 1 task, Bob: 1 task — they must not see each other
-- -------------------------

SET LOCAL request.jwt.claims = '{"sub": "user_test_alice", "aud": "authenticated"}';

SELECT 'TEST 5 — Alice full table scan (should see only her tasks)' AS test,
       title,
       workspace_id,
       CASE WHEN workspace_id = 'test0000-0000-0000-0000-00000000000a' THEN 'PASS' ELSE 'FAIL — data leak!' END AS result
FROM tasks
WHERE title IN ('Alice secret task', 'Bob secret task');

-- -------------------------
-- TEST 6: task_events append-only — UPDATE denied
-- Expected: ERROR (RLS denies UPDATE on task_events)
-- -------------------------

-- Note: this test will raise an error if run directly.
-- Run in a transaction and catch the error, or verify by checking
-- that no UPDATE policy exists on task_events.

SELECT 'TEST 6 — task_events has no UPDATE policy (append-only)' AS test,
       COUNT(*) AS update_policies,
       CASE WHEN COUNT(*) = 0 THEN 'PASS' ELSE 'FAIL' END AS result
FROM pg_policies
WHERE tablename = 'task_events'
  AND cmd = 'UPDATE';

-- -------------------------
-- TEST 7: task_events has no DELETE policy
-- Expected: 0 DELETE policies
-- -------------------------

SELECT 'TEST 7 — task_events has no DELETE policy (append-only)' AS test,
       COUNT(*) AS delete_policies,
       CASE WHEN COUNT(*) = 0 THEN 'PASS' ELSE 'FAIL' END AS result
FROM pg_policies
WHERE tablename = 'task_events'
  AND cmd = 'DELETE';

-- -------------------------
-- CLEANUP: remove test data
-- -------------------------

DELETE FROM workspaces WHERE id IN (
  'test0000-0000-0000-0000-00000000000a',
  'test0000-0000-0000-0000-00000000000b'
);

-- (CASCADE deletes workspace_members, tasks, etc.)
