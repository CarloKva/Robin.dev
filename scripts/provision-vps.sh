#!/usr/bin/env bash
# =============================================================================
# Robin.dev — VPS Provisioning Script
# EPIC-30 · STORY-05.09
#
# Usage: ./scripts/provision-vps.sh \
#          --workspace-slug acme \
#          --github-account acme-org \
#          --supabase-url https://xxx.supabase.co \
#          --supabase-service-key eyJ...
#
# Idempotent: safe to run twice on the same VPS.
# Run as root or sudo-capable user on a fresh Ubuntu 24.04 VPS.
# =============================================================================

set -euo pipefail

# ─── Colours ────────────────────────────────────────────────────────────────
RED='\033[0;31m'; GREEN='\033[0;32m'; YELLOW='\033[1;33m'; NC='\033[0m'
info()    { echo -e "${GREEN}[INFO]${NC}  $*"; }
warn()    { echo -e "${YELLOW}[WARN]${NC}  $*"; }
error()   { echo -e "${RED}[ERROR]${NC} $*" >&2; exit 1; }
step()    { echo -e "\n${GREEN}▶ $*${NC}"; }

# ─── Argument parsing ────────────────────────────────────────────────────────
WORKSPACE_SLUG=""
GITHUB_ACCOUNT=""
SUPABASE_URL=""
SUPABASE_SERVICE_KEY=""
REDIS_URL="redis://127.0.0.1:6379"
ANTHROPIC_API_KEY=""

while [[ $# -gt 0 ]]; do
  case "$1" in
    --workspace-slug)      WORKSPACE_SLUG="$2";      shift 2 ;;
    --github-account)      GITHUB_ACCOUNT="$2";      shift 2 ;;
    --supabase-url)        SUPABASE_URL="$2";        shift 2 ;;
    --supabase-service-key) SUPABASE_SERVICE_KEY="$2"; shift 2 ;;
    --redis-url)           REDIS_URL="$2";           shift 2 ;;
    --anthropic-api-key)   ANTHROPIC_API_KEY="$2";   shift 2 ;;
    *) error "Unknown argument: $1" ;;
  esac
done

# ─── Validation ──────────────────────────────────────────────────────────────
[[ -z "$WORKSPACE_SLUG" ]] && error "--workspace-slug is required"
[[ -z "$GITHUB_ACCOUNT" ]] && error "--github-account is required"
[[ -z "$SUPABASE_URL" ]]   && error "--supabase-url is required"
[[ -z "$SUPABASE_SERVICE_KEY" ]] && error "--supabase-service-key is required"

AGENT_USER="robin"
ROBIN_DIR="/home/${AGENT_USER}/robin-platform"
REPOS_DIR="/home/${AGENT_USER}/repos"

echo "════════════════════════════════════════════════════════"
echo "  Robin.dev VPS Provisioning"
echo "  Workspace: ${WORKSPACE_SLUG}"
echo "  GitHub:    ${GITHUB_ACCOUNT}"
echo "════════════════════════════════════════════════════════"

# ─── PHASE 1: System update ──────────────────────────────────────────────────
step "Phase 1: System update"

apt-get update -qq && apt-get upgrade -y -qq
apt-get install -y -qq git curl wget unzip build-essential lsb-release
info "System updated"

# ─── PHASE 2: Create agent user ──────────────────────────────────────────────
step "Phase 2: Agent user"

if id "$AGENT_USER" &>/dev/null; then
  info "User '${AGENT_USER}' already exists"
else
  useradd -m -s /bin/bash "$AGENT_USER"
  usermod -aG sudo "$AGENT_USER"
  # Copy SSH keys from root so admin can SSH as robin
  mkdir -p "/home/${AGENT_USER}/.ssh"
  if [[ -f /root/.ssh/authorized_keys ]]; then
    cp /root/.ssh/authorized_keys "/home/${AGENT_USER}/.ssh/"
    chown -R "${AGENT_USER}:${AGENT_USER}" "/home/${AGENT_USER}/.ssh"
    chmod 700 "/home/${AGENT_USER}/.ssh"
    chmod 600 "/home/${AGENT_USER}/.ssh/authorized_keys"
  fi
  info "User '${AGENT_USER}' created"
fi

# ─── PHASE 3: Node.js 22 ─────────────────────────────────────────────────────
step "Phase 3: Node.js 22"

if command -v node &>/dev/null && node --version | grep -q "^v22"; then
  info "Node.js 22 already installed: $(node --version)"
else
  curl -fsSL https://deb.nodesource.com/setup_22.x | bash -
  apt-get install -y nodejs
  info "Node.js installed: $(node --version)"
fi

# ─── PHASE 4: Redis ──────────────────────────────────────────────────────────
step "Phase 4: Redis"

if systemctl is-active --quiet redis-server; then
  info "Redis already running"
else
  apt-get install -y redis-server
  # Bind to localhost only (security)
  sed -i 's/^bind .*/bind 127.0.0.1/' /etc/redis/redis.conf
  systemctl enable --quiet redis-server
  systemctl start redis-server
  info "Redis installed and started"
fi

# Verify
redis-cli ping | grep -q "PONG" || error "Redis not responding"

# ─── PHASE 5: Claude Code CLI ────────────────────────────────────────────────
step "Phase 5: Claude Code CLI"

if command -v claude &>/dev/null; then
  info "Claude Code already installed: $(claude --version 2>/dev/null || echo 'version unknown')"
else
  npm install -g @anthropic-ai/claude-code
  info "Claude Code installed"
fi

# ─── PHASE 6: Clone Robin.dev platform ──────────────────────────────────────
step "Phase 6: Robin.dev platform"

if [[ -d "$ROBIN_DIR" ]]; then
  info "Robin platform already cloned — pulling latest"
  sudo -u "$AGENT_USER" bash -c "cd ${ROBIN_DIR} && git pull --ff-only"
else
  sudo -u "$AGENT_USER" git clone \
    https://github.com/CarloKva/Robin.dev.git "$ROBIN_DIR"
  info "Robin platform cloned"
fi

# Install orchestrator dependencies
sudo -u "$AGENT_USER" bash -c "
  cd ${ROBIN_DIR}
  npm install --workspace=packages/shared-types --silent
  npm install --workspace=apps/orchestrator --silent
"
info "Dependencies installed"

# ─── PHASE 7: Generate GitHub deploy key ─────────────────────────────────────
step "Phase 7: GitHub deploy key"

KEY_FILE="/home/${AGENT_USER}/.ssh/id_ed25519_${WORKSPACE_SLUG}"

if [[ -f "${KEY_FILE}" ]]; then
  info "Deploy key already exists: ${KEY_FILE}"
else
  sudo -u "$AGENT_USER" ssh-keygen \
    -t ed25519 \
    -C "robin-agent-${WORKSPACE_SLUG}@robin.dev" \
    -f "$KEY_FILE" \
    -N ""
  info "Deploy key generated"
fi

# Configure SSH alias for the client repo
SSH_CONFIG="/home/${AGENT_USER}/.ssh/config"
if ! grep -q "Host github-${WORKSPACE_SLUG}" "$SSH_CONFIG" 2>/dev/null; then
  sudo -u "$AGENT_USER" bash -c "cat >> ${SSH_CONFIG} << 'EOF'
Host github-${WORKSPACE_SLUG}
  HostName github.com
  User git
  IdentityFile ${KEY_FILE}
  IdentitiesOnly yes
EOF"
  chmod 600 "$SSH_CONFIG"
  chown "${AGENT_USER}:${AGENT_USER}" "$SSH_CONFIG"
fi

# ─── PHASE 8: Write .env file ────────────────────────────────────────────────
step "Phase 8: Environment configuration"

ENV_FILE="${ROBIN_DIR}/apps/orchestrator/.env"

if [[ -f "$ENV_FILE" ]]; then
  info ".env already exists — skipping (edit manually if needed)"
else
  cat > "$ENV_FILE" << EOF
# Robin.dev Orchestrator — ${WORKSPACE_SLUG}
# Generated: $(date -u +"%Y-%m-%dT%H:%M:%SZ")

NODE_ENV=production

SUPABASE_URL=${SUPABASE_URL}
SUPABASE_SERVICE_ROLE_KEY=${SUPABASE_SERVICE_KEY}

REDIS_URL=${REDIS_URL}

ANTHROPIC_API_KEY=${ANTHROPIC_API_KEY}

# Fill these after running create-workspace.ts:
WORKSPACE_ID=
AGENT_ID=

AGENT_HOME=/home/${AGENT_USER}
EOF
  chmod 600 "$ENV_FILE"
  chown "${AGENT_USER}:${AGENT_USER}" "$ENV_FILE"
  info ".env created (WORKSPACE_ID and AGENT_ID still need to be set)"
fi

# ─── PHASE 9: Build orchestrator ─────────────────────────────────────────────
step "Phase 9: Build orchestrator"

sudo -u "$AGENT_USER" bash -c "
  cd ${ROBIN_DIR}
  npm run build --workspace=apps/orchestrator --if-present
" || warn "Build failed — check TypeScript errors before starting service"

# ─── PHASE 10: systemd service ───────────────────────────────────────────────
step "Phase 10: systemd service"

SERVICE_NAME="robin-orchestrator-${WORKSPACE_SLUG}"
SERVICE_FILE="/etc/systemd/system/${SERVICE_NAME}.service"

if [[ -f "$SERVICE_FILE" ]]; then
  info "systemd service already exists"
else
  cat > "$SERVICE_FILE" << EOF
[Unit]
Description=Robin.dev Orchestrator — ${WORKSPACE_SLUG}
After=network.target redis.service
Requires=redis.service

[Service]
Type=simple
User=${AGENT_USER}
WorkingDirectory=${ROBIN_DIR}/apps/orchestrator
EnvironmentFile=${ENV_FILE}
ExecStart=/usr/bin/node dist/index.js
Restart=on-failure
RestartSec=10
StandardOutput=journal
StandardError=journal
SyslogIdentifier=robin-${WORKSPACE_SLUG}

[Install]
WantedBy=multi-user.target
EOF

  systemctl daemon-reload
  systemctl enable --quiet "${SERVICE_NAME}"
  info "systemd service configured (not started — WORKSPACE_ID and AGENT_ID needed first)"
fi

# ─── Summary ─────────────────────────────────────────────────────────────────
echo ""
echo "════════════════════════════════════════════════════════"
echo "  Provisioning complete!"
echo "════════════════════════════════════════════════════════"
echo ""
echo "Next steps (manual):"
echo ""
echo "  1. Add deploy key to GitHub:"
echo "     $(sudo -u ${AGENT_USER} cat ${KEY_FILE}.pub)"
echo ""
echo "  2. Run create-workspace.ts to get WORKSPACE_ID and AGENT_ID:"
echo "     node scripts/create-workspace.ts \\"
echo "       --slug ${WORKSPACE_SLUG} \\"
echo "       --name 'Client Name' \\"
echo "       --clerk-user-id user_xxx"
echo ""
echo "  3. Update .env with WORKSPACE_ID and AGENT_ID:"
echo "     nano ${ENV_FILE}"
echo ""
echo "  4. Start service:"
echo "     systemctl start ${SERVICE_NAME}"
echo "     journalctl -u ${SERVICE_NAME} -f"
echo ""
echo "  5. Run smoke test from Robin.dev machine:"
echo "     node scripts/smoke-test.ts --workspace-id <uuid>"
echo ""
