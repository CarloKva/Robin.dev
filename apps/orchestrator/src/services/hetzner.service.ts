/**
 * Hetzner Cloud API client.
 * Used by the agent provisioning worker to create/delete VPS instances.
 *
 * Docs: https://docs.hetzner.cloud/
 */

const HETZNER_API = "https://api.hetzner.cloud/v1";

function getToken(): string {
  const token = process.env["HETZNER_API_TOKEN"];
  if (!token) throw new Error("HETZNER_API_TOKEN env var is required for provisioning");
  return token;
}

function headers() {
  return {
    Authorization: `Bearer ${getToken()}`,
    "Content-Type": "application/json",
  };
}

// ─── Types ────────────────────────────────────────────────────────────────────

export interface HetznerServer {
  id: number;
  name: string;
  status: "initializing" | "starting" | "running" | "stopping" | "off" | "deleting" | "migrating" | "rebuilding" | "unknown";
  public_net: {
    ipv4: { ip: string } | null;
  };
  created: string;
}

// ─── Create server ────────────────────────────────────────────────────────────

export interface CreateServerParams {
  name: string;           // e.g. "robin-agent-{agentId}"
  serverType?: string;    // default: "cx22"
  image?: string;         // default: "ubuntu-24.04"
  location?: string;      // default: "fsn1"
  sshKeyId?: number;      // Hetzner SSH key ID
  userData: string;       // cloud-init script (bash)
}

export async function createServer(params: CreateServerParams): Promise<HetznerServer> {
  const sshKeyId = params.sshKeyId ?? Number(process.env["HETZNER_SSH_KEY_ID"]);

  const body: Record<string, unknown> = {
    name: params.name,
    server_type: params.serverType ?? "cx22",
    image: params.image ?? "ubuntu-24.04",
    location: params.location ?? "fsn1",
    user_data: params.userData,
  };

  if (sshKeyId && !isNaN(sshKeyId)) {
    body["ssh_keys"] = [sshKeyId];
  }

  const res = await fetch(`${HETZNER_API}/servers`, {
    method: "POST",
    headers: headers(),
    body: JSON.stringify(body),
  });

  if (!res.ok) {
    const errBody = await res.text().catch(() => "");
    throw new Error(`Hetzner createServer failed: ${res.status} ${errBody}`);
  }

  const data = (await res.json()) as { server: HetznerServer };
  return data.server;
}

// ─── Get server status ────────────────────────────────────────────────────────

export async function getServerStatus(serverId: number): Promise<HetznerServer["status"]> {
  const res = await fetch(`${HETZNER_API}/servers/${serverId}`, {
    headers: headers(),
  });

  if (!res.ok) {
    if (res.status === 404) return "unknown";
    const errBody = await res.text().catch(() => "");
    throw new Error(`Hetzner getServer failed: ${res.status} ${errBody}`);
  }

  const data = (await res.json()) as { server: HetznerServer };
  return data.server.status;
}

// ─── Delete server ────────────────────────────────────────────────────────────

/**
 * Deletes a Hetzner server by ID.
 * Returns true if deleted, false if it was already gone (404).
 */
export async function deleteServer(serverId: number): Promise<boolean> {
  const res = await fetch(`${HETZNER_API}/servers/${serverId}`, {
    method: "DELETE",
    headers: headers(),
  });

  if (res.status === 404) return false;  // already gone

  if (!res.ok) {
    const errBody = await res.text().catch(() => "");
    throw new Error(`Hetzner deleteServer failed: ${res.status} ${errBody}`);
  }

  return true;
}

// ─── Poll until server is running ─────────────────────────────────────────────

/**
 * Polls Hetzner until the server reaches "running" status.
 * Returns the IP address once ready.
 * Throws if timeout exceeded.
 */
export async function waitForServerRunning(
  serverId: number,
  timeoutMs = 5 * 60 * 1000   // 5 minutes
): Promise<string> {
  const start = Date.now();

  while (Date.now() - start < timeoutMs) {
    const elapsed = Date.now() - start;
    const interval = elapsed < 60_000 ? 5_000 : 10_000;

    await sleep(interval);

    const res = await fetch(`${HETZNER_API}/servers/${serverId}`, {
      headers: headers(),
    });

    if (!res.ok) continue;

    const data = (await res.json()) as { server: HetznerServer };
    const server = data.server;

    if (server.status === "running") {
      const ip = server.public_net.ipv4?.ip;
      if (!ip) throw new Error("Server running but no IPv4 address assigned");
      return ip;
    }
  }

  throw new Error(`Server ${serverId} did not reach 'running' in ${timeoutMs / 1000}s`);
}

// ─── Poll until orchestrator health endpoint responds ─────────────────────────

/**
 * Polls the orchestrator's /health endpoint until it responds with 200.
 * This is the final gate: VPS is fully set up and orchestrator is running.
 */
export async function waitForOrchestratorHealth(
  vpsIp: string,
  port = 3001,
  timeoutMs = 5 * 60 * 1000   // 5 minutes
): Promise<void> {
  const start = Date.now();
  const url = `http://${vpsIp}:${port}/health`;

  while (Date.now() - start < timeoutMs) {
    await sleep(10_000);

    try {
      const res = await fetch(url, { signal: AbortSignal.timeout(5_000) });
      if (res.ok) return;
    } catch {
      // Not ready yet — continue polling
    }
  }

  throw new Error(
    `Orchestrator at ${url} did not respond in ${timeoutMs / 1000}s — check cloud-init log via SSH`
  );
}

// ─── Cloud-init script generation ────────────────────────────────────────────

interface CloudInitParams {
  agentId: string;
  workspaceId: string;
  supabaseUrl: string;
  supabaseServiceRoleKey: string;
  anthropicApiKey: string;
  githubAppId: string;
  githubAppPrivateKeyB64: string;
  githubInstallationId: number;
  redisUrl?: string;
  orchestratorRepoUrl?: string;
}

/**
 * Generates the cloud-init user_data script for the VPS.
 * The script installs Node.js, Redis, clones the orchestrator, configures
 * environment variables, and starts the systemd service.
 *
 * Security note (ADR-11): credentials are embedded in user_data for the pilot.
 * Future: migrate to a bootstrap-token pattern.
 */
export function buildCloudInitScript(params: CloudInitParams): string {
  const repoUrl = params.orchestratorRepoUrl ?? "https://github.com/CarloKva/Robin.dev.git";
  const redisUrl = params.redisUrl ?? "redis://127.0.0.1:6379";

  return `#!/bin/bash
set -euo pipefail

# Log everything to cloud-init output for debugging
exec > >(tee -a /var/log/cloud-init-output.log) 2>&1

echo "[robin] Starting cloud-init setup at $(date)"

# ── System update ────────────────────────────────────────────────────────────
apt-get update -qq
apt-get upgrade -y -qq

# ── Dependencies ────────────────────────────────────────────────────────────
apt-get install -y -qq curl git

# ── Node.js 22 LTS ──────────────────────────────────────────────────────────
curl -fsSL https://deb.nodesource.com/setup_22.x | bash - 2>/dev/null
apt-get install -y -qq nodejs

echo "[robin] Node.js $(node --version) installed"

# ── Redis (local, loopback only) ─────────────────────────────────────────────
apt-get install -y -qq redis-server
sed -i 's/^bind 127.0.0.1.*/bind 127.0.0.1/' /etc/redis/redis.conf
systemctl enable redis-server
systemctl start redis-server

echo "[robin] Redis started"

# ── Claude Code CLI ──────────────────────────────────────────────────────────
npm install -g @anthropic-ai/claude-code 2>/dev/null || true
echo "[robin] Claude Code: $(claude --version 2>/dev/null || echo 'not found')"

# ── Clone orchestrator ───────────────────────────────────────────────────────
mkdir -p /opt/robin
git clone --depth=1 ${repoUrl} /opt/robin/app
cd /opt/robin/app

# ── Install dependencies ─────────────────────────────────────────────────────
npm install --workspaces --if-present 2>/dev/null || npm install
cd apps/orchestrator
npm install --production 2>/dev/null || true

# Build if needed
npm run build 2>/dev/null || true

# ── Write .env ───────────────────────────────────────────────────────────────
cat > /opt/robin/app/apps/orchestrator/.env << 'ENVEOF'
AGENT_ID=${params.agentId}
WORKSPACE_ID=${params.workspaceId}
SUPABASE_URL=${params.supabaseUrl}
SUPABASE_SERVICE_ROLE_KEY=${params.supabaseServiceRoleKey}
ANTHROPIC_API_KEY=${params.anthropicApiKey}
GITHUB_APP_ID=${params.githubAppId}
GITHUB_APP_PRIVATE_KEY_B64=${params.githubAppPrivateKeyB64}
GITHUB_INSTALLATION_ID=${params.githubInstallationId}
REDIS_URL=${redisUrl}
AGENT_HOME=/home/agent
ENVEOF

echo "[robin] .env written"

# ── Systemd service ───────────────────────────────────────────────────────────
cat > /etc/systemd/system/robin-orchestrator.service << 'SVCEOF'
[Unit]
Description=Robin.dev Orchestrator
After=network.target redis-server.service

[Service]
Type=simple
User=root
WorkingDirectory=/opt/robin/app/apps/orchestrator
ExecStart=/usr/bin/node dist/index.js
Restart=always
RestartSec=10
EnvironmentFile=/opt/robin/app/apps/orchestrator/.env
StandardOutput=journal
StandardError=journal

[Install]
WantedBy=multi-user.target
SVCEOF

systemctl daemon-reload
systemctl enable robin-orchestrator
systemctl start robin-orchestrator

echo "[robin] Orchestrator service started"

# ── Wait for orchestrator health check ────────────────────────────────────────
for i in $(seq 1 30); do
  if curl -s http://127.0.0.1:3001/health > /dev/null 2>&1; then
    echo "[robin] Health check passed after \${i}0s"
    break
  fi
  sleep 10
done

echo "[robin] Cloud-init completed at $(date)"
`;
}

// ─── Utility ──────────────────────────────────────────────────────────────────

function sleep(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}
