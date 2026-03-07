-- Migration: add mcp_config JSONB column to workspaces
-- Stores MCP server configuration following the .mcp.json schema of Claude Code.
-- The field is optional (DEFAULT NULL): if not set, no MCP servers are passed to the agent.

ALTER TABLE workspaces
  ADD COLUMN mcp_config JSONB DEFAULT NULL;

ALTER TABLE workspaces
  ADD CONSTRAINT valid_mcp_config CHECK (
    mcp_config IS NULL OR mcp_config ? 'mcpServers'
  );
