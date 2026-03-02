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
  serverType?: string;    // default: "cx23"
  image?: string;         // default: "ubuntu-24.04"
  location?: string;      // default: "nbg1"
  sshKeyId?: number;      // Hetzner SSH key ID
  userData: string;       // cloud-init script (bash)
}

export async function createServer(params: CreateServerParams): Promise<HetznerServer> {
  const sshKeyId = params.sshKeyId ?? Number(process.env["HETZNER_SSH_KEY_ID"]);

  const body: Record<string, unknown> = {
    name: params.name,
    server_type: params.serverType ?? "cx23",
    image: params.image ?? "ubuntu-24.04",
    location: params.location ?? "nbg1",
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

// ─── Snapshots ───────────────────────────────────────────────────────────────

export async function createSnapshot(serverId: number, description?: string): Promise<{ id: number }> {
  const res = await fetch(`${HETZNER_API}/servers/${serverId}/actions/create_image`, {
    method: "POST",
    headers: headers(),
    body: JSON.stringify({
      type: "snapshot",
      description: description ?? `robin-base-${new Date().toISOString().slice(0, 10)}`,
    }),
  });

  if (!res.ok) {
    const errBody = await res.text().catch(() => "");
    throw new Error(`Hetzner createSnapshot failed: ${res.status} ${errBody}`);
  }

  const data = (await res.json()) as { image: { id: number } };
  return { id: data.image.id };
}

export async function powerOffServer(serverId: number): Promise<void> {
  const res = await fetch(`${HETZNER_API}/servers/${serverId}/actions/shutdown`, {
    method: "POST",
    headers: headers(),
    body: JSON.stringify({}),
  });

  if (!res.ok) {
    const errBody = await res.text().catch(() => "");
    throw new Error(`Hetzner powerOff failed: ${res.status} ${errBody}`);
  }
}

export async function waitForServerOff(serverId: number, timeoutMs = 3 * 60 * 1000): Promise<void> {
  const start = Date.now();
  while (Date.now() - start < timeoutMs) {
    await sleep(5_000);
    const status = await getServerStatus(serverId);
    if (status === "off") return;
  }
  throw new Error(`Server ${serverId} did not power off within ${timeoutMs / 1000}s`);
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
  githubCloneToken: string;
  redisUrl?: string;
  redisCaCert?: string;
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
  const baseRepoUrl = params.orchestratorRepoUrl ?? "https://github.com/CarloKva/Robin.dev.git";
  const repoUrl = baseRepoUrl.replace("https://", `https://x-access-token:${params.githubCloneToken}@`);
  const redisUrl = params.redisUrl ?? "redis://127.0.0.1:6379";
  const redisCaCertLine = params.redisCaCert
    ? `REDIS_CA_CERT=${params.redisCaCert}`
    : "";

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

# ── Claude Code CLI ──────────────────────────────────────────────────────────
npm install -g @anthropic-ai/claude-code 2>/dev/null || true
echo "[robin] Claude Code: $(claude --version 2>/dev/null || echo 'not found')"

# ── Create non-root agent user ────────────────────────────────────────────────
useradd -m -s /bin/bash agent 2>/dev/null || true

# ── Clone orchestrator ───────────────────────────────────────────────────────
mkdir -p /opt/robin
git clone --depth=1 ${repoUrl} /opt/robin/app
cd /opt/robin/app

# ── Install dependencies ─────────────────────────────────────────────────────
npm install --workspaces --if-present 2>/dev/null || npm install
cd apps/orchestrator

# Build (devDependencies like @types/* are already installed by the workspace step)
npm run build

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
${redisCaCertLine}
AGENT_HOME=/home/agent
ENVEOF

echo "[robin] .env written"

# ── Set ownership so agent user can read/write everything ─────────────────────
chown -R agent:agent /opt/robin
mkdir -p /home/agent/repos
chown -R agent:agent /home/agent

# ── GitHub token helper (Node ESM — no external deps) ────────────────────────
cat > /opt/robin/get-github-token.mjs << 'JSEOF'
import crypto from 'node:crypto';
const appId = process.env.GITHUB_APP_ID;
const privateKeyB64 = process.env.GITHUB_APP_PRIVATE_KEY_B64;
const installationId = Number(process.env.GITHUB_INSTALLATION_ID);
if (!appId || !privateKeyB64 || !installationId) process.exit(1);
const privateKey = Buffer.from(privateKeyB64, 'base64').toString('utf-8');
const now = Math.floor(Date.now() / 1000);
const h = Buffer.from(JSON.stringify({ alg: 'RS256', typ: 'JWT' })).toString('base64url');
const p = Buffer.from(JSON.stringify({ iat: now - 60, exp: now + 600, iss: appId })).toString('base64url');
const sign = crypto.createSign('RSA-SHA256');
sign.update(h + '.' + p);
const jwt = h + '.' + p + '.' + sign.sign(privateKey, 'base64url');
const res = await fetch('https://api.github.com/app/installations/' + installationId + '/access_tokens', {
  method: 'POST',
  headers: {
    Authorization: 'Bearer ' + jwt,
    Accept: 'application/vnd.github+json',
    'X-GitHub-Api-Version': '2022-11-28',
  },
});
const data = await res.json();
if (data.token) process.stdout.write(data.token);
else process.exit(1);
JSEOF

# ── Startup wrapper: pull latest main, rebuild if updated, then exec node ─────
cat > /opt/robin/start.sh << 'STARTEOF'
#!/bin/bash
# Robin.dev orchestrator startup wrapper.
# On every (re)start: refreshes GitHub token, pulls latest main,
# rebuilds only if code changed, then hands off to node.
APP_DIR=/opt/robin/app
log() { echo "[robin-start] $*"; }
log "=== Startup at $(date) ==="

# ── Refresh GitHub App token so git pull works for private repos ──────────────
TOKEN=$(node /opt/robin/get-github-token.mjs 2>/dev/null || true)
if [ -n "\${TOKEN}" ]; then
  BASE=$(git -C "$APP_DIR" remote get-url origin 2>/dev/null \
    | sed 's|https://[^@]*@||;s|^https://||' || true)
  if [ -n "\${BASE}" ]; then
    git -C "$APP_DIR" remote set-url origin "https://x-access-token:\${TOKEN}@\${BASE}" 2>/dev/null || true
    log "GitHub token refreshed"
  fi
else
  log "Could not get GitHub token — git pull may fail for private repos"
fi

# ── Pull latest code from main ────────────────────────────────────────────────
BEFORE=$(git -C "$APP_DIR" rev-parse HEAD 2>/dev/null || echo "")
if git -C "$APP_DIR" pull origin main --ff-only 2>&1; then
  AFTER=$(git -C "$APP_DIR" rev-parse HEAD 2>/dev/null || echo "")
  if [ -n "$BEFORE" ] && [ "$BEFORE" != "$AFTER" ]; then
    log "Updated \${BEFORE:0:7} → \${AFTER:0:7}, rebuilding..."
    cd "$APP_DIR"
    npm install --workspaces --if-present 2>/dev/null || true
    npm run build --workspace=apps/orchestrator 2>/dev/null || true
    log "Build complete"
  else
    log "Already up to date"
  fi
else
  log "git pull failed — continuing with current code"
fi

# ── Hand off to orchestrator ──────────────────────────────────────────────────
log "Starting orchestrator..."
exec node "$APP_DIR/apps/orchestrator/dist/index.js"
STARTEOF
chmod +x /opt/robin/start.sh

echo "[robin] Startup wrapper written"

# ── Systemd service ───────────────────────────────────────────────────────────
cat > /etc/systemd/system/robin-orchestrator.service << 'SVCEOF'
[Unit]
Description=Robin.dev Orchestrator
After=network.target

[Service]
Type=simple
User=agent
WorkingDirectory=/opt/robin
ExecStart=/opt/robin/start.sh
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

// ─── Snapshot-based cloud-init (lightweight) ─────────────────────────────────

interface SnapshotCloudInitParams {
  agentId: string;
  workspaceId: string;
  supabaseUrl: string;
  supabaseServiceRoleKey: string;
  anthropicApiKey: string;
  githubAppId: string;
  githubAppPrivateKeyB64: string;
  githubInstallationId: number;
  githubCloneToken: string;
  redisUrl?: string;
  redisCaCert?: string;
}

/**
 * Lightweight cloud-init for snapshot-based provisioning.
 * Everything is pre-installed in the snapshot — this only:
 *   1. Writes the agent-specific .env
 *   2. Pulls latest code + rebuilds
 *   3. Restarts the systemd service
 */
export function buildSnapshotCloudInitScript(params: SnapshotCloudInitParams): string {
  const redisUrl = params.redisUrl ?? "redis://127.0.0.1:6379";
  const redisCaCertLine = params.redisCaCert
    ? `REDIS_CA_CERT=${params.redisCaCert}`
    : "";

  return `#!/bin/bash
set -euo pipefail
exec > >(tee -a /var/log/cloud-init-output.log) 2>&1

echo "[robin] Snapshot cloud-init starting at $(date)"

# ── Write agent-specific .env ───────────────────────────────────────────────
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
${redisCaCertLine}
AGENT_HOME=/home/agent
ENVEOF

echo "[robin] .env written"

# ── Pull latest code using a fresh GitHub token ────────────────────────────
TOKEN=$(sudo -u agent node /opt/robin/get-github-token.mjs 2>/dev/null || true)
if [ -n "\${TOKEN}" ]; then
  APP_DIR=/opt/robin/app
  BASE=$(git -C "$APP_DIR" remote get-url origin 2>/dev/null \\
    | sed 's|https://[^@]*@||;s|^https://||' || true)
  if [ -n "\${BASE}" ]; then
    git -C "$APP_DIR" remote set-url origin "https://x-access-token:\${TOKEN}@\${BASE}"
  fi
  cd "$APP_DIR"
  git pull origin main --ff-only 2>&1 || true
  npm install --workspaces --if-present 2>/dev/null || true
  npm run build --workspace=apps/orchestrator
  chown -R agent:agent /opt/robin
  echo "[robin] Code updated and rebuilt"
fi

# ── Restart the orchestrator service ────────────────────────────────────────
systemctl restart robin-orchestrator

echo "[robin] Snapshot cloud-init completed at $(date)"
`;
}

// ─── Utility ──────────────────────────────────────────────────────────────────

function sleep(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}
