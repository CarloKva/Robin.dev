# Spike 06: BullMQ — Configuration and Patterns

**Date:** 2026-02-26
**Author:** Carlo Ferrero
**Time-box:** 3h
**Output used in:** ADR-05

---

## Problem Statement

BullMQ has many configuration options that affect reliability, performance, and
observability. Choosing wrong defaults (or using defaults) creates hard-to-debug
production problems. This spike documents every relevant option with the choice
made for Robin.dev and why.

---

## Core Concepts

### Job Lifecycle

```
WAITING → ACTIVE → COMPLETED
                 ↓
              FAILED (attempt < maxAttempts)
                 ↓
              WAITING (retry with backoff)
                 ↓
              FAILED (attempt = maxAttempts) → stays in failed set
```

### Key BullMQ primitives

- **Queue** — holds jobs, has no processing logic
- **Worker** — processes jobs from a queue; `concurrency` controls parallelism
- **Job** — unit of work with `data`, `opts`, lifecycle state
- **QueueEvents** — event emitter for observing job lifecycle (used for monitoring)
- **FlowProducer** — creates parent/child job trees (not used in Sprint 2)

---

## Configuration Decisions

### Retry strategy

```typescript
defaultJobOptions: {
  attempts: 3,
  backoff: {
    type: 'exponential',
    delay: 5000,   // 5s → 25s → 125s
  },
}
```

**Why 3 attempts:** most transient errors (rate limits, timeouts) resolve within 2 retries.
A 4th attempt is unlikely to succeed and delays DLQ notification.

**Why exponential backoff starting at 5s:**
- Immediate retry on a rate-limit error would fail again
- 5s → 25s → 125s gives the external service time to recover
- Max wait before DLQ: ~155 seconds (~2.5 minutes)

**Non-retryable errors bypass this:** jobs that throw `retryable: false` errors
are immediately moved to the failed set regardless of `attempts`.

### Concurrency

```typescript
new Worker('tasks', processor, {
  connection,
  concurrency: 2,
})
```

**Why 2:** Claude Code is memory-heavy. Each execution spawns a Node.js process + Claude model context.
Estimated memory per Claude Code job: 400-600MB. With 4GB VPS RAM and ~1GB for OS + orchestrator:
- concurrency 2: ~2.2GB peak → safe
- concurrency 3: ~3.4GB peak → marginal
- concurrency 4: ~4.6GB peak → OOM risk

Start at 2, increase to 3 only after measuring actual memory usage.

### Job retention

```typescript
defaultJobOptions: {
  removeOnComplete: { count: 200, age: 7 * 24 * 3600 },  // keep last 200 or 7 days
  removeOnFail: { count: 100 },                           // keep last 100 failed for DLQ inspection
}
```

**Why not remove immediately:** failed jobs are the "dead letter queue" — we inspect them
to diagnose problems. Keeping 100 failed jobs with full data/logs is essential.

### Stalled jobs

```typescript
new Worker('tasks', processor, {
  connection,
  concurrency: 2,
  stalledInterval: 30000,    // check for stalled jobs every 30s
  maxStalledCount: 1,        // move to failed after 1 stall (not 2)
})
```

**Stalled job:** a worker took a job to ACTIVE but stopped sending heartbeats (e.g., VPS OOM killed the process).
BullMQ detects this and either retries or fails the job.

`maxStalledCount: 1` means a stalled job gets one retry. If it stalls again, it fails.
This prevents infinite loops when a job reliably crashes the worker.

### Job priority

```typescript
// When adding jobs:
await queue.add('process-task', payload, { priority: priorityToNumber(payload.priority) })

function priorityToNumber(p: Priority): number {
  return { urgent: 1, high: 2, medium: 5, low: 10 }[p]
}
```

BullMQ priority is a number where **lower = higher priority** (1 = first).
3 effective levels: urgent (1), normal (5), low (10). High maps to 2.

**Overhead:** priority queues use a sorted set instead of a list — O(log N) instead of O(1).
For our job volumes (< 100 concurrent), this is negligible.

---

## Dead Letter Queue

BullMQ does not have a "DLQ queue" natively. The dead letter pattern is implemented via
the **failed job set** — jobs that exhausted all retries remain in Redis in a failed state.

**Robin.dev approach:**
- Failed jobs stay in the failed set (kept for 100 entries by `removeOnFail`)
- `QueueEvents` listener triggers on `failed` event → calls `NotificationService`
- Manual requeue function: `queue.retryJobs({ state: 'failed', count: N })`

```typescript
// Monitoring failed jobs
const failedCount = (await queue.getJobCounts()).failed
if (failedCount > 3) {
  await notificationService.notifyDLQAlert(failedCount)
}
```

---

## What happens when VPS crashes with an ACTIVE job?

1. Worker process dies, stops sending heartbeats to Redis
2. On next worker start, BullMQ's stall checker detects the orphaned job
3. Job is moved back to WAITING (if `maxStalledCount` not exceeded)
4. New worker instance picks it up and retries

**Guarantee:** with AOF persistence enabled on Redis, no jobs are lost even if both
the VPS and Redis restart. The job data survives in the Redis AOF file.

---

## Bull Board (UI)

Bull Board is an optional web UI for inspecting queues.

```typescript
import { createBullBoard } from '@bull-board/api'
import { BullMQAdapter } from '@bull-board/api/bullMQAdapter'
import { ExpressAdapter } from '@bull-board/express'

const serverAdapter = new ExpressAdapter()
serverAdapter.setBasePath('/admin/queues')
createBullBoard({ queues: [new BullMQAdapter(taskQueue)], serverAdapter })

app.use('/admin/queues', serverAdapter.getRouter())
```

**Decision:** include Bull Board, exposed on localhost only. Access via SSH tunnel:
```bash
ssh -L 3001:localhost:3001 agent@vps-ip
# then open http://localhost:3001/admin/queues
```

This gives real-time visibility into queue state, job history, and failed jobs without
exposing the admin interface to the internet.

---

## QueueEvents for monitoring

```typescript
const queueEvents = new QueueEvents('tasks', { connection })

queueEvents.on('completed', ({ jobId }) => {
  logger.info({ jobId, event: 'completed' })
})
queueEvents.on('failed', ({ jobId, failedReason }) => {
  logger.error({ jobId, event: 'failed', reason: failedReason })
  notificationService.notifyTaskFailed(jobId, failedReason)
})
queueEvents.on('stalled', ({ jobId }) => {
  logger.warn({ jobId, event: 'stalled' })
})
```

---

## Summary of choices

| Parameter | Value | Reason |
|---|---|---|
| `attempts` | 3 | Enough for transient errors, not too many |
| `backoff.type` | exponential | Avoids thundering herd on rate limits |
| `backoff.delay` | 5000ms | 5s base, grows to 125s max |
| `concurrency` | 2 | Memory safety on 4GB VPS |
| `removeOnComplete` | 200 / 7 days | Audit trail without Redis bloat |
| `removeOnFail` | 100 | DLQ inspection history |
| `stalledInterval` | 30s | Fast detection of crashed workers |
| `maxStalledCount` | 1 | One retry on stall, then fail |
| Job priority levels | 4 (maps to 1,2,5,10) | Granular but not overly complex |
| Bull Board | Yes, localhost only | Observability without security risk |
