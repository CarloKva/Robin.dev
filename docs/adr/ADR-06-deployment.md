# ADR-06: Orchestrator Deployment Strategy

**Status:** Accepted
**Date:** 2026-02-26
**Deciders:** Carlo Ferrero

---

## Context

The orchestrator is a long-running Node.js process on a Hetzner VPS. It must:
- Start automatically on VPS boot
- Restart itself if it crashes
- Be updatable without manual intervention on every deploy
- Produce logs that can be inspected without connecting to the VPS

---

## Decision

**systemd** manages the process lifecycle. Git + npm + `systemctl restart` is the
update procedure. Betterstack monitors uptime. Logs go to journald.

---

## systemd Unit File

Path: `/etc/systemd/system/robindev-orchestrator.service`

```ini
[Unit]
Description=Robin.dev Orchestrator
After=network.target redis.service
Wants=redis.service

[Service]
Type=simple
User=agent
WorkingDirectory=/home/agent/robindev/apps/orchestrator
EnvironmentFile=/home/agent/.env
ExecStart=/usr/bin/node dist/index.js
Restart=always
RestartSec=5
StandardOutput=journal
StandardError=journal
SyslogIdentifier=robindev-orchestrator
# Memory limit: prevent runaway processes from killing the VPS
MemoryMax=2G

[Install]
WantedBy=multi-user.target
```

**Key choices:**
- `After=redis.service` — Redis starts first; orchestrator won't start without it
- `Restart=always` + `RestartSec=5` — recovers from any crash within 5 seconds
- `EnvironmentFile` — secrets never in the unit file (unit files are world-readable in some configs)
- `MemoryMax=2G` — hard limit; if exceeded, systemd kills and restarts the process
- `User=agent` — non-root user; `agent` has no sudo after initial setup

---

## Update Procedure

Standard update (target downtime: < 30 seconds):

```bash
ssh agent@<vps-ip>
cd ~/robindev
git pull origin main
npm install --workspace=apps/orchestrator
npm run build --workspace=apps/orchestrator
systemctl restart robindev-orchestrator
journalctl -u robindev-orchestrator -f  # watch for 60s
curl -s localhost:3001/health | jq .    # verify health
```

**BullMQ safety during restart:**
- In-flight jobs: systemd sends SIGTERM; Node.js should catch it and call `worker.close()` (graceful shutdown — drains active jobs before exiting)
- Jobs in WAITING/DELAYED state: survive in Redis (persistent), picked up on restart
- Expected behaviour: 0 lost jobs during normal restart

---

## Rollback Procedure

```bash
cd ~/robindev
git log --oneline -5          # identify the previous good commit
git checkout <commit-hash>
npm run build --workspace=apps/orchestrator
systemctl restart robindev-orchestrator
```

Rollback time: < 2 minutes.

---

## Logging

All logs go to journald via `StandardOutput=journal`. Format: structured JSON.

```bash
# Tail live
journalctl -u robindev-orchestrator -f

# Last 100 lines
journalctl -u robindev-orchestrator -n 100

# JSON output (machine-readable)
journalctl -u robindev-orchestrator -o json

# Filter by time
journalctl -u robindev-orchestrator --since "1 hour ago"
```

Log format in application code:
```typescript
// Every log line is JSON with these fields:
{ timestamp, level, jobId?, taskId?, phase?, message, ...extra }
```

---

## Monitoring (Betterstack)

**What is monitored:**
1. **HTTP health check** — Betterstack pings `GET /health` every 60 seconds
2. **Alert condition** — if health check fails for 2 consecutive minutes → alert

**Health endpoint response:**
```json
{
  "status": "ok",
  "uptime": 3600,
  "queueCounts": { "waiting": 2, "active": 1, "failed": 0 },
  "redisConnected": true,
  "version": "1.0.0"
}
```

**Port:** 3001, bound to `127.0.0.1`. Betterstack reaches it via:
- Option A: SSH tunnel (dev/staging)
- Option B: nginx proxy on the VPS that forwards `/health` to localhost:3001 with IP allowlist

**Alert channels:** email (primary) + Slack (secondary).

---

## Consequences

**Positive:**
- Auto-restart on crash (< 5s)
- Structured logs via journald — no log file management
- Update procedure is < 30s downtime
- No external deployment service required (no GitHub Actions, no CI step for VPS)

**Negative:**
- Updates require SSH access to the VPS
- No zero-downtime deploy (systemd restart has a brief gap)
- If the VPS itself goes down, everything goes down (acceptable at this stage)

**Review trigger:** if multiple team members need to deploy, introduce a deploy pipeline. If HA is required, introduce a second VPS with a Redis replica.
