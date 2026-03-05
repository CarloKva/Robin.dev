# Stato funzionale as-is — Robin.dev — 2026-03-05

---

## Ciclo di delivery attuale

Il ciclo funziona end-to-end con un'interruzione critica al passaggio "PR mergeata → task done" (BUG-ORC-01). I passi verificati nel codice:

1. **Founder crea una task dal form** `/tasks/new` o dal drawer backlog.
   - `POST /api/tasks` riceve il payload, validato via Zod. Status iniziale: `backlog` se nessuno sprint assegnato, `sprint_ready` se `sprint_id` presente.
   - `task_events` riceve `task.created` + `task.state.changed` (human).
   - Nessun job BullMQ emesso in questo step. La task non parte finché il sprint non viene avviato esplicitamente.
   - File: `apps/web/app/api/tasks/route.ts`

2. **Founder organizza il backlog** nella vista `/backlog`.
   - Trascina task in sprint (status → `sprint_ready`), riordina per `sprint_order`, può creare nuovi sprint.
   - File: `apps/web/app/(dashboard)/backlog/page.tsx`, `components/backlog/BacklogJiraView.tsx`

3. **Founder avvia lo sprint** con "Avvia sprint" nel `SprintSection`.
   - `POST /api/sprints/{sprintId}/start` verifica precondizioni: tutte le task devono avere `status=sprint_ready` + `repository_id`, e almeno un agente online.
   - Sprint → `active`, tutte le task → `queued`, `task.state.changed` emesso per ognuna.
   - BullMQ: un job `RepoQueueJobPayload` per task per repository nella queue `repo-queue-{repositoryId}`.
   - BullMQ: un job `SprintControlJobPayload` nella queue `sprint-control` (attiva i worker per-repo sul control-plane in <1s).
   - File: `apps/web/app/api/sprints/[sprintId]/start/route.ts`

4. **SprintControlWorker attiva i worker per-repo** (control-plane).
   - Chiama `createRepoQueueWorker(repositoryId)` per ogni repo coinvolta.
   - Fallback: `RepoWatchdogService` ogni 60s ri-crea i worker se mancano (idempotente).
   - File: `apps/orchestrator/src/workers/sprint-control.worker.ts`

5. **RepoQueueWorker esegue il routing** (control-plane, concurrency=1 per repository).
   - Carica la task dal DB, verifica status `queued` o `sprint_ready`.
   - Seleziona l'agente: 1) `preferred_agent_id` se online, 2) load balancing (meno task 24h), 3) tiebreaker `provisioned_at` più recente.
   - Se nessun agente disponibile: delay 5 min, notifica Slack dopo 30 min.
   - Aggiorna `tasks.assigned_agent_id`, enqueue `JobPayload` in queue `tasks`.
   - File: `apps/orchestrator/src/workers/repo-queue.worker.ts`

6. **TaskWorker esegue la task** (agent VPS, concurrency=2).
   - Task → `in_progress`, `agent_status` → `busy`.
   - Emette `agent.phase.started` (fase "analysis" al pre-esecuzione, "write" all'avvio Claude).
   - Scrive `TASK.md` nella root del repository (auto-clone se repo non presente).
   - Spawna `claude --print --dangerously-skip-permissions "Read the instructions in TASK.md..."`.
   - File: `apps/orchestrator/src/workers/task.worker.ts`, `apps/orchestrator/src/agent/claude.runner.ts`

7. **ClaudeRunner esegue Claude Code** in streaming.
   - Monitora stdout: rileva SHA commit (regex `[0-9a-f]{40}`) → emette `agent.commit.pushed`.
   - Al termine: controlla `BLOCKED.md` → `AgentBlockedError`; altrimenti parsa l'output per `pr_url`.
   - Prima prova a parsare l'ultima riga come JSON `{"pr_url":"...","branch":"..."}`, fallback a regex URL GitHub PR.
   - Emette `agent.phase.started/completed` (write + proof).
   - File: `apps/orchestrator/src/agent/claude.runner.ts`

8. **TaskWorker processa il risultato** (agent VPS).
   - Se `result.status === "in_review"` (PR trovata): salva artifact `pr` in `task_artifacts`, emette `agent.pr.opened`, task → **`review_pending`** (NON `in_review`).
   - Se `result.status === "completed"` (no PR): salva artifact `commit`, task → `completed`, emette `task.completed`.
   - Notifica Slack: `notifyTaskReady()` con link alla PR.
   - Agente → `idle`.
   - File: `apps/orchestrator/src/workers/task.worker.ts:60-98`

9. **GitHub webhook riceve evento PR** (`pull_request:closed`).
   - `POST /api/webhooks/github` verifica firma HMAC-SHA256, filtra eventi (`pull_request:closed`, `pull_request_review_comment`, `issue_comment`), risolve workspace da `repositories.full_name`.
   - Enqueue `GitHubEventJobPayload` in queue `github-events` con dedup via `deliveryId`.
   - File: `apps/web/app/api/webhooks/github/route.ts`

10. **GitHubEventsWorker tenta la transizione finale** (control-plane).
    - Se PR mergeata: chiama `taskRepository.updateStatus(taskId, "done")`.
    - **BUG-ORC-01**: il task è in stato `review_pending` (impostato dal TaskWorker). La state machine (`VALID_TRANSITIONS`) non ammette `review_pending → done`. Il `try/catch` intercetta l'errore, logga "invalid transition to done — skipping" e **ritorna senza aggiornare il task**. Il task rimane `review_pending` indefinitamente.
    - File: `apps/orchestrator/src/workers/github-events.worker.ts:166-188`
    - File correlato: `apps/orchestrator/src/repositories/task.repository.ts:6-21` (VALID_TRANSITIONS)

**Risultato**: il ciclo end-to-end non si chiude automaticamente. Nessuna PR viene mai marcata `done` tramite webhook senza intervento manuale.

---

## Feature completate e funzionanti

### Gestione agenti

**Provisioning automatico VPS (Hetzner cloud-init)**
Dalla pagina `/agents`, il founder crea un agente. `POST /api/agents` enqueue un job `AgentProvisioningJobPayload`. Il worker sul control-plane crea la VPS Hetzner con cloud-init, attende che raggiunga `running`, poi polling `agents.last_seen_at` ogni 10s finché l'orchestratore sull'agent VPS invia heartbeat (entro 5–12 min). Aggiorna `provisioning_status = 'online'`.
Route/componente: `apps/web/app/api/agents/route.ts`, `apps/orchestrator/src/workers/agent.provisioning.worker.ts`.
Stato: ✅ funzionante. Limitazione: credenziali in chiaro nel campo `user_data` Hetzner (documentato, fix pianificato Sprint D).

**Deprovisioning**
`DELETE /api/agents/[agentId]` → `deprovisioning` → BullMQ → cancella VPS Hetzner (gestisce 404 se già eliminata) → `deprovisioned`.
Stato: ✅ funzionante.

**Heartbeat e status real-time**
`HeartbeatService` aggiorna `agents.last_seen_at` ogni 30s. Vista `agents_with_status` deriva `effective_status` da `last_seen_at` (offline se > 2 min). Pagina `/agents` usa Supabase Realtime per aggiornamenti live.
Stato: ✅ funzionante.

**Retry provisioning**
`POST /api/agents/[agentId]/retry-provisioning` esiste.
Stato: ✅ route esiste — funzionamento interno non verificato in questo audit.

### Backlog management

**Vista backlog unificata (Jira-like)**
Pagina `/backlog` mostra sprint attivi/planning in sezioni collapsibili, backlog non-sprint in fondo. Ricerca, filtro per tipo, bulk actions, drag-and-drop `sprint_order`.
Route/componente: `apps/web/app/(dashboard)/backlog/page.tsx`, `components/backlog/BacklogJiraView.tsx` (728 righe — god component, technical debt noto).
Stato: ✅ funzionante.

**Creazione task**
Form `/tasks/new` con react-hook-form + Zod, `DescriptionQualityIndicator`, preview TASK.md, shortcut `N`.
Route/componente: `apps/web/app/(dashboard)/tasks/new/TaskCreationForm.tsx`, `POST /api/tasks`.
Stato: ✅ funzionante.

**Editing inline task**
`PATCH /api/tasks/[taskId]` per titolo, descrizione, priorità. Emette `user.task.updated`.
Stato: ✅ funzionante.

**Bulk actions**
`POST /api/tasks/bulk` per operazioni su più task contemporaneamente.
Stato: ✅ route esiste — funzionamento interno non verificato in dettaglio.

**Import backlog**
`POST /api/backlog/import` — parsing e importazione bulk di task.
Stato: non verificato — richiede analisi manuale.

### Sprint management

**CRUD sprint completo**
Crea, rinomina, aggiunge/rimuove task, riordina, avvia, completa. Sprint status: `planning → active → completed`.
Route: `apps/web/app/api/sprints/`, `GET/PATCH/DELETE /api/sprints/[sprintId]`.
Stato: ✅ funzionante.

**Avvio sprint con validazione**
`POST /api/sprints/[sprintId]/start` verifica: almeno una task `sprint_ready`, ogni task ha `repository_id`, almeno un agente online. Nessuno sprint già attivo.
Stato: ✅ funzionante.

**Completamento sprint**
`POST /api/sprints/[sprintId]/complete` — stato `completed`, aggiornamento metriche.
Stato: ✅ route esiste — funzionamento interno non verificato in dettaglio.

**Creazione sprint da backlog**
`POST /api/sprints/from-backlog` — crea sprint a partire da task selezionate nel backlog.
Stato: ✅ route esiste.

**Vista sprint detail**
`/sprints/[sprintId]` mostra task del sprint con status in tempo reale.
Stato: ✅ funzionante.

### Task execution

**Esecuzione Claude Code**
ClaudeRunner spawna `claude --print --dangerously-skip-permissions` con `TASK.md` nella root del repo. Auto-clone se repo non presente (con token GitHub App fresco). Timeout per tipo: chore=15m, docs=20m, bug=30m, refactor=45m, feature=60m.
Stato: ✅ funzionante.

**Event sourcing durante esecuzione**
Emette `agent.phase.started/completed` (write + proof), `agent.commit.pushed` (rilevato da regex SHA-40 nello stdout), `agent.pr.opened` (dopo completamento), `task.state.changed` a ogni transizione.
Stato: ✅ funzionante. Limitazione: la fase "analysis" viene emessa all'avvio del job (prima del clone), non separata dall'esecuzione reale.

**Routing multi-agente**
Algorithm: 1) `preferred_agent_id` se online, 2) load balancing (meno task completate in 24h per quella repo), 3) tiebreaker `provisioned_at` più recente. Sequential per repository (concurrency=1), parallelo tra repository diverse.
Stato: ✅ funzionante.

**Artifact storage**
PR e commit salvati in `task_artifacts`. Visibili nel TaskDetailClient.
Stato: ✅ funzionante.

**Task detail real-time**
`/tasks/[taskId]` usa Supabase Realtime su `task_events` (INSERT) per aggiornamenti live. SSR per dati storici, Realtime per incrementali. Colonna 2: PRCard, DeployPreviewCard, CommitList da `TaskProjectedState`.
Stato: ✅ funzionante.

**Gestione errori e DLQ**
`AgentBlockedError` (non-retryable) → emette `agent.blocked`, notifica Slack+email. `AgentTimeoutError`, `APIRateLimitError`, `NetworkError` (retryable, 3 tentativi, backoff 5s→25s→125s). DLQ alert Slack se >3 job failed.
Stato: ✅ funzionante.

### Provisioning VPS

Descritto in "Gestione agenti" sopra. Include: idempotenza (skip creazione se `vps_id != null`), snapshot cloud-init se `HETZNER_SNAPSHOT_ID` configurato (1–2 min vs 7–8 min), `ProvisioningTimeline` real-time nella pagina `/agents/[agentId]`.
Stato: ✅ funzionante.

### Notifiche

**Slack (incoming webhook)**
Attive per: task ready (PR aperta), task bloccata, task fallita, PR mergeata, PR chiusa senza merge, DLQ alert.
Configurazione: variabile processo `SLACK_WEBHOOK_URL` sull'orchestratore. Se non impostata: silently skipped.
**Attenzione:** `workspace_settings.notify_slack_webhook` esiste in DB e viene salvato dalla Settings UI, ma `notification.service.ts` non lo legge — usa solo `process.env["SLACK_WEBHOOK_URL"]`. La config per-workspace è inattiva.
Stato: ⚠️ funzionante con limitazioni. Funziona solo se env var impostata. Config workspace UI disconnessa.

**Email (Resend)**
Attive per: task bloccata, task fallita, PR chiusa senza merge.
Configurazione: `RESEND_API_KEY` + `NOTIFY_EMAIL` nell'env orchestratore. Stessa disconnessione con `workspace_settings.notify_email`.
Stato: ⚠️ funzionante con limitazioni. Come Slack.

### Real-time dashboard

**Dashboard principale** (`/dashboard`)
AgentHeroSection (stato agenti online), MetricsTile (conteggi task), ActiveTaskCard, WorkspaceFeed (eventi recenti via Realtime). `getDashboardAgents()` + `AgentStatusGrid` per multi-agente.
Stato: ✅ funzionante.

**Metriche** (`/metrics`)
Cycle time, PR approval rate, escalation rate. Selettore periodo. Download report Markdown (`GET /api/reports/monthly`).
Stato: ✅ funzionante.

### GitHub integration

**GitHub App connection**
Settings → GitHubConnectionCard → redirect install page → callback → salva `installation_id` in `github_connections`. Revoca via `DELETE /api/auth/github`.
Stato: ✅ funzionante.

**Repository selector**
`GET /api/github/repos` lista repo dall'API GitHub + DB merge. Toggle abilitazione. `agent_repositories` per associare repo ad agente.
Stato: ✅ funzionante.

**Webhook ricezione**
`POST /api/webhooks/github` verifica firma HMAC-SHA256, filtra e enqueue eventi `pull_request:closed`, `pull_request_review_comment`, `issue_comment`.
Stato: ✅ ricezione e routing funzionanti. Processamento parziale (vedi sezione worker).

### Context documents e AI Brainstorm

**Context documents**
Tabella `context_documents`, CRUD via `GET/POST /api/context`, `DELETE/PATCH /api/context/[docId]`, sync da GitHub repo via `POST /api/context/sync`.
Pagina `/context` esiste.
Stato: ✅ infrastruttura funzionante — utilizzo nel delivery (es. iniezione in TASK.md) non verificato.

**AI Brainstorm**
`POST /api/ai/brainstorm` esiste.
Stato: non verificato — richiede analisi manuale.

### Operazioni admin

**Bake snapshot**: `POST /api/admin/bake-snapshot` (role: owner) pubblica su Redis channel `robin:bake-snapshot`. Il `SnapshotBakerService` sul control-plane lo riceve e bake Hetzner snapshot. Stato: ✅ route + servizio esistono.

**Update agents**: `POST /api/admin/update-agents` (role: owner). Stato: route esiste — non verificato in dettaglio.

**GDPR export**: `GET /api/workspace/export` scarica JSON completo workspace. Stato: ✅ funzionante.

---

## Cosa NON esiste ancora

| Feature | Descrizione | Sprint |
|---------|-------------|--------|
| Rework trigger automatico (GitHub comment) | `pull_request_review_comment` e `issue_comment` arrivano al webhook ma vengono loggati e scartati nel worker — nessun job rework creato | Sprint C |
| Rework trigger manuale (dashboard) | L'evento `user.rework.initiated` esiste in `EventPayloadMap` ma nessuna API route lo traduce in una nuova esecuzione dell'agente. La UI per triggerare rework non è implementata | Sprint C |
| Worker rework (`rework-trigger.worker`) | Non esiste nessun worker che prenda una task in stato `rework` e la re-esegua con `REWORK.md` | Sprint C |
| REWORK.md nel ClaudeRunner | ADR-13 descrive la struttura, ma `claude.runner.ts` non scrive mai `REWORK.md` — solo `TASK.md` | Sprint C |
| Popolamento `task_iterations` | La tabella e `getTaskIterations()` esistono, ma nessun worker o route scrive mai una riga. La tabella è sempre vuota | Sprint C |
| `sprint.started` / `sprint.completed` eventi | Non in `EventPayloadMap` né in `task_event_type` DB (documentato come pianificato) | Sprint C |
| `task.rework_started` evento | Non in `shared-types` — da definire insieme al `ReworkPayload` (ADR pendente) | Sprint C |
| `agent.pr.updated` emissione | Il tipo esiste in `EventPayloadMap` ma nessun worker lo emette (noted in `docs/events.md`) | Sprint C |
| Notifiche per-workspace da DB settings | `workspace_settings.notify_email/notify_slack_webhook` esistono ma `notification.service.ts` legge da process env | Sprint C o sprint successivo |
| Task detail: transizione manuale `review_pending → in_review` | Nessun pulsante/azione UI per spostare una task da `review_pending` a `in_review` (blocca il ciclo di delivery finché BUG-ORC-01 non è risolto) | Sprint C |

---

## Flusso dati end-to-end

| Step | Componente | Tabella DB | Evento emesso | Notifica |
|------|------------|------------|---------------|---------|
| Task creata | `POST /api/tasks` | `tasks` INSERT | `task.created`, `task.state.changed` (→ backlog/sprint_ready) | — |
| Sprint avviato | `POST /api/sprints/{id}/start` | `tasks` UPDATE (→ queued), `sprints` UPDATE (→ active) | `task.state.changed` (→ queued) per ogni task | — |
| Job BullMQ enqueued | stessa route | — (Redis) | — | — |
| Repo worker routing | `repo-queue.worker.ts` | `tasks` UPDATE (assigned_agent_id) | — | Slack dopo 30 min se nessun agente |
| Task presa in carico | `task.worker.ts` | `tasks` UPDATE (→ in_progress), `agent_status` UPDATE (→ busy) | `agent.phase.started` (analysis), `task.state.changed` (→ in_progress) | — |
| Claude esegue | `claude.runner.ts` | — | `agent.phase.started/completed` (write/proof), `agent.commit.pushed` (per ogni SHA rilevato) | — |
| PR aperta | `task.worker.ts` dopo runner | `task_artifacts` INSERT (pr), `tasks` UPDATE (→ review_pending) | `agent.pr.opened`, `task.state.changed` (→ review_pending) | Slack: "PR ready for review" |
| GitHub PR mergeata | `POST /api/webhooks/github` → BullMQ `github-events` → `github-events.worker.ts` | tentativo `tasks` UPDATE (→ done) **FALLISCE** (BUG-ORC-01) | `task.completed` emesso anche se la transizione di stato fallisce | Slack: "PR mergeata" (emessa comunque) |
| Task fallita | `task.worker.ts` on final attempt | `tasks` UPDATE (→ failed), `agent_status` UPDATE (→ error) | `task.failed`, `task.state.changed` (→ failed) | Slack + email: "Task failed" |
| Agente bloccato | `task.worker.ts` on `AgentBlockedError` | `agent_status` UPDATE (→ error) | `agent.blocked` | Slack + email: "Agent blocked" |

---

## Stato dei worker orchestrator

### `task.worker.ts`
- **Queue:** `tasks` (QUEUE_NAME)
- **Trigger:** job `JobPayload` enqueued da `repo-queue.worker.ts`
- **Cosa fa:** esegue Claude Code, aggiorna status, emette eventi, notifica, gestisce errori (3 tentativi, backoff exponential)
- **Stato:** ✅ attivo
- **Limitazione:** imposta status `review_pending` invece di `in_review` alla fine dell'esecuzione con PR. Questo rompe la transizione verso `done` via webhook (BUG-ORC-01).

### `repo-queue.worker.ts`
- **Queue:** `repo-queue-{repositoryId}` (dinamica, una per repository)
- **Trigger:** job `RepoQueueJobPayload` enqueued da `POST /api/sprints/{id}/start`
- **Cosa fa:** routing dell'agente, dispatch a queue `tasks`; retry ogni 5 min se nessun agente disponibile
- **Stato:** ✅ attivo. Safety net: `RepoWatchdogService` ogni 60s ricostruisce le code perse.

### `github-events.worker.ts`
- **Queue:** `github-events`
- **Trigger:** evento `pull_request:closed` (o altri) da `POST /api/webhooks/github`
- **Cosa fa:**
  - `pull_request:closed` + `merged=true`: tenta `task → done` — **fallisce silenziosamente** per BUG-ORC-01 (transition `review_pending → done` non valida)
  - `pull_request:closed` + `merged=false`: tenta `task → in_review` — **fallisce silenziosamente** per la stessa ragione (transition `review_pending → in_review` non valida)
  - `pull_request_review_comment`: ricevuto, loggato, non processato (BUG-ORC-02)
  - `issue_comment`: ricevuto, loggato, non processato (BUG-ORC-02)
- **Stato:** 🐛 BUG-ORC-01 e BUG-ORC-02. Il worker gira ma le transizioni di stato non avvengono.
- **Note tech debt:** `GitHubEventJobPayload` definita localmente invece che in `shared-types` (TASK-REFACTOR-ORC-06). `concurrency: 5` inline invece di `workerOptions` centralizzate (ADR-05 violation).

### `sprint-control.worker.ts`
- **Queue:** `sprint-control`
- **Trigger:** job `SprintControlJobPayload` da `POST /api/sprints/{id}/start`
- **Cosa fa:** chiama `createRepoQueueWorker(repositoryId)` per ogni repo dello sprint — latency <1s
- **Stato:** ✅ attivo.

### `agent.provisioning.worker.ts`
- **Queue:** `agent-provisioning`
- **Trigger:** job `AgentProvisioningJobPayload` da `POST /api/agents`
- **Cosa fa:** crea VPS Hetzner, attende `running`, polling heartbeat, marca `online`
- **Stato:** ✅ attivo. Idempotente (skip creazione se `vps_id != null`).

### `agent.deprovisioning.worker.ts`
- **Queue:** `agent-deprovisioning`
- **Trigger:** job `AgentDeprovisioningJobPayload` da `DELETE /api/agents/[agentId]`
- **Cosa fa:** cancella VPS Hetzner (gestisce 404), marca `deprovisioned`
- **Stato:** ✅ attivo.

### Servizi accessori (control-plane)
- **`RepoWatchdogService`**: ogni 60s, ri-ricostruisce queue per task `queued` rimaste orfane — ✅
- **`ProvisioningRecoveryService`**: al boot, recupera agenti stuck in `pending` senza BullMQ job — ✅
- **`SelfUpdateService`**: listen su Redis pub/sub per restart remoto — ✅
- **`SnapshotBakerService`**: bake Hetzner snapshot su richiesta — ✅ (non verificato in dettaglio)

### Servizi accessori (agent VPS)
- **`HeartbeatService`**: ogni 30s aggiorna `agents.last_seen_at` + versioni; all'avvio rileva versione Claude Code CLI; al graceful shutdown marca `offline` — ✅
- **`TaskPoller`**: polling adattivo 5–30s per task `pending` senza `queued_at` — ✅ (path legacy, non usato nello Sprint B flow dove le task arrivano già `queued`)

---

## Gap critici per Sprint C

### 1. BUG-ORC-01 — Transizione di stato `review_pending → done/in_review` impossibile

**Cosa manca:** `task.worker.ts` imposta `review_pending` quando la PR viene aperta. `VALID_TRANSITIONS` in `task.repository.ts` non include `done` né `in_review` come destinazioni da `review_pending`. Il `github-events.worker.ts` tenta entrambe le transizioni e fallisce silenziosamente.

**Dove agganciarsi:**
- `apps/orchestrator/src/workers/task.worker.ts:74` — cambiare da `"review_pending"` a `"in_review"`
- `apps/orchestrator/src/repositories/task.repository.ts:6-21` — aggiungere `review_pending: [..., "in_review"]` se si vuole mantenere `review_pending` come passo intermedio
- `apps/orchestrator/src/workers/github-events.worker.ts` — nessuna modifica necessaria se `task.worker.ts` è corretto

**Dipendenze:** nessuna. Questo è il prerequisito di tutto Sprint C.

**Rischio:** basso — modifica atomica a una riga in `task.worker.ts`. Richiede verifica che la UI non mostri cose diverse tra `review_pending` e `in_review` (STATUS_LABELS/STATUS_COLORS in `lib/task-constants.ts`).

---

### 2. BUG-ORC-02 — Rework trigger da commenti GitHub non implementato

**Cosa manca:** `pull_request_review_comment` e `issue_comment` arrivano al webhook, vengono enqueued nel worker, ma il worker fa solo `log.info(..., "not yet processed")` e ritorna. Nessun meccanismo di rework viene attivato.

**Dove agganciarsi:**
- `apps/orchestrator/src/workers/github-events.worker.ts:234-241` — aggiungere handler per `pull_request_review_comment` e `issue_comment`
- Deve leggere `tasks.pending_rework_comments` (jsonb), aggregare i commenti in finestra temporale
- Deve creare una riga in `task_iterations` + aggiornare `tasks.rework_count`/`current_iteration`/`last_rework_trigger`
- Deve enqueue un nuovo job di esecuzione (non ancora definito come tipo BullMQ)

**Dipendenze:** BUG-ORC-01 deve essere risolto prima. Richiede definizione di `ReworkPayload` in `shared-types` (ADR pendente). Richiede creazione del worker `rework-trigger.worker.ts` (non esiste).

**Rischio:** alto — nuovo worker, nuovo tipo di payload, modifica alla state machine. Coinvolge `shared-types`, orchestratore e web.

---

### 3. REWORK.md non implementato in ClaudeRunner

**Cosa manca:** ADR-13 descrive la struttura di `REWORK.md`, ma `claude.runner.ts` non la implementa. La funzione `run()` scrive solo `TASK.md`. Nessuna logica per costruire il contesto del rework (diff PR, commenti, iterazioni precedenti).

**Dove agganciarsi:**
- `apps/orchestrator/src/agent/claude.runner.ts` — aggiungere parametro opzionale `reworkContext?: ReworkPayload` e logica di scrittura `REWORK.md` prima dello spawn, rimozione nel blocco `finally`
- La struttura del file è descritta in `docs/architecture.md:ADR-13`

**Dipendenze:** BUG-ORC-01 + BUG-ORC-02 + definizione `ReworkPayload` in `shared-types`.

**Rischio:** medio — la logica di costruzione del contesto (diff GitHub API, commenti, iterazioni precedenti) è complessa. Budget diff: 200.000 caratteri.

---

### 4. `task_iterations` mai popolata

**Cosa manca:** la tabella `task_iterations` esiste e `getTaskIterations()` può leggerla, ma nessun worker o route crea mai righe. Ogni task ha sempre 0 iterazioni nel DB, indipendentemente da quante esecuzioni ha avuto.

**Dove agganciarsi:**
- `apps/orchestrator/src/workers/task.worker.ts` — creare riga `task_iterations` al `IN (running)` e aggiornare a `completed/failed` al termine
- Oppure in un worker rework dedicato per l'iterazione N>1

**Dipendenze:** nessuna per l'iterazione 1 (può essere aggiunta a task.worker.ts indipendentemente). Per N>1 dipende da BUG-ORC-02.

**Rischio:** basso per iterazione 1.

---

### 5. Notifiche per-workspace disconnesse dal DB

**Cosa manca:** `workspace_settings.notify_email` e `notify_slack_webhook` vengono salvati dalla Settings UI (`POST /api/workspace/settings`) ma `notification.service.ts` ignora il DB e legge solo da `process.env`.

**Dove agganciarsi:**
- `apps/orchestrator/src/services/notification.service.ts` — ogni metodo deve leggere la config del workspace dal DB (via Supabase service role) prima di inviare
- Richiede passare `workspaceId` a ogni metodo di notifica (già presente come parametro in `TaskInfo`)

**Dipendenze:** nessuna bloccante.

**Rischio:** basso — modifica contenuta nel service. Attenzione ai N+1 query (leggere settings una volta per job, non per ogni notifica).

---

### 6. Nessuna transizione manuale `review_pending → in_review` nella UI

**Cosa manca:** dopo che la PR è aperta, il task rimane `review_pending`. Non esiste un pulsante/azione nel TaskDetailClient per spostarlo a `in_review` (che è lo stato richiesto perché il webhook lo porti a `done`). Il founder non ha modo di "prendere in carico" la review in modo che il sistema lo sappia.

**Dove agganciarsi:**
- `apps/web/app/(dashboard)/tasks/[taskId]/TaskDetailClient.tsx` — aggiungere azione "Prendi in review" quando `status === "review_pending"`
- `apps/web/app/api/tasks/[taskId]/route.ts` (PATCH) — già gestisce update status; verificare che `review_pending → in_review` sia nelle transizioni permesse lato web

**Dipendenze:** BUG-ORC-01 (fix stato in task.worker.ts). Dopo il fix, questo è il complemento UI necessario.

**Rischio:** basso — aggiunta UI localizzata.

---

## Tabella prerequisiti Sprint C

| Prerequisito | Stato | Note |
|-------------|-------|------|
| Sprint B completato: sprint eseguito end-to-end | ✅ | BUG-ORC-01 fixato in `fix/TASK-BUG-01-sprint-c-prerequisites`. Il ciclo completo `sprint_ready → in_progress → in_review → done` ora funziona via webhook GitHub. |
| Task events popolati durante esecuzione | ✅ | `agent.phase.started/completed`, `agent.commit.pushed`, `agent.pr.opened`, `task.state.changed` sono tutti emessi durante l'esecuzione reale. Verificato in `event.service.ts` e `task.worker.ts`. |
| Almeno una PR reale aperta dall'agente | non verificabile da codice | Dipende dal fatto che una VPS sia stata provisionata e una task eseguita in produzione. Il codice che apre PR è corretto ma non si può verificare l'esito senza dati reali. |
| BUG-ORC-01 fixato (state machine github-events) | ✅ | Fixato: `task.worker.ts` imposta `in_review` (era `review_pending`). Il webhook `pull_request:closed` porta il task a `done` (merged) o lo mantiene in `in_review` (closed without merge) senza più try/catch silenzioso. |
| SECURITY-WEB-01 fixato (admin routes role check) | ✅ | `POST /api/admin/bake-snapshot` e `POST /api/admin/update-agents` verificano `role === "owner"` via `getWorkspaceMemberRole()`. Verificato in `apps/web/app/api/admin/bake-snapshot/route.ts:24-25`. |
| Notifiche email e Slack funzionanti | ✅ | `notification.service.ts` legge `workspace_settings.notify_slack_webhook` e `notify_email` da DB con fallback su env vars. Fixato in `fix/TASK-BUG-01-sprint-c-prerequisites`. |
| `task_iterations` popolata durante esecuzione | ✅ | `task.repository.ts` espone `createIteration`, `updateIteration`, `markRunningIterationFailed`. `task.worker.ts` crea la riga all'avvio del job e la aggiorna a `completed` o `failed` alla fine. Fixato in `fix/TASK-BUG-01-sprint-c-prerequisites`. |
| STATUS_LABEL/BADGE completi nel TaskDetailClient | ✅ | `in_review`, `done`, `rework`, `backlog`, `sprint_ready` aggiunti a entrambe le mappe. Fixato in `fix/TASK-BUG-01-sprint-c-prerequisites`. |
