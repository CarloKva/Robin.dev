# Projections — Robin.dev

Le proiezioni calcolano lo stato corrente di un task riducendo la sequenza di eventi.
Sono implementate in TypeScript (non in PostgreSQL) per testabilità e flessibilità.

---

## Principio

```
events: TaskEvent[]  →  reduce()  →  TaskProjectedState
```

Gli eventi sono immutabili e ordinati per `created_at ASC`. La proiezione è deterministica:
lo stesso array di eventi produce sempre lo stesso stato.

---

## `TaskProjectedState`

```typescript
type TaskProjectedState = {
  status: TaskStatus;
  currentPhase: ADWPPhase | null;
  prUrl: string | null;
  commitSha: string | null;
  blockedReason: string | null;
  lastUpdated: string;
};
```

---

## Regole di riduzione per campo

### `status`

Aggiornato da ogni evento `task.state.changed`:

```typescript
case "task.state.changed":
  state.status = payload.to;
```

Stato iniziale default: `"pending"`.

### `currentPhase`

- `agent.phase.started` → imposta la fase
- `agent.phase.completed` → resetta a `null`

```typescript
case "agent.phase.started":
  state.currentPhase = payload.phase as ADWPPhase;
case "agent.phase.completed":
  state.currentPhase = null;
```

### `prUrl`

Impostato da `agent.pr.opened`, non viene mai annullato:

```typescript
case "agent.pr.opened":
  state.prUrl = payload.pr_url;
```

### `commitSha`

Aggiornato da `agent.commit.pushed` e da `agent.pr.opened` (se presente `commit_sha`):

```typescript
case "agent.commit.pushed":
  state.commitSha = payload.commit_sha;
case "agent.pr.opened":
  if (payload.commit_sha) state.commitSha = payload.commit_sha;
```

### `blockedReason`

- `agent.blocked` → imposta la domanda
- `human.approved` o `human.rejected` → resetta a `null` (task riprende)

```typescript
case "agent.blocked":
  state.blockedReason = payload.question;
case "human.approved":
case "human.rejected":
  state.blockedReason = null;
```

### `lastUpdated`

Sempre aggiornato all'evento corrente:

```typescript
state.lastUpdated = event.created_at;
```

---

## Implementazione

File: `apps/web/lib/db/events.ts`

```typescript
export function projectTaskState(events: TaskEvent[]): TaskProjectedState {
  return events.reduce<TaskProjectedState>(
    (state, event) => {
      // ... regole sopra
      return state;
    },
    {
      status: "pending",
      currentPhase: null,
      prUrl: null,
      commitSha: null,
      blockedReason: null,
      lastUpdated: events[0]?.created_at ?? new Date().toISOString(),
    }
  );
}
```

---

## `TimelineEntry`

Una proiezione più semplice che converte ogni evento in una voce narrativa:

```typescript
type TimelineEntry = {
  id: string;
  event_type: TaskEventType;
  actor_type: ActorType;
  actor_id: string;
  payload: Record<string, unknown>;
  created_at: string;
  narrative: string;  // testo leggibile prodotto da narrativize()
};
```

Implementazione narrativize: `apps/web/lib/events/narrativize.ts`

---

## Testing

Le proiezioni non richiedono DB. Si testano con array di eventi fixture:

```typescript
// Esempio test (futuro)
const events = [
  makeEvent("task.state.changed", { from: "pending", to: "in_progress" }),
  makeEvent("agent.phase.started", { phase: "analysis" }),
  makeEvent("agent.pr.opened", { pr_url: "https://github.com/org/repo/pull/42" }),
];
const state = projectTaskState(events);
expect(state.status).toBe("in_progress");
expect(state.prUrl).toBe("https://github.com/org/repo/pull/42");
```
