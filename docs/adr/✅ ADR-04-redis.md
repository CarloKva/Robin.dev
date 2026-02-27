# ADR-04: Redis — Self-Hosted on VPS

**Status:** Accepted
**Date:** 2026-02-26
**Deciders:** Carlo Ferrero

---

## Context

Robin.dev's orchestrator uses BullMQ as a job queue. BullMQ requires Redis.
Two options were evaluated: Upstash (managed) and Redis self-hosted on the VPS.
See `docs/spikes/spike-05-redis.md` for full analysis.

---

## Decision

**Redis self-hosted on the same Hetzner VPS as the orchestrator.**

---

## Rationale

1. **Full BullMQ compatibility** — Upstash does not support keyspace notifications, which BullMQ uses for delayed jobs and rate limiting. Self-hosted has no such limitation.
2. **Loopback latency** — < 0.1ms vs 15-25ms/command over the network. BullMQ issues ~20 Redis commands per job lifecycle; over hundreds of jobs this matters.
3. **Debuggability** — `redis-cli` on localhost is essential for diagnosing queue problems in development and production.
4. **No additional cost or external dependency** — Redis on the VPS costs nothing extra and removes one external service to authenticate and monitor.
5. **Simplicity** — no account, no API keys, no vendor-specific connection handling.

The only downside is that Redis and the orchestrator share the same failure domain (the VPS). At this stage, with no SLAs, this is acceptable.

---

## Configuration

```ini
# /etc/redis/redis.conf
appendonly yes              # AOF persistence — queue survives restarts
appendfsync everysec        # flush to disk every second (balance durability/performance)
maxmemory 512mb             # hard cap — leaves ~3.5GB for Node.js + Claude Code
maxmemory-policy allkeys-lru # evict LRU keys when at capacity
bind 127.0.0.1              # loopback only — never exposed to the internet
requirepass <REDIS_PASSWORD> # set in environment, never hardcoded
```

Environment variable:
```
REDIS_URL=redis://:${REDIS_PASSWORD}@127.0.0.1:6379
```

---

## Consequences

**Positive:**
- Zero-latency queue operations
- Full BullMQ feature set
- No external dependency
- Simple local debugging

**Negative:**
- VPS is a single point of failure for both the orchestrator and its queue
- Redis requires occasional maintenance (upgrades, memory monitoring)

**Review trigger:** if Robin.dev requires multi-region or HA deployment, migrate to Upstash or Redis Cluster. The migration is a one-line `REDIS_URL` change plus removal of the self-hosted process.
