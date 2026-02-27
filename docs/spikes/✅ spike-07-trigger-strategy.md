# Spike 07: Trigger Strategy — Webhook vs Polling vs Supabase Realtime

**Date:** 2026-02-26
**Author:** Carlo Ferrero
**Time-box:** 2h
**Output used in:** ADR-05 (producer configuration)

---

## Problem Statement

When a user creates a task in the gestionale, the orchestrator must pick it up and
enqueue a job. Three strategies exist: Supabase webhooks, active polling, or
Supabase Realtime (WebSocket subscription). Which one is right for this system?

---

## Option A: Supabase Webhooks (Database Webhooks)

### How it works
Supabase can send an HTTP POST to a URL when a row is inserted/updated.
Configure via Dashboard → Database → Webhooks.

### Requirements
- The VPS must be reachable via public HTTPS URL
- Webhook payload contains the full row data
- Supabase sends the webhook synchronously after the DB write

### Problems for Robin.dev
1. **VPS has no public HTTPS endpoint** — the orchestrator is a background worker process, not a web server. Exposing it requires: static IP, DNS record, SSL certificate (Let's Encrypt), reverse proxy (nginx), open firewall port. This is significant setup overhead.
2. **Reliability** — Supabase webhooks are "best effort". If the VPS is down when the webhook fires, the event is lost. There is no built-in retry that guarantees delivery to the orchestrator.
3. **Security** — the webhook endpoint must be authenticated (Supabase sends a shared secret) — one more thing to configure and rotate.

### Verdict: too complex for the VPS setup. Ruled out.

---

## Option B: Active Polling

### How it works
The orchestrator runs a loop: every N seconds, query Supabase for tasks in state `pending` that are not yet in the queue, and enqueue them.

```typescript
// Simple polling loop
async function pollForNewTasks() {
  const tasks = await supabase
    .from('tasks')
    .select('*')
    .eq('status', 'pending')
    .is('queued_at', null)  // not yet enqueued

  for (const task of tasks) {
    await taskQueue.addJob(buildJobPayload(task))
    await supabase.from('tasks').update({ queued_at: new Date() }).eq('id', task.id)
  }
}

setInterval(pollForNewTasks, POLL_INTERVAL_MS)
```

### Adaptive polling interval
Rather than a fixed 5s interval (wasteful when idle), use adaptive backoff:

```typescript
let interval = 5_000   // start at 5s
let idle = 0

async function poll() {
  const tasks = await pollForNewTasks()
  if (tasks.length > 0) {
    idle = 0
    interval = 5_000    // reset to fast polling when work exists
  } else {
    idle++
    interval = Math.min(interval * 1.5, 30_000)  // back off to 30s max when idle
  }
  setTimeout(poll, interval)
}
```

### Idempotency
A task could be polled twice before `queued_at` is set. Prevent duplicates with:
1. Set `queued_at` atomically when enqueuing (use `UPDATE ... WHERE queued_at IS NULL`)
2. BullMQ job ID = task UUID → duplicate job IDs are rejected by BullMQ

### Latency
- Best case (fast polling): 0-5s from task creation to queue
- Worst case (idle, 30s interval): up to 30s
- Acceptable: task processing takes minutes, not seconds

### Pros
- No public endpoint required
- Stateless: if the orchestrator restarts, the next poll picks up missed tasks
- Simple to debug: just query the `tasks` table to understand state
- Works behind any firewall

### Cons
- Polling load on Supabase (~12-720 queries/hour depending on activity)
- Up to 30s delay in idle mode

---

## Option C: Supabase Realtime (WebSocket)

### How it works
Supabase Realtime allows subscribing to table changes over a WebSocket connection.

```typescript
supabase
  .channel('tasks-channel')
  .on('postgres_changes',
    { event: 'INSERT', schema: 'public', table: 'tasks' },
    (payload) => {
      taskQueue.addJob(buildJobPayload(payload.new))
    }
  )
  .subscribe()
```

### Analysis
- **Near-instant delivery**: new task → orchestrator picks up in < 1s
- **No public endpoint needed**: the VPS initiates the WebSocket connection outbound
- **Reliability concern**: WebSocket connections drop. Supabase Realtime does reconnect, but events during a disconnection are lost unless you also poll on reconnect.
- **Complexity**: requires handling connect/disconnect/reconnect lifecycle, buffering events during reconnect, and a fallback poll on startup to catch tasks created while disconnected.
- **Supabase Realtime + service role**: works but requires careful setup — Realtime typically uses the anon key, using service role with Realtime is less documented.

### Verdict: good latency, but reliability requires combining with polling on reconnect, making it more complex than pure polling for marginal benefit (seconds vs 5s).

---

## Decision: Adaptive Polling

**Polling wins** for Robin.dev at this stage because:

1. **Simplicity** — no WebSocket lifecycle management, no public endpoint, one query per poll cycle
2. **Reliability** — polling is inherently idempotent and stateless. Restart the orchestrator, it just polls on next boot
3. **Acceptable latency** — 5s fast poll is fast enough. Tasks take minutes to execute, not seconds
4. **Debuggability** — the `queued_at` column on tasks provides an explicit, queryable audit trail of when each task entered the queue
5. **No lost events** — even if the orchestrator is down for an hour, the next poll picks up all pending tasks

**Implementation decision:** start polling at 5s, back off to 30s maximum when idle, reset to 5s immediately when a task is found.

**Future migration path:** if sub-second latency becomes required (e.g., real-time agent dispatching), replace the poller with a Supabase Realtime listener + polling fallback. The `TaskPoller` interface abstracts this so the swap is isolated.

---

## `queued_at` column

The polling strategy requires tracking which tasks have been enqueued to avoid duplicates.
Add a `queued_at timestamptz` column to the `tasks` table:

```sql
-- Migration: 0003_add_queued_at.sql
ALTER TABLE tasks ADD COLUMN queued_at timestamptz;
CREATE INDEX ON tasks(status, queued_at) WHERE queued_at IS NULL;
```

The partial index `WHERE queued_at IS NULL` makes the polling query efficient:
```sql
SELECT * FROM tasks WHERE status = 'pending' AND queued_at IS NULL;
```
