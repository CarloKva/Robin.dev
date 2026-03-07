-- Add mcp_config JSONB column to workspaces table
-- Stores MCP server configuration in Claude Code .mcp.json format

ALTER TABLE workspaces
ADD COLUMN mcp_config JSONB DEFAULT NULL;

ALTER TABLE workspaces
ADD CONSTRAINT valid_mcp_config CHECK (
  mcp_config IS NULL OR mcp_config ? 'mcpServers'
);
