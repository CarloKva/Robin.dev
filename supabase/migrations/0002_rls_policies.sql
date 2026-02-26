-- =============================================================================
-- Robin.dev — RLS Policies
-- Migration: 0002_rls_policies.sql
-- =============================================================================

-- -------------------------
-- Helper function
-- -------------------------
-- Returns all workspace IDs the currently authenticated user belongs to.
-- Uses auth.jwt()->>'sub' (text) NOT auth.uid() (uuid) because Clerk user IDs
-- like "user_abc123" are NOT valid UUIDs.

CREATE OR REPLACE FUNCTION get_my_workspace_ids()
RETURNS SETOF uuid
LANGUAGE sql
SECURITY DEFINER
STABLE
AS $$
  SELECT workspace_id
  FROM workspace_members
  WHERE user_id = (auth.jwt() ->> 'sub')::text;
$$;

-- -------------------------
-- Enable RLS on all tenant tables
-- -------------------------

ALTER TABLE workspaces        ENABLE ROW LEVEL SECURITY;
ALTER TABLE workspace_members ENABLE ROW LEVEL SECURITY;
ALTER TABLE agents            ENABLE ROW LEVEL SECURITY;
ALTER TABLE agent_status      ENABLE ROW LEVEL SECURITY;
ALTER TABLE tasks             ENABLE ROW LEVEL SECURITY;
ALTER TABLE task_artifacts    ENABLE ROW LEVEL SECURITY;
ALTER TABLE task_events       ENABLE ROW LEVEL SECURITY;

-- -------------------------
-- workspaces
-- -------------------------

CREATE POLICY "workspaces_select" ON workspaces
  FOR SELECT USING (id IN (SELECT get_my_workspace_ids()));

CREATE POLICY "workspaces_insert" ON workspaces
  FOR INSERT WITH CHECK (true);  -- anyone authenticated can create a workspace

CREATE POLICY "workspaces_update" ON workspaces
  FOR UPDATE USING (id IN (SELECT get_my_workspace_ids()));

CREATE POLICY "workspaces_delete" ON workspaces
  FOR DELETE USING (id IN (SELECT get_my_workspace_ids()));

-- -------------------------
-- workspace_members
-- -------------------------

CREATE POLICY "workspace_members_select" ON workspace_members
  FOR SELECT USING (workspace_id IN (SELECT get_my_workspace_ids()));

CREATE POLICY "workspace_members_insert" ON workspace_members
  FOR INSERT WITH CHECK (workspace_id IN (SELECT get_my_workspace_ids()));

CREATE POLICY "workspace_members_update" ON workspace_members
  FOR UPDATE USING (workspace_id IN (SELECT get_my_workspace_ids()));

CREATE POLICY "workspace_members_delete" ON workspace_members
  FOR DELETE USING (workspace_id IN (SELECT get_my_workspace_ids()));

-- -------------------------
-- agents
-- -------------------------

CREATE POLICY "agents_select" ON agents
  FOR SELECT USING (workspace_id IN (SELECT get_my_workspace_ids()));

CREATE POLICY "agents_insert" ON agents
  FOR INSERT WITH CHECK (workspace_id IN (SELECT get_my_workspace_ids()));

CREATE POLICY "agents_update" ON agents
  FOR UPDATE USING (workspace_id IN (SELECT get_my_workspace_ids()));

CREATE POLICY "agents_delete" ON agents
  FOR DELETE USING (workspace_id IN (SELECT get_my_workspace_ids()));

-- -------------------------
-- agent_status
-- -------------------------

CREATE POLICY "agent_status_select" ON agent_status
  FOR SELECT USING (
    agent_id IN (
      SELECT id FROM agents WHERE workspace_id IN (SELECT get_my_workspace_ids())
    )
  );

CREATE POLICY "agent_status_insert" ON agent_status
  FOR INSERT WITH CHECK (
    agent_id IN (
      SELECT id FROM agents WHERE workspace_id IN (SELECT get_my_workspace_ids())
    )
  );

CREATE POLICY "agent_status_update" ON agent_status
  FOR UPDATE USING (
    agent_id IN (
      SELECT id FROM agents WHERE workspace_id IN (SELECT get_my_workspace_ids())
    )
  );

-- -------------------------
-- tasks
-- -------------------------

CREATE POLICY "tasks_select" ON tasks
  FOR SELECT USING (workspace_id IN (SELECT get_my_workspace_ids()));

CREATE POLICY "tasks_insert" ON tasks
  FOR INSERT WITH CHECK (workspace_id IN (SELECT get_my_workspace_ids()));

CREATE POLICY "tasks_update" ON tasks
  FOR UPDATE USING (workspace_id IN (SELECT get_my_workspace_ids()));

CREATE POLICY "tasks_delete" ON tasks
  FOR DELETE USING (workspace_id IN (SELECT get_my_workspace_ids()));

-- -------------------------
-- task_artifacts
-- -------------------------

CREATE POLICY "task_artifacts_select" ON task_artifacts
  FOR SELECT USING (workspace_id IN (SELECT get_my_workspace_ids()));

CREATE POLICY "task_artifacts_insert" ON task_artifacts
  FOR INSERT WITH CHECK (workspace_id IN (SELECT get_my_workspace_ids()));

CREATE POLICY "task_artifacts_update" ON task_artifacts
  FOR UPDATE USING (workspace_id IN (SELECT get_my_workspace_ids()));

CREATE POLICY "task_artifacts_delete" ON task_artifacts
  FOR DELETE USING (workspace_id IN (SELECT get_my_workspace_ids()));

-- -------------------------
-- task_events (append-only — SELECT + INSERT only, no UPDATE/DELETE)
-- -------------------------

CREATE POLICY "task_events_select" ON task_events
  FOR SELECT USING (workspace_id IN (SELECT get_my_workspace_ids()));

CREATE POLICY "task_events_insert" ON task_events
  FOR INSERT WITH CHECK (workspace_id IN (SELECT get_my_workspace_ids()));

-- No UPDATE or DELETE policies for task_events — intentionally omitted.
-- The absence of policies (with RLS enabled) means these operations are denied.
