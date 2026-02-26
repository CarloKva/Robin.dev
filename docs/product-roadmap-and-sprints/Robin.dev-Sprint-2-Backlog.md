# Robin.dev — Sprint 2 Backlog
## Orchestratore v2

**Versione 1.0 · Carlo Ferrero · Febbraio 2026**

---

## Obiettivo dello sprint

Riscrivere l'orchestratore da zero con architettura corretta.
Al termine di questo sprint esiste un processo Node.js sul VPS che:

- riceve un job dalla queue BullMQ quando una task viene creata nel gestionale
- lancia Claude Code in modalità headless sul repository del cliente
- aggiorna lo stato della task su Supabase ad ogni transizione
- si riavvia da solo se crasha
- non perde mai un job, nemmeno in caso di errore o timeout

**Cosa ottieni concretamente alla fine:**
Crei una task nel gestionale → entro 30 secondi l'orchestratore la prende in carico →
aggiorna lo stato su Supabase da `backlog` a `in_progress` → Claude Code lavora
sul repository → lo stato avanza fino a `in_review`. Tutto verificabile su Supabase,
tutto loggato su `journalctl`, nessun intervento manuale.

L'agente GitHub (`kva-agent`) non è ancora integrato in questo sprint —
l'orchestratore lavora su un repository di test con un agente mock.
L'integrazione reale con Claude Code arriva nella Fase B di questo sprint,
dopo che l'architettura della queue è stabile.

---

## Prerequisiti da Sprint 1

Prima di iniziare questo sprint, verificare che siano soddisfatti:

- [ ] Schema Supabase deployato con tabelle `tasks`, `agents`, `task_events`
- [ ] RLS policies attive e testate
- [ ] Monorepo configurato con package `apps/orchestrator`
- [ ] CI/CD attiva sul monorepo
- [ ] Variabili d'ambiente gestite via GitHub Secrets

Se uno di questi non è soddisfatto, Sprint 2 non inizia.

---

## Struttura del backlog

```
Sprint 2
├── FASE A — Analisi e Design
│   ├── EPIC-05 · Ricerca e decisioni architetturali
│   └── EPIC-06 · Design dell'interfaccia orchestratore → agente
└── FASE B — Implementazione
    ├── EPIC-07 · Infrastruttura Redis e BullMQ
    ├── EPIC-08 · Worker e job lifecycle
    ├── EPIC-09 · Interfaccia agente
    ├── EPIC-10 · Sincronizzazione stato su Supabase
    └── EPIC-11 · Deployment e stabilità VPS
```

---

## FASE A — Analisi e Design

---

### EPIC-05 · Ricerca e decisioni architetturali

**Descrizione**
Prima di scrivere una riga di codice dell'orchestratore, si chiudono
tutte le decisioni architetturali che impattano la struttura del sistema.
Quattro ADR da produrre, ciascuno con spike dedicato.

---

#### STORY-02.01 · ADR su Redis: managed vs self-hosted

```
Come architect del sistema,
voglio documentare e chiudere la decisione su dove far girare Redis,
per non scoprire problemi operativi dopo aver costruito tutto sopra.
```

**Criteri di accettazione**
- [ ] ADR-04 scritto e committed sotto `/docs/adr/`
- [ ] Le due opzioni (Upstash managed vs Redis self-hosted sul VPS) sono
  analizzate in profondità
- [ ] La decisione è chiusa con motivazione esplicita
- [ ] Le implicazioni operative (costo, latenza, failover) sono documentate

**SPIKE-02.01.A · Upstash vs Redis self-hosted**
*Time-box: 2h*

Domande da rispondere:
- Upstash: pricing reale per il volume di job atteso (stima: 500-1000 job/mese
  per cliente), latenza aggiuntiva da VPS Helsinki verso Upstash EU,
  come si gestisce il failover, supporta tutte le feature BullMQ necessarie
  (streams, keyspace notifications)?
- Redis self-hosted sul VPS: overhead operativo (backup, aggiornamenti,
  memoria consumata), rischio single point of failure (Redis e worker
  sullo stesso VPS), come si monitora?
- Esiste una terza opzione (Redis Cloud, Railway) che vale la pena considerare?
- Qual è la scelta più comune per sistemi BullMQ in produzione su VPS singola?

Output: `docs/spikes/spike-05-redis.md` con analisi comparativa e raccomandazione.

**TASK-02.01.1** — Leggere documentazione Upstash: pricing, limiti,
compatibilità BullMQ, latenza media verso EU.

**TASK-02.01.2** — Valutare Redis self-hosted: requisiti memoria per
BullMQ con 10 job concorrenti, configurazione persistence (AOF vs RDB),
monitoraggio via `redis-cli`.

**TASK-02.01.3** — Scrivere ADR-04 con decisione finale e committed.

---

#### STORY-02.02 · ADR su BullMQ: pattern e configurazione

```
Come architect del sistema,
voglio documentare le scelte di configurazione di BullMQ,
per avere un reference chiaro quando debug un job fallito alle 2 di notte.
```

**Criteri di accettazione**
- [ ] ADR-05 scritto e committed
- [ ] I pattern di retry sono definiti (tentativi, backoff, condizioni)
- [ ] La dead letter queue è definita (quando si attiva, cosa contiene, chi la monitora)
- [ ] La concurrency per worker è definita con motivazione
- [ ] Il visibility timeout è definito con motivazione
- [ ] I job priority levels sono definiti (quanti livelli, quale criterio)

**SPIKE-02.02.A · BullMQ in profondità**
*Time-box: 3h*

BullMQ ha molte opzioni. Questo spike serve a capirle prima di usarle,
non dopo che un bug in produzione ti ha costretto a leggerle.

Domande da rispondere:
- Qual è la differenza esatta tra `attempts`, `backoff` e `removeOnFail`?
  Cosa succede a un job dopo N tentativi falliti?
- Come funziona la dead letter queue in BullMQ? È una queue separata
  o una configurazione sulla queue principale?
- Concurrency: se un worker ha `concurrency: 3`, come gestisce 3 job Claude Code
  in parallelo sullo stesso VPS con 4GB RAM? Qual è il limite pratico?
- Job priority: come funziona, quando è utile, overhead?
- Come si monitora BullMQ in produzione? Esiste una UI (Bull Board)?
  Vale la pena installarla?
- Cosa succede se il VPS crasha mentre un job è `active`?
  Il job viene ripreso o perso?

Output: `docs/spikes/spike-06-bullmq.md` con pattern scelti e motivazioni.

**TASK-02.02.1** — Leggere documentazione BullMQ completa: queues, workers,
jobs, flows, events. Annotare tutto quello che non è ovvio.

**TASK-02.02.2** — Sperimentare localmente: creare una queue BullMQ minimale,
inserire job, osservare il comportamento in caso di errore e retry.

**TASK-02.02.3** — Scrivere ADR-05 con configurazione definitiva BullMQ.

---

#### STORY-02.03 · ADR su strategia di deployment orchestratore

```
Come operator del sistema,
voglio documentare come l'orchestratore viene deployato, aggiornato e monitorato,
per poter fare un aggiornamento senza downtime e diagnosticare problemi
senza accedere fisicamente al VPS.
```

**Criteri di accettazione**
- [ ] ADR-06 scritto e committed
- [ ] La strategia systemd è documentata (unit file, dipendenze, restart policy)
- [ ] La procedura di aggiornamento è definita (zero-downtime o con finestra?)
- [ ] La strategia di logging è definita (journalctl + eventuale aggregazione)
- [ ] La strategia di monitoring è definita (Betterstack o alternativa)

**TASK-02.03.1** — Ricercare pattern systemd per processi Node.js:
`Type=simple` vs `Type=forking`, `Restart=always` vs `Restart=on-failure`,
`RestartSec`, limiti di memoria.

**TASK-02.03.2** — Definire la procedura di aggiornamento:
git pull + npm install + systemctl restart? Blue-green? Documentare.

**TASK-02.03.3** — Scrivere ADR-06 con strategia completa.

---

### EPIC-06 · Design dell'interfaccia orchestratore → agente

**Descrizione**
L'interfaccia tra orchestratore e agente è il confine più importante del sistema.
Da un lato c'è Node.js con BullMQ. Dall'altro c'è Claude Code headless.
Questo confine deve essere esplicito, tipizzato, testabile.

---

#### STORY-02.04 · Design del contratto JobPayload

```
Come orchestratore,
voglio un contratto tipizzato per i dati che passano tra queue e agente,
per non avere sorprese di tipo runtime quando un job viene processato.
```

**Criteri di accettazione**
- [ ] Tipo `JobPayload` definito in `packages/shared-types`
- [ ] Tipo `JobResult` definito per l'output dell'agente
- [ ] Tipo `JobError` definito per gli errori strutturati
- [ ] I tipi sono documentati con JSDoc
- [ ] Il documento `docs/orchestrator-agent-interface.md` descrive
  il contratto completo con esempi

**TASK-02.04.1** — Definire `JobPayload`:
```typescript
type JobPayload = {
  taskId: string           // UUID della task su Supabase
  workspaceId: string      // workspace di appartenenza
  repositoryUrl: string    // URL del repo GitHub
  branch: string           // branch di lavoro
  claudeMdPath: string     // path del CLAUDE.md nel repo
  taskDescription: string  // descrizione completa della task
  taskType: TaskType       // bug | feature | docs | refactor | chore
  priority: Priority       // low | medium | high | critical
  timeoutMinutes: number   // timeout configurabile per tipo
}
```

**TASK-02.04.2** — Definire `JobResult` con: stato finale, PR URL se aperta,
commit SHA, tempo di esecuzione per fase ADWP, eventuali warning.

**TASK-02.04.3** — Definire `JobError` con: codice errore, messaggio,
fase ADWP in cui è avvenuto, se è retryable o no.

**TASK-02.04.4** — Scrivere `docs/orchestrator-agent-interface.md`
con il contratto completo, esempi di payload e diagramma del flusso.

---

#### STORY-02.05 · Design degli stati dell'agente

```
Come gestionale,
voglio che lo stato dell'agente sia modellato correttamente,
per poter mostrare all'utente cosa sta facendo l'agente in ogni momento.
```

**Criteri di accettazione**
- [ ] State machine degli stati agente documentata
- [ ] Enum `AgentStatus` definito in `shared-types`
- [ ] Le transizioni valide tra stati sono documentate
- [ ] È definito come lo stato viene scritto su Supabase
  (tabella `agent_status` o colonna su `agents`?)

**TASK-02.05.1** — Disegnare la state machine dell'agente:
```
idle → claiming → executing → reporting → idle
                ↓
              error → idle (dopo retry o manual reset)
              blocked → idle (dopo input umano)
```
Verificare che copra tutti i casi del POC + i nuovi.

**TASK-02.05.2** — Definire enum `AgentStatus` in `shared-types`.

**TASK-02.05.3** — Decidere se lo stato agente è una colonna su `agents`
o una tabella `agent_status` separata. Documentare la scelta.
(Considerare: la tabella separata permette history, la colonna è più semplice.)

---

## FASE B — Implementazione

---

### EPIC-07 · Infrastruttura Redis e BullMQ

**Descrizione**
Setup dell'infrastruttura di queue: Redis attivo e raggiungibile,
BullMQ configurato nel package `orchestrator`, queue e worker funzionanti
in locale prima di toccare il VPS.

---

#### STORY-02.06 · Setup Redis

```
Come orchestratore,
voglio Redis attivo e raggiungibile,
per poter usare BullMQ come queue di job.
```

**Criteri di accettazione**
- [ ] Redis attivo secondo la decisione presa in ADR-04
- [ ] Connessione Redis verificata dal package `orchestrator` in locale
- [ ] Connection string Redis in variabili d'ambiente (mai hardcoded)
- [ ] Redis raggiungibile anche dal VPS (se managed: test di latenza documentato)
- [ ] Procedura di verifica connessione documentata (`redis-cli ping`)

**TASK-02.06.1** — Setup Redis secondo ADR-04 (Upstash o self-hosted).
Se Upstash: creare database, copiare connection string in `.env`.
Se self-hosted: installare Redis sul VPS, configurare `bind` e `requirepass`.

**TASK-02.06.2** — Verificare connessione da locale e dal VPS:
```bash
redis-cli -u $REDIS_URL ping  # deve rispondere PONG
```

**TASK-02.06.3** — Aggiungere `REDIS_URL` alle variabili d'ambiente
in `.env.example`, `.env.local`, GitHub Secrets.

---

#### STORY-02.07 · Setup BullMQ nel package orchestrator

```
Come developer,
voglio BullMQ configurato nel package orchestrator con la struttura corretta,
per avere una base solida su cui costruire worker e producer.
```

**Criteri di accettazione**
- [ ] `bullmq` installato nel package `apps/orchestrator`
- [ ] Struttura di cartelle del package definita e documentata
- [ ] Classe `TaskQueue` implementata: wrappa BullMQ Queue con metodi tipizzati
- [ ] Classe `TaskWorker` implementata: wrappa BullMQ Worker con configurazione
  da ADR-05 (concurrency, retry, backoff)
- [ ] Configurazione BullMQ centralizzata in `config/bullmq.config.ts`
- [ ] La queue si connette a Redis senza errori in locale

**TASK-02.07.1** — Definire struttura package `apps/orchestrator`:
```
apps/orchestrator/
├── src/
│   ├── queues/
│   │   └── task.queue.ts      ← BullMQ Queue wrapper
│   ├── workers/
│   │   └── task.worker.ts     ← BullMQ Worker wrapper
│   ├── agent/
│   │   └── claude.runner.ts   ← interfaccia verso Claude Code (Sprint B)
│   ├── db/
│   │   └── supabase.client.ts ← client Supabase con service role
│   ├── config/
│   │   └── bullmq.config.ts   ← configurazione centralizzata
│   └── index.ts               ← entrypoint
├── package.json
└── tsconfig.json
```

**TASK-02.07.2** — Implementare `task.queue.ts`:
classe `TaskQueue` con metodi `addJob(payload: JobPayload)`,
`getJob(jobId: string)`, `getJobCounts()`.

**TASK-02.07.3** — Implementare `task.worker.ts`:
classe `TaskWorker` con concurrency e retry da ADR-05.
Il processor per ora è un placeholder (`async (job) => { console.log(job.data) }`).

**TASK-02.07.4** — Implementare `bullmq.config.ts` con tutte le opzioni
di configurazione: retry attempts, backoff strategy, removeOnComplete,
removeOnFail, concurrency.

**TASK-02.07.5** — Verificare che `npm run dev` nel package orchestrator
avvii worker e queue senza errori, con connessione Redis attiva.

---

#### STORY-02.08 · Producer: da Supabase a BullMQ

```
Come sistema,
voglio che ogni task creata nel gestionale venga automaticamente
inserita nella queue BullMQ,
per disaccoppiare la creazione della task dall'esecuzione.
```

**Criteri di accettazione**
- [ ] Quando una task viene creata su Supabase con stato `backlog`,
  un job viene inserito in BullMQ entro 5 secondi
- [ ] Il `JobPayload` del job contiene tutti i dati necessari all'agente
- [ ] Il `job.id` è correlato al `task.id` di Supabase per tracciabilità
- [ ] Se l'inserimento in queue fallisce, l'errore viene loggato
  e la task rimane in `backlog` (non va in stato inconsistente)

**SPIKE-02.08.A · Strategia di trigger: webhook Supabase vs polling**
*Time-box: 2h*

Il POC usava polling ogni 15 secondi. Questo sprint decide se continuare
con polling (migliorato) o passare a webhook Supabase.

Domande da rispondere:
- Supabase supporta webhook su INSERT/UPDATE? Come si configura?
  Il VPS può ricevere webhook dall'esterno (serve porta aperta)?
- Polling con backoff adattivo: partire da 5s, aumentare se non ci sono task,
  tornare a 5s quando arriva una task. È abbastanza buono?
- Supabase Realtime: si può usare lato orchestratore (Node.js) per ricevere
  notifiche su nuove task? È più affidabile dei webhook?
- Quale strategia è più semplice da operare in produzione su un VPS
  senza porte pubbliche aperte?

Output: `docs/spikes/spike-07-trigger-strategy.md` con decisione.

**TASK-02.08.1** — Implementare `TaskPoller` (o `TaskListener` se webhook):
logica che rileva nuove task con stato `backlog` e le inserisce in BullMQ.

**TASK-02.08.2** — Implementare correlazione `task.id` → `job.id`:
salvare il BullMQ job ID sulla task in Supabase per tracciabilità.

**TASK-02.08.3** — Gestire il caso di task già in queue (idempotenza):
se una task è già `in_progress`, non inserirla di nuovo in queue.

**TASK-02.08.4** — Testare il flusso: creare task su Supabase →
verificare che il job appaia in BullMQ (via log o Bull Board).

---

### EPIC-08 · Worker e job lifecycle

**Descrizione**
Il worker processa i job dalla queue. Questo epic implementa
la logica di lifecycle completa: dal job ricevuto al job completato
o fallito, con tutti gli stati intermedi.

---

#### STORY-02.09 · Processor base del worker

```
Come worker,
voglio un processor che gestisce il ciclo di vita completo di un job,
per poter costruire sopra la logica dell'agente in modo ordinato.
```

**Criteri di accettazione**
- [ ] Il processor riceve un `Job<JobPayload>` e lo processa
- [ ] Ogni fase del processing logga su `console` con formato strutturato
  (JSON con timestamp, jobId, fase, messaggio)
- [ ] Il processor aggiorna lo stato della task su Supabase
  ad ogni transizione di stato
- [ ] Se il processor lancia un'eccezione, BullMQ gestisce il retry
  secondo la configurazione in ADR-05
- [ ] Il processor ha un timeout globale configurabile (da `JobPayload.timeoutMinutes`)

**TASK-02.09.1** — Implementare il processor in `task.worker.ts`:
sostituire il placeholder con la logica reale di orchestrazione.
Struttura del processor:
```typescript
async function processJob(job: Job<JobPayload>): Promise<JobResult> {
  await updateTaskStatus(job.data.taskId, 'in_progress')
  await runAgentPhase(job, 'INTAKE')
  await runAgentPhase(job, 'ANALYSIS')
  await runAgentPhase(job, 'PLANNING')
  await runAgentPhase(job, 'IMPLEMENTATION')
  await runAgentPhase(job, 'TESTING')
  await runAgentPhase(job, 'DOCUMENTATION')
  await runAgentPhase(job, 'REVIEW')
  await updateTaskStatus(job.data.taskId, 'in_review')
  return buildJobResult(job)
}
```
Per ora ogni `runAgentPhase` è un mock che aspetta N secondi.
L'integrazione reale con Claude Code è in EPIC-09.

**TASK-02.09.2** — Implementare logging strutturato:
ogni log è un oggetto JSON con `{ timestamp, jobId, taskId, phase, level, message }`.

**TASK-02.09.3** — Implementare timeout globale sul processor:
se il job supera `timeoutMinutes`, lanciare `JobTimeoutError` (retryable: false).

**TASK-02.09.4** — Testare il processor con job mock:
inserire 3 job in queue, osservare che vengono processati in parallelo
fino al limite di concurrency, verificare che lo stato su Supabase
venga aggiornato correttamente.

---

#### STORY-02.10 · Gestione errori e dead letter queue

```
Come sistema,
voglio che i job falliti siano gestiti in modo deterministico,
per non perdere mai una task e poter diagnosticare ogni fallimento.
```

**Criteri di accettazione**
- [ ] Job fallito dopo N tentativi → finisce nella dead letter queue
- [ ] La task su Supabase passa a stato `failed` con messaggio di errore
- [ ] Ogni tentativo fallito logga: tentativo numero, errore, prossimo retry tra X secondi
- [ ] Errori retryable vs non-retryable sono distinti:
  timeout API Anthropic → retryable; task spec incompleta → non-retryable
- [ ] Esiste un meccanismo per re-accodare manualmente un job dalla DLQ
- [ ] La DLQ è monitorata: alert se contiene più di N job

**TASK-02.10.1** — Definire la gerarchia di errori:
```typescript
class JobError extends Error { retryable: boolean }
class AgentTimeoutError extends JobError { retryable = true }
class AgentBlockedError extends JobError { retryable = false }
class InsufficientSpecError extends JobError { retryable = false }
class APIRateLimitError extends JobError { retryable = true }
```

**TASK-02.10.2** — Configurare la dead letter queue in BullMQ:
`failedJobsHistory`, `removeOnFail: { count: 100 }` per non perdere history.

**TASK-02.10.3** — Implementare `onFailed` handler sul worker:
aggiorna task su Supabase a stato `failed`, logga dettaglio errore,
notifica via Slack se è errore critico.

**TASK-02.10.4** — Implementare `requeue(jobId)`: funzione che sposta
un job dalla DLQ alla queue principale per retry manuale.

**TASK-02.10.5** — Testare i percorsi di errore: job che fallisce sempre,
job che fallisce 2 volte e poi riesce, job non-retryable.

---

#### STORY-02.11 · Notifiche operative

```
Come developer/operator,
voglio ricevere una notifica quando eventi critici accadono nell'orchestratore,
per non dover monitorare i log manualmente.
```

**Criteri di accettazione**
- [ ] Notifica Slack quando una task entra in stato `in_review` (PR pronta)
- [ ] Notifica Slack quando una task entra in stato `blocked` (agente bloccato)
- [ ] Notifica Slack quando una task entra in stato `failed` (errore non recuperabile)
- [ ] Notifica email via Resend per eventi critici (failed, blocked)
- [ ] Le notifiche contengono: nome task, workspace, link diretto alla task nel gestionale
- [ ] Le notifiche non spammano: massimo 1 notifica per evento per task

**TASK-02.11.1** — Configurare Slack webhook: creare app Slack,
configurare Incoming Webhook, salvare URL in variabili d'ambiente.

**TASK-02.11.2** — Implementare `NotificationService`:
```typescript
class NotificationService {
  async notifyTaskReady(task: Task): Promise<void>
  async notifyTaskBlocked(task: Task, reason: string): Promise<void>
  async notifyTaskFailed(task: Task, error: JobError): Promise<void>
}
```

**TASK-02.11.3** — Configurare Resend: account, API key, dominio mittente.
Implementare template email per `task_failed` e `task_blocked`.

**TASK-02.11.4** — Integrare `NotificationService` nei punti giusti
del processor e dell'`onFailed` handler.

**TASK-02.11.5** — Testare le notifiche: far fallire un job intenzionalmente
e verificare che la notifica Slack e email arrivino correttamente.

---

### EPIC-09 · Interfaccia agente

**Descrizione**
Il modulo che incapsula Claude Code headless. È il confine netto
tra l'orchestratore (che non sa nulla di Claude Code) e l'agente
(che non sa nulla di BullMQ). Questo modulo è il cuore del sistema.

---

#### STORY-02.12 · Setup VPS e ambiente agente

```
Come operator,
voglio un VPS configurato con tutto il necessario per eseguire Claude Code,
per poter sviluppare e testare l'integrazione in condizioni reali.
```

**Criteri di accettazione**
- [ ] VPS Hetzner CX23 provisionato (nuovo, non il VPS del POC)
- [ ] Utente `agent` non-root creato con permessi corretti
- [ ] Node.js v24 LTS installato e verificato
- [ ] Claude Code installato e autenticato con API key Anthropic
- [ ] GitHub CLI installato e autenticato con account `kva-agent`
- [ ] Repository di test clonato e accessibile dall'utente `agent`
- [ ] Variabili d'ambiente configurate in `/home/agent/.env`
- [ ] Il package `apps/orchestrator` deployato sul VPS e avviabile

**TASK-02.12.1** — Provisionare nuovo VPS Hetzner CX23:
Ubuntu 24.04 LTS, Helsinki, SSH key only (no password auth).

**TASK-02.12.2** — Setup utente `agent`:
```bash
useradd -m -s /bin/bash agent
usermod -aG sudo agent  # solo per setup iniziale, rimuovere dopo
```

**TASK-02.12.3** — Installare Node.js v24 via nvm, Claude Code,
GitHub CLI. Verificare versioni:
```bash
node --version   # v24.x.x
claude --version # 2.x.x
gh --version     # 2.x.x
```

**TASK-02.12.4** — Autenticare Claude Code con API key Anthropic:
configurare `ANTHROPIC_API_KEY` in `/home/agent/.env`.

**TASK-02.12.5** — Autenticare GitHub CLI con token `kva-agent`:
```bash
gh auth login --with-token <<< $GITHUB_TOKEN
gh auth status  # deve mostrare kva-agent
```

**TASK-02.12.6** — Creare repository di test su GitHub
(`kva-agent-test-repo`) con `CLAUDE.md` base e qualche file di codice.
Clonarlo sul VPS sotto `/home/agent/repos/test`.

**TASK-02.12.7** — Deployare package `apps/orchestrator` sul VPS:
git clone del monorepo, `npm install`, verifica che si avvii.

---

#### STORY-02.13 · ClaudeRunner — modulo di esecuzione agente

```
Come orchestratore,
voglio un modulo ClaudeRunner che incapsula l'esecuzione di Claude Code,
per poter lanciare l'agente senza conoscere i dettagli di come funziona.
```

**Criteri di accettazione**
- [ ] `ClaudeRunner` è un modulo TypeScript con interfaccia pulita
- [ ] Il modulo riceve un `JobPayload` e restituisce un `JobResult`
- [ ] Il modulo non sa nulla di BullMQ — è completamente disaccoppiato
- [ ] Il timeout è gestito internamente al modulo
- [ ] L'output di Claude Code (stdout/stderr) è catturato e strutturato
- [ ] Gli errori di Claude Code sono tradotti in `JobError` tipizzati
- [ ] Il modulo è testabile in isolamento con un repository di test

**TASK-02.13.1** — Implementare `claude.runner.ts`:
```typescript
class ClaudeRunner {
  async run(payload: JobPayload): Promise<JobResult> {
    // 1. Preparare TASK.md nel repository
    // 2. Lanciare claude code headless con child_process.spawn
    // 3. Catturare stdout/stderr in streaming
    // 4. Attendere completamento o timeout
    // 5. Parsare output e costruire JobResult
  }
}
```

**TASK-02.13.2** — Implementare la preparazione di `TASK.md`:
file che Claude Code legge per capire cosa fare. Generato dal `JobPayload`.
Struttura:
```markdown
# Task: [titolo]
## Tipo: [bug|feature|docs|refactor]
## Priorità: [low|medium|high|critical]
## Descrizione
[descrizione completa]
## Criteri di accettazione
[derivati dalla descrizione]
```

**TASK-02.13.3** — Implementare il lancio di Claude Code via `child_process.spawn`:
```typescript
const claudeProcess = spawn('claude', [
  '--dangerously-skip-permissions',
  '--output-format', 'json'
], {
  cwd: payload.repositoryPath,
  env: { ...process.env, ANTHROPIC_API_KEY: config.anthropicApiKey },
  timeout: payload.timeoutMinutes * 60 * 1000
})
```

**TASK-02.13.4** — Implementare cattura streaming di stdout/stderr:
ogni chunk loggato in tempo reale, output finale parsato per estrarre
risultato strutturato.

**TASK-02.13.5** — Implementare parsing dell'output Claude Code:
rilevare se ha aperto una PR (estrarre URL), quali file ha modificato,
se si è bloccato con una domanda.

**TASK-02.13.6** — Testare `ClaudeRunner` in isolamento sul VPS:
dargli un task semplice ("aggiungi un commento a questo file"),
verificare che completi e restituisca un `JobResult` corretto.

---

#### STORY-02.14 · Integrazione ClaudeRunner nel worker

```
Come worker,
voglio che il processor usi ClaudeRunner per eseguire il lavoro reale,
per avere il flusso completo task → queue → agente → PR funzionante.
```

**Criteri di accettazione**
- [ ] Il processor del worker usa `ClaudeRunner.run()` al posto del mock
- [ ] Il flusso completo funziona: task su Supabase → job in BullMQ →
  Claude Code esegue → PR aperta su GitHub → stato task aggiornato a `in_review`
- [ ] Il tempo totale del flusso è < 5 minuti per un task semplice
- [ ] L'output di Claude Code è loggato in modo leggibile su `journalctl`
- [ ] In caso di errore di Claude Code, il job viene marcato correttamente
  e la notifica viene inviata

**TASK-02.14.1** — Sostituire il mock nel processor con `ClaudeRunner.run()`.

**TASK-02.14.2** — Testare il flusso end-to-end con task reale:
creare task su Supabase → osservare il job in BullMQ → osservare Claude Code
che lavora sul VPS → verificare PR aperta su GitHub → verificare stato
`in_review` su Supabase.

**TASK-02.14.3** — Verificare che l'agente blocchi correttamente su task
ambigue: creare task con descrizione volutamente incompleta,
verificare che il job entri in stato `blocked` e la notifica arrivi.

---

### EPIC-10 · Sincronizzazione stato su Supabase

**Descrizione**
Ogni transizione di stato della task — sia che venga dall'orchestratore,
sia che venga dall'agente — deve essere scritta su Supabase in modo
atomico e consistente. Questo epic implementa il layer di persistenza
dell'orchestratore.

---

#### STORY-02.15 · Supabase client lato orchestratore

```
Come orchestratore,
voglio un client Supabase configurato con service role key,
per poter scrivere su Supabase bypassando RLS in modo controllato.
```

**Criteri di accettazione**
- [ ] Client Supabase inizializzato con `SUPABASE_SERVICE_ROLE_KEY` (non anon key)
- [ ] Il client è un singleton — non si crea una nuova connessione per ogni job
- [ ] Le query sono tipizzate con i tipi generati da Prisma o da Supabase CLI
- [ ] Gli errori di connessione sono gestiti con retry automatico
- [ ] La service role key è in variabile d'ambiente, mai nel codice

**TASK-02.15.1** — Implementare `supabase.client.ts` nel package orchestrator:
```typescript
import { createClient } from '@supabase/supabase-js'
export const supabase = createClient(
  process.env.SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
)
```

**TASK-02.15.2** — Implementare `TaskRepository`:
classe con metodi tipizzati per tutte le operazioni sulla tabella `tasks`:
`updateStatus()`, `addArtifact()`, `getById()`.

**TASK-02.15.3** — Implementare `AgentRepository`:
metodi per aggiornare lo stato dell'agente: `setStatus()`, `getByWorkspace()`.

**TASK-02.15.4** — Verificare che le operazioni del repository bypassino
correttamente RLS (service role) e che non sia possibile abusare di questo
accesso privilegiato da codice esterno.

---

#### STORY-02.16 · Aggiornamenti di stato atomici

```
Come sistema,
voglio che gli aggiornamenti di stato su Supabase siano atomici,
per non avere mai una task in uno stato inconsistente.
```

**Criteri di accettazione**
- [ ] `updateTaskStatus(taskId, newStatus, metadata?)` è l'unico punto
  in cui lo stato di una task cambia — nessun altro codice aggiorna
  direttamente la colonna `status`
- [ ] La funzione verifica che la transizione sia valida prima di scriverla
  (non si può passare da `done` a `in_progress`)
- [ ] La transizione di stato e l'inserimento in `task_events` avvengono
  nella stessa transaction (o con compensazione se la transaction fallisce)
- [ ] Se l'aggiornamento fallisce, il job non prosegue — lancia errore

**TASK-02.16.1** — Implementare `updateTaskStatus()` con validazione
della state machine:
```typescript
const VALID_TRANSITIONS: Record<TaskStatus, TaskStatus[]> = {
  backlog:         ['in_progress', 'cancelled'],
  in_progress:     ['blocked', 'in_review', 'failed'],
  blocked:         ['in_progress', 'cancelled'],
  in_review:       ['in_progress', 'done'],
  done:            [],
  failed:          ['backlog'],
  cancelled:       [],
}
```

**TASK-02.16.2** — Implementare inserimento `task_events` contestuale:
ogni `updateTaskStatus()` inserisce anche un evento in `task_events`
con tipo `task.state.changed` e payload con stato precedente e nuovo.

**TASK-02.16.3** — Testare le transizioni invalide: verificare che
tentare di passare `done → in_progress` lanci un errore chiaro.

---

### EPIC-11 · Deployment e stabilità VPS

**Descrizione**
L'orchestratore deve girare da solo sul VPS, senza intervento manuale.
Questo epic configura systemd, il monitoring, e la procedura
di aggiornamento.

---

#### STORY-02.17 · systemd service

```
Come operator,
voglio che l'orchestratore si avvii automaticamente al boot del VPS
e si riavvii in caso di crash,
per non dovermi connettere al VPS ogni volta che qualcosa va storto.
```

**Criteri di accettazione**
- [ ] Unit file systemd creato e enabled per avvio al boot
- [ ] Il servizio si riavvia automaticamente entro 5 secondi dal crash
- [ ] I log sono visibili via `journalctl -u robindev-orchestrator -f`
- [ ] Le variabili d'ambiente sono caricate dal file `/home/agent/.env`
- [ ] Il servizio gira come utente `agent` (non root)
- [ ] `systemctl status robindev-orchestrator` mostra `active (running)`

**TASK-02.17.1** — Scrivere unit file systemd:
```ini
[Unit]
Description=Robin.dev Orchestrator
After=network.target

[Service]
Type=simple
User=agent
WorkingDirectory=/home/agent/robindev/apps/orchestrator
EnvironmentFile=/home/agent/.env
ExecStart=/usr/bin/node dist/index.js
Restart=always
RestartSec=5
StandardOutput=journal
StandardError=journal
SyslogIdentifier=robindev-orchestrator

[Install]
WantedBy=multi-user.target
```

**TASK-02.17.2** — Installare e abilitare il servizio:
```bash
cp robindev-orchestrator.service /etc/systemd/system/
systemctl daemon-reload
systemctl enable robindev-orchestrator
systemctl start robindev-orchestrator
```

**TASK-02.17.3** — Testare il restart automatico:
```bash
kill -9 $(pgrep -f "node dist/index.js")
sleep 6
systemctl status robindev-orchestrator  # deve essere running
```

**TASK-02.17.4** — Verificare che i log siano leggibili:
```bash
journalctl -u robindev-orchestrator -f --output=json
```

---

#### STORY-02.18 · Monitoring e alerting

```
Come operator,
voglio sapere se l'orchestratore smette di funzionare
senza dover guardare i log attivamente,
per poter intervenire prima che i clienti se ne accorgano.
```

**Criteri di accettazione**
- [ ] Betterstack (o alternativa) configurato con uptime monitor sull'orchestratore
- [ ] Alert entro 5 minuti se l'orchestratore non risponde
- [ ] Metrica "job in DLQ" monitorata: alert se > 3 job falliti in 1 ora
- [ ] Dashboard Betterstack mostra: uptime, ultimi eventi, alert history
- [ ] Il numero di job processati nelle ultime 24h è visibile

**TASK-02.18.1** — Creare account Betterstack, configurare monitor HTTPS
sull'health endpoint dell'orchestratore.

**TASK-02.18.2** — Implementare health endpoint nell'orchestratore:
```typescript
// GET /health
{
  status: 'ok',
  uptime: process.uptime(),
  queueCounts: await taskQueue.getJobCounts(),
  redisConnected: true
}
```
Esposto su porta locale, accessibile via SSH tunnel o proxy leggero.

**TASK-02.18.3** — Configurare alert Betterstack: email + Slack
se health check fallisce per 2 minuti consecutivi.

**TASK-02.18.4** — Configurare alert DLQ: script che controlla
il numero di job falliti ogni ora e notifica se sopra soglia.

---

#### STORY-02.19 · Procedura di aggiornamento documentata

```
Come operator,
voglio una procedura documentata per aggiornare l'orchestratore,
per poter fare un deploy senza improvisare i comandi sotto pressione.
```

**Criteri di accettazione**
- [ ] Documento `docs/runbook/update-orchestrator.md` scritto
- [ ] La procedura è testata almeno una volta end-to-end
- [ ] Il rollback è documentato (cosa fare se la nuova versione ha un bug)
- [ ] Il tempo di downtime atteso è documentato (target: < 30 secondi)

**TASK-02.19.1** — Scrivere la procedura di aggiornamento:
```markdown
1. ssh agent@vps-ip
2. cd ~/robindev && git pull origin main
3. npm install --workspace=apps/orchestrator
4. npm run build --workspace=apps/orchestrator
5. systemctl restart robindev-orchestrator
6. journalctl -u robindev-orchestrator -f  # osservare per 60 secondi
7. curl localhost:3001/health  # verificare risposta ok
```

**TASK-02.19.2** — Testare la procedura: fare un aggiornamento reale
e verificare che funzioni esattamente come documentato.

**TASK-02.19.3** — Documentare il rollback:
```markdown
Se qualcosa va storto:
1. git log --oneline -5  # identificare il commit precedente
2. git checkout <previous-commit>
3. npm run build --workspace=apps/orchestrator
4. systemctl restart robindev-orchestrator
```

---

## Definition of Done — Sprint 2

Lo sprint è completato quando **tutti** i seguenti criteri sono soddisfatti:

**Documentazione**
- [ ] ADR-04 (Redis), ADR-05 (BullMQ config), ADR-06 (deployment) committed
- [ ] `docs/orchestrator-agent-interface.md` con contratto completo
- [ ] `docs/runbook/update-orchestrator.md` testato
- [ ] Tutti gli spike documentati in `docs/spikes/`

**Infrastruttura**
- [ ] Redis attivo e raggiungibile da orchestratore e VPS
- [ ] VPS configurato con Node.js, Claude Code, GitHub CLI
- [ ] systemd service attivo e testato (crash + restart automatico)
- [ ] Monitoring Betterstack attivo con alert configurati

**Applicazione**
- [ ] Flusso completo funzionante: task creata su Supabase →
  job in BullMQ → Claude Code esegue → PR aperta su GitHub →
  stato `in_review` su Supabase
- [ ] Notifiche Slack operative per `in_review`, `blocked`, `failed`
- [ ] Dead letter queue configurata e testata
- [ ] Aggiornamenti di stato atomici con validazione state machine

**Qualità**
- [ ] Zero errori TypeScript nel package orchestrator
- [ ] Flusso testato con 3 task in parallelo senza errori
- [ ] Test di crash: orchestratore killato e ripartito senza perdere job attivi

**Il test finale:**
Creare una task reale nel gestionale (descrizione: "aggiungi un file README
al repository di test con una breve descrizione del progetto") →
osservare su Supabase le transizioni di stato in tempo reale →
ricevere notifica Slack quando la PR è pronta →
aprire la PR su GitHub e trovare il lavoro fatto da `kva-agent`.
Tutto senza toccare il VPS, senza aprire un terminale.

---

## Stima effort

| Epic | Scope | Effort stimato |
|---|---|---|
| EPIC-05 · ADR | 3 decisioni architetturali con spike | ~7h |
| EPIC-06 · Design interfaccia | Tipi e state machine | ~4h |
| EPIC-07 · Redis + BullMQ setup | Infrastruttura queue | ~5h |
| EPIC-08 · Worker lifecycle | Processor, errori, notifiche | ~8h |
| EPIC-09 · ClaudeRunner | Modulo agente + VPS setup | ~10h |
| EPIC-10 · Sync Supabase | Repository pattern + atomic updates | ~5h |
| EPIC-11 · Deployment VPS | systemd, monitoring, runbook | ~5h |
| **Totale stimato** | | **~44h** |

Sprint più lungo del primo perché include lavoro su due ambienti
(locale per lo sviluppo, VPS per il testing reale) e l'integrazione
con Claude Code introduce variabili non completamente controllabili.

---

## Rischi specifici di questo sprint

| Rischio | Probabilità | Mitigazione |
|---|---|---|
| Claude Code headless si comporta diversamente dal POC | Media | TASK-02.13.6 testa in isolamento prima dell'integrazione |
| Latenza Redis managed introduce problemi su VPS Helsinki | Bassa | SPIKE-02.01.A misura la latenza prima della decisione |
| Parsing output Claude Code fragile | Alta | Output strutturato (JSON mode) riduce la fragilità |
| Job persi durante restart orchestratore | Bassa | BullMQ con Redis persistence garantisce durabilità |
| Costo API Anthropic su task di test | Media | Usare task semplici per i test, non task complesse |

---

## Collegamento con gli altri sprint

**Dipende da Sprint 1:**
Schema Supabase con tabelle `tasks`, `agents`, `task_events` già deployato.

**Prepara Sprint 3:**
La tabella `task_events` inizia a ricevere dati reali dall'orchestratore
(evento `task.state.changed` ad ogni transizione). Sprint 3 costruirà
il layer di event sourcing completo e il real-time sopra questi dati.

**Prepara Sprint 5:**
Il modello di deployment su VPS definito in questo sprint è il template
che verrà replicato per ogni cliente nel Sprint 5.

---

*Robin.dev · Sprint 2 Backlog v1.0 · Carlo Ferrero · Febbraio 2026*
