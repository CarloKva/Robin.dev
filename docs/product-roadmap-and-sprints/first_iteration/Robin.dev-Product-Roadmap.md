# Robin.dev — Product Roadmap
**Versione 2.0 · Carlo Ferrero · Febbraio 2026**

---

## Premessa

Il POC del 25 febbraio 2026 ha validato una cosa sola: il flusso end-to-end funziona.
Task sul gestionale → orchestratore rileva → agente esegue → PR su GitHub → deploy preview.

Questo era l'obiettivo del POC. Non era un'architettura. Non era codice production-ready.
Era una prova di concetto.

Questa roadmap riparte da zero con una domanda diversa:
**come si costruisce Robin.dev nel modo giusto, sapendo già che il flusso funziona?**

Ogni componente — orchestratore, gestionale, database, protocollo agente — viene
riprogettato con intenzione, non evoluto dal codice di validazione.

---

## Principi architetturali

Questi principi guidano ogni decisione tecnica della roadmap. Quando c'è un dubbio,
si torna qui.

**Separazione dei layer.** Orchestratore, agente, gestionale e database sono layer
indipendenti con interfacce esplicite. Nessun layer conosce i dettagli implementativi
di un altro. Si può sostituire l'agente senza toccare l'orchestratore.

**Event-driven prima del polling.** Il polling è una soluzione di emergenza, non
un'architettura. Il sistema usa eventi dove possibile, polling solo dove gli eventi
non sono praticabili e con backoff adattivo.

**Schema dati come contratto.** Il database non è un dettaglio implementativo. Lo
schema PostgreSQL è il contratto tra tutti i layer del sistema. Si definisce con cura,
si versiona, si migra in modo controllato.

**Multi-agent dal giorno 1.** Non si costruisce un sistema single-agent e poi si
cerca di scalarlo. L'architettura supporta più agenti in parallelo fin dalla prima
versione production, anche se inizialmente ne gira uno solo.

**Osservabilità come feature.** Log strutturati, event sourcing sull'activity log,
metriche ADWP — non sono aggiunte successive. Sono parte del prodotto, perché
la tracciabilità è il valore filosofico centrale di Robin.dev.

**Solo io.** L'architettura è progettata per un developer singolo. Significa:
stack coerente (Node.js + TypeScript ovunque), meno layer di astrazione non
necessari, scelte che privilegiano la leggibilità rispetto alla cleverness.

---

## Stack tecnologico target

| Layer | Tecnologia | Motivazione |
|---|---|---|
| Gestionale frontend | Next.js 15, App Router, TypeScript | Continuità con il POC, ecosistema maturo |
| Gestionale styling | Tailwind CSS + shadcn/ui | Componenti professionali senza design system custom |
| Auth | Clerk | Auth completa in ore, non giorni. OAuth, sessioni, webhook |
| Real-time | Supabase Realtime (WebSockets) | Integrato con il DB, zero infrastruttura aggiuntiva |
| Database | PostgreSQL su Supabase | Multi-tenant, row-level security, real-time, storage |
| ORM | Prisma | Type-safe, migrations versionati, DX eccellente |
| Job queue | BullMQ + Redis | Queue strutturata, retry, priorità, visibility timeout |
| Orchestratore | Node.js v24 + TypeScript | Continuità, ma riscritto con architettura a worker |
| Agente | Claude Code (headless) | Invariato — è il layer esecutivo, non l'orchestratore |
| VPS | Hetzner CX23 (1 per cliente) | Isolamento completo, costi contenuti |
| Deploy gestionale | Vercel | Invariato |
| Monitoring | Betterstack (o equivalente) | Uptime + log aggregation in un unico tool |
| Notifiche | Resend (email) + Slack webhook | Transazionale via Resend, operativo via Slack |

---

## Struttura degli sprint

Ogni sprint ha due fasi interne:

**Fase A — Analisi e Design (40% del tempo)**
Prima di scrivere codice: ricerca tecnica, decisioni architetturali documentate,
schema dati, interfacce tra componenti, spike su tecnologie non ancora usate.
L'output è un Architecture Decision Record (ADR) per ogni decisione non ovvia.

**Fase B — Implementazione (60% del tempo)**
Build sulla base delle decisioni prese nella Fase A. Nessuna decisione architetturale
durante l'implementazione — se emerge un dubbio, si torna in Fase A.

---

## Sprint 1 — Fondamenta architetturali
**Obiettivo:** Definire e costruire lo scheletro su cui poggia tutto il resto.
Database, schema, autenticazione, struttura del monorepo, pipeline CI/CD base.
Al termine di questo sprint esiste un sistema vuoto ma corretto: si può fare login,
si può creare un workspace, il database ha lo schema giusto, il codice è deployato.

### Perché questo sprint prima degli altri

Senza schema dati corretto tutto il resto è sabbia. Senza auth integrata dal giorno 1
si costruisce qualcosa che va buttato. Senza una struttura di progetto coerente
un developer singolo si perde nel caos dopo due settimane.

### Fase A — Analisi e Design

- Definizione completa dello schema PostgreSQL: `workspaces`, `users`, `agents`,
  `tasks`, `task_events`, `task_artifacts`, `agent_metrics`
- Decisione sul modello di multi-tenancy: row-level security su Supabase vs
  schema separati per workspace
- Struttura del monorepo: gestionale, orchestratore, tipi condivisi in un unico repo
- Scelta e configurazione CI/CD: GitHub Actions per test, lint, deploy automatico
- ADR: ogni decisione non ovvia documentata con contesto, opzioni valutate, scelta

### Fase B — Implementazione

- Setup monorepo (Turborepo o workspace npm)
- Configurazione Supabase: progetto, schema iniziale, RLS policies
- Integrazione Clerk sul gestionale: login, signup, workspace creation
- Schema Prisma allineato con Supabase
- Gestionale v2: scaffolding Next.js 15 con App Router, layout base, pagine protette
- Pipeline CI/CD: lint + type check + deploy su Vercel ad ogni push su main
- Ambiente di sviluppo locale documentato e riproducibile

### Epics

#### EPIC-01 · Schema dati
Progettazione e implementazione dello schema PostgreSQL completo, con row-level
security, relazioni corrette e supporto nativo al multi-tenancy.

#### EPIC-02 · Autenticazione e workspace
Implementazione del sistema di autenticazione con Clerk, gestione del ciclo di vita
del workspace, e separazione degli ambienti per utente.

#### EPIC-03 · Struttura di progetto
Setup del monorepo, configurazione degli strumenti di sviluppo (TypeScript strict,
ESLint, Prettier), pipeline CI/CD e ambiente locale documentato.

#### EPIC-04 · Gestionale scaffold
Prima versione del gestionale v2: layout, navigazione, pagine protette, connessione
al database. Nessuna feature di business — solo la struttura corretta.

---

## Sprint 2 — Orchestratore v2
**Obiettivo:** Riscrivere l'orchestratore da zero con architettura corretta.
Job queue strutturata con BullMQ, separazione netta tra orchestratore e agente,
supporto nativo al parallelismo, gestione degli errori deterministica.

### Perché questo sprint è il più critico

L'orchestratore è il cuore operativo di Robin.dev. È il layer che trasforma
un'intenzione (task nel gestionale) in esecuzione (Claude Code sul VPS).
Il POC lo aveva scritto come script di polling. La versione production deve essere
un sistema di job processing robusto, osservabile e scalabile.

### Fase A — Analisi e Design

- Ricerca e valutazione approfondita di BullMQ: pattern di retry, dead letter queue,
  visibility timeout, job priority, concurrency per worker
- Definizione dell'interfaccia tra orchestratore e agente: come si passa una task,
  come si riceve l'output, come si gestisce un blocco
- Modello degli stati dell'agente: idle, claiming, executing, reporting, error
- Strategia di deployment sul VPS: come si installa, come si aggiorna, come si
  monitora un worker BullMQ in produzione
- Decisione su Redis: managed (Upstash) vs self-hosted sul VPS
- ADR per ogni decisione non ovvia

### Fase B — Implementazione

- Setup Redis (Upstash o self-hosted sul VPS)
- Implementazione BullMQ: queue `task-execution`, worker con concurrency configurabile,
  retry con backoff esponenziale, dead letter queue per task fallite
- Interfaccia agente: modulo TypeScript che incapsula il lancio di Claude Code,
  la lettura dell'output, la gestione del timeout
- Sincronizzazione stato: ogni transizione di stato della task viene scritta
  su Supabase con timestamp e contesto
- systemd service per il worker sul VPS: avvio automatico, restart on failure,
  logging su journalctl
- Test di carico: simulazione di 5 task in parallelo per validare il comportamento

### Epics

#### EPIC-05 · Job queue
Implementazione della queue BullMQ con Redis, worker configurabile, retry
strutturato e dead letter queue per la gestione delle task fallite.

#### EPIC-06 · Interfaccia agente
Separazione netta tra orchestratore (gestione della queue) e agente (esecuzione
di Claude Code). Modulo TypeScript con API esplicita e testabile.

#### EPIC-07 · Sincronizzazione stato
Sistema che mantiene allineato lo stato della task su Supabase con l'esecuzione
reale sul VPS, con garanzie di consistenza anche in caso di crash.

#### EPIC-08 · Deployment e stabilità VPS
Configurazione systemd, monitoring del worker, procedura di aggiornamento
documentata. Il VPS deve essere autonomo e osservabile senza accesso diretto.

---

## Sprint 3 — Event sourcing e real-time
**Obiettivo:** Implementare l'activity log come event sourcing e portare il
gestionale in real-time via WebSockets. Al termine di questo sprint il gestionale
mostra cosa sta facendo l'agente in questo momento, senza refresh manuale.

### Perché event sourcing per l'activity log

L'activity log non è un semplice log di testo. È la storia verificabile di ogni
azione dell'agente — il fondamento epistemologico del sistema, come descritto
nell'analisi filosofica. Event sourcing è il pattern corretto perché:

- ogni evento è immutabile e timestampato
- lo stato corrente di una task è derivabile dalla sequenza di eventi
- è possibile ricostruire cosa è successo in qualsiasi momento
- i client real-time ricevono eventi incrementali, non snapshot completi

### Fase A — Analisi e Design

- Definizione del catalogo eventi: quali eventi esistono, quale struttura hanno,
  quali payload portano (es. `task.state.changed`, `agent.phase.started`,
  `agent.commit.pushed`, `agent.pr.opened`, `agent.blocked`, `human.approved`)
- Modello di proiezione: come si ricostruisce lo stato corrente di una task
  dalla sequenza di eventi
- Strategia real-time: Supabase Realtime su `task_events` vs canali custom
- Schema `task_events` su Supabase: event type, payload JSONB, versioning
- ADR per ogni decisione non ovvia

### Fase B — Implementazione

- Tabella `task_events` con schema event sourcing
- Funzioni di proiezione: `getTaskState(taskId)`, `getTaskTimeline(taskId)`
- Emissione eventi dall'orchestratore: ogni azione dell'agente produce un evento
  scritto su Supabase
- Supabase Realtime: subscription lato gestionale su `task_events`
- Dashboard real-time: stato agente aggiornato in tempo reale senza polling
- Timeline UI: visualizzazione della sequenza di eventi come storia narrativa,
  non come raw log
- Feed live: notifica visiva quando un nuovo evento arriva mentre si guarda una task

### Epics

#### EPIC-09 · Event sourcing schema
Definizione del catalogo eventi, implementazione della tabella `task_events`,
funzioni di proiezione per ricostruire lo stato corrente.

#### EPIC-10 · Emissione eventi dall'orchestratore
Integrazione dell'orchestratore con il sistema di eventi: ogni azione dell'agente
produce un evento strutturato scritto su Supabase.

#### EPIC-11 · Real-time sul gestionale
Subscription Supabase Realtime, aggiornamento della UI in tempo reale,
gestione della connessione (reconnect, fallback a polling in caso di errore).

#### EPIC-12 · Timeline UI
Componente visivo per la visualizzazione della storia di una task come sequenza
di eventi narrativi, con differenziazione per tipo di evento e fase ADWP.

---

## Sprint 4 — Gestionale v2 completo
**Obiettivo:** Completare il gestionale con tutte le feature di business.
Task management, dashboard agente, visualizzazione PR e artifact, form di
creazione guidata. Al termine di questo sprint il gestionale è mostrabile
a un cliente senza imbarazzo.

### Cosa significa "mostrabile senza imbarazzo"

Non significa bello. Significa credibile. Un cliente che apre il gestionale deve:
- capire immediatamente cosa sta facendo l'agente
- trovare la storia completa di ogni task senza cercare
- creare una nuova task senza istruzioni
- fidarsi del sistema perché vede tutto quello che è successo

### Fase A — Analisi e Design

- UX flow completo: dalla login alla task completata, ogni schermata e transizione
- Information architecture: cosa mostra la dashboard, cosa mostra la task detail,
  cosa mostra la lista task
- Componenti UI critici da progettare prima di costruire: status indicator agente,
  timeline eventi, task form con validazione guidata, PR card
- Responsive strategy: quali viste sono prioritarie su mobile
- Performance budget: tempi di caricamento target per ogni pagina

### Fase B — Implementazione

- Dashboard: stato agente real-time, task attive, metriche di riepilogo
- Lista task: filtri per stato, tipo, priorità; ordinamento; ricerca
- Task detail: tutte le informazioni di una task in una pagina — descrizione,
  stato, timeline eventi, PR collegata, deploy preview, metriche di esecuzione
- Task creation form: validazione guidata, suggerimenti per tipo di task,
  selezione agente (in preparazione al multi-agent)
- PR card: collegamento diretto alla PR su GitHub, stato del deploy preview
  Vercel, diff summary
- Metrics view: accuracy rate, cycle time, escalation rate per workspace
- Responsive: dashboard e task detail ottimizzati per mobile

### Epics

#### EPIC-13 · Dashboard
Pagina principale con stato agente real-time, task in corso, metriche di sintesi
e accesso rapido alle azioni più frequenti.

#### EPIC-14 · Task management
Lista task con filtri e ricerca, task detail completa con timeline e artifact,
form di creazione con validazione guidata.

#### EPIC-15 · Artifact integration
Visualizzazione delle PR aperte dall'agente, collegamento al deploy preview
Vercel, stato del CI/CD, diff summary leggibile.

#### EPIC-16 · Metrics e reporting
Vista delle metriche ADWP per workspace: accuracy rate, cycle time, PR approval
rate, escalation rate. Report mensile generabile.

---

## Sprint 5 — Multi-tenancy e provisioning
**Obiettivo:** Il sistema gestisce più clienti in isolamento completo.
Ogni cliente ha il proprio workspace, il proprio VPS, il proprio agente GitHub.
Il provisioning di un nuovo cliente è documentato, riproducibile e non richiede
più di 2 ore. Al termine di questo sprint si possono onboardare i primi 3 pilota.

### Fase A — Analisi e Design

- Modello di isolamento definitivo: VPS dedicata per cliente vs processi isolati
  su VPS condivisa — analisi costi/complessità/sicurezza
- Provisioning checklist: ogni passo dall'acquisto VPS al primo task eseguito
- Account GitHub per cliente: naming convention, permessi minimi necessari,
  procedura di revoca
- CLAUDE.md per cliente: struttura template vs personalizzazione per progetto
- Offboarding: procedura di cancellazione completa con garanzia di rimozione dati
- Pricing operativo: costo reale per cliente con la nuova architettura

### Fase B — Implementazione

- Script di provisioning: automatizzazione di tutti i passi ripetibili
  (setup VPS, installazione dipendenze, configurazione agente, test flusso)
- Workspace isolation: RLS policies su Supabase verificate con test espliciti
  di cross-contamination
- Agent registry: tabella `agents` con stato, VPS, account GitHub, workspace
- Multi-agent routing: logica per assegnare una task all'agente corretto
  in base al workspace e al tipo di task
- Offboarding script: cancellazione workspace, dati, accessi GitHub, VPS
- Runbook: documentazione operativa per ogni scenario (provisioning, update,
  incident, offboarding)

### Epics

#### EPIC-17 · Modello di isolamento
Decisione e implementazione del modello di isolamento per cliente, con test
espliciti che verificano l'impossibilità di cross-contamination.

#### EPIC-18 · Provisioning automatizzato
Script e procedura documentata per onboardare un nuovo cliente in meno di 2 ore,
dalla creazione del workspace al primo task eseguito con successo.

#### EPIC-19 · Multi-agent routing
Supporto a più agenti per workspace e logica di routing automatico delle task
verso l'agente corretto.

#### EPIC-20 · Runbook operativo
Documentazione completa per ogni scenario operativo: provisioning, aggiornamento
orchestratore, incident management, offboarding cliente.

---

## Milestone di progetto

| Milestone | Criterio di verifica | Sprint |
|---|---|---|
| **Schema e auth stabili** | Login funzionante, schema Supabase definitivo deployato | Fine Sprint 1 |
| **Orchestratore production-ready** | 5 task in parallelo senza errori, VPS autonomo 48h | Fine Sprint 2 |
| **Real-time operativo** | Activity log live senza refresh, eventi visibili in < 1s | Fine Sprint 3 |
| **Demo mostrabile** | UX review con 1 persona esterna, feedback raccolto | Fine Sprint 4 |
| **Pronto per clienti pilota** | 3 workspace provisionate, primo task reale eseguito | Fine Sprint 5 |

---

## Architecture Decision Records (da produrre)

Ogni decisione non ovvia verrà documentata come ADR durante la Fase A del
relativo sprint. Lista delle decisioni attese:

- ADR-01: Modello di multi-tenancy (RLS vs schema separati)
- ADR-02: Redis managed (Upstash) vs self-hosted per BullMQ
- ADR-03: Event sourcing — catalogo eventi e schema payload
- ADR-04: Modello di isolamento per cliente (VPS dedicata vs processi isolati)
- ADR-05: Strategia di aggiornamento orchestratore senza downtime

---

## Prossimi passi

La roadmap è lo scheletro. Il prossimo livello è dettagliare ogni sprint con
Epic → Story → Task → Spike, criteri di accettazione e stima di effort.

Si procede in ordine: prima il dettaglio completo del Sprint 1, poi via via
gli altri. Non si detaglia uno sprint successivo prima di aver iniziato
l'implementazione del precedente — il contesto cambia man mano che si costruisce.

---

*Robin.dev · Product Roadmap v2.0 · Carlo Ferrero · Febbraio 2026*
