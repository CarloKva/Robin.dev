# Spike 08 — Event Schema Design

**Sprint:** 3
**Status:** ✅ Complete
**Decision:** → ADR-07

---

## Obiettivo

Definire lo schema strutturato dei payload degli eventi `task_events` per garantire
type-safety end-to-end tra orchestratore, Supabase e frontend.

---

## Opzioni analizzate

### Opzione A — Campo `version` nel payload

Ogni evento porta `{ version: 1, ...data }` nel payload JSON.

**Pro:** Migrazione controllata se cambia il payload
**Contro:** Overhead cognitivo. Con event sourcing immutabile le versioni non cambiano —
i vecchi eventi rimangono invariati. Il discriminatore è già `event_type`.

### Opzione B — Funzioni PostgreSQL per proiezioni

Proiezioni calcolate via SQL (es. `get_task_state(task_id)`).

**Pro:** Query semplici lato client
**Contro:** Logica business sepolta nel DB, difficile da testare, accoppiamento schema rigido.
In caso di bug nei trigger PostgreSQL il debug è laborioso.

### Opzione C — Proiezioni TypeScript + `EventPayloadMap` (SCELTA)

- `event_type` come discriminatore unico (no `version`)
- `EventPayloadMap`: discriminated union TypeScript con payload tipizzato per ciascun event type
- Proiezioni calcolate in TypeScript tramite `reduce()` sull'array di eventi
- Indice GIN su payload solo per `agent.pr.opened` (prUrl è utile per query dirette)

**Pro:** Type-safety piena nel compilatore TS, testabilità con unit test, flessibilità
**Contro:** Proiezioni non disponibili via SQL diretto (accettabile: non serve)

---

## Analisi indici

```sql
-- Timeline query: ORDER BY created_at per task
CREATE INDEX task_events_task_id_created_at_idx
  ON task_events (task_id, created_at ASC);

-- GIN solo per pr_url (unico campo utile come filtro)
CREATE INDEX task_events_pr_url_gin_idx
  ON task_events USING GIN (payload)
  WHERE event_type = 'agent.pr.opened';
```

Indice GIN su tutto il payload sarebbe troppo pesante per uso generico.

---

## EventPayloadMap — struttura

```typescript
export type EventPayloadMap = {
  "task.created":          { title: string; description: string; priority: TaskPriority };
  "task.state.changed":    { from: TaskStatus; to: TaskStatus; note?: string };
  "agent.phase.started":   { phase: ADWPPhase | string };
  "agent.phase.completed": { phase: ADWPPhase | string; duration_seconds?: number };
  "agent.commit.pushed":   { commit_sha: string; branch: string; message?: string };
  "agent.pr.opened":       { pr_url: string; pr_number?: number; commit_sha?: string };
  "agent.blocked":         { question: string };
  "human.approved":        { comment?: string };
  "human.rejected":        { reason?: string };
  "human.commented":       { comment: string };
  "task.completed":        { duration_seconds?: number };
  "task.failed":           { error_code: string; message: string };
};
```

---

## ADWPPhase

Fasi del ciclo di lavoro dell'agente:

| Fase       | Descrizione                              |
|------------|------------------------------------------|
| `analysis` | L'agente analizza il task e il codebase  |
| `design`   | Pianificazione dell'implementazione      |
| `write`    | Scrittura del codice                     |
| `proof`    | Test, review, cleanup                    |

---

## Decisione

→ Opzione C. Vedi ADR-07 per la decisione formale.
