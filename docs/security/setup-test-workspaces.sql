-- Robin.dev — Test Workspace Setup
-- Eseguire con: psql $DATABASE_URL -f docs/security/setup-test-workspaces.sql
-- Prerequisito: migrations 0001–0006 già applicate

BEGIN;

-- ===================================================================
-- WORKSPACE A (cliente sicuro — attaccante simulato)
-- ===================================================================
INSERT INTO workspaces (id, name, slug, created_at, updated_at)
VALUES (
  '11111111-1111-1111-1111-111111111111',
  'Test Workspace A',
  'test-workspace-a',
  now(), now()
)
ON CONFLICT (id) DO NOTHING;

INSERT INTO workspace_members (id, workspace_id, user_id, role, created_at, updated_at)
VALUES (
  '11111111-1111-1111-1111-111111111112',
  '11111111-1111-1111-1111-111111111111',
  'user_test_A',
  'owner',
  now(), now()
)
ON CONFLICT (workspace_id, user_id) DO NOTHING;

INSERT INTO agents (id, workspace_id, name, type, created_at, updated_at)
VALUES (
  '11111111-1111-1111-1111-111111111113',
  '11111111-1111-1111-1111-111111111111',
  'Agent A',
  'claude',
  now(), now()
)
ON CONFLICT (id) DO NOTHING;

INSERT INTO tasks (id, workspace_id, title, description, status, priority, created_by_user_id, created_at, updated_at)
VALUES (
  '11111111-1111-1111-1111-111111111114',
  '11111111-1111-1111-1111-111111111111',
  'Task segreto di A',
  'Questo task deve essere visibile SOLO ad utenti di workspace A',
  'pending', 'high', 'user_test_A',
  now(), now()
)
ON CONFLICT (id) DO NOTHING;

-- ===================================================================
-- WORKSPACE B (vittima simulata)
-- ===================================================================
INSERT INTO workspaces (id, name, slug, created_at, updated_at)
VALUES (
  '22222222-2222-2222-2222-222222222221',
  'Test Workspace B',
  'test-workspace-b',
  now(), now()
)
ON CONFLICT (id) DO NOTHING;

INSERT INTO workspace_members (id, workspace_id, user_id, role, created_at, updated_at)
VALUES (
  '22222222-2222-2222-2222-222222222222',
  '22222222-2222-2222-2222-222222222221',
  'user_test_B',
  'owner',
  now(), now()
)
ON CONFLICT (workspace_id, user_id) DO NOTHING;

INSERT INTO agents (id, workspace_id, name, type, created_at, updated_at)
VALUES (
  '22222222-2222-2222-2222-222222222223',
  '22222222-2222-2222-2222-222222222221',
  'Agent B',
  'claude',
  now(), now()
)
ON CONFLICT (id) DO NOTHING;

INSERT INTO tasks (id, workspace_id, title, description, status, priority, created_by_user_id, created_at, updated_at)
VALUES (
  '22222222-2222-2222-2222-222222222224',
  '22222222-2222-2222-2222-222222222221',
  'Task segreto di B',
  'Questo task deve essere visibile SOLO ad utenti di workspace B',
  'pending', 'high', 'user_test_B',
  now(), now()
)
ON CONFLICT (id) DO NOTHING;

INSERT INTO task_events (id, task_id, workspace_id, event_type, actor_type, actor_id, payload, created_at)
VALUES (
  '22222222-2222-2222-2222-222222222225',
  '22222222-2222-2222-2222-222222222224',
  '22222222-2222-2222-2222-222222222221',
  'task.created',
  'human',
  'user_test_B',
  '{"confidential": true, "secret_note": "Dati riservati workspace B"}',
  now()
)
ON CONFLICT (id) DO NOTHING;

COMMIT;

-- Verifica setup
SELECT 'workspaces' as tbl, count(*) FROM workspaces
WHERE id IN ('11111111-1111-1111-1111-111111111111','22222222-2222-2222-2222-222222222221')
UNION ALL
SELECT 'workspace_members', count(*) FROM workspace_members
WHERE workspace_id IN ('11111111-1111-1111-1111-111111111111','22222222-2222-2222-2222-222222222221')
UNION ALL
SELECT 'tasks', count(*) FROM tasks
WHERE workspace_id IN ('11111111-1111-1111-1111-111111111111','22222222-2222-2222-2222-222222222221');
-- Atteso: 3 righe con count = 2, 2, 2
