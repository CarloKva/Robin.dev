# Robin.dev — Sprint 3 Backlog
## Event sourcing e real-time

**Versione 1.0 · Carlo Ferrero · Febbraio 2026**

---

## Obiettivo dello sprint

Implementare l'activity log come event sourcing e portare il gestionale
in real-time via WebSockets. Al termine di questo sprint:

- ogni azione dell'agente produce un evento strutturato scritto su Supabase
- il gestionale mostra cosa sta facendo l'agente in questo momento
- la timeline di una task è una storia narrativa leggibile, non un raw log
- nessun refresh manuale — gli aggiornamenti arrivano in meno di 1 secondo

**Cosa ottieni concretamente alla fine:**
Crei una task nel gestionale → guardi lo stato dell'agente cambiare in
tempo reale senza premere F5 → apri la task detail → vedi la timeline
completa con ogni evento dell'agente narrativizzato → quando arriva
un nuovo evento mentre stai guardando la pagina, appare senza reload.
Tutto verificabile da Supabase: ogni evento è immutabile, timestampato,
con payload strutturato.

---

## Prerequisiti da Sprint 2

Prima di iniziare questo sprint, verificare che siano soddisfatti:

- [ ] Orchestratore funzionante su VPS con BullMQ + Redis
- [ ] Flusso end-to-end: task su Supabase → job → Claude Code → PR → `in_review`
- [ ] `updateTaskStatus()` già scrive eventi `task.state.changed` su `task_events`
- [ ] Tabella `task_events` già presente nello schema (creata in Sprint 1)
- [ ] Supabase Realtime abilitato sul progetto (verifica in Supabase Dashboard → Realtime)
- [ ] Package `shared-types` configurato e importabile da `web` e `orchestrator`

Se uno di questi non è soddisfatto, Sprint 3 non inizia.

---

## Struttura del backlog

```
Sprint 3
├── FASE A — Analisi e Design
│   ├── EPIC-12 · Decisioni architetturali (ADR)
│   └── EPIC-13 · Design del catalogo eventi e proiezioni
└── FASE B — Implementazione
    ├── EPIC-14 · Schema event sourcing su Supabase
    ├── EPIC-15 · Emissione eventi dall'orchestratore
    ├── EPIC-16 · Real-time sul gestionale
    └── EPIC-17 · Timeline UI
```

---

## FASE A — Analisi e Design

---

### EPIC-12 · Decisioni architetturali (ADR)

**Descrizione**
Due decisioni architetturali da chiudere prima di scrivere una riga
di codice. La struttura del payload degli eventi impatta lo schema del DB,
i tipi condivisi, la UI e la query di proiezione — se non è definita bene
ora, si paga cara dopo. La strategia real-time impatta la complessità
del codice client e la gestione dei casi di errore.

---

#### STORY-03.01 · ADR sulla struttura degli eventi e versioning del payload

```
Come architect del sistema,
voglio documentare e chiudere la struttura dei payload degli eventi
e la strategia di versioning,
per non dover fare una migration distruttiva quando si aggiunge
un campo al payload di un evento già in produzione.
```

**Criteri di accettazione**
- [ ] ADR-07 scritto e committed sotto `/docs/adr/`
- [ ] Il formato base di ogni evento è definito (campi obbligatori, convenzioni)
- [ ] La strategia di versioning del payload è definita (come si gestisce
  l'evoluzione del payload senza rompere i client esistenti)
- [ ] Il catalogo completo degli event types è elencato nell'ADR
  (anche quelli non implementati in questo sprint — verranno aggiunti dopo)
- [ ] Le implicazioni sulla struttura JSONB su PostgreSQL sono documentate
  (indici su campi JSONB, query pattern attesi)

**SPIKE-03.01.A · Struttura payload e versioning eventi**
*Time-box: 2h*

Domande da rispondere:
- Quale formato di base ha ogni evento? Il campo `payload` è JSONB libero
  o ha una struttura parzialmente fissa? Aggiungere `version: number`
  a ogni payload vale la complessità?
- Come si gestisce un client che legge un evento di versione 2
  quando conosce solo la versione 1? Schema evolution vs strict typing?
- Vale la pena usare Zod per validare il payload al momento dell'inserimento?
  O ci si fida che l'orchestratore inserisca payload corretti?
- Gli indici su `payload->>'fieldName'` su PostgreSQL hanno overhead
  significativo? Quali campi del payload conviene indicizzare
  (es. `payload->>'prUrl'` per recuperare PR di una task)?
- Conviene avere una colonna `metadata` separata da `payload`?
  (Es. `payload` = dati specifici dell'evento, `metadata` = dati di contesto sempre presenti)

Output: `docs/spikes/spike-08-event-schema.md` con analisi e raccomandazione.

**TASK-03.01.1** — Definire il formato base di ogni evento:
```typescript
type TaskEvent = {
  id: string              // UUID
  task_id: string         // FK → tasks
  workspace_id: string    // FK → workspaces (per RLS e indici)
  event_type: EventType   // enum
  actor_type: 'agent' | 'human' | 'system'
  actor_id?: string       // Clerk user ID o agent ID
  payload: EventPayload   // JSONB con struttura per tipo
  created_at: string      // immutabile, no updated_at
}
```

**TASK-03.01.2** — Definire la struttura payload per ogni event type
del catalogo (vedi STORY-03.03). Documentare nell'ADR con esempi concreti:
```json
// task.state.changed
{
  "from": "backlog",
  "to": "in_progress",
  "reason": "job picked up by worker"
}

// agent.phase.started
{
  "phase": "ANALYSIS",
  "adwp_step": 2,
  "context": "reading CLAUDE.md and task description"
}

// agent.pr.opened
{
  "prUrl": "https://github.com/org/repo/pull/42",
  "prNumber": 42,
  "branch": "robindev/task-abc123",
  "filesChanged": 3,
  "linesAdded": 47,
  "linesRemoved": 12
}
```

**TASK-03.01.3** — Scrivere ADR-07 con decisione finale e committed nel repo.

---

#### STORY-03.02 · ADR sulla strategia real-time

```
Come architect del sistema,
voglio documentare la scelta tra le strategie di real-time disponibili,
per non scoprire limitazioni operative dopo aver costruito il layer
di subscription nel gestionale.
```

**Criteri di accettazione**
- [ ] ADR-08 scritto e committed
- [ ] Le opzioni analizzate includono almeno: Supabase Realtime su `task_events`,
  Supabase Broadcast channels, polling con backoff adattivo
- [ ] La strategia di reconnect è definita (cosa succede se la connessione cade?)
- [ ] La strategia di fallback è definita (cosa mostra la UI se Realtime non è disponibile?)
- [ ] Le limitazioni di Supabase Realtime sono documentate (limite connessioni,
  payload massimo, latenza attesa)

**SPIKE-03.02.A · Supabase Realtime in profondità**
*Time-box: 2h*

Domande da rispondere:
- Supabase Realtime su `task_events`: si può fare subscription filtrata per
  `task_id`? Per `workspace_id`? O si ricevono tutti gli eventi e si filtra client-side?
- Qual è il limite di connessioni WebSocket per piano Supabase Free/Pro?
  Con N utenti che guardano la stessa task detail, si apre N connessioni
  o Supabase gestisce il multiplexing?
- Come si gestisce il reconnect? Supabase SDK lo fa automaticamente?
  Cosa succede agli eventi persi durante la disconnessione?
- Broadcast channels: differenza rispetto a Realtime su tabella?
  Quando conviene usare uno vs l'altro?
- Il fallback a polling è necessario? In quale scenario Realtime non è disponibile?
  Come si implementa un fallback trasparente per l'utente?

Output: `docs/spikes/spike-09-realtime.md` con comparazione e decisione.

**TASK-03.02.1** — Testare Supabase Realtime in isolamento:
creare una subscription su `task_events` filtrata per `task_id`,
inserire un evento via SQL, verificare che arrivi al client in < 1s.

**TASK-03.02.2** — Testare il comportamento in caso di disconnessione:
disabilitare rete, reinserire evento, riabilitare rete — l'evento arriva?

**TASK-03.02.3** — Scrivere ADR-08 con strategia definitiva,
gestione reconnect e fallback.

---

### EPIC-13 · Design del catalogo eventi e proiezioni

**Descrizione**
Il catalogo eventi è il vocabolario del sistema. Ogni evento che può
accadere nel ciclo di vita di una task deve essere definito, nominato
con convenzione coerente, e avere un payload tipizzato in TypeScript.
Le funzioni di proiezione derivano lo stato corrente di una task
dalla sequenza di eventi — devono essere definite prima di implementarle.

---

#### STORY-03.03 · Catalogo eventi completo

```
Come sistema,
voglio un catalogo completo e tipizzato di tutti gli eventi possibili,
per avere un contratto esplicito tra orchestratore (produce eventi)
e gestionale (consuma eventi).
```

**Criteri di accettazione**
- [ ] Tutti gli event types sono definiti come union type TypeScript in `shared-types`
- [ ] Ogni event type ha un payload tipizzato con i campi obbligatori e opzionali
- [ ] Il documento `docs/event-catalog.md` descrive ogni evento in linguaggio naturale:
  quando viene emesso, chi lo emette, cosa contiene il payload, esempio concreto
- [ ] La convenzione di naming è rispettata (dot notation: `entity.action.qualifier`)
- [ ] Il catalogo copre il ciclo di vita completo di una task, inclusi i casi di errore

**TASK-03.03.1** — Definire l'enum `EventType` in `packages/shared-types/src/events.ts`:
```typescript
export type EventType =
  // Ciclo di vita task
  | 'task.created'
  | 'task.state.changed'
  | 'task.completed'
  | 'task.failed'
  | 'task.cancelled'
  // Fasi agente
  | 'agent.phase.started'
  | 'agent.phase.completed'
  // Azioni agente
  | 'agent.commit.pushed'
  | 'agent.pr.opened'
  | 'agent.pr.updated'
  | 'agent.blocked'
  | 'agent.unblocked'
  // Azioni umane
  | 'human.approved'
  | 'human.rejected'
  | 'human.commented'
  | 'human.assigned'
```

**TASK-03.03.2** — Definire il tipo discriminato `EventPayload` per ogni EventType:
```typescript
export type EventPayloadMap = {
  'task.state.changed': {
    from: TaskStatus
    to: TaskStatus
    reason: string
  }
  'agent.phase.started': {
    phase: ADWPPhase
    adwp_step: number
    context?: string
  }
  'agent.pr.opened': {
    prUrl: string
    prNumber: number
    branch: string
    filesChanged: number
    linesAdded: number
    linesRemoved: number
  }
  'agent.blocked': {
    reason: string
    question?: string
    context?: string
  }
  // ... tutti gli altri
}

export type EventPayload<T extends EventType = EventType> = EventPayloadMap[T]
```

**TASK-03.03.3** — Scrivere `docs/event-catalog.md` con sezione per ogni
event type: descrizione, trigger, emesso da (orchestratore/gestionale/sistema),
payload con descrizione di ogni campo, esempio JSON concreto.

**TASK-03.03.4** — Definire il tipo `ADWPPhase` in `shared-types`:
```typescript
export type ADWPPhase =
  | 'INTAKE'
  | 'ANALYSIS'
  | 'DESIGN'
  | 'PLANNING'
  | 'IMPLEMENTATION'
  | 'TESTING'
  | 'DOCUMENTATION'
  | 'REVIEW'
```

---

#### STORY-03.04 · Design delle funzioni di proiezione

```
Come gestionale,
voglio funzioni di proiezione che ricostruiscono lo stato corrente di una task
dalla sequenza di eventi,
per avere un'unica fonte di verità derivata dagli eventi
invece di duplicare lo stato in più colonne.
```

**Criteri di accettazione**
- [ ] La funzione `getTaskState(taskId)` è progettata: cosa restituisce,
  quali eventi considera, come gestisce eventi mancanti o task vuota
- [ ] La funzione `getTaskTimeline(taskId)` è progettata: ordinamento,
  paginazione, formato di output per la UI
- [ ] Il documento `docs/projections.md` descrive le proiezioni con pseudocodice
  e casi limite (task senza eventi, eventi fuori ordine, evento di tipo sconosciuto)
- [ ] È deciso se le proiezioni sono funzioni PostgreSQL o funzioni TypeScript lato server
  (ADR-07 deve includere questa decisione)

**TASK-03.04.1** — Progettare `getTaskState(taskId)` — cosa restituisce:
```typescript
type TaskProjectedState = {
  currentStatus: TaskStatus
  currentPhase?: ADWPPhase  // fase ADWP corrente dell'agente
  isAgentActive: boolean
  isBlocked: boolean
  blockReason?: string
  lastEventAt: string
  prUrl?: string            // se l'agente ha aperto una PR
  completedPhases: ADWPPhase[]
  eventCount: number
}
```

**TASK-03.04.2** — Progettare `getTaskTimeline(taskId)` — formato output per la UI:
```typescript
type TimelineEntry = {
  id: string
  eventType: EventType
  actorType: 'agent' | 'human' | 'system'
  actorLabel: string         // "Robin" | nome utente | "System"
  narrativeText: string      // testo human-readable dell'evento
  payload: EventPayload
  createdAt: string
  isKeyEvent: boolean        // true per eventi significativi (PR, stato, blocco)
}
```

**TASK-03.04.3** — Decidere dove vivono le proiezioni:
PostgreSQL function (vicina ai dati, eseguibile via Supabase)
vs TypeScript function lato Next.js server (più controllabile, testabile con Jest).
Documentare la scelta in `docs/projections.md` con motivazione.

**TASK-03.04.4** — Definire la funzione `narrativize(event: TaskEvent): string`
che traduce un evento in testo leggibile:
```typescript
// esempi di output attesi:
// agent.phase.started → "Started analysis phase"
// agent.pr.opened → "Opened PR #42: Add user authentication"
// agent.blocked → "Blocked: needs clarification on database schema"
// task.state.changed (to in_review) → "Task ready for review"
// human.approved → "Carlo approved the changes"
```
Scrivere la mappa di trasformazione per ogni event type.

---

## FASE B — Implementazione

---

### EPIC-14 · Schema event sourcing su Supabase

**Descrizione**
La tabella `task_events` esiste già dallo Sprint 1 ma potrebbe avere
bisogno di aggiustamenti basati sulle decisioni prese nella Fase A
(nuovi indici, colonne aggiuntive, funzioni PostgreSQL).
Questo epic applica le migration necessarie e implementa
le funzioni di proiezione a livello di database.

---

#### STORY-03.05 · Migration per ottimizzazione task_events

```
Come sistema,
voglio che la tabella task_events sia ottimizzata per le query
che la Timeline UI e le funzioni di proiezione eseguiranno,
per avere tempi di risposta accettabili anche con centinaia di eventi per task.
```

**Criteri di accettazione**
- [ ] Migration `0003_event_sourcing.sql` creata e applicata (remote e locale)
- [ ] Indice su `(task_id, created_at)` — le query più comuni
- [ ] Indice su `(workspace_id, created_at DESC)` — feed workspace-level futuro
- [ ] Indice su `event_type` — per filtrare per tipo di evento nella Timeline
- [ ] Indice GIN su `payload` — se si decide di fare query su campi JSONB (ADR-07)
- [ ] La migration è idempotente (può essere rieseguita senza errori)
- [ ] `supabase db reset` locale funziona correttamente con la nuova migration

**TASK-03.05.1** — Verificare lo schema attuale di `task_events`
rispetto a quello necessario. Identificare colonne mancanti o da aggiungere.
Possibili aggiunte: `actor_id`, `sequence_number` (per ordinamento garantito).

**TASK-03.05.2** — Creare migration `0003_event_sourcing.sql`:
```sql
-- Indici per query pattern della Timeline UI
CREATE INDEX IF NOT EXISTS idx_task_events_task_timeline
  ON task_events (task_id, created_at ASC);

CREATE INDEX IF NOT EXISTS idx_task_events_workspace_feed
  ON task_events (workspace_id, created_at DESC);

CREATE INDEX IF NOT EXISTS idx_task_events_type
  ON task_events (event_type);

-- Se ADR-07 decide di indicizzare campi JSONB specifici
-- CREATE INDEX IF NOT EXISTS idx_task_events_payload_pr
--   ON task_events ((payload->>'prUrl'))
--   WHERE event_type = 'agent.pr.opened';
```

**TASK-03.05.3** — Abilitare Supabase Realtime sulla tabella `task_events`:
```sql
-- In Supabase Dashboard → Realtime → Tables, oppure via migration:
ALTER PUBLICATION supabase_realtime ADD TABLE task_events;
```
Verificare che la pubblicazione sia attiva.

**TASK-03.05.4** — Applicare migration in locale e su remote.
Verificare con `supabase db reset` che lo stack completo sia pulito.

---

#### STORY-03.06 · Funzioni di proiezione (PostgreSQL o TypeScript)

```
Come gestionale,
voglio le funzioni di proiezione implementate e disponibili,
per poter costruire la Timeline UI e il dashboard real-time sopra di esse.
```

**Criteri di accettazione**
- [ ] `getTaskTimeline(taskId)` implementata e testata: restituisce eventi
  in ordine cronologico con il testo narrativo per ciascuno
- [ ] `getTaskProjectedState(taskId)` implementata e testata: restituisce
  lo stato derivato dagli eventi (status corrente, fase, PR, ecc.)
- [ ] Le funzioni gestiscono correttamente task senza eventi (restituiscono
  default sensati, non crash)
- [ ] Le funzioni sono testate con dati reali del seed

**TASK-03.06.1** — Implementare `getTaskTimeline(taskId: string): Promise<TimelineEntry[]>`
in `apps/web/lib/db/events.ts`:
```typescript
export async function getTaskTimeline(taskId: string): Promise<TimelineEntry[]> {
  // Query su task_events ordinata per created_at ASC
  // Trasforma ogni evento con narrativize()
  // Marca isKeyEvent per eventi significativi
}
```

**TASK-03.06.2** — Implementare `narrativize(event: TaskEvent): string`:
funzione in `apps/web/lib/events/narrativize.ts` che mappa ogni EventType
a una stringa leggibile. Usare la mappa definita in TASK-03.04.4.

**TASK-03.06.3** — Implementare `getTaskProjectedState(taskId: string): Promise<TaskProjectedState>`:
riduzione sulla sequenza di eventi per costruire lo stato aggregato.

**TASK-03.06.4** — Testare le funzioni con dati del seed:
eseguire `supabase db reset`, chiamare le funzioni sulle task seed,
verificare che i risultati siano corretti e coerenti con i dati inseriti.

---

### EPIC-15 · Emissione eventi dall'orchestratore

**Descrizione**
L'orchestratore già scrive l'evento `task.state.changed` ad ogni transizione
di stato (Sprint 2). Questo epic espande la copertura: ogni azione significativa
dell'agente — inizio di una fase ADWP, commit pushato, PR aperta, blocco —
deve produrre un evento strutturato su Supabase. Il sistema diventa
un archivio di tutto quello che l'agente ha fatto.

---

#### STORY-03.07 · EventService nel package orchestrator

```
Come orchestratore,
voglio un EventService con metodi tipizzati per emettere ogni tipo di evento,
per avere un punto centrale di emissione degli eventi
invece di query Supabase sparse nel codice.
```

**Criteri di accettazione**
- [ ] Classe `EventService` in `apps/orchestrator/src/events/event.service.ts`
- [ ] Un metodo per ogni event type del catalogo (o almeno per quelli emessi
  dall'orchestratore in questo sprint)
- [ ] I metodi sono tipizzati: il payload è validato a compile time grazie
  ai tipi importati da `shared-types`
- [ ] `EventService` usa il `supabase` client con service role (non bypassa la sicurezza,
  ma inserisce per conto di workspace — workspace_id sempre esplicito)
- [ ] Se l'inserimento fallisce, logga l'errore ma non fa crash il job
  (gli eventi sono osservabilità, non logica di business critica)
- [ ] Gli eventi sono immutabili — nessun metodo di update o delete

**TASK-03.07.1** — Creare `apps/orchestrator/src/events/event.service.ts`:
```typescript
import type { EventType, EventPayloadMap } from '@robindev/shared-types'

class EventService {
  async emit<T extends EventType>(
    taskId: string,
    workspaceId: string,
    eventType: T,
    payload: EventPayloadMap[T],
    actorType: 'agent' | 'system' = 'agent'
  ): Promise<void> {
    // Inserisce in task_events con service role
    // Non lancia eccezione se fallisce — logga e continua
  }

  // Metodi di convenienza per gli eventi più comuni:
  async emitPhaseStarted(taskId: string, workspaceId: string, phase: ADWPPhase): Promise<void>
  async emitPhaseCompleted(taskId: string, workspaceId: string, phase: ADWPPhase): Promise<void>
  async emitCommitPushed(taskId: string, workspaceId: string, commitSha: string, message: string): Promise<void>
  async emitPROpened(taskId: string, workspaceId: string, prUrl: string, prNumber: number, stats: PRStats): Promise<void>
  async emitBlocked(taskId: string, workspaceId: string, reason: string, question?: string): Promise<void>
}
```

**TASK-03.07.2** — Rendere `EventService` un singleton nel package orchestrator,
importabile da worker e altri moduli senza creare istanze multiple.

**TASK-03.07.3** — Aggiungere test manuale: chiamare `EventService.emit()` direttamente,
verificare che l'evento appaia in Supabase con payload corretto.

---

#### STORY-03.08 · Integrazione eventi nel worker

```
Come orchestratore,
voglio che ogni azione significativa dell'agente emetta un evento,
per avere un archivio completo e real-time di tutto quello che l'agente fa.
```

**Criteri di accettazione**
- [ ] `agent.phase.started` emesso all'inizio di ogni fase ADWP del processor
- [ ] `agent.phase.completed` emesso al completamento di ogni fase ADWP
- [ ] `agent.commit.pushed` emesso quando ClaudeRunner rileva un commit
  nel parsing dell'output (SHA, messaggio commit)
- [ ] `agent.pr.opened` emesso quando ClaudeRunner rileva una PR aperta
  (PR URL, numero, statistiche)
- [ ] `agent.blocked` emesso quando ClaudeRunner rileva che l'agente
  ha fatto una domanda o è in attesa di input
- [ ] Gli eventi sono emessi in ordine cronologico e non mancano mai
  (anche in caso di eccezione parziale nel processing)

**TASK-03.08.1** — Integrare `EventService` nel processor del worker:
aggiungere `emitPhaseStarted` / `emitPhaseCompleted` intorno a ogni
`runAgentPhase()`.

**TASK-03.08.2** — Estendere `ClaudeRunner` per estrarre dal parsing
dell'output di Claude Code: commit SHA + messaggio, PR URL + numero,
rilevamento di blocco (Claude Code che pone una domanda).

**TASK-03.08.3** — Aggiungere emissione eventi in `ClaudeRunner.run()`:
dopo il completamento, emettere `agent.commit.pushed` e `agent.pr.opened`
con i dati estratti.

**TASK-03.08.4** — Testare il flusso end-to-end: eseguire una task reale,
poi controllare `task_events` su Supabase — devono essere presenti
almeno: `task.state.changed` (backlog→in_progress), `agent.phase.started`
× N fasi, `agent.pr.opened`, `task.state.changed` (in_progress→in_review).

**TASK-03.08.5** — Verificare che gli eventi abbiano `created_at` in ordine
cronologico corretto e che la sequenza ricostruisca lo stato finale atteso
tramite `getTaskProjectedState()`.

---

### EPIC-16 · Real-time sul gestionale

**Descrizione**
Il gestionale si iscrive agli eventi di Supabase Realtime e aggiorna
la UI senza polling e senza refresh manuale. Questo epic implementa
il layer di subscription, la gestione della connessione, e i componenti
React che reagiscono agli eventi in arrivo.

---

#### STORY-03.09 · Supabase Realtime subscription

```
Come gestionale,
voglio un hook React che si iscrive agli eventi di una task in real-time,
per poter costruire componenti che si aggiornano automaticamente
senza logica di polling.
```

**Criteri di accettazione**
- [ ] Hook `useTaskEvents(taskId: string)` implementato in
  `apps/web/lib/realtime/useTaskEvents.ts`
- [ ] Il hook si iscrive al canale Supabase Realtime per `task_events` filtrato
  per `task_id`
- [ ] I nuovi eventi appaiono nello state del hook in < 1 secondo dall'inserimento
- [ ] Il hook gestisce il reconnect automatico (testare: disconnettere rete,
  riconnettersi — gli eventi arrivano di nuovo)
- [ ] Il hook si deiscrive correttamente quando il componente viene unmounted
  (cleanup function nel useEffect)
- [ ] In caso di errore di connessione, il hook mostra uno stato `isOffline: true`
  che la UI può usare per informare l'utente

**TASK-03.09.1** — Implementare il client Supabase lato browser per Realtime
in `apps/web/lib/supabase/client.ts` (singleton, non ricrea la connessione
ad ogni render):
```typescript
import { createBrowserClient } from '@supabase/ssr'
let supabaseBrowserClient: ReturnType<typeof createBrowserClient> | null = null

export function getSupabaseBrowserClient() {
  if (!supabaseBrowserClient) {
    supabaseBrowserClient = createBrowserClient(
      process.env.NEXT_PUBLIC_SUPABASE_URL!,
      process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!
    )
  }
  return supabaseBrowserClient
}
```

**TASK-03.09.2** — Implementare `useTaskEvents(taskId: string)`:
```typescript
export function useTaskEvents(taskId: string) {
  const [events, setEvents] = useState<TaskEvent[]>([])
  const [isOffline, setIsOffline] = useState(false)

  useEffect(() => {
    const supabase = getSupabaseBrowserClient()
    const channel = supabase
      .channel(`task-events:${taskId}`)
      .on('postgres_changes', {
        event: 'INSERT',
        schema: 'public',
        table: 'task_events',
        filter: `task_id=eq.${taskId}`
      }, (payload) => {
        setEvents(prev => [...prev, payload.new as TaskEvent])
        setIsOffline(false)
      })
      .subscribe((status) => {
        if (status === 'CHANNEL_ERROR') setIsOffline(true)
        if (status === 'SUBSCRIBED') setIsOffline(false)
      })

    return () => { supabase.removeChannel(channel) }
  }, [taskId])

  return { events, isOffline }
}
```

**TASK-03.09.3** — Testare il hook con un componente di debug minimale:
mostrare il numero di eventi ricevuti in real-time, inserire eventi
via Supabase SQL editor, verificare che il contatore si aggiorni in < 1s.

**TASK-03.09.4** — Testare il reconnect: aprire la pagina, simulare
la disconnessione di rete (DevTools → Network → Offline),
reinserire un evento dopo il ripristino, verificare che arrivi.

---

#### STORY-03.10 · Stato agente real-time nella dashboard

```
Come utente,
voglio vedere lo stato dell'agente aggiornato in tempo reale sulla dashboard,
per capire a colpo d'occhio se l'agente sta lavorando e su cosa.
```

**Criteri di accettazione**
- [ ] Componente `AgentStatusBadge` mostra lo stato corrente dell'agente:
  idle / working (con fase corrente) / blocked / offline
- [ ] Lo stato si aggiorna automaticamente quando arrivano nuovi eventi
  senza refresh della pagina
- [ ] Se l'agente è in fase `IMPLEMENTATION`, si vede "Working · Implementation"
- [ ] Se l'agente è bloccato, si vede "Blocked · Waiting for input" con il motivo
- [ ] Se non ci sono eventi negli ultimi 5 minuti, lo stato torna a "idle"
- [ ] Indicatore visivo di connessione Realtime: punto verde (connesso) /
  punto grigio (offline — mostra ultimo stato noto)

**TASK-03.10.1** — Creare componente `AgentStatusBadge` in
`apps/web/components/agent/AgentStatusBadge.tsx`:
- Riceve `workspaceId` come prop
- Si iscrive agli eventi dell'agente corrente del workspace
- Usa `getTaskProjectedState()` come stato iniziale (SSR),
  poi `useTaskEvents()` per aggiornamenti incrementali

**TASK-03.10.2** — Aggiungere `AgentStatusBadge` al layout della dashboard
(nella sidebar o nell'header, visibile da tutte le pagine).

**TASK-03.10.3** — Aggiungere l'indicatore di connessione Realtime:
icona con tooltip "Real-time connected" / "Offline — showing last known state".

**TASK-03.10.4** — Testare lo scenario completo:
avviare una task → guardare la dashboard → osservare lo stato
che passa da idle → working (ANALYSIS) → working (IMPLEMENTATION) →
working (REVIEW) → idle (in_review), tutto senza refresh.

---

#### STORY-03.11 · Feed live eventi nella task detail

```
Come utente che sta guardando una task in esecuzione,
voglio vedere i nuovi eventi apparire nella pagina senza refresh,
per seguire il lavoro dell'agente in tempo reale.
```

**Criteri di accettazione**
- [ ] Nella pagina task detail, i nuovi eventi appaiono in cima (o in fondo)
  alla timeline senza refresh
- [ ] Quando arriva un nuovo evento, c'è una notifica visiva discreta
  (es. badge "1 new event" che sparisce dopo 2 secondi)
- [ ] Lo scroll non viene interrotto dall'aggiornamento
  (nuovi eventi non fanno saltare la pagina)
- [ ] Il primo caricamento degli eventi è server-side (SSR),
  gli aggiornamenti successivi sono client-side via Realtime

**TASK-03.11.1** — Implementare hook `useTaskEventsFeed(taskId, initialEvents)`:
variante di `useTaskEvents` che accetta gli eventi iniziali caricati
lato server (SSR) e li fonde con gli eventi in arrivo in real-time,
deduplicando per ID.

**TASK-03.11.2** — Aggiungere logica di "new event toast":
quando arriva un evento mentre l'utente sta scorrendo la timeline,
mostrare un badge "↓ 1 new event" che porta all'evento più recente
al click, senza interrompere la posizione di scroll corrente.

**TASK-03.11.3** — Implementare la fusione SSR + Realtime senza duplicati:
i dati SSR hanno timestamp passati, gli eventi Realtime hanno timestamp
futuri — la fusione deve mantenere l'ordine cronologico.

---

### EPIC-17 · Timeline UI

**Descrizione**
La timeline è la feature visiva centrale di questo sprint. Non è un raw log
di record del database. È la storia narrativa di una task: cosa ha fatto
l'agente, in quale ordine, con quale esito. Il componente deve essere
leggibile da chiunque, non solo da un developer.

---

#### STORY-03.12 · Componente Timeline base

```
Come utente,
voglio vedere la storia completa di una task come sequenza di eventi narrativi,
per capire esattamente cosa ha fatto l'agente senza leggere log tecnici.
```

**Criteri di accettazione**
- [ ] Componente `Timeline` in `apps/web/components/timeline/Timeline.tsx`
- [ ] Ogni evento è visualizzato come entry con: icona per tipo,
  testo narrativo, timestamp relativo (es. "3 minutes ago"), actor label
- [ ] Gli eventi sono differenziati visivamente per categoria:
  eventi di stato (colore neutro), eventi agente (colore primario),
  eventi umani (colore accent), eventi critici — PR, blocco — (colore evidenziato)
- [ ] Gli eventi chiave (`isKeyEvent: true`) hanno visual emphasis maggiore
  rispetto agli eventi di contesto
- [ ] La timeline funziona correttamente con 1 evento, con 50 eventi,
  con 200 eventi (nessun problema di performance)
- [ ] I timestamp si aggiornano relativamente senza refresh
  (da "just now" a "2 minutes ago" a "1 hour ago")

**TASK-03.12.1** — Installare e configurare i componenti shadcn/ui necessari
per la timeline: `Badge`, `Avatar`, `Separator`, `ScrollArea`.

**TASK-03.12.2** — Implementare `TimelineEntry` — il componente per un singolo evento:
```typescript
type TimelineEntryProps = {
  entry: TimelineEntry  // tipo definito in STORY-03.04
  isLatest: boolean
}
```
Layout: icona (sinistra) → contenuto (destra) con testo narrativo + timestamp.

**TASK-03.12.3** — Implementare la mappa icona → EventType:
```typescript
const EVENT_ICONS: Record<EventType, LucideIcon> = {
  'task.state.changed': ArrowRight,
  'agent.phase.started': Play,
  'agent.phase.completed': Check,
  'agent.commit.pushed': GitCommit,
  'agent.pr.opened': GitPullRequest,
  'agent.blocked': AlertCircle,
  'human.approved': ThumbsUp,
  'human.commented': MessageSquare,
  // ...
}
```

**TASK-03.12.4** — Implementare il componente `Timeline` che renderizza
una lista di `TimelineEntry` con linea verticale di connessione.
Usare `ScrollArea` di shadcn/ui per gestire liste lunghe.

**TASK-03.12.5** — Implementare timestamp relativi che si aggiornano:
hook `useRelativeTime(timestamp: string)` che aggiorna ogni minuto.

---

#### STORY-03.13 · Pagina Task Detail con timeline integrata

```
Come utente,
voglio una pagina di dettaglio della task con timeline completa e aggiornamento real-time,
per avere tutte le informazioni di una task in un'unica schermata.
```

**Criteri di accettazione**
- [ ] Pagina `/tasks/[taskId]` mostra: header con titolo e stato task,
  sezione metadati (tipo, priorità, agente, date), timeline completa,
  sezione artifact (PR link se presente)
- [ ] La timeline è caricata server-side (SSR) per il primo rendering
- [ ] I nuovi eventi appaiono in real-time tramite `useTaskEventsFeed`
- [ ] Il link alla PR (se `agent.pr.opened` è tra gli eventi) è cliccabile
  e porta direttamente a GitHub
- [ ] La pagina mostra un indicatore visivo del fatto che la task
  è attiva in real-time vs completata (storica)

**TASK-03.13.1** — Creare Server Component `TaskDetailPage` in
`apps/web/app/(dashboard)/tasks/[taskId]/page.tsx`:
```typescript
export default async function TaskDetailPage({ params }: { params: { taskId: string } }) {
  const task = await getTaskById(params.taskId)
  const initialEvents = await getTaskTimeline(params.taskId)
  const projectedState = await getTaskProjectedState(params.taskId)

  return (
    <TaskDetailClient
      task={task}
      initialEvents={initialEvents}
      projectedState={projectedState}
    />
  )
}
```

**TASK-03.13.2** — Creare Client Component `TaskDetailClient` che gestisce
il real-time con `useTaskEventsFeed(taskId, initialEvents)`.

**TASK-03.13.3** — Implementare la sezione Artifacts:
estrarre `prUrl` dalla proiezione degli eventi e mostrarla come card
con link a GitHub. Se non c'è ancora una PR, mostrare placeholder.

**TASK-03.13.4** — Aggiungere link alla task detail dalla lista task
(tabella o card nella pagina `/tasks`).

**TASK-03.13.5** — Testare la pagina con dati del seed:
caricare la task detail con eventi pre-esistenti, verificare SSR corretto,
poi inserire un nuovo evento via SQL e verificare che appaia in real-time.

---

#### STORY-03.14 · Lista task aggiornata con stato real-time

```
Come utente,
voglio che la lista delle task mostri lo stato corrente di ogni task
senza dover ricaricare la pagina,
per avere un overview immediato dello stato del sistema.
```

**Criteri di accettazione**
- [ ] La pagina `/tasks` mostra una lista di task con stato e tipo
- [ ] La task attualmente in esecuzione ha un indicatore visivo animato
  (es. pulsing dot) per distinguerla dalle task ferme
- [ ] Quando lo stato di una task cambia, la lista si aggiorna
  senza refresh (almeno lo stato badge)
- [ ] La lista è ordinata per: task attive prima, poi per data di aggiornamento

**TASK-03.14.1** — Implementare hook `useActiveTask(workspaceId)`:
si iscrive agli eventi di Realtime a livello workspace (non task singola),
aggiorna l'ID della task attualmente in esecuzione.

**TASK-03.14.2** — Aggiungere indicatore di task attiva nella lista:
il componente `TaskStatusBadge` mostra un'animazione quando la task
corrisponde all'`activeTaskId` restituito da `useActiveTask`.

**TASK-03.14.3** — Creare la pagina `/tasks` base se non esiste ancora:
lista task con colonne essenziali (titolo, stato, tipo, data creazione, link a detail).

---

## Definition of Done — Sprint 3

Lo sprint è completato quando **tutti** i seguenti criteri sono soddisfatti:

**Documentazione**
- [ ] ADR-07 (struttura eventi e versioning) committed in `/docs/adr/`
- [ ] ADR-08 (strategia real-time) committed in `/docs/adr/`
- [ ] `docs/event-catalog.md` con tutti gli event types documentati
- [ ] `docs/projections.md` con design delle funzioni di proiezione
- [ ] Tutti gli spike documentati in `docs/spikes/`

**Infrastruttura**
- [ ] Tabella `task_events` ottimizzata con indici corretti
- [ ] Supabase Realtime abilitato sulla tabella `task_events` (verificato)
- [ ] Migration `0003_event_sourcing.sql` applicata su remote e locale

**Orchestratore**
- [ ] `EventService` implementato con metodi per tutti gli event types emessi dall'agente
- [ ] Ogni transizione di stato emette un evento strutturato
- [ ] Ogni fase ADWP emette `agent.phase.started` e `agent.phase.completed`
- [ ] `agent.pr.opened` e `agent.commit.pushed` emessi con dati corretti

**Gestionale**
- [ ] `AgentStatusBadge` mostra lo stato real-time nella dashboard
- [ ] Pagina `/tasks/[taskId]` con timeline SSR + aggiornamenti real-time
- [ ] Nuovi eventi appaiono in < 1 secondo dall'inserimento
- [ ] Gestione offline: indicatore visivo quando Realtime non è connesso

**Qualità**
- [ ] Zero errori TypeScript (`tsc --noEmit` pulito) in tutti i package
- [ ] I tipi di `EventPayloadMap` sono usati end-to-end: dall'orchestratore
  che emette al gestionale che consuma — nessun `any`
- [ ] Il seed aggiornato contiene eventi sufficienti per testare la Timeline UI
  (almeno 5 event types diversi per la task di test)

**Il test finale:**
Eseguire una task reale dall'orchestratore. Aprire in contemporanea:
la dashboard (per vedere `AgentStatusBadge`) e la task detail (per vedere
la timeline). Senza toccare la tastiera, osservare: lo stato agente
cambia sulla dashboard, gli eventi appaiono nella timeline, la PR appare
nella sezione artifact quando l'agente la apre. Tutto in tempo reale.
Tutto senza F5.

---

## Stima effort

| Epic | Scope | Effort stimato |
|---|---|---|
| EPIC-12 · ADR | 2 decisioni architetturali con spike | ~5h |
| EPIC-13 · Design catalogo | Catalogo eventi + proiezioni | ~4h |
| EPIC-14 · Schema Supabase | Migration + indici + proiezioni | ~4h |
| EPIC-15 · EventService | Emissione eventi dall'orchestratore | ~6h |
| EPIC-16 · Real-time gestionale | Subscription + AgentStatus + feed live | ~8h |
| EPIC-17 · Timeline UI | Componente + task detail + lista | ~7h |
| **Totale stimato** | | **~34h** |

Sprint più corto del secondo perché non include provisioning di nuova
infrastruttura (Redis, VPS, systemd sono già in piedi). La complessità
è nella cura dei dettagli: real-time che non perde eventi, UI che non
salta durante gli aggiornamenti, tipi che sono coerenti end-to-end.

---

## Rischi specifici di questo sprint

| Rischio | Probabilità | Mitigazione |
|---|---|---|
| Supabase Realtime su `task_events` non supporta filtro per `task_id` | Media | SPIKE-03.02.A verifica prima — se non supportato, si filtra client-side o si usa Broadcast |
| Parsing output Claude Code per estrarre commit SHA e PR URL è fragile | Alta | TASK-03.08.2 testa in isolamento con output reale campionato dal Sprint 2 |
| Idratazione SSR + Realtime produce eventi duplicati | Media | TASK-03.11.3 implementa deduplicazione esplicita per ID evento |
| Performance Timeline UI con 200+ eventi (un cliente attivo per mesi) | Bassa | Usare `ScrollArea` + virtualizzazione se necessario, ma non over-engineerare ora |
| `narrativize()` produce testi imbarazzanti per event types rari | Bassa | Avere un fallback generico (`event_type` capitalizzato) per tipi non coperti |

---

## Collegamento con gli altri sprint

**Dipende da Sprint 2:**
- Orchestratore con BullMQ funzionante — EventService ci costruisce sopra
- `task_events` già riceve eventi `task.state.changed` — Sprint 3 li arricchisce
- Schema `task_events` già deployato — Sprint 3 aggiunge solo indici e ottimizzazioni

**Prepara Sprint 4:**
- La pagina `/tasks/[taskId]` creata qui è la base della Task Detail completa
  che Sprint 4 arricchirà con PR card, metriche, form di azione
- `AgentStatusBadge` entra nella dashboard definitiva di Sprint 4
- Le funzioni di proiezione (`getTaskProjectedState`, `getTaskTimeline`)
  sono il data layer su cui Sprint 4 costruisce tutta la UI di business
- Il catalogo eventi definito qui è il contratto che Sprint 4 usa per
  mostrare tutte le informazioni della task senza query aggiuntive

---

*Robin.dev · Sprint 3 Backlog v1.0 · Carlo Ferrero · Febbraio 2026*
