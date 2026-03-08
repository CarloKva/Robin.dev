-- =============================================================================
-- Robin.dev — KVA Room Connector: migration 0018
-- Adds tables and columns required by the connector integration layer.
-- =============================================================================

-- KVA SSO user sync: maps KVA Room users to Robin Dev workspaces
CREATE TABLE IF NOT EXISTS kva_connector_users (
  id              UUID        PRIMARY KEY DEFAULT gen_random_uuid(),
  kva_user_id     TEXT        UNIQUE NOT NULL,
  email           TEXT        NOT NULL,
  name            TEXT        NOT NULL,
  role            TEXT        NOT NULL DEFAULT 'viewer',
  kva_venture_id  TEXT        NOT NULL DEFAULT 'robin-dev',
  workspace_id    UUID        REFERENCES workspaces(id) ON DELETE SET NULL,
  created_at      TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at      TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_kva_connector_users_workspace_id
  ON kva_connector_users(workspace_id);

-- Connector webhook subscriptions: registered by the Room via POST /api/connector/subscribe
CREATE TABLE IF NOT EXISTS connector_webhook_subscriptions (
  id          UUID        PRIMARY KEY DEFAULT gen_random_uuid(),
  url         TEXT        NOT NULL,
  events      TEXT[]      NOT NULL DEFAULT '{}',
  active      BOOLEAN     NOT NULL DEFAULT true,
  created_at  TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at  TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- AI readability flag: marks entities safe/ready for Room indexing
ALTER TABLE tasks
  ADD COLUMN IF NOT EXISTS ai_readable BOOLEAN NOT NULL DEFAULT false;
