# Event Catalog — Robin.dev

Catalogo di tutti gli eventi `task_events`. Ogni evento è immutabile e append-only.

---

## Convenzioni

- **`actor_type`**: `"agent"` o `"human"`
- **`actor_id`**: UUID dell'agente (come stringa) o Clerk user ID
- **`payload`**: JSON tipizzato per ogni `event_type` (vedi `EventPayloadMap` in `shared-types`)
- Gli eventi non hanno campo `version` — il discriminatore è `event_type`

---

## Eventi

### `task.created`

Emesso quando un task viene creato nel sistema.

| Campo   | Tipo     | Descrizione                        |
|---------|----------|------------------------------------|
| title   | string   | Titolo del task al momento creazione |
| description | string | Descrizione completa             |
| priority | TaskPriority | Priorità assegnata            |

**Emesso da:** API route `/api/tasks` (human)

---

### `task.state.changed`

Emesso ad ogni transizione di stato del task.

| Campo | Tipo       | Descrizione                         |
|-------|------------|-------------------------------------|
| from  | TaskStatus | Stato precedente                    |
| to    | TaskStatus | Nuovo stato                         |
| note  | string?    | Nota opzionale (es. motivo rifiuto) |

**Emesso da:** `TaskRepository.updateStatus()` (agent o human)

---

### `agent.phase.started`

Emesso quando l'agente inizia una fase di lavoro ADWP.

| Campo | Tipo               | Descrizione              |
|-------|--------------------|--------------------------|
| phase | ADWPPhase \| string | Fase corrente dell'agente |

**ADWP Phases:** `analysis` | `design` | `write` | `proof`

**Emesso da:** `EventService` nell'orchestratore

---

### `agent.phase.completed`

Emesso quando l'agente completa una fase.

| Campo            | Tipo               | Descrizione                   |
|------------------|--------------------|-------------------------------|
| phase            | ADWPPhase \| string | Fase completata               |
| duration_seconds | number?            | Durata in secondi             |

**Emesso da:** `EventService` nell'orchestratore

---

### `agent.commit.pushed`

Emesso quando l'agente fa push di un commit.

| Campo      | Tipo    | Descrizione                    |
|------------|---------|--------------------------------|
| commit_sha | string  | SHA completo del commit (40 chars) |
| branch     | string  | Branch su cui è stato pushato  |
| message    | string? | Primo rigo del commit message  |

**Emesso da:** `ClaudeRunner` (rilevato dall'output di Claude)

---

### `agent.pr.opened`

Emesso quando l'agente apre una Pull Request.

| Campo      | Tipo    | Descrizione              |
|------------|---------|--------------------------|
| pr_url     | string  | URL completo della PR    |
| pr_number  | number? | Numero PR su GitHub      |
| commit_sha | string? | HEAD SHA della PR        |

**Emesso da:** `task.worker.ts` dopo `ClaudeRunner.run()`

> ⚠️ Questo evento ha un indice GIN su `payload` per query su `pr_url`.

---

### `agent.blocked`

Emesso quando l'agente non può procedere senza input umano.

| Campo    | Tipo   | Descrizione                              |
|----------|--------|------------------------------------------|
| question | string | La domanda che l'agente ha posto         |

**Emesso da:** `task.worker.ts` su `AgentBlockedError`

---

### `human.approved`

Emesso quando un umano approva la PR del task.

| Campo   | Tipo    | Descrizione       |
|---------|---------|-------------------|
| comment | string? | Commento opzionale |

**Emesso da:** API route (human)

---

### `human.rejected`

Emesso quando un umano rifiuta la PR del task.

| Campo  | Tipo    | Descrizione           |
|--------|---------|-----------------------|
| reason | string? | Motivo del rifiuto    |

**Emesso da:** API route (human)

---

### `human.commented`

Emesso quando un umano commenta su un task.

| Campo   | Tipo   | Descrizione      |
|---------|--------|------------------|
| comment | string | Testo del commento |

**Emesso da:** API route (human)

---

### `task.completed`

Emesso quando il task è completato con successo.

| Campo            | Tipo    | Descrizione                  |
|------------------|---------|------------------------------|
| duration_seconds | number? | Durata totale dell'esecuzione |

**Emesso da:** `task.worker.ts` su `result.status === "completed"`

---

### `task.failed`

Emesso quando il task fallisce in modo non recuperabile.

| Campo      | Tipo   | Descrizione                     |
|------------|--------|---------------------------------|
| error_code | string | Codice errore (`JobErrorCode`)  |
| message    | string | Messaggio di errore leggibile   |

**Emesso da:** `task.worker.ts` su job failure finale

---

## Proiezione → `TaskProjectedState`

Dato l'array di eventi ordinati per `created_at ASC`, la proiezione produce:

```typescript
type TaskProjectedState = {
  status: TaskStatus;           // dall'ultimo task.state.changed
  currentPhase: ADWPPhase | null; // dall'ultimo agent.phase.started/completed
  prUrl: string | null;         // da agent.pr.opened
  commitSha: string | null;     // da agent.commit.pushed o agent.pr.opened
  blockedReason: string | null; // da agent.blocked (null se poi risolto)
  lastUpdated: string;          // created_at dell'ultimo evento
};
```

Implementazione: `apps/web/lib/db/events.ts → getTaskProjectedState()`
