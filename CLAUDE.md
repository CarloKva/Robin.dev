# Robin.dev — Claude Code

Robin.dev è una piattaforma SaaS che gestisce agenti AI (Claude Code) per conto di team software. Ogni workspace corrisponde a un cliente: l'agente esegue task di sviluppo su repository GitHub del cliente, apre PR, e passa i risultati in review al founder.

## Struttura del monorepo

| Directory | Ruolo |
|-----------|-------|
| `apps/web` | Next.js 15 App Router — gestionale, API routes, UI |
| `apps/orchestrator` | Node.js — worker BullMQ, esecuzione Claude Code, provisioning VPS |
| `packages/shared-types` | Tipi TypeScript condivisi tra web e orchestrator |
| `docs/` | Architettura, schema DB, catalogo eventi, runbook operativi |
| `supabase/migrations/` | Migration SQL applicate via `supabase db push` |
| `scripts/` | Provisioning manuale, smoke test, offboarding |

## Come leggere queste istruzioni

Quando lavori su `apps/web`, leggi `apps/web/CLAUDE.md`.
Quando lavori su `apps/orchestrator`, leggi `apps/orchestrator/CLAUDE.md`.
Questo file contiene solo le regole comuni a entrambi i package.

## Account e identità

- Repository: `https://github.com/CarloKva/Robin.dev`
- Branch di default: `main` — non lavorare mai direttamente su main
- Naming branch: `[tipo]/[task-id]-[descrizione-breve]`
  - es. `feat/TASK-123-global-create-modal`
  - es. `fix/TASK-456-sprint-order-bug`
  - es. `chore/update-claude-md-20260305`

## Workflow obbligatorio — 4 fasi

Ogni task, senza eccezioni:

### Fase 1 — Analisi

Prima di toccare qualsiasi file:
- Leggi tutti i file coinvolti dalla task
- Identifica effetti collaterali e dipendenze (in particolare: shared-types e route handler)
- Se la task è ambigua, scrivi le assunzioni che stai facendo prima di procedere

### Fase 2 — Piano

Prima di scrivere codice:
- Elenca i file da modificare, uno per uno, con la modifica prevista
- Se il piano richiede una decisione architetturale non inferibile dal codice, fermati e chiedi
- Per refactor: verifica che nessun file sorgente venga toccato prima che il piano sia completo

### Fase 3 — Implementazione

- Il progetto deve compilare dopo ogni singola modifica
- Mai lasciare import rotti o TypeScript errors aperti
- Un problema alla volta — non fixare cose fuori scope mentre implementi qualcos'altro

### Fase 4 — Review

- Rileggi tutto il codice scritto
- Verifica: TypeScript compila, nessun import rotto, nessuna regressione funzionale ovvia
- Documenta il technical debt trovato ma non risolto in un commento `// TODO:` o in `.robin.md`

## Regole non negoziabili

- Mai pushare su `main` — sempre PR
- Mai modificare file `.env` (solo `.env.example`)
- Mai modificare migration già applicate (`supabase/migrations/`)
- Mai hardcodare credenziali, URL, o chiavi API
- Mai operazioni destructive su DB senza istruzione esplicita del founder
- Aprire sempre una PR al termine del lavoro

## Variabili d'ambiente

Le variabili d'ambiente stanno in:
- `.env.local` (non versionato) — sviluppo locale
- `.env.example` (versionato) — template con placeholder

Mai leggere valori reali da `.env.local` e includerli nel codice o nei commit.

## Commit conventions

Il progetto usa Conventional Commits con trattino lungo `—` come separatore opzionale:

```
feat: descrizione breve
fix: descrizione breve
chore: descrizione breve
feat(scope): descrizione — dettaglio opzionale
fix(scope): descrizione
chore(scope): descrizione
```

Esempi reali da `git log`:
- `feat: BrainstormModal → floating chat widget with inline import card`
- `fix: white background on sync modal and raise paths limit to 500`
- `chore: replace all UI emojis with Lucide SVG icons`
- `feat(sidebar): collapsible icon-only mode with localStorage persistence`
- `chore: health check refactor — centralize auth guards, clean dead code, consolidate docs`

## Known issues attivi

Questi bug sono stati identificati e non ancora fixati. Non introdurre codice che dipende dal comportamento attuale di questi punti:

- **BUG-ORC-01:** `github-events.worker.ts` bypassa la state machine dei task per le transizioni `done`/`in_review` — chiama `taskRepository.updateStatus()` direttamente senza validare lo stato di partenza. Fix pianificato in TASK-BUG-01.

- **BUG-ORC-02:** `pull_request_review_comment` e `issue_comment` ricevuti ma non processati in `github-events.worker.ts` — i rework trigger da GitHub non sono implementati. Necessario per Sprint C.

## Runbook operativo — task bloccate in produzione

### Status UI
- **"In review" (giallo)** = `status = 'in_review'` — webhook GitHub ha confermato la PR
- **"Review" (plain)** = `status = 'review_pending'` — agente ha finito ma il webhook non è ancora arrivato

### Causa comune di task stuck in `queued`
BullMQ v5: `queue.add()` con un `jobId` già esistente ritorna l'hash vecchio (dedup) senza rientrare in coda. Risultato: task bloccata in loop infinito. Cause:
1. `removeOnComplete: true` → normalizzato a `{count:200}`, hash non eliminato → dedup blocca i re-enqueue. Fix: `removeOnComplete: { count: 0 }` in `defaultJobOptions` e `workerOptions`.
2. `assigned_agent_id = null` + due agenti → entrambi i poller aggiungono lo stesso job con `agentId` diversi → **cross-agent mismatch loop** (vedi sotto).
3. Build disallineata su un agente → vecchio `task.worker.js` chiama `moveToDelayed` invece di `resetToUnqueued` → task non viene mai liberata.

### Cross-agent mismatch loop — diagnosi e fix
**Sintoma:** `queued_at` settato nel DB, BullMQ vuoto, watchdog mostra `a=2 w=0` per minuti interi.
**Causa:** l'agente idle consuma i job prima dell'agente corretto → routing mismatch → `resetToUnqueued` → poller ri-accoda → loop a ~5s per ciclo. Le task sembrano stuck ma vengono processate e rilasciate centinaia di volte al minuto.
**Diagnosi rapida:**
```bash
redis-cli --tls --insecure -a <pwd> -h 77.42.71.71 LLEN bull:tasks:active   # dovrebbe essere >0 se c'è lavoro reale
ssh root@46.225.212.237 "tail -5 /opt/robin/watchdog.log"                   # a=2 w=0 per minuti = mismatch loop
```
**Fix:**
```bash
# 1. Ferma l'agente idle per rompere il loop
ssh -i ~/.ssh/robindev_provisioning root@46.225.212.237 "systemctl stop robin-orchestrator"

# 2. Resetta le task e assegna esplicitamente all'agente corretto
# In Supabase SQL editor:
UPDATE tasks SET queued_at=NULL, assigned_agent_id='<uuid-agente>', updated_at=NOW()
WHERE status='queued' AND sprint_id='<sprint_id>';

# 3. Attendi ~35s che il poller del'agente attivo prenda i job, poi riavvia l'agente fermato
ssh -i ~/.ssh/robindev_provisioning root@46.225.212.237 "systemctl start robin-orchestrator"
```
Con `assigned_agent_id` settato entrambi i poller costruiscono il payload con lo stesso `agentId` → il loop si esaurisce naturalmente.

### Restart agenti con sprint attivo — procedura sicura
Se devi riavviare tutti gli agenti mentre uno sprint è in corso, i job BullMQ in `active` vengono droppati ma `queued_at` nel DB rimane settato → task bloccate per sempre (poller non re-accoda se `queued_at IS NOT NULL`).
**Prima del restart**: resetta le task queued/in_progress o aspetta che finiscano.
**Dopo il restart** (se dimentichi): esegui in Supabase SQL editor:
```sql
UPDATE tasks SET queued_at=NULL, status='pending', updated_at=NOW()
WHERE status IN ('queued', 'in_progress') AND sprint_id IS NOT NULL;
```
Il poller ri-accoda entro ~5s.

### Task `in_progress` o `queued` orfane dopo restart agente

**Causa:** systemd riavvia l'agente (`Restart=always`) mentre un job BullMQ è in stato `active`. Il job viene droppato, ma il DB rimane `in_progress`/`queued` con `queued_at IS NOT NULL`. Il poller non le riaccoda (filtra `queued_at IS NULL`).

**Segnale diagnostico:**
```bash
redis-cli --tls --insecure -a <pwd> -h 77.42.71.71 LLEN bull:tasks:active   # → 0
redis-cli --tls --insecure -a <pwd> -h 77.42.71.71 ZCARD bull:tasks:prioritized  # → 0
# + DB mostra task in_progress o queued → conferma: task orfane
```

**Fix (30 secondi):**
```sql
-- In Supabase SQL editor
UPDATE tasks SET queued_at = NULL, status = 'pending', updated_at = NOW()
WHERE workspace_id = '<workspace_id>'
  AND status IN ('queued', 'in_progress');
```
Il poller riaccoda entro ~5s.

**Nota:** questo bug si verifica anche dopo top-up crediti Anthropic se l'agente è rimasto in stato `Restart=always` — si riavvia autonomamente e riprende, ma i job che erano in active al momento dello stop vengono persi.

### Procedura di sblocco generica
```bash
# SSH ai VPS agenti (chiave: ~/.ssh/robindev_provisioning)
ssh -i ~/.ssh/robindev_provisioning root@<IP>

# Variabili env agente (da .env): REDIS_URL, AGENT_ID, WORKSPACE_ID
# BullMQ queue name: "tasks" — job priority va in bull:tasks:prioritized (ZSET), non bull:tasks:wait (LIST)
# getJobCounts('waiting') = 0 anche con job in coda prioritaria — usare zrange bull:tasks:prioritized
```

### Manutenzione ad ogni nuovo sprint
1. **Watchdog SPRINT_ID** — hardcoded in `/opt/robin/queue-watchdog.js` su agent `7ab81aa7` (`46.225.212.237`). Va aggiornato, altrimenti il watchdog non vede le task stuck del nuovo sprint:
```bash
ssh -i ~/.ssh/robindev_provisioning root@46.225.212.237 \
  "sed -i \"s/<old_sprint_id>/<new_sprint_id>/\" /opt/robin/queue-watchdog.js"
```
2. **SSH key sul control plane** — richiesta da `ops-ssh.service` per i diagnostics. Deve esistere a `~/.ssh/robindev_provisioning` su `77.42.71.71`. Se mancante:
```bash
scp -i ~/.ssh/robindev_provisioning ~/.ssh/robindev_provisioning root@77.42.71.71:~/.ssh/robindev_provisioning
ssh root@77.42.71.71 "chmod 600 ~/.ssh/robindev_provisioning"
```

## Dove trovare le cose

| Cosa cerchi | Dove guardare |
|-------------|---------------|
| Schema DB completo | `docs/schema.md` |
| Architettura e ADR | `docs/architecture.md` |
| Catalogo eventi | `docs/events.md` |
| Runbook operativi | `docs/runbook.md` |
| Sicurezza e RLS test | `docs/security.md` |
| Backlog task attivo | `.robin.md` (se esiste) |
