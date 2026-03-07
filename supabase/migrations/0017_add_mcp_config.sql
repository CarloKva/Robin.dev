-- Add mcp_config column to workspaces table
-- Stores MCP server configuration as JSONB for use by workspace agents
ALTER TABLE workspaces
  ADD COLUMN IF NOT EXISTS mcp_config jsonb DEFAULT NULL;
