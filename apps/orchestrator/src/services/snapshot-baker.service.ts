/**
 * SnapshotBaker — creates a Hetzner snapshot with all dependencies pre-installed.
 *
 * Flow:
 *   1. Create a temp VPS with the full cloud-init (no agent-specific creds)
 *   2. Wait for it to boot and finish setup
 *   3. Power it off
 *   4. Create a snapshot
 *   5. Delete the temp VPS
 *   6. Return the snapshot ID
 *
 * The resulting snapshot has Node.js, Redis, Claude Code, and the built
 * orchestrator ready to go. Provisioning new agents from this snapshot
 * takes ~30s instead of ~5min.
 */

import {
  createServer,
  waitForServerRunning,
  powerOffServer,
  waitForServerOff,
  createSnapshot,
  deleteServer,
} from "./hetzner.service";
import { getInstallationToken } from "./github.service";
import { log } from "../utils/logger";

export async function bakeSnapshot(): Promise<{ snapshotId: number }> {
  const githubAppId = process.env["GITHUB_APP_ID"];
  const githubAppPrivateKeyB64 = process.env["GITHUB_APP_PRIVATE_KEY_B64"];
  const orchestratorRepoUrl = process.env["ORCHESTRATOR_REPO_URL"] ?? "https://github.com/CarloKva/Robin.dev.git";

  if (!githubAppId || !githubAppPrivateKeyB64) {
    throw new Error("Missing GITHUB_APP_ID or GITHUB_APP_PRIVATE_KEY_B64");
  }

  // We need an installation ID to clone. Use the first connected workspace's.
  const { getSupabaseClient } = await import("../db/supabase.client");
  const supabase = getSupabaseClient();
  const { data: conn } = await supabase
    .from("github_connections")
    .select("installation_id")
    .eq("status", "connected")
    .limit(1)
    .maybeSingle();

  if (!conn?.installation_id) {
    throw new Error("No active GitHub connection found — needed for git clone token");
  }

  const cloneToken = await getInstallationToken(
    githubAppId,
    githubAppPrivateKeyB64,
    conn.installation_id as number
  );

  const repoUrl = orchestratorRepoUrl.replace("https://", `https://x-access-token:${cloneToken}@`);

  const userData = `#!/bin/bash
set -euo pipefail
exec > >(tee -a /var/log/cloud-init-output.log) 2>&1

echo "[robin-bake] Starting base image bake at $(date)"

apt-get update -qq
apt-get upgrade -y -qq
apt-get install -y -qq curl git

curl -fsSL https://deb.nodesource.com/setup_22.x | bash - 2>/dev/null
apt-get install -y -qq nodejs

echo "[robin-bake] Node.js $(node --version) installed"

apt-get install -y -qq redis-server
sed -i 's/^bind 127.0.0.1.*/bind 127.0.0.1/' /etc/redis/redis.conf
systemctl enable redis-server
systemctl start redis-server

npm install -g @anthropic-ai/claude-code 2>/dev/null || true
echo "[robin-bake] Claude Code: $(claude --version 2>/dev/null || echo 'not found')"

useradd -m -s /bin/bash agent 2>/dev/null || true

mkdir -p /opt/robin
git clone --depth=1 ${repoUrl} /opt/robin/app
cd /opt/robin/app
npm install --workspaces --if-present 2>/dev/null || npm install
cd apps/orchestrator
npm run build

# Placeholder .env (will be overwritten by snapshot cloud-init)
cat > /opt/robin/app/apps/orchestrator/.env << 'ENVEOF'
AGENT_ID=placeholder
ENVEOF

chown -R agent:agent /opt/robin
mkdir -p /home/agent/repos
chown -R agent:agent /home/agent

# Write the GitHub token helper
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

# Write the start.sh wrapper
cat > /opt/robin/start.sh << 'STARTEOF'
#!/bin/bash
APP_DIR=/opt/robin/app
log() { echo "[robin-start] $*"; }
log "=== Startup at $(date) ==="

TOKEN=$(node /opt/robin/get-github-token.mjs 2>/dev/null || true)
if [ -n "\${TOKEN}" ]; then
  BASE=$(git -C "$APP_DIR" remote get-url origin 2>/dev/null \\
    | sed 's|https://[^@]*@||;s|^https://||' || true)
  if [ -n "\${BASE}" ]; then
    git -C "$APP_DIR" remote set-url origin "https://x-access-token:\${TOKEN}@\${BASE}" 2>/dev/null || true
    log "GitHub token refreshed"
  fi
fi

BEFORE=$(git -C "$APP_DIR" rev-parse HEAD 2>/dev/null || echo "")
if git -C "$APP_DIR" pull origin main --ff-only 2>&1; then
  AFTER=$(git -C "$APP_DIR" rev-parse HEAD 2>/dev/null || echo "")
  if [ -n "$BEFORE" ] && [ "$BEFORE" != "$AFTER" ]; then
    log "Updated \${BEFORE:0:7} -> \${AFTER:0:7}, rebuilding..."
    cd "$APP_DIR"
    npm install --workspaces --if-present 2>/dev/null || true
    npm run build --workspace=apps/orchestrator 2>/dev/null || true
    log "Build complete"
  else
    log "Already up to date"
  fi
fi

log "Starting orchestrator..."
exec node "$APP_DIR/apps/orchestrator/dist/index.js"
STARTEOF
chmod +x /opt/robin/start.sh

# Write systemd service
cat > /etc/systemd/system/robin-orchestrator.service << 'SVCEOF'
[Unit]
Description=Robin.dev Orchestrator
After=network.target redis-server.service

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

# Clean up package caches to shrink snapshot size
apt-get clean
rm -rf /var/lib/apt/lists/*
npm cache clean --force 2>/dev/null || true

# Remove the clone token from git remote URL
git -C /opt/robin/app remote set-url origin "${orchestratorRepoUrl}" 2>/dev/null || true

echo "[robin-bake] Bake completed at $(date)"
`;

  // 1. Create temp VPS
  log.info({}, "Baking snapshot: creating temp VPS");
  const server = await createServer({
    name: `robin-bake-${Date.now()}`,
    userData,
  });

  log.info({ serverId: server.id }, "Bake VPS created, waiting for running status");

  // 2. Wait for running
  await waitForServerRunning(server.id);

  // 3. Wait for cloud-init to finish (poll /var/log/cloud-init-output.log via health)
  // Cloud-init takes ~5min. We poll for the marker line.
  log.info({ serverId: server.id }, "Bake VPS running, waiting for cloud-init to finish (~5min)");
  const bakeStart = Date.now();
  const BAKE_TIMEOUT = 10 * 60 * 1000;
  while (Date.now() - bakeStart < BAKE_TIMEOUT) {
    await new Promise((r) => setTimeout(r, 30_000));
    // We can't SSH in from here, so we rely on a time-based wait.
    // Cloud-init typically finishes in 3-5 minutes.
    if (Date.now() - bakeStart > 6 * 60 * 1000) {
      log.info({}, "Bake: 6 minutes elapsed, assuming cloud-init is complete");
      break;
    }
  }

  // 4. Power off
  log.info({ serverId: server.id }, "Powering off bake VPS");
  await powerOffServer(server.id);
  await waitForServerOff(server.id);

  // 5. Create snapshot
  log.info({ serverId: server.id }, "Creating snapshot");
  const snapshot = await createSnapshot(server.id);
  log.info({ snapshotId: snapshot.id }, "Snapshot created");

  // 6. Delete temp VPS
  await deleteServer(server.id);
  log.info({ serverId: server.id }, "Temp bake VPS deleted");

  return { snapshotId: snapshot.id };
}
