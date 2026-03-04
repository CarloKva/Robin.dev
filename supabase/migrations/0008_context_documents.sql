CREATE TABLE context_documents (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  workspace_id UUID NOT NULL REFERENCES workspaces(id) ON DELETE CASCADE,
  title TEXT NOT NULL,
  content TEXT NOT NULL,
  source_repo_full_name TEXT,
  source_path TEXT,
  source_sha TEXT,
  last_synced_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX idx_context_docs_workspace ON context_documents(workspace_id);

ALTER TABLE context_documents ENABLE ROW LEVEL SECURITY;

CREATE POLICY "workspace members" ON context_documents
  USING (workspace_id IN (
    SELECT workspace_id FROM workspace_members WHERE user_id = auth.jwt()->>'sub'
  ));
