# Spike 05: Redis — Upstash Managed vs Self-Hosted on VPS

**Date:** 2026-02-26
**Author:** Carlo Ferrero
**Time-box:** 2h
**Output used in:** ADR-04

---

## Problem Statement

Robin.dev's orchestrator uses BullMQ as its job queue. BullMQ requires Redis.
The question is where Redis runs: as a managed cloud service (Upstash) or
self-hosted on the same VPS as the orchestrator.

---

## Option A: Upstash (managed Redis)

### What it is
Upstash provides serverless Redis. You create a database, get a connection URL,
and never touch infrastructure. Pricing is per-command (not per-hour).

### Pricing analysis
- Free tier: 10,000 commands/day → ~300k/month
- Estimated Robin.dev usage at steady state (500 jobs/month, ~200 BullMQ commands/job):
  ~100k commands/month → **free tier sufficient for early stage**
- Pay-as-you-go above free tier: $0.2 per 100k commands → negligible

### BullMQ compatibility
Upstash supports Redis protocol but has **two critical limitations**:
1. **No keyspace notifications** — BullMQ uses `SUBSCRIBE`/`PSUBSCRIBE` for delayed jobs and rate limiting. Upstash does not support Pub/Sub channels. BullMQ falls back to polling, which adds ~1s latency on delayed jobs.
2. **HTTP-only mode is not compatible** — BullMQ requires raw TCP Redis connection (ioredis), not HTTP. Upstash's regular Redis (non-serverless) supports TCP and works.

### Latency from VPS Helsinki → Upstash EU
- Upstash EU endpoint: Frankfurt (~1200km from Helsinki)
- Measured round-trip: ~15-25ms per command
- BullMQ processes one job with ~20 Redis round-trips = **300-500ms overhead per job**
- For a task that takes 5-10 minutes, this is negligible (<0.1% of total time)

### Operability
- Zero maintenance: no upgrades, no backups, no memory management
- Failover: handled by Upstash (99.99% SLA)
- Monitoring: Upstash dashboard shows commands/second, latency, errors

### Risk
- External dependency: if Upstash has an outage, the queue stops
- VPS + Upstash outage are independent — partial resilience
- Vendor lock-in is low: Redis protocol is standard

---

## Option B: Redis self-hosted on the VPS

### What it is
Redis process running alongside the orchestrator on the same Hetzner VPS (CX23: 2 vCPU, 4GB RAM).

### Resource usage
- Redis idle memory: ~5MB
- Redis under BullMQ load (10 concurrent jobs, 1000 stored job histories): ~50-100MB
- CPU impact: negligible
- Leaves ~3.8GB for Node.js + Claude Code processes

### Performance
- Loopback latency (localhost): < 0.1ms per command
- No network overhead
- BullMQ real-time features (keyspace notifications, Pub/Sub) work fully

### Operability
- Persistence: configure AOF (Append-Only File) for durability — if VPS restarts, queue state survives
- Backup: `redis-cli BGSAVE` + copy RDB file, or volume snapshot via Hetzner
- Monitoring: `redis-cli INFO` + `redis-cli MONITOR` for debugging
- Upgrades: `apt upgrade redis-server` — done in < 30 seconds

### Single Point of Failure
- If the VPS goes down, both the orchestrator AND Redis are unavailable
- However: BullMQ's `DURABLE` job storage means jobs survive Redis restart (AOF enabled)
- This SPOF is acceptable at early stage: we don't yet have SLAs with clients

### Memory risk with Claude Code
- 2-3 concurrent Claude Code processes × ~500MB each = 1-1.5GB
- Redis: ~100MB
- Node.js orchestrator: ~200MB
- Total under load: ~2GB — safe headroom on 4GB VPS

---

## Comparison Matrix

| Criterion | Upstash | Self-Hosted |
|---|---|---|
| Setup time | 5 minutes | 30 minutes |
| Maintenance | Zero | Low (monthly) |
| Monthly cost | Free (early stage) | Included in VPS |
| Latency | 15-25ms/cmd | < 0.1ms/cmd |
| BullMQ compatibility | Partial (no keyspace notif) | Full |
| Reliability | 99.99% SLA | Depends on VPS |
| SPOF risk | Low (independent failure) | High (same machine) |
| Debuggability | Dashboard only | Full redis-cli access |

---

## Recommendation

**Self-hosted on the VPS.**

Rationale:
1. **BullMQ compatibility** — full feature support (keyspace notifications, Pub/Sub for real-time job events) without workarounds
2. **Latency** — zero network overhead is valuable for high-frequency BullMQ operations (heartbeats, lock extensions during Claude Code execution)
3. **Debuggability** — `redis-cli` on localhost is invaluable during development
4. **No external dependency** — one less service to configure, authenticate, and monitor during early stage
5. **Cost** — no marginal cost on an already-paid VPS

The SPOF risk is the only real downside, and it is acceptable at this stage. If Robin.dev grows to require HA, the migration to Upstash or Redis Cluster is straightforward (just change `REDIS_URL`).

**Configuration:** AOF persistence enabled, `maxmemory 512mb`, `maxmemory-policy allkeys-lru`.

---

## Configuration snippet

```bash
# /etc/redis/redis.conf additions
appendonly yes
appendfsync everysec
maxmemory 512mb
maxmemory-policy allkeys-lru
requirepass ${REDIS_PASSWORD}
bind 127.0.0.1  # loopback only — never expose to internet
```

```
REDIS_URL=redis://:${REDIS_PASSWORD}@127.0.0.1:6379
```
