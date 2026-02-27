# ADR-05: BullMQ Configuration

**Status:** Accepted
**Date:** 2026-02-26
**Deciders:** Carlo Ferrero

---

## Context

BullMQ is the job queue library. Its defaults are not appropriate for production.
Every non-default choice needs an explicit justification so that when a job
fails at 2am, the on-call person (me) knows exactly what will happen and why.
See `docs/spikes/spike-06-bullmq.md` for full analysis.

---

## Decision

The following configuration is canonical for Robin.dev. It lives in
`apps/orchestrator/src/config/bullmq.config.ts` and is never duplicated.

---

## Queue Configuration

```typescript
export const QUEUE_NAME = 'tasks'

export const defaultJobOptions: DefaultJobOptions = {
  attempts: 3,
  backoff: {
    type: 'exponential',
    delay: 5000,  // 5s → 25s → 125s
  },
  removeOnComplete: { count: 200, age: 7 * 24 * 3600 },
  removeOnFail: { count: 100 },
}
```

---

## Worker Configuration

```typescript
export const workerOptions: WorkerOptions = {
  concurrency: 2,
  stalledInterval: 30_000,
  maxStalledCount: 1,
}
```

---

## Job Priority

```typescript
export function priorityToNumber(p: TaskPriority): number {
  const map: Record<TaskPriority, number> = {
    urgent: 1,
    high:   2,
    medium: 5,
    low:    10,
  }
  return map[p]
}
```

BullMQ priority: lower number = processed first.

---

## Rationale for each setting

| Setting | Value | Reason |
|---|---|---|
| `attempts` | 3 | Handles transient errors (rate limits, timeouts) without excessive delay |
| `backoff.type` | exponential | Avoids retry storms on external service failures |
| `backoff.delay` | 5000ms | 5s → 25s → 125s; max ~2.5 min before DLQ |
| `removeOnComplete.count` | 200 | Audit trail of recent successful jobs |
| `removeOnComplete.age` | 7 days | Auto-cleanup of old records |
| `removeOnFail.count` | 100 | Dead letter queue: keep failed jobs for inspection |
| `concurrency` | 2 | Memory safety: 2 × ~500MB Claude Code = ~1GB; fits in 4GB VPS |
| `stalledInterval` | 30s | Fast detection when a worker crashes mid-job |
| `maxStalledCount` | 1 | One retry on stall; second stall → fail (prevents infinite loops) |

---

## Dead Letter Queue

BullMQ's "DLQ" is the failed job set. Jobs that exhaust all `attempts` remain in Redis
in the `failed` state (kept for `removeOnFail.count = 100` entries).

**Inspection:** via Bull Board UI (localhost tunnel) or `queue.getFailed(0, 20)`.
**Manual requeue:** `queue.retryJobs({ state: 'failed', count: N })`.
**Alert trigger:** `NotificationService` fires when `(await queue.getJobCounts()).failed > 3`.

---

## Trigger Strategy

The orchestrator uses **adaptive polling** to detect new tasks:
- Poll interval starts at 5s, backs off to 30s maximum when idle
- Resets to 5s immediately when a new task is found
- Requires `queued_at` column on `tasks` table (migration `0003_add_queued_at.sql`)
- Idempotent: `UPDATE tasks SET queued_at = now() WHERE id = $1 AND queued_at IS NULL`

See `docs/spikes/spike-07-trigger-strategy.md` for full analysis.

---

## Bull Board

Bull Board is enabled, exposed on `localhost:3001/admin/queues`.
Access in production via SSH port forwarding:
```bash
ssh -L 3001:localhost:3001 agent@<vps-ip>
```

---

## Consequences

**Positive:**
- Deterministic retry behaviour — no surprises when jobs fail
- Memory-safe concurrency
- Built-in DLQ via failed job set
- Full observability via Bull Board and QueueEvents

**Negative:**
- `concurrency: 2` limits throughput — at high volumes, increase after memory profiling
- Polling adds up to 30s latency when idle (acceptable for current workload)

**Review trigger:** revisit concurrency if VPS is upgraded to CX33 (8GB) or if job volumes exceed 50/day.
