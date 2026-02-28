# Robin.dev — Sprint B Backlog
## Backlog Management + Sprint Planning

**Versione 1.0 · Carlo Ferrero · Febbraio 2026**

---

## Obiettivo dello sprint

Il founder può gestire centinaia di task in backlog, organizzarle in
sprint, e avviare l'esecuzione con un click. Gli agenti iniziano a
lavorare in modo autonomo e sequenziale, senza intervento manuale.

Al termine di questo sprint, Robin.dev ha un cuore di prodotto
funzionante: non è più un sistema per eseguire task singole — è un
sistema per gestire la delivery di un team.

**Cosa ottieni concretamente alla fine:**
Il founder apre Robin.dev il lunedì mattina. Ha 40 task in backlog
accumulate nelle ultime settimane — alcune scritte ieri, alcune di un
mese fa, alcune ancora vaghe. Le affina, sceglie quelle giuste per
la settimana, le trascina nello sprint e clicca "Avvia Sprint". Gli
agenti iniziano a prenderle in carico una alla volta per repository,
in sequenza. Il founder chiude il laptop. Mercoledì ha tre notifiche
di PR pronte. Non ha parlato con nessun agente. Non ha aperto nessun
terminale.

Questo è il value proposition centrale di Robin.dev. Tutto quello che
c'era prima era infrastruttura. Questo è il prodotto.

---

## Prerequisiti da Sprint A

Prima di iniziare, verificare che siano soddisfatti:

- [ ] GitHub OAuth funzionante su account reale
- [ ] Almeno un agente online con repository assegnata
- [ ] Provisioning automatico VPS testato end-to-end
- [ ] Dashboard multi-agente aggiornata e stabile
- [ ] BullMQ + Redis funzionanti con job di provisioning in produzione

Se non esiste almeno un agente online con una repo reale assegnata,
Sprint B non inizia. Non si può testare il routing delle task senza
un agente reale.

---

## Struttura del backlog

```
Sprint B
├── FASE A — Analisi e Design
│   ├── EPIC-B1 · Data model backlog e sprint
│   └── EPIC-B2 · UX flow backlog e sprint planning
└── FASE B — Implementazione
    ├── EPIC-B3 · Backlog management
    ├── EPIC-B4 · Task creation avanzata
    ├── EPIC-B5 · Sprint management
    ├── EPIC-B6 · Execution engine — queue per repo
    └── EPIC-B7 · Notifiche e visibilità dell'esecuzione
```

---

## Una nota sulla natura di questo sprint

Sprint A ha costruito l'infrastruttura di setup. Sprint B costruisce
il loop principale di utilizzo — quello che il founder ripete ogni
settimana. È il flusso che decide se il prodotto è utile o no.

Il rischio principale non è tecnico. È di product design. Un backlog
mal progettato diventa un secondo Jira — un posto dove le task vanno
a morire invece che a essere smaltite. Lo sprint planning mal progettato
diventa un overhead invece che un acceleratore.

Il principio guida è: **il sistema deve togliere frizione, non aggiungerla**.
Creare una task deve costare meno di 60 secondi. Avviare uno sprint deve
costare meno di 5 minuti. Se richiede di più, il design è sbagliato.

---

## FASE A — Analisi e Design

---

### EPIC-B1 · Data model backlog e sprint

**Descrizione**
Definire lo schema dati per backlog e sprint prima di toccare il codice.
Le decisioni prese qui condizionano tutto il resto dello sprint —
sbagliare il modello significa migrare il database a metà implementazione.

---

#### STORY-B.01 · Modello dati per task e backlog

```
Come architect del sistema,
voglio definire lo schema completo per task, backlog e sprint,
per non dover fare migration correttive durante l'implementazione.
```

**Criteri di accettazione**
- [ ] Schema delle tabelle nuove o modificate definito e discusso
  prima di scrivere migration
- [ ] La tabella `tasks` copre tutti i campi necessari per backlog,
  sprint, esecuzione e rework
- [ ] Le relazioni tra `tasks`, `sprints`, `agents`, `repositories`
  sono normalizzate e prive di ambiguità
- [ ] I campi di stato sono definiti come enum PostgreSQL con tutti
  i valori possibili documentati
- [ ] Migration script scritto e testato in locale
- [ ] RLS policies per le nuove tabelle definite

**TASK-B.01.1** — Definire e finalizzare la tabella `tasks`:
rivedere lo schema esistente e aggiungere i campi mancanti per
supportare il nuovo modello. Campi da aggiungere o verificare:
`sprint_id` (nullable — null significa backlog), `repository_id`
(quale repo deve usare l'agente per questa task), `agent_id`
(nullable — assegnato al momento dell'esecuzione, non alla creazione),
`task_type` (enum: `feature` | `bug` | `refactor` | `chore` |
`accessibility` | `security` | `docs`), `priority` (enum: `critical`
| `high` | `medium` | `low`), `status` (enum esteso: `backlog` |
`sprint_ready` | `queued` | `in_progress` | `in_review` | `rework` |
`done` | `cancelled` | `failed`), `sprint_order` (intero, posizione
nella coda dello sprint), `context` (testo libero aggiuntivo oltre
la description — note, link, screenshot di riferimento), `estimated_effort`
(enum opzionale: `xs` | `s` | `m` | `l`).

**TASK-B.01.2** — Definire la tabella `sprints`:
campi: `workspace_id`, `name` (es. "Sprint 2026-W10"), `status`
(enum: `planning` | `active` | `completed` | `cancelled`),
`started_at`, `completed_at`, `goal` (testo libero — obiettivo
dello sprint in una frase).

**TASK-B.01.3** — Verificare e aggiornare gli indici per le query
frequenti: `(workspace_id, status)` su tasks per il backlog,
`(sprint_id, sprint_order)` per la coda ordinata dello sprint,
`(repository_id, status)` per la queue per repo.

**TASK-B.01.4** — Scrivere le RLS policies per le nuove tabelle:
`sprints` visibili solo al workspace owner. Task già coperte — verificare
che `sprint_id` e `repository_id` non aprano vettori di accesso cross-workspace.

**TASK-B.01.5** — Scrivere e testare la migration in ambiente locale.
Verificare che i dati esistenti (task create negli sprint precedenti)
non vengano corrotti.

---

#### STORY-B.02 · ADR sul modello di stato delle task

```
Come architect del sistema,
voglio documentare il ciclo di vita completo di una task
e le transizioni di stato valide,
per avere un riferimento che impedisce stati inconsistenti
durante l'implementazione.
```

**Criteri di accettazione**
- [ ] ADR-12 scritto e committed in `docs/adr/`
- [ ] Grafo delle transizioni di stato documentato: da quale stato
  si può passare a quale, chi triggera la transizione (utente/sistema/agente)
- [ ] I casi edge documentati: task cancellata mentre in esecuzione,
  sprint chiuso con task ancora in coda, agente che va offline
  durante un'esecuzione
- [ ] Le transizioni invalide sono documentate e il sistema le rifiuta

**TASK-B.02.1** — Disegnare il grafo delle transizioni di stato:
```
backlog
  └→ sprint_ready    [utente: aggiunge a sprint]
       └→ queued         [sistema: sprint avviato]
            └→ in_progress    [sistema: agente prende in carico]
                 ├→ in_review      [agente: PR aperta]
                 │    ├→ rework        [utente/sistema: commenti PR]
                 │    │    └→ in_review   [agente: nuova PR]
                 │    └→ done           [utente: merge]
                 └→ failed        [sistema: agente in errore]

backlog → cancelled    [utente: in qualsiasi momento prima di queued]
sprint_ready → backlog [utente: rimuove dallo sprint]
queued → cancelled     [utente: con warning — agente già assegnato?]
```

**TASK-B.02.2** — Documentare chi triggera ogni transizione e
il meccanismo: webhook GitHub (merge → done), orchestratore (in_progress,
failed), utente via dashboard (sprint_ready, cancelled, rework).

**TASK-B.02.3** — Scrivere ADR-12 con grafo, transizioni, casi edge
e policy per stati inconsistenti.

---

### EPIC-B2 · UX flow backlog e sprint planning

**Descrizione**
Prima di costruire la UI, definire esattamente come si usa il backlog
e lo sprint planning. L'output è un documento di UX flow che guida
tutta la Fase B, eliminando le decisioni di product durante il coding.

---

#### STORY-B.03 · UX flow del backlog

```
Come product designer (sono io),
voglio mappare il flusso completo di gestione del backlog,
per costruire un'interfaccia che non diventa un secondo Jira.
```

**Criteri di accettazione**
- [ ] Documento `docs/ux/backlog-flow.md` scritto
- [ ] Ogni azione nel backlog è definita: creare task, affinare task,
  riordinare, filtrare, spostare in sprint
- [ ] La densità della lista backlog è definita: quante informazioni
  mostrare per task senza sovraccaricare
- [ ] Il caso "backlog vuoto" è progettato: non una pagina bianca ma
  una call to action chiara
- [ ] Il caso "backlog con 100+ task" è progettato: come si naviga
  senza perdersi

**TASK-B.03.1** — Definire la struttura della pagina backlog:
sezioni (es. "Da affinare", "Pronte per sprint", "Tutte"), ordinamento
default, filtri disponibili (tipo, priorità, repository, effort stimato).

**TASK-B.03.2** — Definire il flusso di creazione rapida task:
l'obiettivo è < 60 secondi. Cosa si inserisce obbligatoriamente (titolo,
repository target), cosa è opzionale (descrizione, tipo, priorità, effort).
La task può essere creata "grezza" e affinata dopo — questo è il punto.

**TASK-B.03.3** — Definire il flusso di affinamento task:
il founder torna su una task creata giorni fa e la completa. Come apre
il dettaglio, quali campi modifica, come salva. L'editing deve essere
inline dove possibile — nessun modale per cambiare una priorità.

**TASK-B.03.4** — Definire il flusso di spostamento in sprint:
drag-and-drop? Checkbox + azione bulk? Bottone contestuale su ogni task?
Scegliere un pattern e documentarlo. Considerare il caso mobile.

---

#### STORY-B.04 · UX flow dello sprint planning e dell'avvio sprint

```
Come product designer (sono io),
voglio definire come funziona lo sprint planning e l'avvio,
per costruire un flusso che riduce l'attrito invece di aggiungerlo.
```

**Criteri di accettazione**
- [ ] Documento `docs/ux/sprint-flow.md` scritto
- [ ] Il flusso da "backlog" a "sprint avviato" è definito passo per passo
- [ ] Il concetto di sprint è spiegabile in una frase a un founder
  che non ha mai usato Robin
- [ ] L'avvio sprint è una singola azione con un effetto chiaro e visibile
- [ ] Il caso "sprint con task su repo diverse" è progettato:
  come si vede quale agente prende quale task

**TASK-B.04.1** — Definire il ciclo di vita di uno sprint in Robin:
quanto dura? È a durata fissa (es. 1 settimana) o libera? Il founder
può avere più sprint in planning e uno solo attivo? Queste decisioni
impattano il modello dati — vanno prese in Fase A.

**TASK-B.04.2** — Definire la vista sprint planning:
la board o la lista dove il founder vede le task dello sprint in
stato `sprint_ready`, può riordinarle, può rimuoverle prima dell'avvio.

**TASK-B.04.3** — Definire cosa succede visivamente al click su
"Avvia Sprint": quali feedback immediati riceve il founder? Come
vede le task diventare `queued` e poi `in_progress`? Come capisce
quale agente ha preso quale task?

**TASK-B.04.4** — Definire la chiusura dello sprint: quando si chiude
uno sprint? Automaticamente quando tutte le task sono done/cancelled/failed?
Manualmente dal founder? Cosa succede alle task non completate
(rimangono nel backlog automaticamente)?

---

## FASE B — Implementazione

---

### EPIC-B3 · Backlog management

**Descrizione**
La pagina backlog è il posto dove il founder passa il tempo quando
non sta reviewando PR. Deve essere veloce da navigare, veloce da
modificare, e non deve richiedere di capire un sistema complesso.

---

#### STORY-B.05 · Pagina backlog con lista e filtri

```
Come founder,
voglio una pagina dove vedo tutte le task in backlog
e le posso filtrare e ordinare,
per trovare quello che cerco senza scorrere 100 righe.
```

**Criteri di accettazione**
- [ ] Route `/backlog` implementata
- [ ] Lista di tutte le task con `status=backlog` o `status=sprint_ready`
  del workspace
- [ ] Filtri funzionanti: tipo, priorità, repository, effort stimato
- [ ] Ricerca testuale su titolo e descrizione
- [ ] Ordinamento: per data creazione, per priorità, per repository
- [ ] Raggruppamento opzionale per repository o per tipo
- [ ] Indicatore visivo che distingue task "grezze" (solo titolo)
  da task "pronte" (descrizione completa + tipo + priorità)
- [ ] Paginazione o infinite scroll con performance accettabile
  fino a 200 task

**TASK-B.05.1** — Implementare `BacklogPage` come Server Component:
query Supabase con filtri passati come search params, paginazione
a 30 task per default.

**TASK-B.05.2** — Implementare `BacklogFilters`:
componente client con select per tipo, priorità, repository, effort.
I filtri aggiornano i search params dell'URL — il link al backlog
filtrato è condivisibile e persistente tra reload.

**TASK-B.05.3** — Implementare `TaskRow` nella lista backlog:
riga compatta con titolo, badge tipo, badge priorità, repository chip,
effort chip, data creazione. Click apre il dettaglio inline o un drawer
laterale — non una navigazione a pagina separata (il founder sta
scorrendo il backlog, non vuole perdere il contesto della lista).

**TASK-B.05.4** — Implementare l'indicatore di completezza task:
logica semplice: titolo + descrizione + tipo + priorità + repository
= task pronta. Icona diversa (es. cerchio pieno vs tratteggiato)
nella lista per distinguere le due categorie a colpo d'occhio.

**TASK-B.05.5** — Implementare la ricerca testuale:
input di ricerca con debounce (300ms) che filtra su `title` e
`description`. Nessuna ricerca full-text complessa — ILIKE su
Supabase è sufficiente per le dimensioni attese.

---

#### STORY-B.06 · Editing inline e bulk actions

```
Come founder,
voglio poter modificare le task del backlog rapidamente,
senza aprire modali o navigare a pagine separate
per ogni singola modifica.
```

**Criteri di accettazione**
- [ ] Priorità modificabile inline con click (dropdown contestuale)
- [ ] Tipo modificabile inline con click (dropdown contestuale)
- [ ] Effort stimato modificabile inline
- [ ] Repository modificabile inline (dropdown delle repo abilitate)
- [ ] Titolo modificabile con doppio click inline
- [ ] Bulk action: seleziona N task → sposta in sprint attivo
- [ ] Bulk action: seleziona N task → cambia priorità
- [ ] Bulk action: seleziona N task → cancella (con conferma)
- [ ] Tutte le modifiche sono ottimistiche: UI si aggiorna subito,
  API call in background

**TASK-B.06.1** — Implementare `InlineSelect` riutilizzabile:
componente che su click mostra un dropdown con le opzioni,
seleziona e chiude con una chiamata API. Usato per tipo, priorità,
effort, repository.

**TASK-B.06.2** — Implementare editing inline del titolo:
doppio click → input text con il valore corrente → blur o Enter
salva → Escape annulla. Ottimistico.

**TASK-B.06.3** — Implementare la selezione multipla con checkbox:
checkbox su ogni riga, "seleziona tutti" nell'header, barra azioni
bulk che appare in basso quando almeno una task è selezionata.

**TASK-B.06.4** — Implementare le Route Handler per le bulk actions:
`POST /api/tasks/bulk` con body `{ action, taskIds, payload }`.
Transazione PostgreSQL: tutte le modifiche vanno a buon fine o nessuna.

---

### EPIC-B4 · Task creation avanzata

**Descrizione**
Creare una task deve costare meno di 60 secondi. Ma una task ben scritta
vale dieci volte una task vaga. Questo epic costruisce il flusso di
creazione che bilancia velocità e qualità, senza forzare il founder
a compilare un form lungo prima di poter salvare.

---

#### STORY-B.07 · Form di creazione rapida task

```
Come founder,
voglio poter creare una task in meno di 60 secondi
anche quando non ho ancora tutti i dettagli,
per non perdere l'idea mentre sono in un altro contesto.
```

**Criteri di accettazione**
- [ ] Shortcut globale (es. `N` o `Cmd+K` → "Nuova task") accessibile
  da qualsiasi pagina
- [ ] Form minimale: titolo (obbligatorio), repository (obbligatorio),
  tutti gli altri campi opzionali
- [ ] Submit crea la task in `status=backlog` e chiude il form
- [ ] Opzione "Crea e affina" che porta al dettaglio completo della task
- [ ] La repository selezionata di default è l'ultima usata (persistita
  in localStorage)
- [ ] Il form si apre in meno di 200ms — nessun loading state visibile

**TASK-B.07.1** — Implementare `QuickTaskForm` come dialog/sheet:
componente accessibile globalmente tramite un contesto React o un
keybinding. Input titolo con autofocus, select repository, bottoni
"Crea" e "Crea e affina".

**TASK-B.07.2** — Implementare Route Handler `POST /api/tasks`:
crea la task con i campi forniti, imposta `status=backlog` e
`workspace_id` dal JWT. Restituisce la task creata.

**TASK-B.07.3** — Implementare il keybinding globale:
listener `keydown` nel layout root che apre il `QuickTaskForm`
al tasto `N` quando il focus non è in un input. Documentare
il keybinding nella UI (tooltip o shortcuts panel).

---

#### STORY-B.08 · Dettaglio e affinamento task

```
Come founder,
voglio una vista di dettaglio completa per ogni task
dove posso aggiungere contesto, modificare tutti i campi,
e vedere la storia della task,
per trasformare una task grezza in una task pronta per l'esecuzione.
```

**Criteri di accettazione**
- [ ] Ogni campo modificabile inline (nessun bottone "Modifica" separato)
- [ ] Campo `description` con supporto Markdown e preview inline
- [ ] Campo `context` per note aggiuntive, link, riferimenti
- [ ] Tutti i metadata editabili: tipo, priorità, repository, effort,
  assegnazione agente (opzionale — di default è automatica)
- [ ] Sezione "Storia" che mostra la timeline eventi (inizialmente vuota
  per task in backlog, popolata durante e dopo l'esecuzione)
- [ ] Indicatore di completezza visibile con lista dei campi mancanti
- [ ] Azioni contestuali: "Aggiungi a sprint", "Duplica task", "Cancella"

**TASK-B.08.1** — Implementare `TaskDetailDrawer` o `TaskDetailPage`:
scegliere il pattern in Fase A (drawer laterale vs pagina dedicata).
Il drawer è preferibile per il backlog (mantiene il contesto della lista);
la pagina è preferibile per una task in esecuzione.

**TASK-B.08.2** — Implementare l'editor Markdown per `description`:
textarea con preview live affiancata (split view) o toggle
preview/edit. Usare una libreria leggera (`react-markdown` per il
render, nessun editor WYSIWYG).

**TASK-B.08.3** — Implementare `CompletenessIndicator`:
logica che calcola un punteggio di completezza (0–100%) basato su
quali campi sono compilati. Barra di progresso visibile nel dettaglio
e nella lista (come icona).

**TASK-B.08.4** — Implementare "Aggiungi a sprint":
action che aggiorna `sprint_id` e `status=sprint_ready` della task.
Se non esiste uno sprint in `planning`, proporre di crearne uno.

---

#### STORY-B.09 · Template per tipo di task

```
Come founder,
voglio che quando seleziono il tipo di task (bug, feature, refactor...)
il sistema mi suggerisca una struttura per la descrizione,
per scrivere task migliori senza doverci pensare ogni volta.
```

**Criteri di accettazione**
- [ ] Selezione del tipo pre-compila la `description` con un template
  in Markdown (il founder può modificarlo liberamente)
- [ ] Template disponibili per: `bug`, `feature`, `refactor`,
  `accessibility`, `security`, `chore`
- [ ] I template sono modificabili dal founder nelle Settings
  (personalizzazione per workspace)
- [ ] Se la `description` è già compilata e il founder cambia tipo:
  warning prima di sovrascrivere con il nuovo template

**TASK-B.09.1** — Definire i template di default per ogni tipo di task:
ogni template è un testo Markdown con sezioni guida. Esempio per `bug`:
```
## Comportamento attuale
[Descrivi cosa succede]

## Comportamento atteso
[Descrivi cosa dovrebbe succedere]

## Passi per riprodurre
1. ...

## Contesto aggiuntivo
[Screenshot, log, URL...]
```
Definire template analoghi per `feature`, `refactor`, `accessibility`,
`security`, `chore`.

**TASK-B.09.2** — Implementare la pre-compilazione del template:
quando il tipo viene selezionato e `description` è vuota (o contiene
solo il template precedente), sostituire con il template del nuovo tipo.

**TASK-B.09.3** — Implementare la tabella `task_templates` e la
pagina Settings per la personalizzazione: un workspace può avere
template custom per ogni tipo. Migration + CRUD API + UI in Settings.

---

### EPIC-B5 · Sprint management

**Descrizione**
Lo sprint è il meccanismo che trasforma il backlog in esecuzione.
Deve essere abbastanza semplice da non richiedere formazione,
e abbastanza potente da dare controllo reale sul lavoro degli agenti.

---

#### STORY-B.10 · Creazione e gestione sprint

```
Come founder,
voglio poter creare sprint, assegnarvi task, e gestirne il ciclo di vita,
per organizzare il lavoro degli agenti in modo strutturato.
```

**Criteri di accettazione**
- [ ] Pagina `/sprints` con lista degli sprint del workspace
- [ ] Creazione sprint: nome (auto-generato ma modificabile, es.
  "Sprint W10-2026"), obiettivo opzionale in una frase
- [ ] Solo uno sprint può essere `active` per workspace in un dato momento
- [ ] Più sprint possono essere in `planning` (bozze)
- [ ] Lo sprint in `planning` mostra la lista delle task assegnate
  con possibilità di riordinare e rimuovere
- [ ] Lo sprint `active` mostra lo stato di ogni task in real-time
- [ ] Lo sprint `completed` è read-only con riepilogo delle task

**TASK-B.10.1** — Implementare `SprintsPage`:
lista sprint con status badge, date, numero task, link al dettaglio.
Bottone "Nuovo sprint" in alto.

**TASK-B.10.2** — Implementare `SprintDetailPage` con tre stati visuali:
in `planning` mostra la lista task ordinabile (drag-and-drop o
frecce su/giù); in `active` mostra la board di esecuzione real-time;
in `completed` mostra il riepilogo.

**TASK-B.10.3** — Implementare Route Handler `POST /api/sprints`:
crea sprint con status `planning`. Validazione: non più di uno sprint
`active` per workspace.

**TASK-B.10.4** — Implementare Route Handler `PATCH /api/sprints/{sprintId}`:
aggiornamento nome, obiettivo, riordinamento task (aggiorna `sprint_order`
di tutte le task dello sprint in una transazione).

---

#### STORY-B.11 · Avvio sprint

```
Come founder,
voglio poter avviare uno sprint con un singolo click,
e vedere gli agenti iniziare a prendere in carico le task
senza dover fare nulla di manuale.
```

**Criteri di accettazione**
- [ ] Bottone "Avvia Sprint" visibile nella pagina sprint in `planning`
- [ ] Prima dell'avvio: validazione che ci sia almeno un agente online
  e almeno una task in `sprint_ready`
- [ ] Se la validazione fallisce: messaggio chiaro con le azioni
  necessarie (es. "Nessun agente online — provisiona un agente prima")
- [ ] Avvio sprint: tutte le task passano a `status=queued` e vengono
  inserite nella queue BullMQ per repo, rispettando `sprint_order`
- [ ] Il founder vede le task cambiare stato in real-time sulla pagina
- [ ] Notifica al founder (email/Slack) quando il primo agente prende
  in carico la prima task

**TASK-B.11.1** — Implementare Route Handler `POST /api/sprints/{sprintId}/start`:
transazione che aggiorna sprint a `status=active`, imposta `started_at`,
aggiorna tutte le task a `status=queued`, inserisce i job BullMQ
per ogni task (raggruppati per repository, in ordine di `sprint_order`).

**TASK-B.11.2** — Implementare la validazione pre-avvio:
verificare che esista almeno un agente `online` nel workspace e almeno
una task `sprint_ready` nello sprint. Restituire errori strutturati
per ogni caso di fallimento.

**TASK-B.11.3** — Implementare il feedback real-time sull'avvio:
subscription Supabase Realtime sulla pagina sprint che aggiorna
i badge di stato di ogni task man mano che passano da `queued` a
`in_progress`. Il founder vede lo sprint "prendere vita" senza refresh.

---

#### STORY-B.12 · Chiusura sprint e retrospettiva

```
Come founder,
voglio che lo sprint si chiuda in modo ordinato
e che io possa vedere un riepilogo di cosa è stato fatto,
per capire quanto il sistema ha reso in quella settimana.
```

**Criteri di accettazione**
- [ ] Lo sprint può essere chiuso manualmente dal founder in qualsiasi momento
- [ ] Se ci sono task in `in_progress` o `queued` al momento della chiusura:
  warning con lista delle task e opzione "Sposta in backlog" o "Annulla task"
- [ ] Alla chiusura: sprint passa a `status=completed`, `completed_at`
  impostato, task non completate tornano in backlog automaticamente
- [ ] Pagina di riepilogo sprint: numero task completate, fallite,
  rimandate, cycle time medio, agente più produttivo

**TASK-B.12.1** — Implementare Route Handler `POST /api/sprints/{sprintId}/complete`:
transazione che chiude lo sprint, sposta le task non completate
in `status=backlog` con `sprint_id=null`, calcola e persiste le
metriche aggregate dello sprint.

**TASK-B.12.2** — Implementare `SprintSummaryPage`:
vista read-only dello sprint completato con: barra di completamento
(done/failed/rimandato), cycle time medio per tipo di task, lista
task con esito e link alla PR.

**TASK-B.12.3** — Aggiornare la tabella `sprints` con i campi
di riepilogo: `tasks_completed`, `tasks_failed`, `tasks_moved_back`,
`avg_cycle_time_minutes`. Calcolati e persistiti al momento della chiusura.

---

### EPIC-B6 · Execution engine — queue per repo

**Descrizione**
Questo è il cuore operativo di Sprint B: il sistema che prende le task
di uno sprint e le distribuisce agli agenti in modo corretto. La regola
è una e non negoziabile: per ogni repository, una task alla volta.
Nessuna eccezione.

---

#### STORY-B.13 · Queue per repo — design e implementazione

```
Come sistema,
voglio che le task di uno sprint vengano eseguite in sequenza
per ogni repository,
per garantire che due agenti non creino conflitti lavorando
sulla stessa codebase contemporaneamente.
```

**Criteri di accettazione**
- [ ] Ogni repository ha una queue BullMQ dedicata (`repo-queue:{repoId}`)
- [ ] Le task di uno sprint vengono inserite nelle queue della loro
  repository target, in ordine di `sprint_order`
- [ ] Una task di una repo inizia solo quando la precedente è in
  stato `done`, `failed`, o `cancelled`
- [ ] Task di repository diverse vengono eseguite in parallelo
  (agenti diversi, code diverse, nessun conflitto)
- [ ] Se l'agente assegnato alla repo va offline durante l'esecuzione:
  la task viene sospesa e notificata al founder

**TASK-B.13.1** — Implementare il sistema di queue per repo in BullMQ:
al momento dell'avvio sprint, per ogni repository con task assegnate,
creare una queue `repo-queue:{repoId}` e inserire i job in ordine
di `sprint_order` con `concurrency=1` (BullMQ garantisce esecuzione
sequenziale con concurrency 1).

**TASK-B.13.2** — Implementare il worker `RepoQueueWorker`:
worker che processa la queue di una repository. Per ogni job:
seleziona l'agente disponibile per quella repo (online + non occupato),
avvia l'esecuzione della task, aspetta il completamento prima di
prendere il job successivo dalla queue.

**TASK-B.13.3** — Implementare la selezione agente per task:
logica di assegnazione: se la task ha `agent_id` esplicito, usa quello
(se online); altrimenti seleziona il primo agente online assegnato
a quella repository. Se nessun agente è disponibile: task rimane
in `queued`, sistema fa polling ogni 5 minuti, notifica al founder
dopo 30 minuti di attesa.

**TASK-B.13.4** — Implementare la gestione dell'agente offline durante
l'esecuzione: se l'orchestratore perde la connessione (health check
fallisce), la task torna a `queued`, viene emesso evento
`agent.disconnected`, il founder riceve notifica con dettaglio della task.

**TASK-B.13.5** — Implementare la gestione delle queue alla riapertura:
se il sistema si riavvia (orchestratore o Redis), le queue devono
essere ricostruite dallo stato del database (task in `queued`).
BullMQ con Redis persistente (AOF) mantiene i job — verificare che
i job non vengano duplicati al riavvio.

---

#### STORY-B.14 · Routing agente → task → repository

```
Come sistema,
voglio che ogni task venga assegnata all'agente corretto
in modo automatico e deterministico,
per non richiedere intervento manuale del founder
per ogni singola assegnazione.
```

**Criteri di accettazione**
- [ ] L'assegnazione automatica è documentata come algoritmo preciso
- [ ] Se più agenti sono disponibili per la stessa repo: la scelta
  è deterministica (non casuale) e documentata
- [ ] L'assegnazione viene persistita su `tasks.agent_id` al momento
  dell'inizio esecuzione
- [ ] Il founder può sovrascrivere l'assegnazione automatica nel
  dettaglio della task (ma solo mentre la task è in `queued`)

**TASK-B.14.1** — Documentare e implementare l'algoritmo di selezione
agente: priorità decrescente: (1) agente esplicitamente assegnato alla
task, (2) agente con meno task completate nelle ultime 24h per quella
repo (load balancing leggero), (3) agente con `provisioned_at` più
recente come tiebreaker. Documentare in `docs/flows/agent-routing.md`.

**TASK-B.14.2** — Implementare il campo di override nella task detail:
dropdown "Agente assegnato" visibile nella task detail quando la task
è in `queued`. Lista degli agenti online assegnati alla repo target.

---

### EPIC-B7 · Notifiche e visibilità dell'esecuzione

**Descrizione**
Il valore del modello asincrono dipende interamente dalla qualità delle
notifiche. Se il founder deve aprire la dashboard per sapere cosa sta
succedendo, il modello non funziona. Le notifiche devono essere
precise, azionabili, e al momento giusto — non spam.

---

#### STORY-B.15 · Notifiche di esecuzione sprint

```
Come founder,
voglio ricevere notifiche precise quando le cose cambiano,
senza essere bombardato di messaggi per ogni micro-evento,
per restare informato senza perdere il focus.
```

**Criteri di accettazione**
- [ ] Notifica quando: una PR è pronta (evento più importante),
  una task fallisce, una task rimane in `queued` da più di 30 minuti
  senza agente disponibile, lo sprint è completato
- [ ] Nessuna notifica per: ogni cambio di stato intermedio,
  ogni commit dell'agente, ogni evento di log
- [ ] Canale configurabile dal founder: email (via Resend), Slack
  (webhook), entrambi, nessuno
- [ ] Ogni notifica contiene: titolo della task, link diretto alla
  task in dashboard, azione richiesta se necessaria

**TASK-B.15.1** — Definire il catalogo notifiche con template:
per ogni evento che genera notifica, definire il soggetto email,
il corpo (breve, in linguaggio naturale), e l'azione suggerita.
Documentare in `docs/notifications/catalog.md`.

**TASK-B.15.2** — Implementare `NotificationService`:
service che centralizza l'invio di notifiche. Riceve evento +
workspace_id, legge la configurazione canale del workspace,
e invoca Resend o il webhook Slack appropriato.

**TASK-B.15.3** — Implementare la pagina Notification Settings:
toggle per email/Slack, input per webhook Slack, test di connessione
("Invia notifica di test"). Salvataggio su tabella `workspace_settings`.

**TASK-B.15.4** — Collegare `NotificationService` agli eventi
dell'orchestratore: ogni evento `agent.pr.opened`, `task.failed`,
`sprint.completed` triggera il `NotificationService`.

---

#### STORY-B.16 · Vista sprint attivo in real-time

```
Come founder,
voglio che la pagina dello sprint attivo mi mostri
lo stato di ogni task in tempo reale,
per avere una visione live del lavoro degli agenti
senza dover fare refresh.
```

**Criteri di accettazione**
- [ ] La pagina dello sprint attivo si aggiorna in real-time
  via Supabase Realtime
- [ ] Ogni task mostra: status badge aggiornato, agente assegnato,
  fase ADWP corrente (se in `in_progress`), ultimo evento (es.
  "Commit pushato 5 minuti fa")
- [ ] Le task sono raggruppate per stato: In esecuzione, In coda,
  Completate, Fallite
- [ ] Un counter in testa alla pagina mostra il progresso globale:
  "7 / 12 task completate"
- [ ] Click su una task porta al suo dettaglio completo

**TASK-B.16.1** — Implementare `ActiveSprintBoard`:
componente con colonne per stato (o lista raggruppata su mobile).
Subscription Supabase Realtime su `task_events` filtrata per le task
dello sprint attivo.

**TASK-B.16.2** — Implementare `SprintProgressBar`:
barra di progresso in cima alla pagina con contatore e percentuale.
Si aggiorna in real-time al completamento di ogni task.

**TASK-B.16.3** — Implementare `TaskStatusCard` nella board sprint:
card con titolo task, `StatusBadge`, nome agente, fase ADWP (se attiva),
ultimo evento in formato relativo. Click apre il dettaglio.

---

## Definition of Done — Sprint B

Lo sprint è completato quando **tutti** i seguenti criteri sono soddisfatti:

**Backlog**
- [ ] Pagina backlog con lista, filtri e ricerca funzionanti
- [ ] Creazione rapida task in < 60 secondi testata (cronometrata)
- [ ] Editing inline di tipo, priorità, repository, effort funzionante
- [ ] Bulk actions: sposta in sprint, cambia priorità, cancella
- [ ] Template per tipo di task funzionanti e personalizzabili

**Sprint management**
- [ ] Creazione sprint funzionante
- [ ] Avvio sprint con validazione e feedback real-time funzionante
- [ ] Chiusura sprint con task non completate spostate in backlog
- [ ] Pagina riepilogo sprint completato con metriche

**Execution engine**
- [ ] Queue per repo implementata e testata con due agenti su due repo diverse
- [ ] Esecuzione sequenziale verificata: il secondo job della stessa repo
  parte solo dopo che il primo è completato
- [ ] Esecuzione parallela verificata: job su repo diverse partono simultaneamente
- [ ] Gestione agente offline durante esecuzione testata

**Notifiche**
- [ ] Notifica email funzionante per PR pronta e task fallita
- [ ] Notifica Slack funzionante (se webhook configurato)
- [ ] Settings notifiche funzionanti

**Il test finale — sprint completo end-to-end:**
Partendo da un backlog vuoto, seguire questo flusso senza istruzioni:
- Creare 5 task in backlog (almeno 2 repo diverse, almeno 2 tipi diversi)
- Affinare 3 di esse aggiungendo descrizione, tipo e priorità
- Creare uno sprint, aggiungere le 5 task, avviarlo
- Attendere che gli agenti completino almeno 2 task
- Verificare che le PR aperte su GitHub corrispondano alle task

Se uno degli step richiede intervento manuale non previsto dal prodotto,
lo sprint non è finito.

---

## Stima effort

| Epic | Scope | Effort stimato |
|---|---|---|
| EPIC-B1 · Data model | Schema, migration, RLS, ADR | ~5h |
| EPIC-B2 · UX flow | Backlog flow, sprint flow | ~4h |
| EPIC-B3 · Backlog management | Pagina, filtri, editing inline, bulk | ~8h |
| EPIC-B4 · Task creation avanzata | Form rapida, dettaglio, template | ~7h |
| EPIC-B5 · Sprint management | CRUD sprint, avvio, chiusura, riepilogo | ~8h |
| EPIC-B6 · Execution engine | Queue per repo, routing, gestione failure | ~10h |
| EPIC-B7 · Notifiche e visibilità | Notifiche, sprint board real-time | ~6h |
| **Totale stimato** | | **~48h** |

L'Epic B6 (execution engine) è il più critico e il più rischioso.
Va approcciato prima degli altri epic di Fase B — se presenta problemi
imprevisti, è meglio scoprirlo prima di aver costruito tutta la UI
attorno ad esso.

---

## Rischi specifici di questo sprint

| Rischio | Probabilità | Mitigazione |
|---|---|---|
| Queue BullMQ per repo genera job duplicati al riavvio | Media | TASK-B.13.5 affronta esplicitamente questo caso. Testare con riavvio forzato dell'orchestratore durante un'esecuzione |
| Editing inline su backlog crea race condition con aggiornamenti real-time | Bassa | Disabilitare l'editing inline per task in `in_progress` o `queued`. Il founder può modificare solo task in `backlog` o `sprint_ready` |
| Performance della pagina backlog con 200+ task | Media | Paginazione a 30 task, indici su `(workspace_id, status)` e `(workspace_id, created_at)`. Misurare prima di ottimizzare |
| Il founder non capisce la differenza tra backlog e sprint | Media | La UI deve comunicare chiaramente il concetto con copy e visual hierarchy — non dare per scontato che il founder conosca il metodo Scrum |
| Agente non disponibile per una repo blocca lo sprint silenziosamente | Alta | TASK-B.13.3 implementa la notifica dopo 30 minuti. Il founder non deve scoprirlo da solo controllando la dashboard |

---

## Collegamento con gli altri sprint

**Dipende da Sprint A:**
Agenti online, repository associate, provisioning automatico funzionante.
Senza Sprint A, l'execution engine di Sprint B non ha agenti su cui fare routing.

**Prepara Sprint C:**
Il rework flow di Sprint C (commenti GitHub → rework automatico,
iterazione dalla dashboard) assume che le task abbiano una storia
completa (eventi, PR, contesto) generata durante l'esecuzione.
Sprint B costruisce quella storia — Sprint C la usa per il rework.

---

*Robin.dev · Sprint B Backlog v1.0 · Carlo Ferrero · Febbraio 2026*
