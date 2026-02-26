# Robin.dev — Sprint 1 Backlog
## Fondamenta architetturali

**Versione 1.0 · Carlo Ferrero · Febbraio 2026**

---

## Obiettivo dello sprint

Al termine di questo sprint esiste un sistema vuoto ma corretto.
Si può fare login. Si può creare un workspace. Il database ha lo schema giusto
e non verrà più toccato nella struttura. Il codice è in un monorepo ordinato,
deployato, con CI/CD attiva.

Nessuna feature di business. Zero UI elaborata. Solo fondamenta.

**La metafora giusta:** non si costruisce una casa partendo dalle pareti.
Si scava, si gettano le fondamenta, si lascia solidificare. Solo dopo si costruisce.
Questo sprint è il getto di cemento.

---

## Struttura del backlog

```
Sprint 1
├── FASE A — Analisi e Design
│   ├── EPIC-01 · Decisioni architetturali (ADR)
│   └── EPIC-02 · Schema dati
└── FASE B — Implementazione
    ├── EPIC-03 · Struttura di progetto e monorepo
    ├── EPIC-04 · Database e Supabase
    ├── EPIC-05 · Autenticazione e workspace
    └── EPIC-06 · Gestionale scaffold
```

---

## Regole del backlog

- Ogni **Story** ha un titolo in forma `Come [chi], voglio [cosa], per [perché]`
- Ogni **Story** ha criteri di accettazione espliciti e verificabili
- Ogni **Task** è atomica: completabile in una sessione di lavoro (max ~4h)
- Ogni **Spike** ha un time-box fisso e produce un documento di output, non codice
- La **Fase A** deve essere completata prima di iniziare la **Fase B**
- Nessuna decisione architetturale durante la Fase B — se emerge un dubbio, si apre un nuovo spike

---

## FASE A — Analisi e Design

---

### EPIC-01 · Decisioni architetturali (ADR)

**Descrizione**
Ogni decisione non ovvia dello sprint viene analizzata, documentata e chiusa
prima di toccare il codice. L'output è una serie di Architecture Decision Records
che resteranno nel repository come memoria del perché il sistema è fatto così.

**Formato ADR standard**

Ogni ADR segue questa struttura:
```
# ADR-XX · Titolo della decisione
## Stato: [Proposta | Accettata | Sostituita da ADR-YY]
## Contesto
Perché questa decisione è necessaria. Quale problema risolve.
## Opzioni valutate
Elenco delle alternative considerate con pro e contro.
## Decisione
Cosa si è scelto e perché.
## Conseguenze
Cosa diventa più facile, cosa diventa più difficile, quali vincoli introduce.
```

---

#### STORY-01.01 · ADR sul modello di multi-tenancy

```
Come architect del sistema,
voglio documentare e chiudere la decisione sul modello di multi-tenancy,
per non dover riaprire questa discussione durante l'implementazione.
```

**Criteri di accettazione**
- [ ] ADR-01 scritto e committed nel repository sotto `/docs/adr/`
- [ ] Le due opzioni principali sono analizzate in profondità (vedi task)
- [ ] La decisione è chiusa con motivazione esplicita
- [ ] Le conseguenze sulla struttura dello schema sono documentate

**SPIKE-01.01.A · Row-Level Security vs Schema separati**
*Time-box: 3h*

Analisi approfondita delle due strategie principali di multi-tenancy su PostgreSQL/Supabase.

Domande da rispondere:
- RLS: come funziona su Supabase, quali sono i limiti di performance documentati,
  come si gestisce il bypass per operazioni admin, come si testa che funzioni?
- Schema separati: overhead di gestione, complessità delle migrations, come si
  gestisce su Supabase (supportato nativamente?), costo in termini di connessioni DB.
- Qual è la scelta più comune per SaaS B2B su Supabase con < 100 tenant?
- Esistono casi documentati di migrazione da RLS a schema separati o viceversa?

Output: documento `spike-01-multitenancy.md` con analisi comparativa e raccomandazione.

**TASK-01.01.1** — Ricerca RLS su Supabase: leggere documentazione ufficiale,
changelog recenti, limitazioni note. Annotare tutto.

**TASK-01.01.2** — Ricerca schema separati su Supabase: verificare se è supportato
nativamente, cercare casi d'uso reali, valutare complessità operativa.

**TASK-01.01.3** — Scrivere ADR-01 con decisione finale e committed nel repo.

---

#### STORY-01.02 · ADR sulla struttura del monorepo

```
Come developer singolo,
voglio documentare la struttura del monorepo e gli strumenti scelti,
per avere una guida chiara quando aggiungo nuovi package o mi perdo nella struttura.
```

**Criteri di accettazione**
- [ ] ADR-02 scritto e committed nel repository
- [ ] La scelta tra Turborepo e npm workspaces è documentata con motivazione
- [ ] La struttura delle cartelle del monorepo è definita (nomi, responsabilità)
- [ ] La convenzione per i package condivisi (tipi, utils) è definita

**SPIKE-01.02.A · Turborepo vs npm workspaces puri**
*Time-box: 2h*

Domande da rispondere:
- Turborepo: cosa aggiunge rispetto a npm workspaces in un progetto di questa dimensione?
  Vale la complessità di setup per un developer singolo?
- npm workspaces: sufficienti per gestire monorepo con 3 package (gestionale,
  orchestratore, shared-types)? Quali limitazioni si incontrano?
- Come si gestisce il type-sharing tra gestionale (Next.js) e orchestratore (Node.js)
  senza duplicare le definizioni?

Output: documento `spike-02-monorepo.md` + struttura di cartelle proposta.

**TASK-01.02.1** — Ricerca Turborepo: leggere docs, valutare overhead per progetto small.

**TASK-01.02.2** — Scrivere ADR-02 con struttura cartelle definitiva e committed.

---

#### STORY-01.03 · ADR sulla strategia CI/CD

```
Come developer singolo,
voglio documentare la pipeline CI/CD,
per avere automazione affidabile senza overhead di manutenzione.
```

**Criteri di accettazione**
- [ ] ADR-03 scritto e committed
- [ ] I trigger della pipeline sono definiti (push su main, PR, tag)
- [ ] I job della pipeline sono definiti (lint, type-check, test, deploy)
- [ ] La strategia di deploy su Vercel via GitHub Actions è documentata
- [ ] La gestione delle variabili d'ambiente nei vari ambienti è definita

**TASK-01.03.1** — Definire gli ambienti: local, preview (ogni PR), production (main).

**TASK-01.03.2** — Definire quali check bloccano il merge vs sono solo informativi.

**TASK-01.03.3** — Scrivere ADR-03 e committed nel repo.

---

### EPIC-02 · Schema dati

**Descrizione**
Lo schema PostgreSQL è il contratto del sistema. Viene progettato una volta,
con cura, e non viene modificato strutturalmente senza una migration versionata.
Questo epic produce lo schema definitivo — non quello del POC, non "qualcosa che
poi migriamo". Lo schema che resterà.

**Principio guida:** ogni tabella deve avere una ragione di esistere chiara.
Se non sai rispondere a "perché questa tabella esiste separata dalle altre",
non è ancora pronta.

---

#### STORY-01.04 · Schema delle entità core

```
Come sistema,
voglio uno schema dati che rappresenti correttamente le entità di business,
per poter costruire su di esso senza rimpianti strutturali.
```

**Criteri di accettazione**
- [ ] Schema completo scritto in SQL o Prisma schema con tutti i campi tipizzati
- [ ] Ogni tabella ha `id` (UUID), `created_at`, `updated_at` come minimo
- [ ] Le relazioni tra tabelle sono esplicite con foreign key
- [ ] Il `workspace_id` è presente su ogni entità tenant-specific
- [ ] Il documento `schema-design.md` spiega le decisioni non ovvie dello schema
- [ ] Lo schema è review-ato: si riesce a rispondere a tutte le query di business
  con questo schema senza join impossibili?

**SPIKE-01.04.A · Modellazione delle entità e dei loro confini**
*Time-box: 4h*

Questo spike non è ricerca tecnica. È domain modeling. Partire dalle domande
di business e derivare lo schema.

Domande da rispondere:
- Un `workspace` è la stessa cosa di un `organization`? Cosa contiene?
- Un `agent` è una configurazione o un'istanza in esecuzione? Come si modella
  il suo stato (online/offline/working) senza inquinare la tabella anagrafica?
- Una `task` ha un ciclo di vita complesso (12+ stati). Va modellato come
  colonna `status` enum, come tabella `task_state_transitions`, o come proiezione
  degli eventi (vedi Sprint 3)?
- Gli `artifacts` (PR, commit, deploy preview) sono colonne sulla task o tabella separata?
  Come si gestisce il fatto che una task può produrre più artifact?
- Le `agent_metrics` vanno aggregate in tabella dedicata o si calcolano sempre
  a runtime dagli eventi?

Output: documento `spike-03-domain-model.md` con entity relationship diagram
(anche testuale) e decisioni sui confini.

**TASK-01.04.1** — Disegnare l'ER diagram (anche su carta o Excalidraw).
Verificare che copra tutti i casi d'uso del POC + quelli nuovi.

**TASK-01.04.2** — Scrivere lo schema Prisma completo per tutte le entità:
`workspaces`, `workspace_members`, `users`, `agents`, `agent_status`,
`tasks`, `task_artifacts`.

**TASK-01.04.3** — Scrivere il documento `schema-design.md` che spiega
le decisioni non ovvie. Perché UUID e non integer? Perché questa relazione
è N:M e non 1:N? Ecc.

**TASK-01.04.4** — Review dello schema: scrivere 10 query di business in SQL
(es. "tutte le task in stato in_progress per il workspace X",
"cycle time medio per agente nell'ultimo mese") e verificare che siano
eseguibili senza join aberranti.

---

#### STORY-01.05 · Schema per event sourcing (struttura base)

```
Come sistema,
voglio che lo schema preveda già la struttura per l'event sourcing dell'activity log,
per non dover fare una migration strutturale al Sprint 3.
```

**Criteri di accettazione**
- [ ] Tabella `task_events` nello schema con: `id`, `task_id`, `workspace_id`,
  `event_type` (enum), `payload` (JSONB), `created_at`, `actor_type` (agent/human)
- [ ] Il catalogo degli event types è definito come enum PostgreSQL (anche se
  non tutti implementati ora — verranno usati al Sprint 3)
- [ ] La tabella è append-only by design: no `updated_at`, no soft delete
- [ ] Il documento `schema-design.md` include la sezione event sourcing

**TASK-01.05.1** — Definire il catalogo completo degli event types come enum:
`task.created`, `task.state.changed`, `agent.phase.started`, `agent.phase.completed`,
`agent.commit.pushed`, `agent.pr.opened`, `agent.blocked`,
`human.approved`, `human.rejected`, `human.commented`, `task.completed`, `task.failed`.

**TASK-01.05.2** — Aggiungere tabella `task_events` allo schema Prisma.

**TASK-01.05.3** — Definire la struttura del payload JSONB per ogni event type:
quali campi contiene, quali sono obbligatori. Documentare in `schema-design.md`.

---

#### STORY-01.06 · RLS policies

```
Come sistema multi-tenant,
voglio che le RLS policies siano definite prima della prima migration,
per non avere mai dati di un workspace visibili a un altro.
```

**Criteri di accettazione**
- [ ] RLS abilitata su ogni tabella tenant-specific in Supabase
- [ ] Policy `SELECT` permette solo righe con `workspace_id` del workspace corrente
- [ ] Policy `INSERT` forza `workspace_id` al workspace corrente
- [ ] Policy `UPDATE` e `DELETE` limitate al workspace corrente
- [ ] Test esplicito: due utenti di workspace diversi non possono vedere i dati altrui
- [ ] Service role (usato dall'orchestratore) bypassa RLS in modo controllato e documentato

**TASK-01.06.1** — Scrivere le RLS policies SQL per ogni tabella.
Iniziare da `tasks` come tabella pilota, poi estendere al pattern.

**TASK-01.06.2** — Definire la strategia per il service role:
come l'orchestratore (sul VPS) accede al DB bypassando RLS.
Documentare il perché è sicuro farlo in questo contesto.

**TASK-01.06.3** — Scrivere i test di isolamento: script SQL che verifica
che utente A non possa leggere dati di utente B.

---

## FASE B — Implementazione

---

### EPIC-03 · Struttura di progetto e monorepo

**Descrizione**
Il repository è la casa in cui tutto il codice vive. Una casa disordinata
rende ogni lavoro futuro più lento e frustrante. Questo epic crea la struttura
giusta una volta sola.

---

#### STORY-01.07 · Inizializzazione monorepo

```
Come developer,
voglio un monorepo con struttura chiara e strumenti configurati,
per poter aggiungere codice senza dover decidere ogni volta dove metterlo.
```

**Criteri di accettazione**
- [ ] Repository GitHub creato con nome definitivo
- [ ] Struttura cartelle allineata con ADR-02
- [ ] `package.json` root con workspaces configurati
- [ ] TypeScript strict configurato in tutti i package
- [ ] ESLint + Prettier configurati con regole condivise dalla root
- [ ] `.gitignore` completo (node_modules, .env, .next, dist, ecc.)
- [ ] `README.md` root con struttura del progetto e come avviare il dev environment
- [ ] Branch protection su `main`: nessun push diretto, solo PR

**TASK-01.07.1** — Creare repo GitHub, inizializzare con struttura monorepo.
Struttura target:
```
/
├── apps/
│   ├── web/          ← gestionale Next.js
│   └── orchestrator/ ← orchestratore Node.js
├── packages/
│   └── shared-types/ ← tipi condivisi tra web e orchestrator
├── docs/
│   └── adr/          ← tutti gli ADR
├── package.json      ← workspace root
├── tsconfig.base.json
└── README.md
```

**TASK-01.07.2** — Configurare TypeScript: `tsconfig.base.json` alla root,
ogni package estende la base. Strict mode obbligatorio.

**TASK-01.07.3** — Configurare ESLint: root config condivisa, regole per
Next.js nel package `web`, regole per Node.js nel package `orchestrator`.

**TASK-01.07.4** — Configurare Prettier: config alla root, integrazione con ESLint,
format on save documentato nel README.

**TASK-01.07.5** — Creare package `shared-types`: struttura base, tsconfig,
export dei tipi fondamentali (anche vuoti per ora — verranno popolati dopo
la finalizzazione dello schema).

**TASK-01.07.6** — Configurare branch protection su GitHub:
require PR review (anche solo da se stessi come checklist mentale),
require status checks prima del merge.

---

#### STORY-01.08 · Pipeline CI/CD

```
Come developer,
voglio che ogni push su main triggeri automaticamente lint, type-check e deploy,
per non dover ricordare di farlo manualmente e per avere feedback immediato.
```

**Criteri di accettazione**
- [ ] GitHub Action attiva su ogni push su `main` e su ogni PR
- [ ] Job `lint`: ESLint su tutto il monorepo, fallisce se ci sono errori
- [ ] Job `typecheck`: `tsc --noEmit` su tutti i package, fallisce se ci sono errori
- [ ] Job `deploy-preview`: deploy automatico su Vercel per ogni PR (preview URL)
- [ ] Job `deploy-production`: deploy su Vercel production ad ogni push su main
- [ ] Le variabili d'ambiente di produzione sono in GitHub Secrets, non nel codice
- [ ] Il tempo totale della pipeline è sotto i 3 minuti

**TASK-01.08.1** — Creare workflow GitHub Actions `ci.yml`:
trigger on push/PR, jobs lint e typecheck in parallelo.

**TASK-01.08.2** — Configurare Vercel per deploy automatico da GitHub.
Collegare il progetto `apps/web` a Vercel, configurare il root directory.

**TASK-01.08.3** — Aggiungere job `deploy-preview` e `deploy-production` al workflow.

**TASK-01.08.4** — Configurare GitHub Secrets per tutte le variabili d'ambiente
necessarie (Supabase URL, Supabase anon key, Clerk keys, ecc.).

**TASK-01.08.5** — Verificare end-to-end: fare un push su main e osservare
la pipeline fino al deploy completato.

---

#### STORY-01.09 · Ambiente di sviluppo locale

```
Come developer,
voglio poter avviare tutto l'ambiente locale con un comando,
per non perdere tempo ogni volta che riprendo il lavoro dopo una pausa.
```

**Criteri di accettazione**
- [ ] `npm run dev` dalla root avvia gestionale e orchestratore in parallelo
- [ ] File `.env.example` con tutte le variabili necessarie e spiegazione di ognuna
- [ ] `README.md` con sezione "Getting started" che porta a zero → dev server in 10 minuti
- [ ] Variabili d'ambiente di sviluppo non hardcoded da nessuna parte nel codice

**TASK-01.09.1** — Configurare script `dev` nel `package.json` root
con `concurrently` o `turbo run dev` per avviare tutti i package in parallelo.

**TASK-01.09.2** — Creare `.env.example` con tutti i placeholder e commenti.

**TASK-01.09.3** — Scrivere sezione "Getting started" nel README.md root.

---

### EPIC-04 · Database e Supabase

**Descrizione**
Creare il progetto Supabase, applicare lo schema progettato nella Fase A,
configurare RLS, e verificare che tutto funzioni prima di costruirci sopra.

---

#### STORY-01.10 · Setup progetto Supabase

```
Come developer,
voglio un progetto Supabase configurato e accessibile,
per poter applicare lo schema e iniziare a sviluppare.
```

**Criteri di accettazione**
- [ ] Progetto Supabase creato (nome: `robindev`)
- [ ] Supabase CLI installata e configurata nel monorepo
- [ ] Login Supabase CLI funzionante in locale
- [ ] Variabili d'ambiente Supabase (URL, anon key, service role key) in `.env.local`
  e nei GitHub Secrets
- [ ] Supabase project linking configurato (`supabase link --project-ref <ref>`)

**TASK-01.10.1** — Creare progetto su Supabase dashboard. Scegliere la regione
più vicina (eu-central-1 o eu-west-1). Annotare project ref.

**TASK-01.10.2** — Installare Supabase CLI nel monorepo (`npm install supabase --save-dev`),
configurare `supabase/` directory alla root.

**TASK-01.10.3** — Configurare `supabase link` e verificare connessione locale.

**TASK-01.10.4** — Copiare tutte le chiavi Supabase in `.env.local` (escluso da git)
e in GitHub Secrets.

---

#### STORY-01.11 · Prima migration — schema completo

```
Come sistema,
voglio che lo schema PostgreSQL sia applicato tramite migration versionata,
per poter tracciare ogni modifica futura e fare rollback se necessario.
```

**Criteri di accettazione**
- [ ] Migration `0001_initial_schema.sql` creata con Supabase CLI
- [ ] La migration include: tutte le tabelle definite nella Fase A, tutti gli enum,
  tutti gli indici, tutti i foreign key
- [ ] La migration è applicata con successo su Supabase (remote)
- [ ] La migration è applicata con successo in locale (`supabase db reset`)
- [ ] Prisma schema è allineato con il database (nessun errore su `prisma db pull`)

**TASK-01.11.1** — Creare migration `0001_initial_schema.sql` con tutte le tabelle.
Usare `supabase migration new initial_schema` per il file, poi riempirlo.

**TASK-01.11.2** — Applicare migration in locale: `supabase db reset` — verificare
che non ci siano errori.

**TASK-01.11.3** — Applicare migration su Supabase remote: `supabase db push`.

**TASK-01.11.4** — Installare Prisma nel monorepo, configurare `schema.prisma`,
eseguire `prisma db pull` per generare il client dal DB esistente.
Verificare che il tipo generato corrisponda allo schema atteso.

**TASK-01.11.5** — Aggiungere `prisma generate` alla pipeline CI/CD
per rigenerare il client ad ogni build.

---

#### STORY-01.12 · Applicazione RLS policies

```
Come sistema multi-tenant,
voglio che le RLS policies siano attive e testate prima di scrivere
qualsiasi query di business,
per non scoprire problemi di isolamento in produzione.
```

**Criteri di accettazione**
- [ ] RLS abilitata su ogni tabella con `ALTER TABLE ... ENABLE ROW LEVEL SECURITY`
- [ ] Policy `SELECT`, `INSERT`, `UPDATE`, `DELETE` scritte per ogni tabella
- [ ] Test di isolamento eseguito manualmente su Supabase SQL editor:
  utente A non vede dati di workspace B
- [ ] Strategia service role documentata e implementata

**TASK-01.12.1** — Creare migration `0002_rls_policies.sql` con enable RLS
e tutte le policies per ogni tabella.

**TASK-01.12.2** — Testare isolamento: creare due workspace via SQL,
inserire dati in entrambi, verificare che query con JWT di workspace A
non restituisca dati di workspace B.

**TASK-01.12.3** — Documentare come l'orchestratore userà la service role key
per bypassare RLS in modo controllato.

---

#### STORY-01.13 · Seed dati di sviluppo

```
Come developer,
voglio un seed script che popola il database locale con dati realistici,
per poter sviluppare e testare la UI senza creare dati manualmente ogni volta.
```

**Criteri di accettazione**
- [ ] Script `supabase/seed.sql` che crea: 1 workspace, 1 utente, 1 agente,
  3-5 task in stati diversi, alcuni task_events per le task
- [ ] Il seed è eseguito automaticamente con `supabase db reset`
- [ ] I dati del seed sono realistici (nomi, descrizioni, timestamp sensati)

**TASK-01.13.1** — Scrivere `supabase/seed.sql` con dati di sviluppo.

**TASK-01.13.2** — Verificare che `supabase db reset` applichi migration + seed
in un unico comando senza errori.

---

### EPIC-05 · Autenticazione e workspace

**Descrizione**
Clerk gestisce tutta l'autenticazione. Il gestionale non implementa
password hashing, session management, o token rotation — Clerk lo fa.
Il compito di questo epic è integrare Clerk correttamente con Next.js
e con Supabase (passaggio del JWT per RLS).

---

#### STORY-01.14 · Setup Clerk

```
Come developer,
voglio Clerk configurato nel gestionale,
per avere autenticazione completa senza implementarla da zero.
```

**Criteri di accettazione**
- [ ] Clerk application creata sulla dashboard Clerk
- [ ] `@clerk/nextjs` installato nel package `web`
- [ ] `ClerkProvider` wrappa il layout root di Next.js
- [ ] Variabili d'ambiente Clerk (`NEXT_PUBLIC_CLERK_PUBLISHABLE_KEY`,
  `CLERK_SECRET_KEY`) configurate in `.env.local` e GitHub Secrets
- [ ] Middleware Clerk configurato: tutte le route sono protette di default,
  solo `/sign-in` e `/sign-up` sono pubbliche
- [ ] Il redirect dopo login porta a `/dashboard`

**TASK-01.14.1** — Creare applicazione su Clerk dashboard.
Abilitare Google OAuth come provider. Configurare redirect URLs.

**TASK-01.14.2** — Installare `@clerk/nextjs`, configurare `ClerkProvider`
nel root layout (`apps/web/app/layout.tsx`).

**TASK-01.14.3** — Creare `middleware.ts` con `clerkMiddleware()`,
definire le route pubbliche con `createRouteMatcher`.

**TASK-01.14.4** — Creare pagine `/sign-in/[[...sign-in]]/page.tsx`
e `/sign-up/[[...sign-up]]/page.tsx` con i componenti Clerk.

**TASK-01.14.5** — Verificare il flusso completo:
utente non autenticato → redirect a /sign-in → login con Google →
redirect a /dashboard → logout → redirect a /sign-in.

---

#### STORY-01.15 · Integrazione Clerk + Supabase (JWT)

```
Come sistema,
voglio che il JWT di Clerk venga passato a Supabase per abilitare RLS,
per non dover implementare un secondo sistema di autorizzazione.
```

**Criteri di accettazione**
- [ ] JWT template Clerk configurato con il claim `sub` mappato a `user_id`
- [ ] Supabase client lato server inizializzato con il JWT di Clerk
- [ ] RLS policies usano `auth.uid()` che corrisponde al `user_id` di Clerk
- [ ] Test: query dal gestionale restituisce solo dati del workspace dell'utente loggato
- [ ] Il flow è documentato in `docs/auth-flow.md`

**SPIKE-01.15.A · Integrazione Clerk + Supabase RLS**
*Time-box: 2h*

Domande da rispondere:
- Come si passa il JWT di Clerk a Supabase per abilitare RLS?
  (Clerk ha un JWT template dedicato per Supabase?)
- Come si inizializza il Supabase client con il JWT di Clerk in Next.js App Router
  (Server Components, Route Handlers, Client Components — tre contesti diversi)?
- Come si gestisce il caso in cui il JWT è scaduto o non presente?

Output: documento `spike-04-clerk-supabase.md` + codice di esempio.

**TASK-01.15.1** — Configurare JWT template su Clerk dashboard per Supabase.

**TASK-01.15.2** — Implementare helper `createSupabaseServerClient()` che
inizializza Supabase con il JWT di Clerk nei Server Components e Route Handlers.

**TASK-01.15.3** — Implementare helper `createSupabaseClientClient()` per
uso nei Client Components (se necessario in questo sprint).

**TASK-01.15.4** — Scrivere test manuale: fare una query che legge tasks,
verificare che RLS restituisca solo le task del workspace corretto.

**TASK-01.15.5** — Documentare il flow in `docs/auth-flow.md`.

---

#### STORY-01.16 · Creazione e gestione workspace

```
Come nuovo utente,
voglio poter creare un workspace al primo login,
per poter iniziare a usare il sistema senza configurazione manuale.
```

**Criteri di accettazione**
- [ ] Al primo login, se l'utente non ha un workspace, viene reindirizzato
  a `/onboarding/workspace`
- [ ] Il form di creazione workspace accetta: nome workspace, slug (auto-generato
  dal nome, modificabile)
- [ ] Il workspace viene creato su Supabase con `workspace_id` UUID
- [ ] L'utente diventa `owner` del workspace nella tabella `workspace_members`
- [ ] Dopo la creazione, redirect a `/dashboard`
- [ ] Lo slug è unico — errore esplicito se già esiste

**TASK-01.16.1** — Creare la logica di check "utente ha workspace?":
webhook Clerk `user.created` o check lato middleware/dashboard.
Documentare la scelta.

**TASK-01.16.2** — Creare pagina `/onboarding/workspace` con form
nome + slug. Validazione client-side con Zod.

**TASK-01.16.3** — Creare Route Handler `POST /api/workspaces` che
inserisce il workspace su Supabase e crea il membership record.

**TASK-01.16.4** — Gestire l'errore di slug duplicato con messaggio utile.

**TASK-01.16.5** — Testare il flusso completo: nuovo utente → login →
onboarding → workspace creato → dashboard.

---

### EPIC-06 · Gestionale scaffold

**Descrizione**
Il gestionale v2 nella sua forma minima: layout, navigazione, pagine
protette, connessione al database. Nessuna feature di business ancora.
L'obiettivo è avere una struttura di codice corretta su cui costruire
nei prossimi sprint, non qualcosa da mostrare a un cliente.

---

#### STORY-01.17 · Layout e navigazione base

```
Come utente autenticato,
voglio un layout coerente con navigazione,
per potermi muovere tra le sezioni dell'applicazione.
```

**Criteri di accettazione**
- [ ] Layout root con sidebar di navigazione e area contenuto
- [ ] Sidebar con link a: Dashboard, Tasks, Agents (placeholder), Settings
- [ ] Header con: nome workspace corrente, avatar utente, link logout
- [ ] Il layout è responsive: sidebar collassabile su mobile
- [ ] shadcn/ui installato e configurato nel package `web`
- [ ] Nessun contenuto reale nelle pagine — solo struttura e placeholder

**TASK-01.17.1** — Installare e configurare shadcn/ui:
`npx shadcn@latest init`. Scegliere il tema base (neutral o slate).

**TASK-01.17.2** — Creare componente `Sidebar` con link di navigazione.
Usare componenti shadcn/ui (`Button`, `Separator`).

**TASK-01.17.3** — Creare componente `Header` con nome workspace e avatar.
Usare `useUser()` di Clerk per i dati utente.

**TASK-01.17.4** — Creare layout autenticato `app/(dashboard)/layout.tsx`
che wrappa Sidebar + Header + children.

**TASK-01.17.5** — Creare pagine placeholder per ogni sezione:
`/dashboard`, `/tasks`, `/agents`, `/settings`.

---

#### STORY-01.18 · Connessione DB nel gestionale

```
Come gestionale,
voglio poter leggere e scrivere su Supabase con RLS attiva,
per poter costruire feature di business nei prossimi sprint
senza dover riscrivere il layer di accesso ai dati.
```

**Criteri di accettazione**
- [ ] Il Supabase client (server-side) funziona correttamente nei Server Components
- [ ] Il Prisma client è configurato e disponibile nei Server Components
- [ ] Esiste una query di test (`getWorkspaceById`) che legge il workspace
  dell'utente corrente e lo mostra nel layout (nome workspace nell'header)
- [ ] La query rispetta RLS: un utente non vede workspace di altri
- [ ] Gli errori di DB sono gestiti con try/catch e non crashano il server

**TASK-01.18.1** — Configurare Prisma client come singleton nel gestionale
(pattern standard per Next.js: `lib/prisma.ts`).

**TASK-01.18.2** — Implementare `getWorkspaceById(workspaceId: string)`
come primo esempio di query tipizzata con Prisma.

**TASK-01.18.3** — Usare la query nel layout per mostrare il nome workspace
nell'header. Questo verifica l'intera catena: auth → JWT → Supabase → RLS → query.

**TASK-01.18.4** — Verificare che un utente senza workspace riceva
un errore gestito, non un crash.

---

#### STORY-01.19 · Pagina Settings — base

```
Come utente,
voglio una pagina settings con le informazioni base del workspace,
per verificare che tutto sia configurato correttamente.
```

**Criteri di accettazione**
- [ ] Pagina `/settings` mostra: nome workspace, slug, data di creazione
- [ ] I dati vengono letti da Supabase, non sono hardcoded
- [ ] La pagina è accessibile solo a owner del workspace (RLS)

**TASK-01.19.1** — Creare Server Component `SettingsPage` che legge
il workspace corrente da Supabase e mostra le informazioni.

**TASK-01.19.2** — Verificare che RLS impedisca di vedere settings
di un workspace di cui non si è owner.

---

## Definition of Done — Sprint 1

Lo sprint è completato quando **tutti** i seguenti criteri sono soddisfatti:

**Documentazione**
- [ ] ADR-01 (multi-tenancy), ADR-02 (monorepo), ADR-03 (CI/CD) committed nel repo
- [ ] `schema-design.md` con spiegazione di ogni decisione non ovvia
- [ ] `docs/auth-flow.md` con diagramma del flusso Clerk + Supabase
- [ ] `README.md` root aggiornato con "Getting started" funzionante

**Infrastruttura**
- [ ] Monorepo con struttura definita in ADR-02, tutti i package configurati
- [ ] CI/CD attiva: lint + typecheck + deploy su ogni push
- [ ] Supabase: schema applicato, RLS attiva, seed funzionante

**Applicazione**
- [ ] Login con Google funzionante via Clerk
- [ ] Creazione workspace funzionante
- [ ] Layout con navigazione e nome workspace nell'header
- [ ] Pagina settings con dati reali da Supabase

**Qualità**
- [ ] Zero errori TypeScript (`tsc --noEmit` pulito)
- [ ] Zero errori ESLint
- [ ] Pipeline CI verde su main
- [ ] Test di isolamento RLS eseguito e documentato

**Il test finale:**
Aprire una scheda privata del browser, fare signup come nuovo utente,
creare un workspace, vedere il nome workspace nell'header, aprire settings
e vedere i dati corretti. Tutto in meno di 2 minuti, senza istruzioni.

---

## Stima effort

| Epic | Story | Effort stimato |
|---|---|---|
| EPIC-01 · ADR | STORY-01.01 → 01.03 | ~6h (inclusi spike) |
| EPIC-02 · Schema dati | STORY-01.04 → 01.06 | ~8h (inclusi spike) |
| EPIC-03 · Monorepo | STORY-01.07 → 01.09 | ~5h |
| EPIC-04 · Database | STORY-01.10 → 01.13 | ~6h |
| EPIC-05 · Auth | STORY-01.14 → 01.16 | ~8h (incluso spike) |
| EPIC-06 · Scaffold | STORY-01.17 → 01.19 | ~5h |
| **Totale stimato** | | **~38h** |

Lo sprint è pensato per 2 settimane di lavoro part-time (developer singolo
con altri impegni). Se le settimane sono full-time, il buffer è usato per
approfondire gli spike o anticipare attività del Sprint 2.

---

## Rischi specifici di questo sprint

| Rischio | Probabilità | Mitigazione |
|---|---|---|
| Integrazione Clerk + Supabase RLS più complessa del previsto | Media | Spike dedicato (SPIKE-01.15.A) con time-box fisso |
| Schema dati da rivedere dopo averlo implementato | Alta | La STORY-01.04 include review esplicita con 10 query di business |
| CI/CD Vercel + monorepo richiede configurazione non standard | Media | TASK-01.08.2 verifica subito, prima di dipenderci |
| Lo slug univoco del workspace crea problemi di UX | Bassa | Gestito in TASK-01.16.4 con messaggio di errore esplicito |

---

## Note per i prossimi sprint

Le decisioni prese in questo sprint che impattano i prossimi:

- **Sprint 2 (Orchestratore):** la tabella `agents` e `agent_status` definite qui
  sono il contratto che l'orchestratore dovrà rispettare per aggiornare il proprio stato.
- **Sprint 3 (Event sourcing):** la tabella `task_events` e il catalogo degli enum
  definiti qui sono la base su cui Sprint 3 costruisce. Non modificare la struttura
  senza una migration versionata.
- **Sprint 5 (Multi-tenancy):** il modello RLS scelto in ADR-01 determinerà
  la complessità dell'isolamento per cliente. Se si sceglie RLS, Sprint 5 sarà
  più semplice. Se si cambia idea, sarà costoso.

---

*Robin.dev · Sprint 1 Backlog v1.0 · Carlo Ferrero · Febbraio 2026*
