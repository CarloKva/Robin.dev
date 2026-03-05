# Events — Robin.dev

**Last updated:** 2026-03-05

---

## Principio

`task_events` è la sorgente di verità per ogni azione avvenuta su un task. Gli eventi sono immutabili e append-only. Non esiste UPDATE o DELETE sulla tabella.

```
events: TaskEvent[]  →  reduce()  →  TaskProjectedState
```

**TypeScript:** `EventPayloadMap` è una discriminated union che mappa ogni `event_type` alla sua payload shape. Zero runtime overhead.

**Indice GIN:** solo per `agent.pr.opened` su campo `pr_url` (l'unico campo payload usato in query dirette).

---

## Convenzioni

- `actor_type`: `"agent"` o `"human"`
- `actor_id`: UUID dell'agente (come stringa) o Clerk user ID
- `payload`: JSON tipizzato per ogni `event_type` (vedi `EventPayloadMap` in `shared-types`)
- Nessun campo `version` — discriminatore è `event_type`

---

## Catalogo eventi

### `task.created`

Emesso quando un task viene creato nel sistema.

| Campo | Tipo | Descrizione |
|-------|------|-------------|
| title | string | Titolo al momento della creazione |
| description | string | Descrizione completa |
| priority | TaskPriority | Priorità assegnata |

**Emesso da:** `POST /api/tasks` (human)

---

### `task.state.changed`

Emesso ad ogni transizione di stato del task.

| Campo | Tipo | Descrizione |
|-------|------|-------------|
| from | TaskStatus | Stato precedente |
| to | TaskStatus | Nuovo stato |
| note | string? | Nota opzionale (es. motivo rifiuto) |

**Emesso da:** `TaskRepository.updateStatus()` (agent o human)

---

### `agent.phase.started`

Emesso quando l'agente inizia una fase ADWP.

| Campo | Tipo | Descrizione |
|-------|------|-------------|
| phase | ADWPPhase \| string | Fase corrente |

**Fasi ADWP:** `analysis` | `design` | `write` | `proof`

**Emesso da:** `EventService` nell'orchestratore

---

### `agent.phase.completed`

Emesso quando l'agente completa una fase.

| Campo | Tipo | Descrizione |
|-------|------|-------------|
| phase | ADWPPhase \| string | Fase completata |
| duration_seconds | number? | Durata in secondi |

**Emesso da:** `EventService` nell'orchestratore

---

### `agent.commit.pushed`

Emesso quando l'agente fa push di un commit.

| Campo | Tipo | Descrizione |
|-------|------|-------------|
| commit_sha | string | SHA completo (40 chars) |
| branch | string | Branch su cui è stato pushato |
| message | string? | Primo rigo del commit message |

**Emesso da:** `ClaudeRunner` (rilevato dall'output di Claude)

---

### `agent.pr.opened`

Emesso quando l'agente apre una Pull Request.

| Campo | Tipo | Descrizione |
|-------|------|-------------|
| pr_url | string | URL completo della PR |
| pr_number | number? | Numero PR su GitHub |
| commit_sha | string? | HEAD SHA della PR |

**Emesso da:** `task.worker.ts` dopo `ClaudeRunner.run()`

> Questo evento ha un indice GIN su `payload` per query su `pr_url`.

---

### `agent.blocked`

Emesso quando l'agente non può procedere senza input umano.

| Campo | Tipo | Descrizione |
|-------|------|-------------|
| question | string | La domanda posta dall'agente |

**Emesso da:** `task.worker.ts` su `AgentBlockedError`

---

### `human.approved`

Emesso quando un umano approva la PR del task.

| Campo | Tipo | Descrizione |
|-------|------|-------------|
| comment | string? | Commento opzionale |

**Emesso da:** API route (human)

---

### `human.rejected`

Emesso quando un umano rifiuta la PR del task.

| Campo | Tipo | Descrizione |
|-------|------|-------------|
| reason | string? | Motivo del rifiuto |

**Emesso da:** API route (human)

---

### `human.commented`

Emesso quando un umano commenta su un task.

| Campo | Tipo | Descrizione |
|-------|------|-------------|
| comment | string | Testo del commento |

**Emesso da:** API route (human)

---

### `task.completed`

Emesso quando il task è completato con successo.

| Campo | Tipo | Descrizione |
|-------|------|-------------|
| duration_seconds | number? | Durata totale dell'esecuzione |

**Emesso da:** `task.worker.ts` su `result.status === "completed"`

---

### `task.failed`

Emesso quando il task fallisce in modo non recuperabile.

| Campo | Tipo | Descrizione |
|-------|------|-------------|
| error_code | string | Codice errore (`JobErrorCode`) |
| message | string | Messaggio di errore leggibile |

**Emesso da:** `task.worker.ts` su job failure finale

---

### `agent.pr.updated`

Emesso quando lo stato di una PR cambia.

| Campo | Tipo | Descrizione |
|-------|------|-------------|
| pr_url | string | URL completo della PR |
| pr_number | number? | Numero PR |
| status | `"open" \| "merged" \| "closed" \| "draft"` | Nuovo stato |
| additions | number? | Righe aggiunte |
| deletions | number? | Righe rimosse |
| changed_files | number? | File modificati |

**Emesso da:** [da definire in Sprint C — tipo definito in `EventPayloadMap` ma emissione non trovata nei worker correnti]

---

### `agent.deploy.staging`

Emesso quando un deploy staging viene avviato o aggiornato.

| Campo | Tipo | Descrizione |
|-------|------|-------------|
| deploy_url | string | URL del deploy staging |
| deploy_status | `"building" \| "ready" \| "error"` | Stato |
| error_message | string? | Messaggio errore se `"error"` |

**Emesso da:** `ClaudeRunner` (rilevato dall'output di Claude)

---

### `agent.provisioning.started`

Emesso quando viene avviato il provisioning di un agente.

| Campo | Tipo | Descrizione |
|-------|------|-------------|
| agent_name | string | Nome dell'agente |
| workspace_id | string | UUID del workspace |

**Emesso da:** `POST /api/agents` (human)

---

### `agent.provisioning.vps_created`

Emesso quando la VPS Hetzner è stata creata.

| Campo | Tipo | Descrizione |
|-------|------|-------------|
| vps_id | number | ID numerico server Hetzner |
| vps_ip | string | IP pubblico del VPS |

**Emesso da:** `agent.provisioning.worker.ts` dopo `createServer()`

---

### `agent.provisioning.setup_running`

Emesso quando la VPS raggiunge lo stato `running`.

| Campo | Tipo | Descrizione |
|-------|------|-------------|
| — | — | Nessun payload aggiuntivo |

**Emesso da:** `agent.provisioning.worker.ts` dopo `waitForServerRunning()` — [emissione da verificare nel worker corrente]

---

### `agent.provisioning.health_check`

Emesso durante il polling del heartbeat.

| Campo | Tipo | Descrizione |
|-------|------|-------------|
| — | — | Nessun payload aggiuntivo |

**Emesso da:** [non trovato nell'implementazione corrente — definito nell'enum DB (0007)]

---

### `agent.provisioning.completed`

Emesso quando l'agente è online e pronto.

| Campo | Tipo | Descrizione |
|-------|------|-------------|
| — | — | Nessun payload aggiuntivo |

**Emesso da:** [non trovato nell'implementazione corrente — il worker aggiorna `provisioning_status = 'online'` ma non emette esplicitamente questo evento]

---

### `agent.provisioning.failed`

Emesso quando il provisioning fallisce.

| Campo | Tipo | Descrizione |
|-------|------|-------------|
| reason | string | Motivo del fallimento |

**Emesso da:** [non trovato nell'implementazione corrente — da verificare]

---

### `agent.deprovisioned`

Emesso quando la VPS è stata eliminata.

| Campo | Tipo | Descrizione |
|-------|------|-------------|
| — | — | Nessun payload aggiuntivo |

**Emesso da:** `agent.deprovisioning.worker.ts` al completamento teardown

---

### `task.pr_closed_without_merge`

Emesso quando una PR viene chiusa senza essere mergeata.

| Campo | Tipo | Descrizione |
|-------|------|-------------|
| pr_number | number | Numero PR chiusa |
| iteration_number | number | Numero iterazione corrente |

**Emesso da:** `github-events.worker.ts` su `pull_request:closed` con `merged=false`

---

### `user.task.created`

Emesso quando un utente crea un task dalla dashboard (aggiuntivo a `task.created`).

| Campo | Tipo | Descrizione |
|-------|------|-------------|
| title | string | Titolo |
| description | string? | Descrizione |
| priority | string? | Priorità |
| type | string? | Tipo |

**Emesso da:** `POST /api/tasks` (human)

---

### `user.task.updated`

Emesso quando un utente aggiorna un task dalla dashboard.

| Campo | Tipo | Descrizione |
|-------|------|-------------|
| before | Record<string, unknown> | Campi prima della modifica |
| after | Record<string, unknown> | Campi dopo la modifica |

**Emesso da:** `PATCH /api/tasks/[taskId]` (human)

---

### `user.task.deleted`

Emesso quando un utente elimina un task.

| Campo | Tipo | Descrizione |
|-------|------|-------------|
| task_id | string | UUID del task |
| title | string? | Titolo |

**Emesso da:** `DELETE /api/tasks/[taskId]` (human)

---

### `user.rework.initiated`

Emesso quando un utente avvia manualmente un rework dalla dashboard.

| Campo | Tipo | Descrizione |
|-------|------|-------------|
| reason | string? | Motivazione |
| iteration_number | number? | Numero iterazione |
| title | string? | Titolo aggiornato (se cambiato) |
| description | string? | Descrizione aggiornata (se cambiata) |
| priority | string? | Priorità aggiornata (se cambiata) |

**Emesso da:** API route (human)

---

## [Sprint C] — Eventi pianificati, non ancora implementati

| Evento | Quando | Note |
|--------|--------|------|
| `sprint.started` | Avvio sprint | Non in `EventPayloadMap` né in `task_event_type` DB |
| `sprint.completed` | Chiusura sprint | Come sopra |
| `task.rework_started` | Agente riprende dopo rework | Non in `shared-types` — da definire insieme a `ReworkPayload` |

---

## Proiezioni

### `TaskProjectedState`

Dato l'array di eventi ordinati per `created_at ASC`, la proiezione produce:

```typescript
type TaskProjectedState = {
  status: TaskStatus;
  currentPhase: ADWPPhase | null;
  prUrl: string | null;         // shortcut — uguale a prData.pr_url
  prData: PRData | null;
  deployData: DeployData | null;
  commitSha: string | null;
  blockedReason: string | null;
  lastUpdated: string;
};
```

### `PRData`

```typescript
type PRData = {
  pr_url: string;
  pr_number?: number;
  title?: string;
  branch?: string;
  additions?: number;
  deletions?: number;
  changed_files?: number;
  commits?: number;
  status: "open" | "merged" | "closed" | "draft";
};
```

### `DeployData`

```typescript
type DeployData = {
  deploy_url: string;
  deploy_status: "building" | "ready" | "error";
  error_message?: string;
};
```

---

## Regole di riduzione

### `status`
```typescript
case "task.state.changed":
  state.status = payload.to;
```
Stato iniziale default: `"pending"`.

### `currentPhase`
```typescript
case "agent.phase.started":
  state.currentPhase = payload.phase as ADWPPhase;
case "agent.phase.completed":
  state.currentPhase = null;
```

### `prUrl` e `prData`
```typescript
case "agent.pr.opened":
  state.prUrl = payload.pr_url;
  state.prData = { pr_url: payload.pr_url, status: "open", ...extraFields };
case "agent.pr.updated":
  if (state.prData) {
    state.prData = { ...state.prData, ...payload };
    state.prUrl = payload.pr_url;
  }
```

### `deployData`
```typescript
case "agent.deploy.staging":
  state.deployData = {
    deploy_url: payload.deploy_url,
    deploy_status: payload.deploy_status,
    ...(payload.error_message !== undefined && { error_message: payload.error_message }),
  };
```

### `commitSha`
```typescript
case "agent.commit.pushed":
  state.commitSha = payload.commit_sha;
case "agent.pr.opened":
  if (payload.commit_sha) state.commitSha = payload.commit_sha;
```

### `blockedReason`
```typescript
case "agent.blocked":
  state.blockedReason = payload.question;
case "human.approved":
case "human.rejected":
  state.blockedReason = null;
```

### `lastUpdated`
```typescript
state.lastUpdated = event.created_at;
```

---

## Implementazione

```typescript
// apps/web/lib/db/projectTaskState.ts
export function projectTaskState(events: TaskEvent[]): TaskProjectedState {
  const initial: TaskProjectedState = {
    status: "pending",
    currentPhase: null,
    prUrl: null,
    prData: null,
    deployData: null,
    commitSha: null,
    blockedReason: null,
    lastUpdated: events[0]?.created_at ?? new Date().toISOString(),
  };

  return events.reduce<TaskProjectedState>((state, event) => {
    // ... regole sopra
    return { ...state, lastUpdated: event.created_at };
  }, initial);
}
```

**Wrapper con DB:** `apps/web/lib/db/events.ts → getTaskProjectedState()`

**Narrativize:** `apps/web/lib/events/narrativize.ts` — converte ogni evento in stringa leggibile.

---

## Testing proiezioni

Le proiezioni non richiedono DB — testabili con array di eventi fixture:

```typescript
const events = [
  makeEvent("task.state.changed", { from: "pending", to: "in_progress" }),
  makeEvent("agent.phase.started", { phase: "analysis" }),
  makeEvent("agent.pr.opened", { pr_url: "https://github.com/org/repo/pull/42", pr_number: 42 }),
  makeEvent("agent.deploy.staging", { deploy_url: "https://preview.vercel.app", deploy_status: "ready" }),
];
const state = projectTaskState(events);
expect(state.status).toBe("in_progress");
expect(state.prUrl).toBe("https://github.com/org/repo/pull/42");
expect(state.prData?.status).toBe("open");
expect(state.deployData?.deploy_status).toBe("ready");
```
