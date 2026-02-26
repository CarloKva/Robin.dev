# Runbook: Update Orchestrator

**Audience:** operator (Carlo)
**Target downtime:** < 30 seconds
**Tested:** Sprint 2

---

## Standard Update

Run these commands in order. Do not skip steps.

```bash
# 1. Connect to VPS
ssh agent@<vps-ip>

# 2. Pull latest code
cd ~/robindev
git pull origin main

# 3. Install any new dependencies
npm install --workspace=apps/orchestrator

# 4. Rebuild TypeScript
npm run build --workspace=apps/orchestrator

# 5. Restart the service
systemctl restart robindev-orchestrator

# 6. Watch logs for 60 seconds — look for errors
journalctl -u robindev-orchestrator -f -n 50

# 7. Verify health endpoint
curl -s localhost:3001/health | jq .
# Expected: { "status": "ok", ... }
```

**Done.** If step 7 returns `status: "ok"`, the update succeeded.

---

## Rollback

If the new version has a bug:

```bash
# Identify the previous good commit
git log --oneline -5

# Roll back to it
git checkout <commit-hash>

# Rebuild and restart
npm run build --workspace=apps/orchestrator
systemctl restart robindev-orchestrator

# Verify
curl -s localhost:3001/health | jq .
```

After rollback, open a GitHub issue describing the problem before re-deploying.

---

## What happens to in-flight jobs during restart?

1. systemd sends SIGTERM to the Node.js process
2. The process catches SIGTERM and calls `worker.close()` (graceful shutdown)
3. `worker.close()` stops accepting new jobs and waits for active jobs to finish
4. Timeout: if an active job doesn't finish within 30s, it is forcibly terminated
5. Forcibly terminated jobs re-enter the WAITING state in Redis (not lost)
6. The new process starts and picks them up

**Result:** 0 lost jobs during a normal restart. At most, one job may be retried if
it was in mid-execution when the restart occurred.

---

## Checking service status

```bash
# Is it running?
systemctl status robindev-orchestrator

# View recent logs
journalctl -u robindev-orchestrator -n 100

# View logs since last restart
journalctl -u robindev-orchestrator --since "$(systemctl show robindev-orchestrator --property=ActiveEnterTimestamp | cut -d= -f2)"

# View logs in JSON format (for grepping)
journalctl -u robindev-orchestrator -o json | jq 'select(.MESSAGE | contains("ERROR"))'
```

---

## Checking queue state

Via Bull Board (SSH tunnel):
```bash
# From your local machine:
ssh -L 3001:localhost:3001 agent@<vps-ip> -N &
# Then open: http://localhost:3001/admin/queues
```

Via Redis CLI:
```bash
redis-cli -u $REDIS_URL
> KEYS bull:tasks:*     # all queue keys
> LLEN bull:tasks:wait  # jobs waiting
> LLEN bull:tasks:active # jobs active
```

---

## Emergency: restart Redis

Only needed if Redis becomes unresponsive.

```bash
systemctl restart redis

# Verify
redis-cli -u $REDIS_URL ping   # should return PONG

# Restart orchestrator after Redis
systemctl restart robindev-orchestrator
```

BullMQ jobs are durable (AOF enabled) — they survive Redis restarts.
