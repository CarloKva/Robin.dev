# Architecture — Robin.dev

**Last updated:** 2026-03-05

---

## Principi generali

### Multi-tenancy — RLS su schema condiviso (ADR-01)

Robin.dev è una piattaforma SaaS multi-tenant. Ogni workspace (team) è isolato tramite Row-Level Security (RLS) su schema condiviso PostgreSQL/Supabase.

**Decisione:** shared schema con RLS su tutte le tabelle tenant.

- Ogni tabella tenant ha `workspace_id uuid NOT NULL REFERENCES workspaces(id) ON DELETE CASCADE`
- Le policy RLS filtrano tramite la funzione helper `get_my_workspace_ids()`
- `workspace_members.user_id` è di tipo `text`, non `uuid` (Clerk IDs non sono UUID validi)

```sql
-- Helper function (SECURITY DEFINER)
CREATE OR REPLACE FUNCTION get_my_workspace_ids()
RETURNS SETOF uuid
LANGUAGE sql
SECURITY DEFINER
STABLE
AS $$
  SELECT workspace_id
  FROM workspace_members
  WHERE user_id = (auth.jwt() ->> 'sub')::text;
$$;
```

**Conseguenze:**
- Zero overhead di provisioning: nessuna creazione schema su signup
- Migrazioni applicabili a tutti i tenant con un singolo `supabase db push`
- RLS deve essere abilitata su ogni tabella tenant (mancanza = bug di sicurezza)

**Review trigger:** rivalutare se tenant count > 1000 o requisiti GDPR di data residency.

---

### Struttura monorepo — npm workspaces (ADR-02)

**Decisione:** npm workspaces (built-in, no Turborepo, no Nx).

```
Robin.dev/
├── apps/
│   ├── web/              — Next.js 15 App Router (gestionale)
│   └── orchestrator/     — Node.js BullMQ worker
├── packages/
│   └── shared-types/     — TypeScript types condivisi
└── package.json          — workspace root
```

```json
{
  "workspaces": ["apps/*", "packages/*"]
}
```

**Review trigger:** rivalutare se CI build time supera i 5 minuti per PR.

---

## Stack e deployment

### CI/CD — GitHub Actions + Vercel (ADR-03)

**Divisione responsabilità:**
- **GitHub Actions:** quality gates (lint + typecheck in parallelo, nessun deploy)
- **Vercel native integration:** tutte le deployment (preview per PR, production su merge a `main`)

```
Push / PR opened
       │
       ├─── GitHub Actions ─── [lint] [typecheck] (paralleli)
       │
       └─── Vercel ─────────── [build] → preview URL (PR) / production (main)

Branch protection: richiede GitHub Actions PASS
```

| Ambiente | Trigger | URL |
|----------|---------|-----|
| Local | `npm run dev` | `localhost:3000` |
| Preview | PR opened/updated | `*.vercel.app` |
| Production | Merge to `main` | Custom domain |

---

### Redis — self-hosted su VPS (ADR-04)

**Decisione:** Redis self-hosted sullo stesso Hetzner VPS dell'orchestratore.

**Rationale:** Upstash non supporta keyspace notifications (richieste da BullMQ per delayed jobs). Latenza loopback < 0.1ms vs 15-25ms over network.

**Configurazione canonica:**
```ini
appendonly yes
appendfsync everysec
maxmemory 512mb
maxmemory-policy allkeys-lru
bind 127.0.0.1
requirepass <REDIS_PASSWORD>
```

```
REDIS_URL=redis://:${REDIS_PASSWORD}@127.0.0.1:6379
```

---

### BullMQ — configurazione (ADR-05)

**File:** `apps/orchestrator/src/config/bullmq.config.ts`

```typescript
export const defaultJobOptions: DefaultJobOptions = {
  attempts: 3,
  backoff: { type: 'exponential', delay: 5000 },  // 5s → 25s → 125s
  removeOnComplete: { count: 200, age: 7 * 24 * 3600 },
  removeOnFail: { count: 100 },
}

export const workerOptions: WorkerOptions = {
  concurrency: 2,        // 2 × ~500MB Claude Code = ~1GB; safe su 4GB VPS
  stalledInterval: 30_000,
  maxStalledCount: 1,
}
```

**Trigger strategy:** adaptive polling (5s → 30s idle, reset a 5s su nuovo task).

**Bull Board:** `localhost:3001/admin/queues` — accesso via SSH port forwarding:
```bash
ssh -L 3001:localhost:3001 robin@<vps-ip>
```

---

### Deployment orchestratore — systemd (ADR-06)

**Decisione:** systemd gestisce il processo lifecycle. Update via git pull + build + restart.

**Unit file path:** `/etc/systemd/system/robin-orchestrator-<CLIENT_SLUG>.service`

```ini
[Unit]
Description=Robin.dev Orchestrator
After=network.target redis.service
Wants=redis.service

[Service]
Type=simple
User=robin
WorkingDirectory=/home/robin/robin-platform/apps/orchestrator
EnvironmentFile=/home/robin/robin-platform/apps/orchestrator/.env
ExecStart=/usr/bin/node dist/index.js
Restart=always
RestartSec=5
StandardOutput=journal
StandardError=journal
SyslogIdentifier=robin-orchestrator-<SLUG>
MemoryMax=2G
```

**Update procedure (downtime < 30s):**
```bash
ssh robin@<vps-ip>
cd ~/robin-platform
git pull origin main
npm install --workspace=apps/orchestrator
npm run build --workspace=apps/orchestrator
sudo systemctl restart robin-orchestrator-<SLUG>
```

**BullMQ graceful shutdown:** SIGTERM → `worker.close()` → drena job attivi → restart. 0 job persi su restart normale. Timeout forzato: 30s.

**Logging:** journald, structured JSON.
```bash
journalctl -u robin-orchestrator-<SLUG> -f
journalctl -u robin-orchestrator-<SLUG> -o json --since "1 hour ago"
```

**Monitoring:** Betterstack pinga `GET /health` ogni 60s. Alert se 2 check consecutivi falliscono.

---

## Autenticazione e autorizzazione

### Clerk + Supabase JWT Bridge

Robin.dev usa **Clerk** per l'autenticazione utente e **Supabase** per il database. I due sistemi sono connessi via JWT bridge.

```
Server Component / Route Handler
│
▼
auth() da @clerk/nextjs/server
getToken({ template: "supabase" })
│
▼  JWT firmato: { "sub": "user_abc123", "aud": "authenticated" }
│
▼
createClient(url, anonKey, {
  global: { headers: { Authorization: `Bearer ${token}` } }
})
│
▼
Supabase valida JWT → popola auth.jwt()->>'sub' = "user_abc123"
│
▼
RLS: workspace_id IN (SELECT get_my_workspace_ids())
│
▼
Query ritorna solo le righe del workspace dell'utente
```

**Perché `auth.jwt()->>'sub'` e non `auth.uid()`:**
`auth.uid()` ritorna `uuid`. I Clerk user ID (es. `user_abc123`) non sono UUID validi. Usare `auth.uid()` causerebbe errori di cast.

```sql
-- Corretto
WHERE user_id = (auth.jwt() ->> 'sub')::text

-- Sbagliato — Clerk IDs non sono UUID
WHERE user_id = auth.uid()
```

**Service role client (orchestratore):** usa `SUPABASE_SERVICE_ROLE_KEY`, bypassa RLS. Usato solo in `apps/web/lib/supabase/admin.ts` (operazioni admin) e `apps/orchestrator`. Mai in variabili `NEXT_PUBLIC_*`, mai inviato al browser.

**JWT Template in Clerk Dashboard** (nome: `supabase`):
```json
{
  "sub": "{{user.id}}",
  "aud": "authenticated"
}
```
JWKS URL da configurare in Supabase → Authentication → JWT Settings.

**Onboarding:** nuovo utente → `/onboarding/workspace` → `POST /api/workspaces` → crea workspace + workspace_members (role: owner) → redirect `/dashboard`.

**File di riferimento:**
| File | Ruolo |
|------|-------|
| `apps/web/middleware.ts` | `clerkMiddleware()` + `createRouteMatcher` — protegge tutte le route non-public |
| `apps/web/lib/supabase/server.ts` | `createSupabaseServerClient()` — user-scoped, RLS enforced |
| `apps/web/lib/supabase/admin.ts` | `createSupabaseAdminClient()` — service role, RLS bypassed |
| `apps/web/lib/db/workspace.ts` | `getWorkspaceForUser()`, `getWorkspaceById()` |
| `apps/web/app/api/workspaces/route.ts` | `POST /api/workspaces` — workspace creation |

---

## Modello di isolamento infrastrutturale

### Una VPS Hetzner CX22 per cliente (ADR-09)

**Decisione v1.0:** VPS dedicata per ogni cliente.

Ogni cliente ha:
- Node.js orchestratore come systemd service
- Redis locale (bind `127.0.0.1`)
- Claude Code CLI installato
- SSH key GitHub dedicata
- `ANTHROPIC_API_KEY` isolata nelle variabili d'ambiente

Il database Supabase rimane condiviso, con isolamento da RLS.

**Costo:** €3.98–4.78/mese (VPS CX22 + backup opzionale).

**Perché non Docker condiviso:** rischio credential leakage via `/proc/[pid]/environ`, noisy neighbor, debug complesso. Inaccettabile per un servizio professionale.

**Piano di rivalutazione:** a ≥25 clienti attivi, valutare migrazione a Docker con Ansible.

---

## GitHub integration

### GitHub App (ADR-10)

**Decisione:** GitHub App (non OAuth App).

**Perché:** OAuth App richiede scope `repo` che concede accesso a **tutte** le repository private. GitHub App permette al cliente di selezionare esattamente quali repository esporre.

**Permessi:**
| Permesso | Livello | Utilizzo |
|---|---|---|
| `contents` | Read & write | Clone, branch, push |
| `pull_requests` | Read & write | Aprire PR, leggere commenti |
| `metadata` | Read | Obbligatorio |

**Token:** installation access token generato on-demand (durata 1h), mai conservato in DB. L'unico dato persistito è `installation_id` (intero non sensibile).

**Flusso:**
```
Founder → click "Connetti GitHub"
  → redirect GitHub App installation page
  → founder seleziona account/org e repository
  → GitHub → /api/auth/github/callback?installation_id=XXX
  → salva installation_id in github_connections
  → dashboard con stato "Connesso"

Worker (pre-task):
  → legge installation_id
  → POST /app/installations/{id}/access_tokens con JWT firmato
  → usa token per clone, push, PR
  → token scartato dopo l'uso
```

**Tabelle:** `github_connections`, `repositories`, `agent_repositories` (migration 0007).

---

## Provisioning infrastruttura

### Hetzner cloud-init, senza SSH post-boot (ADR-11)

**Decisione:** cloud-init via `user_data`, health check via polling `agents.last_seen_at`.

Il worker invia lo script di setup nel campo `user_data` della chiamata `POST /v1/servers`. Hetzner lo esegue al primo boot. Il worker non fa SSH durante il provisioning automatico.

**Nota importante:** `waitForOrchestratorHealth()` via HTTP su porta 3001 era ghost code — rimosso nel refactor 2026-03-05. Il gate reale è il **polling di `agents.last_seen_at`** su Supabase.

**Parametri server:**
| Parametro | Valore |
|---|---|
| Provider | Hetzner Cloud |
| Server type | `cx22` |
| OS image | `ubuntu-24.04` |
| Datacenter | `fsn1` |

**Polling strategy:**
```
1. POST /v1/servers → salva vps_id + vps_ip → evento provisioning.vps_created

2. GET /v1/servers/{vps_id} ogni 5s (max 5 min)
   → quando status == "running" → evento provisioning.setup_running

3. Polling agents.last_seen_at (Supabase) ogni 10s (max 5–12 min)
   → quando last_seen_at fresco (< 60s) → provisioning_status = 'online'
```

**Idempotenza:** se `vps_id != null`, skip alla fase di polling heartbeat.

**Timeout globale job:** 15 minuti. Oltre: BullMQ termina il job, agente → `provisioning_status = 'error'`.

**Security note:** `user_data` contiene credenziali in chiaro (chiavi Supabase, Anthropic). Accettabile per il pilota. Piano Sprint D: "VPS chiama Robin.dev al boot con bootstrap token temporaneo".

**Flusso deprovisioning:**
```
DELETE /v1/servers/{vps_id}
  → se 404: logga "VPS già eliminata" e continua
  → aggiorna agents.provisioning_status = 'deprovisioned'
```

---

## Realtime

### Supabase Realtime postgres_changes (ADR-08)

**Decisione:** Supabase Realtime `postgres_changes` INSERT su `task_events`.

**Pattern:**
1. **SSR** per caricamento iniziale degli eventi storici (Server Component)
2. **Realtime** per aggiornamenti incrementali (Client Component + hook)
3. **Deduplicazione** client-side: controlla se `payload.new.id` è già nello state
4. **Auth:** `supabase.realtime.setAuth(token)` con token Clerk PRIMA di subscribere
5. **Reconnect:** gestito dall'SDK Supabase — nessuna logica custom
6. **Fallback:** badge `isOffline` se canale in errore

**Prerequisito DB:**
```sql
-- Migration 0004
ALTER PUBLICATION supabase_realtime ADD TABLE task_events;
```

**Filtro:** `task_id=eq.{id}` per ricevere solo gli eventi del task corrente.

**Client browser distinto dal client server:** il client Realtime usa `createBrowserClient` da `@supabase/ssr`.

---

## Event sourcing

### EventPayloadMap + proiezioni TypeScript (ADR-07)

**Decisioni:**

1. **Nessun campo `version` nel payload.** Discriminatore = `event_type`. Nuovi tipi → nuovi enum, non versioni.

2. **`EventPayloadMap` — discriminated union TypeScript.**
   ```typescript
   type EventPayloadMap = {
     "task.created": { title: string; description: string; priority: TaskPriority };
     "task.state.changed": { from: TaskStatus; to: TaskStatus; note?: string };
     "agent.pr.opened": { pr_url: string; pr_number?: number; commit_sha?: string };
     // ... tutti gli event types
   }
   ```

3. **Proiezioni in TypeScript, non in PostgreSQL.** `projectTaskState()` riduce array di eventi con `Array.reduce()`. Testabile senza DB.

4. **Indice GIN su payload solo per `agent.pr.opened`** (per query su `pr_url`).

**File:**
- `packages/shared-types/src/index.ts` — `EventPayloadMap`, `TaskProjectedState`
- `apps/web/lib/db/projectTaskState.ts` — funzione pura di proiezione
- `apps/web/lib/db/events.ts` — `getTaskProjectedState()` (wrapper con DB fetch)

**`TaskProjectedState`:** include `prData: PRData | null` e `deployData: DeployData | null` (non solo `prUrl`).

---

## Context preservation per rework

### REWORK.md su filesystem VPS (ADR-13)

Claude Code è stateless: ogni esecuzione riparte da zero. Per il rework, `ClaudeRunner` scrive un file `REWORK.md` nella root del repository prima di invocare Claude, rimosso nel blocco `finally`.

**Decisione:** filesystem VPS — non colonna DB, non Supabase Storage.

**Struttura `REWORK.md`:**
```markdown
# Rework #{N} — {task.title}

**Task ID:** {task.id}
**Iterazione:** {N}
**Branch:** feat/{task.id}

## Descrizione originale
{task.description}

## Cosa ha fatto l'agente nell'iterazione #{N-1}
**PR:** #{pr_number} — {pr_url}
**File modificati:** [...con delta +/-]
**Diff rilevante:** [max 200.000 caratteri totali]

## Commenti del founder sulla PR
{commenti PR in ordine cronologico}

## Contesto iterazioni precedenti
[Presente solo per rework N ≥ 3: summary ultime 2 iterazioni]

## Istruzioni per il rework
{testo del founder — obbligatorio}

## Required Steps
1. Non creare un nuovo branch — lavora su feat/{task.id}
...
```

**Budget diff:** 200.000 caratteri (~50.000 token). File ordinati per `changes` decrescente.

**Regola "ultime 2 iterazioni":** per rework N ≥ 3, include iterazione N-1 completa (diff + commenti) + summary iterazione N-2 (senza diff).

**Lifecycle:**
| Evento | Azione |
|--------|--------|
| ClaudeRunner lancia Claude | `REWORK.md` scritto su VPS |
| Claude termina (successo o errore) | `REWORK.md` eliminato (blocco `finally`) |
| VPS riavviata/distrutta | File non esiste — ricostruibile da Supabase + GitHub API |

**Aggiunta al `.gitignore` del repo template cliente:**
```gitignore
TASK.md
REWORK.md
BLOCKED.md
```

---

## Orchestrator — worker e interface

### Contratto ClaudeRunner

Il confine tra orchestratore e agente è definito dal `JobPayload` e `JobResult`:

```typescript
type JobPayload = {
  taskId: string;
  workspaceId: string;
  repositoryUrl: string;
  branch: string;
  repositoryPath: string;
  taskTitle: string;
  taskDescription: string;
  taskType: TaskType;
  priority: TaskPriority;
  timeoutMinutes: number;  // default: chore=15, docs=20, bug=30, refactor=45, feature=60
  claudeMdPath: string;
}

type JobResult = {
  status: 'completed' | 'in_review' | 'blocked';
  prUrl?: string;
  prNumber?: number;
  commitSha?: string;
  commitBranch?: string;
  startedAt: string;
  completedAt: string;
  durationSeconds: number;
  blockedReason?: string;
  stdoutTail: string;  // ultimi 10k chars
}
```

**TASK.md** scritto da `ClaudeRunner` prima di invocare Claude:
```markdown
# Task: [taskTitle]
**Type:** [taskType]
**Priority:** [priority]
**Task ID:** [taskId]
## Description
[taskDescription]
## Notes
- Create branch feat/[taskId]
- Open a PR when complete
- If blocked, write BLOCKED.md and stop
```

**Errori:**
```typescript
class AgentTimeoutError extends JobError { retryable = true; code = 'AGENT_TIMEOUT' }
class APIRateLimitError extends JobError { retryable = true; code = 'API_RATE_LIMIT' }
class NetworkError extends JobError { retryable = true; code = 'NETWORK_ERROR' }
class AgentBlockedError extends JobError { retryable = false; code = 'AGENT_BLOCKED' }
class InsufficientSpecError extends JobError { retryable = false; code = 'INSUFFICIENT_SPEC' }
class RepositoryAccessError extends JobError { retryable = false; code = 'REPO_ACCESS_ERROR' }
```

### Worker aggiuntivi

**`repo-queue.worker.ts`** — esecuzione sequenziale per repository:
- Queue: `repo-queue-{repositoryId}` (una per repository, creata dinamicamente)
- `concurrency: 1` per repository, parallelismo tra repository diverse
- Routing algorithm: 1) `preferred_agent_id` se online, 2) load balancing (meno task 24h), 3) tiebreaker: `provisioned_at` più recente
- Se nessun agente disponibile: retry ogni 5 min, notifica dopo 30 min

**`github-events.worker.ts`** — webhook GitHub:
- Queue: `github-events`, concurrency 5
- `pull_request:closed`: PR mergeata → task `done` + `task.completed`; PR chiusa senza merge → task `in_review` + `task.pr_closed_without_merge`
- Risolve task dalla PR cercando `agent.pr.opened` con `pr_number` corrispondente

**`sprint-control.worker.ts`** — attivazione worker per sprint:
- Queue: `sprint-control`, concurrency 5
- Invocato da `POST /api/sprints/{id}/start`
- Per ogni `repositoryId`: `createRepoQueueWorker(repositoryId)` — latency sub-secondo

**Orchestrator CONTROL_PLANE mode:** `CONTROL_PLANE=true` → esegue solo provisioning workers.

### File di riferimento

| File | Ruolo |
|------|-------|
| `packages/shared-types/src/index.ts` | Tutti i tipi contratto |
| `apps/orchestrator/src/agent/claude.runner.ts` | ClaudeRunner |
| `apps/orchestrator/src/workers/task.worker.ts` | Task execution |
| `apps/orchestrator/src/workers/repo-queue.worker.ts` | Per-repo sequential queue |
| `apps/orchestrator/src/workers/github-events.worker.ts` | GitHub webhooks |
| `apps/orchestrator/src/workers/sprint-control.worker.ts` | Sprint activation |
| `apps/orchestrator/src/workers/agent.provisioning.worker.ts` | VPS provisioning |
| `apps/orchestrator/src/workers/agent.deprovisioning.worker.ts` | VPS teardown |
| `apps/orchestrator/src/config/bullmq.config.ts` | Configurazione BullMQ |

---

## Decisioni architetturali pendenti

- **`ReworkPayload` strutturato:** non ancora in `shared-types`. Da definire in Sprint C insieme al `rework-trigger.worker`.
- **Provisioning sicurezza `user_data`:** credenziali in chiaro nel campo `user_data` Hetzner. Sprint D: pattern "VPS chiama Robin.dev al boot con bootstrap token".
- **Monitoring distribuito:** con >10 VPS, monitoring richiede sistema centralizzato. Per v1.0: log via SSH + alerting Supabase.
- **`sprint.started` / `sprint.completed` / `task.rework_started`:** eventi pianificati ma non implementati. Da aggiungere in Sprint C.
