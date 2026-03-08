# apps/orchestrator — Orchestratore Robin.dev

Leggi prima `/CLAUDE.md` (root). Questo file aggiunge le regole specifiche di `apps/orchestrator`.

## Stack

| Tech | Versione |
|------|----------|
| Node.js | 22 LTS |
| TypeScript | strict |
| BullMQ | ^5.34.6 |
| ioredis | (peerDep di BullMQ) |
| Express | ^4.21.2 |
| Supabase | @supabase/supabase-js ^2.47.10 |
| Pino | logger strutturato JSON |

## Struttura directory

```
apps/orchestrator/src/
├── index.ts                         — bootstrap, mode switch control-plane/agent
├── config/bullmq.config.ts          — defaultJobOptions, workerOptions, timeout per tipo
├── db/
│   ├── redis.client.ts              — singleton Redis (ioredis)
│   └── supabase.client.ts           — singleton Supabase (service role, bypassa RLS)
├── queues/
│   └── task.queue.ts                — singleton task queue BullMQ
├── workers/
│   ├── task.worker.ts               — esecuzione task (agent VPS only)
│   ├── repo-queue.worker.ts         — queue sequenziale per repository
│   ├── github-events.worker.ts      — webhook GitHub pull_request:closed
│   ├── sprint-control.worker.ts     — attivazione worker per sprint
│   ├── agent.provisioning.worker.ts — provisioning VPS Hetzner
│   └── agent.deprovisioning.worker.ts — teardown VPS
├── agent/
│   └── claude.runner.ts             — ClaudeRunner: esegue Claude Code, parse output
├── services/
│   ├── github.service.ts            — getInstallationToken() via JWT
│   ├── heartbeat.service.ts         — aggiorna agents.last_seen_at ogni 30s
│   ├── task.poller.ts               — polling adattivo task pending → queued
│   ├── hetzner.service.ts           — createServer(), waitForServerRunning()
│   ├── notification.service.ts      — email/Slack su eventi task
│   ├── repo-watchdog.service.ts     — safety net ogni 60s per repo queue
│   ├── provisioning-recovery.service.ts — recovery agenti stuck in pending
│   ├── self-update.service.ts       — listen Redis pub/sub per restart remoto
│   └── snapshot-baker.service.ts    — bake snapshot context documents
├── repositories/
│   ├── task.repository.ts           — updateStatus(), getTask()
│   └── agent.repository.ts          — updateProvisioningStatus(), setOnline()
├── events/
│   └── event.service.ts             — emette task_events su Supabase
├── errors/
│   └── job.errors.ts                — JobError, AgentTimeoutError, AgentBlockedError...
└── utils/
    └── logger.ts                    — pino logger strutturato JSON
```

## Architettura — control plane vs agent mode

L'orchestratore si avvia in due modalità distinte, selezionate tramite la variabile d'ambiente `CONTROL_PLANE`:

```
CONTROL_PLANE=true  → control-plane VPS (Carlo)
CONTROL_PLANE non set → agent VPS (cliente)
```

**Control-plane** (`CONTROL_PLANE=true`):
- Provisioning worker + deprovisioning worker
- Repo queue workers (per-repo, concurrency 1)
- Sprint control worker
- GitHub events worker
- Repo watchdog service
- Express su `0.0.0.0:3001` (raggiungibile per health check)

**Agent VPS** (default):
- Task execution worker (concurrency 2)
- Heartbeat service (aggiorna `agents.last_seen_at` ogni 30s)
- Task poller (polling adattivo 5–30s)
- Express su `127.0.0.1:3001` (solo loopback)

Regola critica: non aggiungere logica task-execution in moduli che girano sul control-plane, e viceversa. Il separatore è `IS_CONTROL_PLANE` in `src/index.ts`.

## BullMQ — pattern

### Queue esistenti

| Queue name | Dove | Scopo |
|------------|------|-------|
| `tasks` (`QUEUE_NAME`) | `queues/task.queue.ts` | Esecuzione task (agent VPS) |
| `repo-queue-{repositoryId}` | creata dinamicamente in `repo-queue.worker.ts` | Queue sequenziale per repository |
| `sprint-control` | `workers/sprint-control.worker.ts` | Attivazione worker per sprint |
| `github-events` | `workers/github-events.worker.ts` | Webhook GitHub |
| `agent-provisioning` | `workers/agent.provisioning.worker.ts` | Provisioning VPS |
| `agent-deprovisioning` | `workers/agent.deprovisioning.worker.ts` | Teardown VPS |

Queue web (enqueue lato Next.js): `lib/queue/tasks.queue.ts`, `lib/queue/provisioning.queue.ts`, `lib/queue/repo.queue.ts`, `lib/queue/sprint-control.queue.ts`, `lib/queue/github-events.queue.ts`.

### Configurazione centralizzata

Le opzioni standard vengono da `src/config/bullmq.config.ts`:

```typescript
import { defaultJobOptions, workerOptions } from "../config/bullmq.config";

// defaultJobOptions: attempts=3, backoff exponential 5s→25s→125s
// workerOptions: concurrency=2, stalledInterval=30s, maxStalledCount=1
```

Attenzione: `github-events.worker.ts` NON usa `workerOptions` centralizzate — usa `concurrency: 5` e `maxStalledCount: 2` inline. Violazione ADR-05 documentata.

### Job types

Tutti i payload sono in `packages/shared-types/src/index.ts`:
- `JobPayload` — task execution
- `AgentProvisioningJobPayload` — provisioning
- `AgentDeprovisioningJobPayload` — deprovisioning
- `RepoQueueJobPayload` — repo queue
- `SprintControlJobPayload` — sprint control

Eccezione: `GitHubEventJobPayload` è definita localmente in `workers/github-events.worker.ts`. Fix pianificato in TASK-REFACTOR-ORC-06.

## Redis

Singleton: `src/db/redis.client.ts` — `getRedisConnection()` (ioredis).

Mai istanziare nuove connessioni Redis — importare sempre il singleton.

```typescript
import { getRedisConnection } from "../db/redis.client";
const redis = getRedisConnection();
```

## Supabase

Singleton: `src/db/supabase.client.ts` — `getSupabaseClient()` (service role key, RLS bypassed).

```typescript
import { getSupabaseClient } from "../db/supabase.client";
const db = getSupabaseClient();
```

Le operazioni sui dati business usano i repository in `src/repositories/` — non inline nei worker.

| Repository | Tabella/operazioni |
|------------|-------------------|
| `task.repository.ts` | `updateStatus()`, `getTask()` |
| `agent.repository.ts` | `updateProvisioningStatus()`, `setOnline()` |

Per operazioni non coperte dai repository, usare `getSupabaseClient()` direttamente nel worker con una query inline (accettabile per operazioni one-off).

## GitHub integration

Per ottenere un token di installazione GitHub App, usare sempre `getInstallationToken()` da `src/services/github.service.ts`. Non reimplementare la firma JWT altrove.

```typescript
import { getInstallationToken } from "../services/github.service";
const token = await getInstallationToken(appId, privateKeyB64, installationId);
```

## Logging

Il logger è pino strutturato JSON — `src/utils/logger.ts`.

```typescript
import { log } from "../utils/logger";

log.info({ taskId, prNumber }, "handlePullRequestClosed: task found");
log.warn({ error: String(err) }, "Provisioning recovery check failed");
log.error({ jobId: job?.id, error: err.message }, "Worker: job failed");
```

Campi obbligatori nel contesto: ID rilevante (taskId, agentId, jobId) + messaggio descrittivo. Non loggare credenziali o service role key.

## Gestione errori nei worker

```typescript
worker.on("failed", (job, err) => {
  log.error({ jobId: job?.id, error: err.message }, "Worker: job failed");
});

// Nei processor, per errori non retryable:
import { AgentBlockedError } from "../errors/job.errors";
throw new AgentBlockedError("Agente bloccato: " + reason);
// AgentBlockedError.retryable = false → BullMQ non riprova
```

Errori `retryable = true`: `AgentTimeoutError`, `APIRateLimitError`, `NetworkError`.
Errori `retryable = false`: `AgentBlockedError`, `InsufficientSpecError`, `RepositoryAccessError`.

## Known technical debt in questo package

- **BUG-ORC-01:** `github-events.worker.ts` chiama `taskRepository.updateStatus()` direttamente per `done`/`in_review` senza validare lo stato di partenza nella state machine. Fix pianificato in TASK-BUG-01.
- **BUG-ORC-02:** `pull_request_review_comment` e `issue_comment` ricevuti ma non processati — rework trigger da GitHub non implementato. Necessario per Sprint C.
- **Worker options non centralizzate:** `github-events.worker.ts` definisce concurrency e stalledInterval inline invece di usare `workerOptions` da `bullmq.config.ts`. Violazione ADR-05.
- **`GitHubEventJobPayload` definita localmente** in `github-events.worker.ts` invece che in `shared-types`. Fix pianificato in TASK-REFACTOR-ORC-06.
- **`task.worker.ts` e `taskQueue` importati in `index.ts` anche in mode control-plane** — l'import statico carica il modulo anche quando non serve. Fix pianificato in TASK-REFACTOR-ORC-07.
- **`restart_orchestrator` in `ops-diagnostics.worker.ts` usa service name errato** — il comando SSH invia `systemctl restart robin-orchestrator-${slug}` ma il service name effettivo sugli agent VPS è `robin-orchestrator` (confermato su VPS reali). L'azione fallirà silenziosamente finché non corretta.
- **`collectSupabaseDiagnostics` non rileva il cross-agent mismatch loop** — la query cerca task con `updated_at > 4h`, ma il loop cicla ogni ~5s e quindi le task non appaiono mai come "stuck" nel pannello Ops. Il mismatch loop va diagnosticato a mano via watchdog logs + redis-cli (vedi root CLAUDE.md).
- **BUG-ORC-03: nessun recovery per task `in_progress` orfane** — quando il systemd riavvia l'agente mentre un job BullMQ è in `active`, il job viene droppato ma il DB rimane `in_progress` con `queued_at IS NOT NULL`. Il `task.poller.ts` cerca solo `queued_at IS NULL` → la task è bloccata per sempre finché non resettata manualmente. `stalledInterval`/`maxStalledCount` in BullMQ non aiutano perché il job non è in BullMQ (è completamente perso). Fix previsto: `TaskRecoveryService` con polling ogni ~5 min che resetta le task `in_progress`/`queued` con `queued_at` più vecchio di 10 minuti (vedi proposta in root CLAUDE.md). Pattern già usato per il provisioning: `provisioning-recovery.service.ts`.
- **Diagnosi task orfane** — segnale chiaro: `redis LLEN bull:tasks:active = 0` + `redis ZCARD bull:tasks:prioritized = 0` + DB ha task `in_progress` o `queued` → task orfane. Fix manuale in <30s: `UPDATE tasks SET queued_at=NULL, status='pending' WHERE status IN ('queued','in_progress')` (vedi runbook root CLAUDE.md).
