# Robin.dev — Sprint C Backlog
## Rework Flow + Context Preservation

**Versione 1.0 · Carlo Ferrero · Febbraio 2026**

---

## Obiettivo dello sprint

Il rework è un flusso di prima classe. Il founder può iterare su una
task completata — lasciando commenti su GitHub o dalla dashboard —
e l'agente riprende il lavoro con il contesto originale intatto,
senza che nessuno debba rispiegare nulla.

Al termine di questo sprint, il ciclo di delivery di Robin.dev è
completo: task → esecuzione → PR → review → rework → merge. Nessun
passo richiede di ricominciare da zero.

**Cosa ottieni concretamente alla fine:**
L'agente ha aperto una PR. Il founder la revisa su GitHub e lascia
tre commenti: "questo componente va estratto", "manca la gestione
dell'errore", "il nome della variabile non è chiaro". Robin intercetta
i commenti, riapre la sessione dell'agente con tutto il contesto
dell'implementazione originale, e produce una PR aggiornata. Il founder
riceve una notifica. Riapre la PR, trova le tre cose corrette. Fa merge.

In alternativa: il founder vede la PR deployata in staging e si accorge
di un problema non catturato nei commenti. Apre Robin, entra nella task,
e scrive istruzioni aggiuntive direttamente dalla dashboard. L'agente
parte di nuovo, con la storia completa della task davanti a sé.

In entrambi i casi: zero riesecuzioni manuali, zero perdita di contesto,
zero dover rispiegare il progetto all'agente.

---

## Prerequisiti da Sprint B

Prima di iniziare, verificare che siano soddisfatti:

- [ ] Sprint B completato: almeno uno sprint eseguito end-to-end con
  PR aperte su GitHub reale
- [ ] Task events popolati correttamente durante l'esecuzione
  (Sprint 3 + Sprint B)
- [ ] Tabella `tasks` con tutti i campi di Sprint B (status, repository_id,
  agent_id, sprint_id)
- [ ] Notifiche email e Slack funzionanti (Sprint B)
- [ ] Almeno una PR reale aperta dall'agente su GitHub, con commenti

Se non esiste almeno una PR reale con commenti su GitHub, il rework
flow non può essere testato end-to-end. Non si dichiarano feature
complete senza test su dati reali.

---

## Struttura del backlog

```
Sprint C
├── FASE A — Analisi e Design
│   ├── EPIC-C1 · Context model — cosa preservare e come
│   └── EPIC-C2 · Rework flow — design delle due modalità
└── FASE B — Implementazione
    ├── EPIC-C3 · GitHub webhook integration
    ├── EPIC-C4 · Rework engine
    ├── EPIC-C5 · Context preservation e task memory
    ├── EPIC-C6 · Dashboard-driven rework
    └── EPIC-C7 · Task history e audit trail
```

---

## Una nota sulla complessità di questo sprint

Sprint A e Sprint B erano prevalentemente additivi: si costruivano
nuove feature su un sistema stabile. Sprint C è diverso: tocca il
cuore dell'orchestratore (il modo in cui Claude Code viene avviato),
introduce un webhook listener esterno (GitHub), e richiede di pensare
seriamente a cosa significa "preservare il contesto" in un sistema
dove l'agente è un processo stateless.

Il rischio principale è tecnico: Claude Code non ha un concetto nativo
di "sessione persistente". Ogni esecuzione è indipendente. Il contesto
va ricostruito attivamente — non è qualcosa che succede da solo. La
Fase A di questo sprint esiste principalmente per risolvere questa
domanda prima di scrivere una riga di codice.

Il principio guida è: **il rework non è una nuova task. È la
continuazione della stessa conversazione.** Il sistema deve costruire
questa illusione in modo affidabile.

---

## FASE A — Analisi e Design

---

### EPIC-C1 · Context model — cosa preservare e come

**Descrizione**
Prima di implementare il rework, capire esattamente cosa significa
"contesto" per un agente che riprende una task. Non è ovvio: Claude Code
è stateless, ogni esecuzione riparte da zero. Il contesto va costruito
esplicitamente — e bisogna decidere cosa includere, in quale formato,
e dove conservarlo.

---

#### STORY-C.01 · Spike sul contesto di esecuzione di Claude Code

```
Come architect del sistema,
voglio capire come ricostruire il contesto di una task precedente
per una nuova sessione di Claude Code,
per non scoprire a metà implementazione che l'approccio scelto
non funziona con il modello di esecuzione dell'agente.
```

**Criteri di accettazione**
- [ ] SPIKE-C.01.A prodotto e committed
- [ ] La domanda "cosa vede Claude Code all'inizio di una sessione
  di rework" ha una risposta precisa e testata
- [ ] Il formato del context document è definito
- [ ] I limiti di dimensione del contesto sono documentati
  (finestra di contesto di Claude, dimensione massima del TASK.md)

**SPIKE-C.01.A · Come ricostruire il contesto per il rework**
*Time-box: 4h*

Domande da rispondere:

Cosa costituisce il "contesto" di una task completata?
- La descrizione originale della task (già in `tasks.description`)
- Le decisioni architetturali prese dall'agente durante l'esecuzione
  (sono nei `task_events`? Sono nei log?)
- I file modificati e il diff finale (accessibile via GitHub API)
- I commenti lasciati dal founder sulla PR (accessibili via GitHub API)
- La cronologia degli eventi della task (da `task_events`)
- Il contenuto del CLAUDE.md del workspace (già sul VPS)

Come si passa questo contesto a Claude Code in una nuova sessione?
- Opzione A: si costruisce un file `REWORK.md` nella root del repo
  che contiene tutto il contesto, e Claude Code lo legge all'avvio
- Opzione B: si passa il contesto come prompt iniziale al comando
  Claude Code (se supportato)
- Opzione C: si usa la conversation history di Claude (se l'agente
  conserva l'ID della conversation originale)

Quali sono i limiti pratici?
- Un diff grande (migliaia di righe) supera la finestra di contesto?
- I commenti GitHub possono contenere immagini o allegati che non
  si possono serializzare?
- Quanto tempo impiega la costruzione del context document?

Output: `docs/spikes/spike-C1-rework-context.md` con risposte,
formato del context document scelto, e limitazioni documentate.

---

#### STORY-C.02 · ADR sul modello di context preservation

```
Come architect del sistema,
voglio documentare le decisioni su cosa preservare, dove conservarlo,
e per quanto tempo,
per avere un riferimento chiaro che impedisce decisioni incoerenti
durante l'implementazione.
```

**Criteri di accettazione**
- [ ] ADR-13 scritto e committed in `docs/adr/`
- [ ] Le domande chiave hanno risposta documentata:
  dove vive il context document (Supabase, VPS, S3),
  per quanto tempo viene conservato,
  cosa succede se la repo è stata modificata da altri tra l'esecuzione
  originale e il rework,
  come si gestisce il context document per rework multipli
  sulla stessa task (rework del rework)
- [ ] I trade-off tra completezza del contesto e dimensione sono
  documentati con valori concreti

**TASK-C.02.1** — Decidere dove conservare il context document:
opzioni sono colonna `context_snapshot` su `tasks` (JSON nel DB),
Storage Supabase (file object), o file sul VPS dell'agente. Valutare
dimensioni attese, accesso in lettura, e semplicità operativa.

**TASK-C.02.2** — Decidere la struttura del context document:
definire il formato preciso (Markdown? JSON? Combinazione?) con le
sezioni: descrizione originale, summary dell'implementazione prodotta
dall'agente, diff dei file principali modificati, commenti del founder,
istruzioni per il rework. Questo è il documento che Claude Code legge.

**TASK-C.02.3** — Definire la policy di retention: il context document
viene conservato per sempre? Per 90 giorni? Si elimina quando la
task viene cancellata? Allineare con la data retention policy di Sprint D.

**TASK-C.02.4** — Scrivere ADR-13 con decisioni e conseguenze.

---

#### STORY-C.03 · Modello dati per rework e iterazioni

```
Come architect del sistema,
voglio definire lo schema dati per tracciare i cicli di rework
di una task,
per poter mostrare al founder la storia completa di ogni iterazione.
```

**Criteri di accettazione**
- [ ] Schema delle nuove tabelle o colonne definito prima della migration
- [ ] Il modello supporta rework multipli sulla stessa task
  (rework del rework)
- [ ] Ogni iterazione ha la propria PR tracciata
- [ ] Il modello supporta entrambe le modalità di rework
  (GitHub-triggered e dashboard-driven)
- [ ] Migration script scritto e testato in locale

**TASK-C.03.1** — Definire la tabella `task_iterations`:
ogni esecuzione di una task (originale + ogni rework) è un record.
Campi: `task_id`, `iteration_number` (1 per l'originale, 2 per il
primo rework, etc.), `trigger` (enum: `initial` | `github_comment`
| `dashboard`), `triggered_by_user_id` (null se GitHub webhook),
`github_comment_ids` (array degli ID commenti che hanno triggerato
il rework, null se dashboard), `pr_url`, `pr_number`, `started_at`,
`completed_at`, `status`, `context_snapshot_url`.

**TASK-C.03.2** — Aggiornare la tabella `tasks` con i campi di
rework: `current_iteration` (intero, incrementato ad ogni rework),
`rework_count` (totale dei rework effettuati), `last_rework_trigger`.

**TASK-C.03.3** — Aggiornare gli eventi in `task_events` per
tracciare le iterazioni: ogni evento deve includere `iteration_number`
nel payload per poter distinguere nella timeline quali eventi
appartengono a quale ciclo.

---

### EPIC-C2 · Rework flow — design delle due modalità

**Descrizione**
Definire con precisione il flusso di entrambe le modalità di rework
prima di implementare qualsiasi cosa. Le due modalità hanno trigger
diversi, UX diversa, e comportamento leggermente diverso
dell'orchestratore — ma devono sembrare la stessa cosa all'utente.

---

#### STORY-C.04 · UX flow del rework GitHub-triggered

```
Come product designer (sono io),
voglio mappare il flusso esatto del rework triggerato da commenti GitHub,
dalla ricezione del webhook al momento in cui il founder
vede la nuova PR,
per costruire un flusso che sembra magico ma è completamente prevedibile.
```

**Criteri di accettazione**
- [ ] Documento `docs/ux/rework-github-flow.md` scritto
- [ ] Ogni passo del flusso è definito con responsabile e timing atteso
- [ ] I casi edge sono documentati: commento su PR già chiusa,
  commento di un utente non autorizzato, commento che non contiene
  istruzioni reali (es. "LGTM"), rework su task già in rework
- [ ] Il founder sa sempre in quale stato è la sua PR senza aprire GitHub

**TASK-C.04.1** — Documentare il flusso happy path GitHub-triggered:
```
1. Founder lascia commento su PR su GitHub
2. GitHub invia webhook a Robin (evento: pull_request_review_comment)
3. Robin valida il webhook (secret)
4. Robin identifica la task associata alla PR
5. Robin verifica che il commento provenga dal founder del workspace
6. Robin costruisce il context document per il rework
7. Robin avvia job BullMQ `task-rework` con context + commenti
8. Task passa a status=rework, iterazione corrente incrementata
9. Agente esegue il rework sulla base del context document
10. Agente aggiorna la PR (force-push sul branch esistente) o
    apre una nuova PR con suffisso `-v2`
11. Robin emette evento, notifica il founder
```
Per ogni passo: chi lo fa, quanto dura, cosa vede il founder.

**TASK-C.04.2** — Documentare i casi edge:
cosa succede se arrivano 3 commenti in rapida successione (entro
5 minuti)? Si fanno 3 rework separati o si aspetta che i commenti
si stabilizzino? Definire una finestra di debounce (es. 10 minuti:
se arrivano nuovi commenti entro 10 minuti dall'ultimo, si aspetta
prima di avviare il rework).

**TASK-C.04.3** — Definire la policy di autorizzazione dei commenti:
solo il founder del workspace può triggerare un rework via commento?
O chiunque abbia accesso alla repo? Documentare e implementare.

---

#### STORY-C.05 · UX flow del rework dashboard-driven

```
Come product designer (sono io),
voglio mappare il flusso del rework avviato dalla dashboard,
per costruire un'interfaccia che permette al founder di dare
istruzioni precise senza perdere il contesto della task.
```

**Criteri di accettazione**
- [ ] Documento `docs/ux/rework-dashboard-flow.md` scritto
- [ ] Il flusso è definito passo per passo con timing e feedback visivi
- [ ] La differenza tra "rework da dashboard" e "creare una nuova task"
  è chiara sia nel design che nella UX
- [ ] Il founder può vedere la storia completa della task prima di
  scrivere le istruzioni di rework

**TASK-C.05.1** — Documentare il flusso happy path dashboard-driven:
```
1. Founder apre la task detail dalla dashboard
2. Vede la timeline completa: descrizione originale, eventi di
   esecuzione, link alla PR, diff summary
3. Clicca "Avvia rework"
4. Si apre un form con: textarea per le istruzioni del rework
   (pre-compilata con i commenti GitHub se presenti),
   contesto dell'iterazione precedente visibile in read-only
5. Submit → Robin costruisce il context document e avvia il rework
6. La task passa a status=rework con feedback real-time
7. Il founder vede la timeline aggiornarsi man mano che l'agente lavora
```

**TASK-C.05.2** — Definire cosa mostra il form di rework dashboard:
il founder deve poter vedere, prima di scrivere le istruzioni:
la descrizione originale della task, il diff dei file modificati
(o almeno la lista dei file), i commenti GitHub già presenti,
l'iterazione corrente (es. "Stai avviando il rework #2").

**TASK-C.05.3** — Definire il comportamento post-rework:
la task torna a `in_review` quando l'agente completa il rework?
Si apre una nuova PR o si aggiorna quella esistente? Documentare
la policy e renderla visibile nella UI.

---

## FASE B — Implementazione

---

### EPIC-C3 · GitHub webhook integration

**Descrizione**
Robin deve ricevere eventi da GitHub in modo sicuro e affidabile.
Il webhook listener è un endpoint pubblico — va protetto, validato,
e reso robusto ai casi di errore. Un webhook perso significa un rework
che non parte.

---

#### STORY-C.06 · Webhook listener e validazione

```
Come sistema,
voglio un endpoint che riceva eventi GitHub in modo sicuro,
validi la firma, e instradi l'evento al handler corretto,
per non perdere nessun evento e non processare richieste non autorizzate.
```

**Criteri di accettazione**
- [ ] Route Handler `POST /api/webhooks/github` implementata
- [ ] Validazione firma HMAC-SHA256 con il webhook secret (ogni workspace
  ha il proprio secret configurato al momento della connessione GitHub)
- [ ] L'endpoint risponde 200 entro 3 secondi (GitHub si aspetta una
  risposta rapida — il processing reale avviene in background)
- [ ] Gli eventi non gestiti vengono loggati e ignorati senza errore
- [ ] Un evento non valido (firma errata) restituisce 401 e viene loggato
- [ ] Retry automatico in caso di fallimento del processing (BullMQ)

**TASK-C.06.1** — Implementare la validazione firma webhook:
GitHub invia l'header `X-Hub-Signature-256` con l'HMAC-SHA256 del
body firmato con il webhook secret. Verificare la firma prima di
processare qualsiasi payload. Se non corrisponde: 401, log, fine.

**TASK-C.06.2** — Implementare il routing degli eventi:
switch sullo header `X-GitHub-Event`. Gli eventi rilevanti sono:
`pull_request_review_comment` (commento su singola riga di diff),
`issue_comment` (commento generale sulla PR),
`pull_request` con action `closed` e `merged=true` (PR mergiata →
task passa a `done`). Tutti gli altri: log e 200.

**TASK-C.06.3** — Implementare la risoluzione workspace da webhook:
il payload GitHub contiene il `repository.full_name`. Fare lookup
su `repositories` per trovare il `workspace_id` associato.
Se non trovato: log e 200 (la repo non è gestita da Robin).

**TASK-C.06.4** — Implementare l'enqueue del job di processing:
dopo la validazione e il routing, inserire un job BullMQ
`github-webhook-processor` con il payload completo e restituire 200.
Il processing reale avviene nel worker, non nel Route Handler.

---

#### STORY-C.07 · Webhook per chiusura PR — task completata

```
Come sistema,
voglio che quando il founder mergia una PR su GitHub,
la task corrispondente venga automaticamente marcata come done,
per non dover aggiornare manualmente lo stato nel gestionale.
```

**Criteri di accettazione**
- [ ] Evento `pull_request` con `action=closed` e `merged=true`
  aggiorna la task corrispondente a `status=done`
- [ ] `completed_at` impostato sul record `task_iterations` corrente
- [ ] Evento `task.completed` emesso su `task_events`
- [ ] Se la PR viene chiusa senza merge (`merged=false`): la task
  torna a `in_review` con evento `task.pr_closed_without_merge`,
  notifica al founder
- [ ] La risoluzione task da PR number è robusta: lookup su
  `task_iterations.pr_number` + `repository_id`

**TASK-C.07.1** — Implementare `handlePullRequestClosed(payload)`:
handler che riceve il payload dell'evento, determina se è un merge
o una chiusura senza merge, aggiorna lo stato della task e
dell'iterazione, emette l'evento appropriato.

**TASK-C.07.2** — Implementare il lookup task da PR:
query `task_iterations` per `pr_number` + `repository_id`. Se trovato:
aggiornare task e iterazione. Se non trovato: log e ignorare
(PR non gestita da Robin).

**TASK-C.07.3** — Aggiornare la dashboard in real-time al merge:
quando una task passa a `done` via webhook, la dashboard e la pagina
sprint attivo devono aggiornarsi via Supabase Realtime senza refresh.

---

#### STORY-C.08 · Webhook per commenti PR — trigger rework

```
Come sistema,
voglio che i commenti del founder su una PR triggerino automaticamente
un rework con debounce,
per non avviare rework multipli per commenti lasciati in rapida successione.
```

**Criteri di accettazione**
- [ ] Evento `pull_request_review_comment` e `issue_comment` processati
- [ ] Verifica che il commento provenga dal founder del workspace
  (confronto `github_user_id` del sender con quello in `github_connections`)
- [ ] Debounce implementato: se arrivano commenti entro una finestra
  configurabile (default 10 minuti), si aspetta la fine della finestra
  prima di avviare il rework
- [ ] Il rework viene avviato una sola volta con tutti i commenti
  della finestra di debounce
- [ ] Se la task è già in `rework`: i nuovi commenti vengono accodati
  e processati dopo il completamento del rework corrente

**TASK-C.08.1** — Implementare `handlePullRequestComment(payload)`:
verifica autore, identifica task, implementa debounce con BullMQ
(job con delay e deduplicazione per PR: se esiste già un job pending
per quella PR, aggiorna il payload accumulando i commenti invece
di aggiungere un nuovo job).

**TASK-C.08.2** — Implementare l'accumulo commenti durante il debounce:
usare il meccanismo di update job di BullMQ per aggiornare il payload
del job pending con i nuovi commenti. Al termine del delay, il job
contiene tutti i commenti della finestra.

**TASK-C.08.3** — Implementare la gestione del caso "task già in rework":
se la task è in `status=rework` quando arrivano nuovi commenti,
salvare i commenti in un campo `pending_rework_comments` sul record
task. Quando il rework corrente completa, avviare automaticamente
il rework successivo con quei commenti.

---

### EPIC-C4 · Rework engine

**Descrizione**
Il rework engine è l'orchestratore del rework: costruisce il contesto,
avvia l'agente nella modalità corretta, e gestisce il ciclo di vita
dell'iterazione. È la parte più delicata dello sprint — sbagliare
il contesto significa agente che lavora alla cieca.

---

#### STORY-C.09 · Context document builder

```
Come sistema,
voglio un componente che costruisce il context document completo
per una sessione di rework,
per garantire che l'agente abbia tutte le informazioni necessarie
senza che il founder debba rispiegare nulla.
```

**Criteri di accettazione**
- [ ] `ContextDocumentBuilder` implementato come funzione pura testabile
- [ ] Il context document include tutte le sezioni definite in ADR-13
- [ ] La costruzione non fallisce se alcune sezioni non sono disponibili
  (es. diff non raggiungibile da GitHub API): include quello che riesce
  e logga le sezioni mancanti
- [ ] La dimensione del context document è verificata: se supera il
  limite definito in SPIKE-C.01.A, viene troncato con priorità
  alle sezioni più rilevanti (commenti founder > diff > eventi)
- [ ] Il context document viene persistito secondo la strategia definita in ADR-13

**TASK-C.09.1** — Implementare `buildContextDocument(taskId, iterationId)`:
funzione che assembla il context document. Recupera da Supabase:
descrizione task, eventi dell'iterazione originale. Recupera da
GitHub API: diff della PR, commenti sulla PR. Assembla nel formato
definito in ADR-13.

**TASK-C.09.2** — Implementare il recupero del diff da GitHub API:
chiamata `GET /repos/{owner}/{repo}/pulls/{pull_number}/files`
per ottenere la lista dei file modificati con patch. Limitare il diff
incluso a N file o N righe totali per evitare superamento della
finestra di contesto (valore definito dallo spike).

**TASK-C.09.3** — Implementare il recupero dei commenti da GitHub API:
chiamata `GET /repos/{owner}/{repo}/pulls/{pull_number}/comments`
per i commenti inline e
`GET /repos/{owner}/{repo}/issues/{pull_number}/comments`
per i commenti generali. Aggregare e ordinare per data.

**TASK-C.09.4** — Implementare la persistenza del context document:
secondo la strategia definita in ADR-13 (Supabase Storage o colonna JSON).
Aggiornare `task_iterations.context_snapshot_url` con il riferimento.

**TASK-C.09.5** — Implementare la gestione dei rework multipli:
se la task è al suo secondo rework, il context document include
anche il summary dell'iterazione precedente. La profondità del
contesto storico è configurabile (default: ultime 2 iterazioni).

---

#### STORY-C.10 · Job di rework — esecuzione dell'agente

```
Come sistema,
voglio un job BullMQ che gestisce l'esecuzione di un ciclo di rework,
dalla preparazione dell'ambiente al completamento dell'iterazione,
per garantire che il rework sia affidabile quanto l'esecuzione originale.
```

**Criteri di accettazione**
- [ ] Job `task-rework` implementato in BullMQ
- [ ] Il job incrementa `task_iterations.iteration_number` e crea
  il record della nuova iterazione
- [ ] Il job aggiorna il branch esistente (o crea un branch `-v{n}`)
  prima di avviare l'agente
- [ ] L'agente riceve il context document come parte del suo ambiente
  di avvio (file `REWORK.md` nella root del repo o equivalente
  definito nello spike)
- [ ] Il job emette eventi per ogni passo significativo
- [ ] Timeout e retry configurati come per il job di esecuzione originale

**TASK-C.10.1** — Implementare `TaskReworkWorker` BullMQ:
sequenza del job:
1. Creare record `task_iterations` per la nuova iterazione
2. Chiamare `buildContextDocument(taskId, newIterationId)`
3. Preparare il contesto sul VPS dell'agente (copia il context document)
4. Avviare Claude Code con le istruzioni di rework
5. Monitorare l'esecuzione e emettere eventi
6. Al completamento: aggiornare la PR o aprire nuova PR, aggiornare
   lo stato della task e dell'iterazione

**TASK-C.10.2** — Implementare la preparazione del branch per il rework:
decidere e implementare la strategia di branch: si lavora sullo stesso
branch con force-push (più pulito, sovrascrive la storia) o si crea
un nuovo branch `feature/task-{id}-v{n}` con una nuova PR (più
tracciabile). La scelta deve essere documentata con i trade-off.

**TASK-C.10.3** — Implementare la consegna del context document
all'agente: copiare il file `REWORK.md` nella root del repository
sul VPS prima di avviare Claude Code. Il file viene eliminato al
completamento del rework (non va committato).

**TASK-C.10.4** — Implementare le istruzioni di avvio per il rework:
il prompt iniziale che riceve Claude Code deve essere diverso da
quello dell'esecuzione originale. Deve riferirsi esplicitamente
al `REWORK.md` e alle istruzioni specifiche del rework. Definire
il template del prompt di rework in `docs/prompts/rework.md`.

---

#### STORY-C.11 · Gestione errori del rework

```
Come sistema,
voglio che i fallimenti durante un rework siano gestiti in modo
prevedibile e comunicati chiaramente al founder,
per non lasciare la task in uno stato inconsistente.
```

**Criteri di accettazione**
- [ ] Se il rework fallisce: task torna a `in_review` (non a `failed`
  — l'esecuzione originale era valida), evento `task.rework_failed`
  emesso, notifica al founder con dettaglio dell'errore
- [ ] Se l'agente va offline durante il rework: stesso comportamento
  del fallimento, con messaggio specifico "Agente offline durante rework"
- [ ] I tentativi di rework falliti sono visibili nella timeline
  della task come iterazioni con `status=failed`
- [ ] Il founder può ritentare il rework dalla dashboard dopo un fallimento

**TASK-C.11.1** — Implementare la gestione del fallimento nel
`TaskReworkWorker`: catch di ogni tipo di errore (timeout, agente
offline, GitHub API error), transizione di stato corretta, emissione
dell'evento appropriato.

**TASK-C.11.2** — Implementare il bottone "Riprova rework" nella
task detail: visibile quando l'iterazione corrente è in `status=failed`.
Avvia un nuovo job `task-rework` con le stesse istruzioni dell'iterazione
fallita.

---

### EPIC-C5 · Context preservation e task memory

**Descrizione**
Il contesto non è solo per il rework. È la memoria permanente di ogni
task — quello che permette al founder di capire, anche mesi dopo,
perché l'agente ha fatto certe scelte. Questo epic costruisce
la memoria delle task in modo strutturato e accessibile.

---

#### STORY-C.12 · Summary automatico dell'esecuzione

```
Come sistema,
voglio che l'agente produca un summary strutturato al termine
di ogni esecuzione,
per avere un documento leggibile di cosa è stato fatto
e perché, senza dover scorrere 200 eventi di log.
```

**Criteri di accettazione**
- [ ] Al termine di ogni esecuzione (originale e rework), l'agente
  produce un file `SUMMARY.md` nella root del repo
- [ ] Il summary contiene: cosa è stato fatto, file modificati con
  motivazione, decisioni architetturali prese, limitazioni incontrate,
  suggerimenti per iterazioni future
- [ ] Il contenuto di `SUMMARY.md` viene estratto e persistito su
  `task_iterations.summary` prima che il file venga eliminato dal repo
- [ ] Il summary è visibile nella task detail in una sezione dedicata
- [ ] Il summary viene incluso nel context document del prossimo rework

**TASK-C.12.1** — Aggiungere l'istruzione di produzione del summary
al prompt di chiusura dell'agente: al termine del lavoro, Claude Code
deve scrivere `SUMMARY.md` seguendo un template definito.
Definire il template in `docs/prompts/summary-template.md`.

**TASK-C.12.2** — Implementare l'estrazione del summary dall'orchestratore:
dopo il completamento dell'esecuzione, leggere `SUMMARY.md` dal VPS
(via SSH o via file system se l'orchestratore è sullo stesso VPS),
persistere il contenuto su `task_iterations.summary`, eliminare il file.

**TASK-C.12.3** — Implementare la visualizzazione del summary nella
task detail: sezione "Cosa ha fatto l'agente" con il testo del summary
renderizzato come Markdown. Visibile per ogni iterazione completata.

---

#### STORY-C.13 · Task memory — contesto persistente per repo

```
Come sistema,
voglio che le informazioni apprese durante le task precedenti
su una repository siano accessibili alle esecuzioni future,
per evitare che l'agente ripeta gli stessi errori o ignori
convenzioni già stabilite.
```

**Criteri di accettazione**
- [ ] Esiste un meccanismo per annotare convenzioni e pattern specifici
  di una repository, accessibili a tutte le esecuzioni future
- [ ] Il founder può modificare queste annotazioni dalla dashboard
- [ ] Le annotazioni vengono incluse nel context document di ogni
  nuova esecuzione per quella repository
- [ ] Le annotazioni sono distinte dal `CLAUDE.md` (che è generico
  per il workspace) — riguardano pattern specifici della repo

**TASK-C.13.1** — Definire e implementare la tabella `repository_memory`:
campi: `repository_id`, `key` (es. "testing_conventions", "naming_patterns"),
`content` (Markdown), `created_at`, `updated_at`.

**TASK-C.13.2** — Implementare la UI per la gestione della repository memory:
sezione nella pagina dettaglio repository con lista delle annotazioni,
editing inline, aggiunta nuova annotazione. Interfaccia semplice —
non un editor complesso.

**TASK-C.13.3** — Integrare la repository memory nel context document:
`buildContextDocument()` include le annotazioni della repository target
in una sezione dedicata del context document.

---

### EPIC-C6 · Dashboard-driven rework

**Descrizione**
La modalità di rework dalla dashboard è il flusso che il founder usa
quando vuole più controllo rispetto al trigger automatico GitHub.
Deve permettere di vedere tutto il contesto prima di scrivere
le istruzioni, e di avviare il rework con piena consapevolezza.

---

#### STORY-C.14 · Form di rework dalla dashboard

```
Come founder,
voglio poter avviare un rework di una task direttamente dalla dashboard,
con accesso al contesto completo della task,
per dare istruzioni precise all'agente senza dover tornare su GitHub.
```

**Criteri di accettazione**
- [ ] Bottone "Avvia rework" visibile nella task detail quando la task
  è in `status=in_review` o `status=done`
- [ ] Click apre un pannello con: summary dell'iterazione corrente,
  link alla PR, diff summary (lista file modificati), commenti GitHub
  già presenti (se esistono), textarea per le nuove istruzioni
- [ ] Le nuove istruzioni si aggiungono ai commenti GitHub esistenti
  (non li sostituiscono)
- [ ] Submit avvia il job `task-rework` con trigger `dashboard`
- [ ] Feedback real-time: la task passa a `status=rework` con
  timeline aggiornata

**TASK-C.14.1** — Implementare `ReworkPanel`:
componente che si apre come drawer o section espandibile nella task
detail. Layout: colonna sinistra con contesto (summary, diff, commenti),
colonna destra con textarea istruzioni e bottone submit. Su mobile:
layout a schede (tab Contesto / tab Istruzioni).

**TASK-C.14.2** — Implementare `DiffSummary`:
componente che mostra la lista dei file modificati nella PR corrente
con: nome file, tipo di modifica (added/modified/deleted), numero
di righe aggiunte/rimosse. Non il diff completo — solo la panoramica.
Dati recuperati da GitHub API al momento dell'apertura del panel.

**TASK-C.14.3** — Implementare Route Handler
`POST /api/tasks/{taskId}/rework`:
valida che la task sia in stato rework-eligible (`in_review` o `done`),
crea il record della nuova iterazione, avvia il job BullMQ `task-rework`
con trigger `dashboard` e le istruzioni fornite.

**TASK-C.14.4** — Implementare il feedback in tempo reale durante
il rework dashboard-driven: subscription Supabase Realtime sulla
task detail che aggiorna la timeline man mano che arrivano eventi
dal job di rework. Il founder può seguire il progresso senza lasciare
la pagina.

---

#### STORY-C.15 · Storico iterazioni nella task detail

```
Come founder,
voglio vedere la storia completa di ogni iterazione di una task —
originale e tutti i rework — in un'unica vista,
per capire l'evoluzione del lavoro e cosa ha cambiato ogni rework.
```

**Criteri di accettazione**
- [ ] Sezione "Iterazioni" nella task detail con lista di tutte
  le iterazioni in ordine cronologico
- [ ] Ogni iterazione mostra: numero iterazione, trigger (iniziale /
  commenti GitHub / dashboard), data, stato, link alla PR,
  summary dell'agente
- [ ] Click su un'iterazione espande i dettagli: eventi della timeline,
  commenti che hanno triggerato il rework (se GitHub-triggered),
  istruzioni del founder (se dashboard-driven)
- [ ] L'iterazione corrente è evidenziata
- [ ] Se esistono più iterazioni, la navigazione tra di esse è intuitiva

**TASK-C.15.1** — Aggiornare `TaskDetailPage` con la sezione iterazioni:
query che recupera tutte le `task_iterations` per la task, ordinate
per `iteration_number`.

**TASK-C.15.2** — Implementare `IterationCard`:
card espandibile per ogni iterazione con i dati definiti nei criteri
di accettazione. Stato con badge colorato (completata, fallita,
in corso, in rework).

**TASK-C.15.3** — Implementare `IterationTimeline`:
al click su una iterazione, mostrare la sua timeline di eventi
filtrata per `iteration_number`. Riutilizzare i componenti
della timeline esistente di Sprint 3.

---

### EPIC-C7 · Task history e audit trail

**Descrizione**
Ogni azione su una task — creazione, modifica, esecuzione, rework,
commento, merge — deve essere tracciata in modo permanente e accessibile.
Non è un log tecnico: è la storia leggibile di come un pezzo di
lavoro è stato portato a termine.

---

#### STORY-C.16 · Timeline completa della task

```
Come founder,
voglio che la timeline di ogni task mostri la storia completa
dall'inizio alla fine, in linguaggio naturale e non come raw log,
per poter rispondere alla domanda "cosa è successo su questa task?"
in meno di 30 secondi.
```

**Criteri di accettazione**
- [ ] La timeline mostra eventi di tutte le iterazioni, raggruppati
  per iterazione con separatori visivi chiari
- [ ] Gli eventi sono in linguaggio naturale: "L'agente ha aperto la PR #42",
  "Il founder ha lasciato 3 commenti", "Rework completato — PR aggiornata"
- [ ] Gli eventi tecnici (ogni singolo commit, ogni API call) non
  appaiono nella timeline principale — sono accessibili in una vista
  "Dettaglio tecnico" collassabile
- [ ] La timeline è ordinata per tempo, con timestamp relativi per
  gli eventi recenti e timestamp assoluti per quelli vecchi
- [ ] La timeline funziona sia per task completate (statica) che per
  task in corso (real-time)

**TASK-C.16.1** — Definire il catalogo completo degli eventi visibili
nella timeline: per ogni tipo di evento in `task_events`, definire
il testo in linguaggio naturale da mostrare. Documentare in
`docs/events/timeline-copy.md`. Esempio:
- `agent.execution.started` → "L'agente ha iniziato a lavorare"
- `agent.pr.opened` → "PR aperta: {pr_title} (#{pr_number})"
- `github.comment.received` → "Il founder ha lasciato {n} commenti sulla PR"
- `task.rework.started` → "Rework #{n} avviato"
- `agent.pr.updated` → "PR aggiornata dopo il rework"
- `github.pr.merged` → "PR mergiata — task completata"

**TASK-C.16.2** — Aggiornare il componente timeline di Sprint 3
per supportare il raggruppamento per iterazione: aggiungere separatori
visivi tra le iterazioni con label "Esecuzione originale",
"Rework #1", "Rework #2", etc.

**TASK-C.16.3** — Implementare la vista "Dettaglio tecnico"
collassabile: sezione opzionale che mostra tutti gli eventi raw
(inclusi quelli tecnici normalmente nascosti) per il debugging.
Di default collassata.

---

#### STORY-C.17 · Audit trail delle azioni del founder

```
Come sistema,
voglio tracciare ogni azione del founder sulla task —
non solo le azioni dell'agente —
per avere un audit trail completo e poter ricostruire
qualsiasi scenario in caso di problemi.
```

**Criteri di accettazione**
- [ ] Le seguenti azioni del founder vengono tracciate come eventi:
  creazione task, modifica descrizione, aggiunta a sprint, avvio rework
  da dashboard, cancellazione task
- [ ] Gli eventi del founder sono distinguibili dagli eventi dell'agente
  nella timeline (icona o colore diverso)
- [ ] L'audit trail non è modificabile — nemmeno dal founder
- [ ] Gli eventi includono: `user_id`, timestamp, tipo azione,
  payload (es. vecchio e nuovo valore per le modifiche)

**TASK-C.17.1** — Implementare `trackUserAction(userId, taskId, action, payload)`:
funzione che scrive un evento `user.*` su `task_events`. Chiamata
dai Route Handler nelle azioni rilevanti del founder.

**TASK-C.17.2** — Aggiungere il tracking alle azioni esistenti:
- `POST /api/tasks` → `user.task.created`
- `PATCH /api/tasks/{id}` → `user.task.updated` con diff dei campi
- `POST /api/tasks/bulk` → `user.tasks.bulk_updated`
- `POST /api/tasks/{id}/rework` → `user.rework.initiated`

**TASK-C.17.3** — Aggiornare la visualizzazione nella timeline:
eventi `user.*` mostrati con icona founder (avatar o icona persona)
per distinguerli dagli eventi `agent.*`.

---

## Definition of Done — Sprint C

Lo sprint è completato quando **tutti** i seguenti criteri sono soddisfatti:

**GitHub webhook**
- [ ] Webhook listener funzionante su account GitHub reale
- [ ] Validazione firma HMAC-SHA256 testata con richieste valide e invalide
- [ ] Evento merge PR → task `done` funzionante end-to-end
- [ ] Evento commento PR → rework avviato funzionante end-to-end

**Rework engine**
- [ ] Context document costruito con diff, commenti, eventi, summary
- [ ] Rework GitHub-triggered testato end-to-end su PR reale con commenti reali
- [ ] Rework dashboard-driven testato end-to-end
- [ ] Rework del rework (iterazione #3) testato
- [ ] Fallimento durante rework gestito: task torna a `in_review`

**Context preservation**
- [ ] Summary prodotto dall'agente al termine di ogni esecuzione
- [ ] Summary visibile nella task detail
- [ ] Repository memory implementata e inclusa nel context document
- [ ] Context document dimensionato entro i limiti della finestra di contesto

**Dashboard**
- [ ] Form rework con contesto completo visibile prima delle istruzioni
- [ ] Timeline con iterazioni raggruppate e differenziate
- [ ] Storico iterazioni navigabile nella task detail
- [ ] Audit trail azioni founder visibile nella timeline

**Il test finale — ciclo completo con rework reale:**
Partendo da una task completata con PR reale su GitHub:
- Lasciare 2 commenti sulla PR su GitHub
- Attendere il debounce (10 minuti) e verificare che il rework parta
- Verificare che l'agente usi il context document (controllare che
  i commenti siano stati indirizzati nella nuova PR)
- Aprire la task detail e verificare che la timeline mostri
  l'iterazione originale e il rework #1 con separatori chiari
- Avviare un secondo rework dalla dashboard con istruzioni aggiuntive
- Verificare che il context document includa anche la storia del rework #1

Se uno step non funziona su dati reali (non su mock), lo sprint non è finito.

---

## Stima effort

| Epic | Scope | Effort stimato |
|---|---|---|
| EPIC-C1 · Context model design | Spike, ADR, modello dati iterazioni | ~7h |
| EPIC-C2 · Rework flow design | UX flow GitHub e dashboard | ~4h |
| EPIC-C3 · GitHub webhook integration | Listener, validazione, routing, handlers | ~7h |
| EPIC-C4 · Rework engine | Context builder, job rework, gestione errori | ~10h |
| EPIC-C5 · Context preservation | Summary agente, repository memory | ~6h |
| EPIC-C6 · Dashboard-driven rework | Form rework, diff summary, real-time | ~7h |
| EPIC-C7 · Task history e audit trail | Timeline iterazioni, audit trail founder | ~5h |
| **Totale stimato** | | **~46h** |

L'Epic C4 (rework engine) è il più critico. La costruzione del context
document e la sua consegna corretta all'agente sono il punto di rischio
principale. Lo spike in Fase A esiste esattamente per ridurre
l'incertezza prima di iniziare l'implementazione.

---

## Rischi specifici di questo sprint

| Rischio | Probabilità | Mitigazione |
|---|---|---|
| Il context document supera la finestra di contesto di Claude | Media | SPIKE-C.01.A misura i limiti empiricamente e definisce la strategia di troncamento. Non si implementa il builder senza questa risposta |
| GitHub limita le chiamate API durante la costruzione del context document | Bassa | Rate limit GitHub API: 5000 richieste/ora per token autenticato. Per i primi clienti non è un problema. Aggiungere caching del diff se necessario |
| Il webhook GitHub non arriva (timeout, retry di GitHub falliti) | Bassa | GitHub ritenta il webhook per 72 ore in caso di mancata risposta. L'endpoint deve rispondere 200 in < 3 secondi — il processing reale è asincrono |
| Rework su branch con conflitti rispetto a main | Media | L'agente deve fare `git pull --rebase` prima di iniziare il rework. Documentare nel prompt di rework. Se il rebase fallisce: evento `task.rework_conflict`, notifica al founder con istruzioni per risoluzione manuale |
| Il founder lascia commenti non pertinenti al rework (es. "ottimo lavoro!") che triggerano un rework inutile | Media | Valutare se aggiungere un layer di classificazione del commento (è un'istruzione di rework?) prima di avviare il job. Alternativa più semplice: bottone "Ignora commenti" nella dashboard che blocca il rework in debounce |
| Rework multipli in parallelo sulla stessa repo violano la queue per repo | Bassa | Il `RepoQueueWorker` di Sprint B gestisce già questo caso — il rework viene inserito nella stessa queue della repo, rispettando la sequenzialità |

---

## Collegamento con gli altri sprint

**Dipende da Sprint A e Sprint B:**
Agenti online, PR reali aperte su GitHub, task events popolati,
notifiche funzionanti. Il rework engine assume che esista almeno
una PR reale con commenti da processare.

**Prepara Sprint D:**
Sprint D (multi-tenancy e provisioning automatico) è il passaggio
finale alla production. Richiede che il prodotto sia stabile e
completo nelle sue feature core. Sprint C chiude l'ultimo gap funzionale
— dopo Sprint C, Robin.dev ha tutto quello che serve per essere
usato da clienti reali. Sprint D lo rende scalabile a più di uno.

---

*Robin.dev · Sprint C Backlog v1.0 · Carlo Ferrero · Febbraio 2026*
