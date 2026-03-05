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

## Dove trovare le cose

| Cosa cerchi | Dove guardare |
|-------------|---------------|
| Schema DB completo | `docs/schema.md` |
| Architettura e ADR | `docs/architecture.md` |
| Catalogo eventi | `docs/events.md` |
| Runbook operativi | `docs/runbook.md` |
| Sicurezza e RLS test | `docs/security.md` |
| Backlog task attivo | `.robin.md` (se esiste) |
