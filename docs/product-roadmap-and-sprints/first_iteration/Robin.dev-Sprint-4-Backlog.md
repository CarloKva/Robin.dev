# Robin.dev — Sprint 4 Backlog
## Gestionale v2 completo

**Versione 1.0 · Carlo Ferrero · Febbraio 2026**

---

## Obiettivo dello sprint

Completare il gestionale con tutte le feature di business necessarie
per mostrarlo a un cliente senza imbarazzo.

Al termine di questo sprint il gestionale è uno strumento completo:
si creano task, si monitorano in tempo reale, si vedono le PR prodotte
dall'agente, si leggono le metriche di performance. Tutto in un'interfaccia
che trasmette controllo e professionalità.

**Cosa ottieni concretamente alla fine:**
Un cliente apre il gestionale per la prima volta. Senza istruzioni,
riesce a: creare una nuova task descrivendo il lavoro in linguaggio naturale,
vedere l'agente prenderla in carico e aggiornarsi in tempo reale,
aprire la PR prodotta dall'agente direttamente dal gestionale,
leggere quante task sono state completate nell'ultimo mese e con che
cycle time. Il tutto su mobile se è in giro.

Questo sprint non aggiunge nuova infrastruttura. Costruisce sulla
pipeline già funzionante dei primi tre sprint. Il lavoro è quasi
interamente di product e frontend.

---

## Prerequisiti da Sprint 3

Prima di iniziare, verificare che siano soddisfatti:

- [ ] Pagina Task Detail con timeline real-time funzionante (Sprint 3)
- [ ] Hook `useTaskEvents()` e `useAgentStatus()` implementati
- [ ] EventEmitter integrato nell'orchestratore
- [ ] Funzioni di proiezione `getTaskTimeline()`, `getTaskPhaseMetrics()`,
  `getWorkspaceFeed()` implementate
- [ ] RLS attiva e verificata su tutte le tabelle

Se uno di questi manca, Sprint 4 non inizia.

---

## Struttura del backlog

```
Sprint 4
├── FASE A — Analisi e Design
│   ├── EPIC-18 · UX flow e information architecture
│   └── EPIC-19 · Design system e componenti critici
└── FASE B — Implementazione
    ├── EPIC-20 · Dashboard completa
    ├── EPIC-21 · Task management completo
    ├── EPIC-22 · Task creation flow
    ├── EPIC-23 · Artifact integration
    ├── EPIC-24 · Metrics e reporting
    └── EPIC-25 · Responsive e performance
```

---

## Una nota sul tono di questo sprint

Gli sprint precedenti erano infrastrutturali: schema dati, queue,
event store, WebSocket. Questo sprint è di prodotto. La sfida non è
tecnica — è capire cosa vuole vedere un cliente e costruirlo nel modo
più semplice possibile.

Il principio guida è uno: **ogni schermata deve rispondere a una domanda
precisa che il cliente si sta facendo**. La dashboard risponde a
"cosa sta facendo adesso il mio agente?". La lista task risponde a
"dove sono tutte le mie task?". La task detail risponde a "cosa è
successo esattamente su questa task?". Le metriche rispondono a
"il sistema sta funzionando bene?".

Se una schermata non risponde a una domanda precisa, non va costruita.

---

## FASE A — Analisi e Design

---

### EPIC-18 · UX flow e information architecture

**Descrizione**
Definire ogni schermata del gestionale, cosa mostra, come si naviga
tra una e l'altra. L'output è un documento di UX flow che guida
tutta la Fase B, eliminando le decisioni di prodotto durante
l'implementazione.

---

#### STORY-04.01 · UX flow completo dalla login alla task completata

```
Come product designer (sono io),
voglio mappare ogni schermata e ogni transizione del gestionale,
per non dover prendere decisioni di UX mentre scrivo codice.
```

**Criteri di accettazione**
- [ ] Documento `docs/ux-flow.md` scritto con descrizione testuale
  di ogni schermata e ogni transizione
- [ ] Ogni schermata ha: domanda a cui risponde, contenuto principale,
  azioni possibili, link a schermate successive
- [ ] I casi edge sono documentati: workspace senza task,
  agente offline, task bloccata, errore di rete
- [ ] Il flusso di onboarding (primo accesso) è separato dal
  flusso di utilizzo quotidiano

**TASK-04.01.1** — Mappare il flusso di utilizzo quotidiano:
```
Login
  └→ Dashboard
       ├→ [click su task attiva] → Task Detail
       ├→ [click su "Nuova task"] → Task Creation
       └→ [click su "Tutte le task"] → Task List
            └→ [click su task] → Task Detail
                 ├→ [PR aperta] → GitHub (esterno)
                 ├→ [deploy preview] → Vercel (esterno)
                 └→ [task bloccata] → Unblock flow
```
Documentare ogni schermata con: domanda, contenuto, azioni.

**TASK-04.01.2** — Mappare il flusso di primo accesso:
```
Signup → Onboarding workspace → Dashboard vuota
  └→ [guida "crea la tua prima task"] → Task Creation
```
La dashboard vuota non deve sembrare rotta — deve guidare
verso la prima azione.

**TASK-04.01.3** — Documentare i casi edge per ogni schermata:
cosa vede l'utente se l'agente è offline? Se non ci sono task?
Se la PR è stata chiusa su GitHub senza merge?

---

#### STORY-04.02 · Information architecture della dashboard

```
Come product designer,
voglio definire con precisione cosa appare nella dashboard e in quale
ordine di importanza,
per costruire una dashboard che risponde alla domanda giusta
senza sovraccaricare l'utente.
```

**Criteri di accettazione**
- [ ] La gerarchia informativa della dashboard è definita in tre livelli:
  primario (visto subito), secondario (visto dopo), terziario (cercato)
- [ ] Il contenuto è diviso in sezioni con responsabilità chiara
- [ ] Le metriche mostrate in dashboard sono quelle giuste —
  non troppe, non le stesse che stanno nella pagina metrics
- [ ] La dashboard è definita per due stati: agente attivo vs agente idle

**TASK-04.02.1** — Definire la gerarchia informativa:

Livello primario (above the fold, primo sguardo):
- Stato agente: online/working/offline con indicatore visivo immediato
- Task in corso: titolo + fase ADWP corrente + tempo trascorso
- Ultimo evento significativo (es. "Commit pushato 3 minuti fa")

Livello secondario (dopo il primo sguardo):
- Contatori: task completate questa settimana, task in coda,
  task bloccate che richiedono attenzione
- Feed degli ultimi N eventi del workspace

Livello terziario (cercato attivamente):
- Link rapido a "Nuova task"
- Link a "Tutte le task"
- Link a "Metriche"

**TASK-04.02.2** — Definire la dashboard in stato "agente idle":
quando non c'è nessuna task in corso, cosa mostra il livello primario?
(Suggerimento: "Agente pronto — nessuna task in coda" + bottone
"Assegna una task" come call to action primaria)

**TASK-04.02.3** — Documentare tutto in `docs/ux-flow.md` sezione Dashboard.

---

#### STORY-04.03 · Information architecture della lista task

```
Come product designer,
voglio definire come si naviga e si filtra la lista di task,
per costruire una lista che non diventa un muro di testo
con 50+ task.
```

**Criteri di accettazione**
- [ ] I filtri disponibili sono definiti: stato, tipo, priorità, periodo
- [ ] L'ordinamento default è definito (più recente prima? task attive prima?)
- [ ] La ricerca testuale è definita: su quali campi cerca?
- [ ] La densità della lista è definita: compact (max info per riga)
  vs comfortable (più spazio, più leggibile)
- [ ] La paginazione è definita: infinite scroll vs paginazione classica?

**TASK-04.03.1** — Definire i filtri e documentare ogni scelta:
- Stato: tutti | backlog | in_progress | in_review | blocked | done | failed
- Tipo: tutti | bug | feature | docs | refactor | chore
- Priorità: tutte | critical | high | medium | low
- Periodo: oggi | questa settimana | questo mese | tutto

**TASK-04.03.2** — Definire la card task nella lista:
quali campi mostra (titolo, stato, tipo, priorità, agente, data),
come mostra lo stato in corso (progress bar? badge animato?),
come mostra le task che richiedono attenzione (bloccate, failed).

**TASK-04.03.3** — Decidere: infinite scroll o paginazione?
Documentare la scelta con motivazione.

---

### EPIC-19 · Design system e componenti critici

**Descrizione**
Definire i componenti UI critici prima di costruirli, e allineare
il design system (colori, tipografia, spacing) con l'identità
visiva di Robin.dev. Non un design system completo — solo
le decisioni necessarie per questo sprint.

---

#### STORY-04.04 · Definizione design tokens

```
Come developer,
voglio che i colori, la tipografia e lo spacing siano definiti come token,
per avere un'interfaccia visivamente coerente senza dover
ricordare i valori hex ogni volta.
```

**Criteri di accettazione**
- [ ] Palette colori definita in `tailwind.config.ts`:
  brand primary, stati (success, warning, error, info),
  superfici (background, surface, border), testo (primary, secondary, muted)
- [ ] Tipografia definita: font family (Inter o sistema), size scale,
  weight scale, line-height
- [ ] Spacing scale: uso della scala default Tailwind è sufficiente?
  Customizzazioni necessarie documentate
- [ ] I token sono usati in modo coerente — nessun colore hex raw nel codice

**TASK-04.04.1** — Definire la palette colori Robin.dev:
scegliere il colore brand primario (probabilmente qualcosa di scuro,
tecnico, non il solito blu SaaS) e costruire la palette completa.
Documentare in `docs/design-tokens.md`.

**TASK-04.04.2** — Configurare `tailwind.config.ts` con i token:
```typescript
colors: {
  brand: { 50: '...', 500: '...', 900: '...' },
  state: {
    success: '...', warning: '...', error: '...', info: '...'
  },
  surface: { base: '...', raised: '...', overlay: '...' }
}
```

**TASK-04.04.3** — Verificare che shadcn/ui rispetti i token:
il tema shadcn/ui usa CSS variables — allinearle con i token Tailwind.

---

#### STORY-04.05 · Design dei componenti critici

```
Come developer,
voglio avere il design dei componenti più complessi definito prima
di implementarli,
per non refactorare la UI dopo averla costruita.
```

**Criteri di accettazione**
- [ ] Design testuale (o sketch) per: `TaskCard`, `AgentStatusBadge`,
  `PRCard`, `MetricsTile`, `TaskCreationForm`
- [ ] I componenti sono classificati: presentazionale (puro) vs
  connesso (legge da Supabase)
- [ ] Le props di ogni componente sono definite prima di scriverlo
- [ ] Lo stato di loading è definito per ogni componente che
  fa fetch asincrono (skeleton? spinner? nothing?)

**TASK-04.05.1** — Definire `TaskCard` (usata nella lista task):
```typescript
type TaskCardProps = {
  id: string
  title: string
  status: TaskStatus
  type: TaskType
  priority: Priority
  agentName: string
  createdAt: Date
  currentPhase?: ADWPPhase   // se in progress
  prUrl?: string             // se PR aperta
  isBlocked: boolean
}
```

**TASK-04.05.2** — Definire `AgentStatusBadge`:
varianti visual per ogni stato (idle, working, offline, error),
animazione per lo stato working (pulse).

**TASK-04.05.3** — Definire `PRCard` (nella task detail):
PR number, titolo, stato (open/merged/closed), branch,
link GitHub, link deploy preview Vercel, data apertura.

**TASK-04.05.4** — Definire `MetricsTile`:
valore numerico grande, label descrittiva, trend rispetto al
periodo precedente (↑ +12% vs periodo precedente).

**TASK-04.05.5** — Definire `TaskCreationForm`:
campi, validazione, ordine di compilazione, comportamento
submit (ottimistico? spinner? redirect?).

---

## FASE B — Implementazione

---

### EPIC-20 · Dashboard completa

**Descrizione**
La dashboard è la prima cosa che il cliente vede dopo il login.
Deve rispondere immediatamente alla domanda: "cosa sta succedendo
adesso nel mio workspace?"

---

#### STORY-04.06 · Header dashboard con stato agente e metriche rapide

```
Come utente,
voglio vedere immediatamente lo stato dell'agente e i numeri chiave
appena entro nella dashboard,
per capire in 3 secondi se tutto va bene o se devo intervenire.
```

**Criteri di accettazione**
- [ ] Hero section con: `AgentStatusBadge` real-time, nome agente,
  uptime agente (da quando è online)
- [ ] Tre metric tiles above the fold:
  "Task completate questa settimana", "In coda", "Richiedono attenzione"
- [ ] "Richiedono attenzione" conta: task `blocked` + task `failed`
  — ha sfondo rosso/arancione se > 0
- [ ] I dati si aggiornano in tempo reale (Supabase Realtime)
  senza refresh della pagina
- [ ] Loading state: skeleton loader per ogni tile durante il fetch iniziale

**TASK-04.06.1** — Implementare Server Component `DashboardPage`:
fetch iniziale di: stato agente, contatori task per stato,
lista task attive. Passare i dati ai Client Components.

**TASK-04.06.2** — Implementare `AgentHeroSection`:
`AgentStatusBadge` grande + nome agente + uptime.
La sezione si aggiorna via `useAgentStatus()` dal Sprint 3.

**TASK-04.06.3** — Implementare i tre `MetricsTile`:
query Supabase per i contatori, aggiornamento ogni 60s
(non real-time — i contatori non cambiano abbastanza spesso
da giustificare una subscription).

**TASK-04.06.4** — Implementare skeleton loaders per tutti i tile:
usare `shadcn/ui Skeleton` con le stesse dimensioni dei componenti reali.

---

#### STORY-04.07 · Task attiva e feed eventi recenti

```
Come utente,
voglio vedere la task in corso e gli ultimi eventi del workspace,
per avere una finestra in tempo reale su cosa sta succedendo.
```

**Criteri di accettazione**
- [ ] Sezione "Task in corso" mostra: titolo task, fase ADWP corrente,
  tempo trascorso dall'inizio, ultimo evento, link alla task detail
- [ ] Se non c'è nessuna task in corso: empty state con messaggio
  "Nessuna task attiva — l'agente è pronto" e CTA "Crea una task"
- [ ] Feed degli ultimi 10 eventi del workspace: timestamp, tipo evento,
  task di riferimento, descrizione leggibile
- [ ] Il feed si aggiorna in real-time via Supabase Realtime
- [ ] Ogni voce del feed è cliccabile e porta alla task detail

**TASK-04.07.1** — Implementare `ActiveTaskSection`:
query della task in stato `in_progress` per il workspace,
aggiornamento real-time via `useAgentStatus()`.

**TASK-04.07.2** — Implementare `WorkspaceFeed`:
usa `getWorkspaceFeed()` dal Sprint 3 per il fetch iniziale,
subscription Supabase Realtime su `task_events` filtrata per
`workspace_id` per gli aggiornamenti successivi.

**TASK-04.07.3** — Implementare `FeedEventItem`:
riga del feed con timestamp relativo ("3 minuti fa"),
icona per tipo evento, descrizione leggibile, chip con nome task.

**TASK-04.07.4** — Implementare l'empty state della dashboard:
quando workspace ha 0 task, mostrare una guida rapida
"Come iniziare" con i 3 passi: crea una task → l'agente lavora →
approva la PR.

---

### EPIC-21 · Task management completo

**Descrizione**
Lista task navigabile con filtri, e task detail completata con tutti
gli artifact prodotti dall'agente. La task detail del Sprint 3
aveva la timeline — questo epic aggiunge tutto il resto.

---

#### STORY-04.08 · Lista task con filtri e ricerca

```
Come utente,
voglio una lista di tutte le mie task navigabile e filtrabile,
per trovare qualsiasi task in meno di 10 secondi.
```

**Criteri di accettazione**
- [ ] Pagina `/tasks` con lista completa delle task del workspace
- [ ] Filtri funzionanti: stato, tipo, priorità, periodo (definiti in STORY-04.03)
- [ ] Ricerca testuale su titolo e descrizione con debounce 300ms
- [ ] Ordinamento: default = task attive prima, poi per data decrescente
- [ ] Ogni task mostra: `TaskCard` con tutti i campi definiti in STORY-04.05
- [ ] Task con stato `blocked` o `failed` evidenziate visivamente
- [ ] Paginazione: 20 task per pagina (o infinite scroll, secondo ADR)
- [ ] URL riflette i filtri attivi (es. `/tasks?status=blocked&type=bug`)
  — il refresh della pagina mantiene i filtri

**TASK-04.08.1** — Implementare Server Component `TaskListPage`:
fetch iniziale con filtri da URL params, passare i dati al
Client Component che gestisce i filtri interattivi.

**TASK-04.08.2** — Implementare `TaskFilters`:
componente con i controlli di filtro, aggiorna URL params al cambio
(no full page reload — usa `router.replace()` con `scroll: false`).

**TASK-04.08.3** — Implementare `TaskSearchInput`:
input con debounce 300ms, cerca su `title` e `description` via
query Supabase con `ilike`.

**TASK-04.08.4** — Implementare `TaskCard`:
componente presentazionale secondo il design definito in STORY-04.05.
Badge colorato per lo stato, chip per il tipo, indicatore priorità.

**TASK-04.08.5** — Implementare la paginazione:
se infinite scroll: Intersection Observer sul'ultimo elemento.
Se paginazione classica: componente `Pagination` di shadcn/ui.

**TASK-04.08.6** — Testare i filtri: verificare che la combinazione
di più filtri attivi funzioni correttamente (AND logic tra filtri).

---

#### STORY-04.09 · Task detail — sezione metadata completa

```
Come utente,
voglio che la pagina task detail mostri tutte le informazioni
della task in modo organizzato,
per avere un'unica fonte di verità su tutto quello che riguarda
quella task.
```

**Nota:** la task detail esiste già dal Sprint 3 con la timeline.
Questo story completa la colonna sinistra (metadata) che nel Sprint 3
era parziale.

**Criteri di accettazione**
- [ ] Colonna sinistra completa con:
  titolo (editabile inline), descrizione (editabile inline),
  stato con badge colorato, tipo e priorità (editabili),
  agente assegnato, data creazione, ultima modifica,
  durata totale (se completata o in corso),
  metriche di esecuzione (fasi completate, commit totali, file modificati)
- [ ] Editing inline: click sul titolo → input editabile → blur/Enter salva
  → aggiornamento ottimistico su Supabase
- [ ] Sezione artifact: PR card (se presente) + deploy preview card (se presente)
- [ ] Azioni contestuali: bottoni visibili solo quando hanno senso
  (Sblocca solo se `blocked`, Cancella solo se `backlog`/`blocked`,
  Riassegna solo se `backlog`)
- [ ] Breadcrumb: "Tasks / [titolo task troncato]"

**TASK-04.09.1** — Completare `TaskMetadata` con tutti i campi.
Separare i campi statici (data creazione, agente) da quelli
aggiornabili (titolo, descrizione, tipo, priorità).

**TASK-04.09.2** — Implementare editing inline per titolo e descrizione:
componente `EditableField` che toggling tra view e edit mode.
Salvataggio via Route Handler `PATCH /api/tasks/[taskId]`.

**TASK-04.09.3** — Implementare `TaskExecutionMetrics`:
conta eventi del tipo `agent.implementation.commit` per i commit totali,
somma i `filesChanged` dai payload per i file modificati,
calcola la durata totale dall'evento `task.created` all'ultimo evento.

**TASK-04.09.4** — Aggiungere breadcrumb navigabile.

**TASK-04.09.5** — Implementare le azioni contestuali con confirmation dialog
per le azioni distruttive (cancella task):
usare `shadcn/ui AlertDialog` per la conferma.

---

### EPIC-22 · Task creation flow

**Descrizione**
Il form di creazione task è il punto di ingresso di tutto il lavoro.
Deve essere abbastanza guidato da non richiedere istruzioni,
ma abbastanza flessibile da non essere limitante.
Una task mal scritta produce lavoro mal fatto — il form deve aiutare
l'utente a scrivere spec chiare.

---

#### STORY-04.10 · Form di creazione task

```
Come utente,
voglio un form che mi guidi nella creazione di una task completa,
per non dover ricordare cosa includere e per dare all'agente
le informazioni di cui ha bisogno.
```

**Criteri di accettazione**
- [ ] Form accessibile da: bottone "Nuova task" nella dashboard e
  nella lista task, shortcut tastiera `N` da qualsiasi pagina
- [ ] Campi: titolo (required), descrizione (required, min 20 chars),
  tipo (required, select), priorità (required, select con default `medium`),
  agente (select, pre-selezionato se c'è un solo agente)
- [ ] Validazione client-side con Zod: feedback inline sui campi,
  non solo al submit
- [ ] Il campo descrizione ha placeholder con esempio concreto:
  "Es: Il form di login non valida l'email prima del submit.
  Aggiungere validazione Zod sul campo email con messaggio di errore
  'Email non valida' sotto il campo."
- [ ] Preview del `TASK.md` che verrà generato: pannello laterale
  che mostra in tempo reale il file che l'agente leggerà
- [ ] Al submit: ottimismo — la task appare subito nella lista,
  poi viene confermata quando Supabase risponde
- [ ] Dopo il submit: redirect alla task detail con messaggio
  "Task creata — l'agente la prenderà in carico a breve"
- [ ] Il form è accessibile via keyboard (Tab, Enter, Escape)

**TASK-04.10.1** — Creare pagina `/tasks/new` con il form.
Usare `react-hook-form` + `zod` per validazione.

**TASK-04.10.2** — Implementare lo schema di validazione Zod:
```typescript
const taskSchema = z.object({
  title: z.string().min(5, 'Titolo troppo corto').max(100),
  description: z.string().min(20, 'Descrizione troppo corta').max(2000),
  type: z.enum(['bug', 'feature', 'docs', 'refactor', 'chore']),
  priority: z.enum(['low', 'medium', 'high', 'critical']),
  agentId: z.string().uuid()
})
```

**TASK-04.10.3** — Implementare il pannello preview `TASK.md`:
componente che riceve i valori del form in real-time (via `watch()`)
e renderizza il markdown come lo vedrà l'agente.
Usare `react-markdown` per il rendering.

**TASK-04.10.4** — Implementare Route Handler `POST /api/tasks`:
validazione server-side con lo stesso schema Zod,
inserimento su Supabase, aggiunta job a BullMQ,
risposta con la task creata.

**TASK-04.10.5** — Implementare submit ottimistico:
aggiungere la task alla lista locale immediatamente,
rollback se la risposta del server è un errore.

**TASK-04.10.6** — Aggiungere shortcut tastiera `N`:
hook `useKeyboardShortcut('n', () => router.push('/tasks/new'))`
attivo solo quando non si è dentro un input.

---

#### STORY-04.11 · Suggerimenti per descrizione task

```
Come utente,
voglio ricevere suggerimenti su come migliorare la descrizione
della task mentre la scrivo,
per aumentare la probabilità che l'agente capisca esattamente
cosa fare.
```

**Criteri di accettazione**
- [ ] Indicatore di qualità della descrizione: poor / fair / good
  basato su criteri semplici (lunghezza, presenza di criteri
  di accettazione, presenza di contesto tecnico)
- [ ] Suggerimenti contestuali: se tipo = `bug`, suggerire di includere
  "comportamento attuale" e "comportamento atteso".
  Se tipo = `feature`, suggerire di includere criteri di accettazione.
- [ ] I suggerimenti sono non invadenti: appaiono sotto il campo
  come testo secondario, non come popup
- [ ] L'indicatore non blocca il submit — è orientativo

**TASK-04.11.1** — Implementare funzione `descriptionQualityScore(description, type)`:
restituisce `poor` | `fair` | `good` basandosi su:
- lunghezza (< 50 chars = poor, 50-150 = fair, > 150 = good come base)
- presenza di keyword specifiche per tipo
  (bug: "attuale"/"atteso"/"steps"; feature: "dovrebbe"/"quando"/"per")

**TASK-04.11.2** — Implementare `DescriptionQualityIndicator`:
barra colorata (rosso/giallo/verde) + testo suggerimento.
Si aggiorna in real-time mentre l'utente scrive.

**TASK-04.11.3** — Aggiungere suggerimenti per tipo:
quando l'utente seleziona `bug`, mostrare sotto la descrizione:
"Suggerimento: includi comportamento attuale, comportamento atteso,
e passi per riprodurre il bug."

---

### EPIC-23 · Artifact integration

**Descrizione**
Tutto quello che l'agente produce — PR, commit, deploy preview —
deve essere visibile e accessibile direttamente dal gestionale,
senza dover aprire GitHub o Vercel separatamente.

---

#### STORY-04.12 · PR Card completa

```
Come utente,
voglio vedere le informazioni della PR prodotta dall'agente
direttamente nel gestionale,
per non dover aprire GitHub solo per sapere se la PR è aperta.
```

**Criteri di accettazione**
- [ ] `PRCard` mostra: numero PR, titolo, stato (open/merged/closed/draft),
  branch sorgente, numero di commit, file modificati, additions/deletions,
  data apertura, link diretto a GitHub
- [ ] Lo stato della PR si aggiorna in tempo reale tramite eventi
  (quando l'agente fa `agent.pr.updated` o `human.approved`)
- [ ] Il diff summary è leggibile: lista dei file modificati con
  tipo di modifica (added/modified/deleted) e numero di righe
- [ ] Badge "Review richiesta" visibile quando la PR è open e non ancora
  reviewata dall'utente
- [ ] Bottone "Apri su GitHub" con icona GitHub, apre in nuova tab

**TASK-04.12.1** — Implementare componente `PRCard` secondo il design
definito in STORY-04.05.

**TASK-04.12.2** — Implementare fetch dati PR da Supabase:
i dati della PR sono salvati nella tabella `task_artifacts` quando
l'orchestratore emette `agent.pr.opened`. Leggere da lì, non da GitHub API.

**TASK-04.12.3** — Implementare aggiornamento real-time della PR card:
subscription su `task_events` filtrata per eventi di tipo `agent.pr.*`
e `human.approved` / `human.rejected`.

**TASK-04.12.4** — Implementare il diff summary:
i file modificati sono nel payload dell'evento `agent.pr.opened`.
Rendere la lista con icone per tipo di modifica.

---

#### STORY-04.13 · Deploy preview card

```
Come utente,
voglio vedere il link al deploy preview di Vercel direttamente
nel gestionale,
per poter verificare il risultato visivo della task senza
cercare l'URL su Vercel.
```

**Criteri di accettazione**
- [ ] `DeployPreviewCard` mostra: URL deploy preview (cliccabile),
  stato deploy (building/ready/error), timestamp ultimo deploy
- [ ] Il bottone "Apri preview" apre in nuova tab
- [ ] Se il deploy è in stato `building`: indicatore animato
- [ ] Se il deploy è in stato `error`: messaggio di errore leggibile
- [ ] Se non c'è deploy preview (es. task senza PR): la card non appare

**TASK-04.13.1** — Salvare l'URL deploy preview nell'evento `agent.pr.opened`
(Vercel genera il preview URL automaticamente al push — l'orchestratore
deve attenderlo e salvarlo).

**TASK-04.13.2** — Implementare `DeployPreviewCard` con stati
building/ready/error.

**TASK-04.13.3** — Implementare aggiornamento stato deploy:
quando Vercel completa il deploy, il deploy preview URL diventa
attivo. L'orchestratore deve rilevare questo e emettere
`agent.deploy.staging` con lo stato aggiornato.

---

#### STORY-04.14 · Lista commit nella task detail

```
Come utente,
voglio vedere la lista di tutti i commit prodotti dall'agente
per questa task,
per capire come il lavoro è stato strutturato.
```

**Criteri di accettazione**
- [ ] Lista commit in ordine cronologico nella task detail
- [ ] Ogni commit mostra: SHA abbreviato (cliccabile → GitHub),
  messaggio commit completo, timestamp, `+X -Y` changes
- [ ] Il messaggio commit è in formato Conventional Commits —
  il prefisso è evidenziato (fix:, feat:, test:, ecc.)
- [ ] La lista appare sotto la PR card nella colonna sinistra

**TASK-04.14.1** — Implementare `CommitList`: query degli eventi
`agent.implementation.commit` per la task, ordine cronologico.

**TASK-04.14.2** — Implementare `CommitItem`: SHA abbreviato
con link GitHub, messaggio con prefisso highlighted, changes summary.

---

### EPIC-24 · Metrics e reporting

**Descrizione**
Le metriche ADWP danno al cliente la risposta alla domanda
"il sistema sta funzionando bene?". Non un analytics dashboard
completo — solo i numeri che contano per valutare la performance
dell'agente nel tempo.

---

#### STORY-04.15 · Pagina Metrics

```
Come utente,
voglio una pagina che mostri le performance dell'agente nel tempo,
per capire se il sistema sta diventando più efficiente e dove
ci sono margini di miglioramento.
```

**Criteri di accettazione**
- [ ] Pagina `/metrics` con periodo selezionabile: 7gg, 30gg, 90gg
- [ ] Metriche visibili:
  - **Cycle time medio**: dal `task.created` al `task.completed`,
    visualizzato in ore con trend rispetto al periodo precedente
  - **PR approval rate**: % di PR approvate al primo tentativo
    (senza commit `fix(review):` successivi)
  - **Escalation rate**: % di task che sono entrate in stato `blocked`
    almeno una volta
  - **Task completate**: conteggio totale con breakdown per tipo
  - **Accuracy rate**: % di task completate senza rework post-merge
- [ ] Ogni metrica ha una spiegazione tooltip su cosa significa
  e come viene calcolata
- [ ] Le metriche sono calcolate lato server dalle proiezioni sugli eventi

**TASK-04.15.1** — Implementare `getWorkspaceMetrics(workspaceId, period)`:
funzione server-side che calcola tutte le metriche dal event store.
```typescript
async function getWorkspaceMetrics(
  workspaceId: string,
  period: '7d' | '30d' | '90d'
): Promise<WorkspaceMetrics>
```

**TASK-04.15.2** — Calcolare il cycle time:
per ogni task completata nel periodo, calcolare `completed_at - created_at`.
Media aritmetica, escludere task con durata anomala (> 3 deviazioni standard).

**TASK-04.15.3** — Calcolare la PR approval rate:
contare le task con almeno un commit `fix(review):` dopo l'apertura PR
(da eventi `agent.implementation.commit` con messaggio che inizia con
`fix(review):`). Le task senza quel commit = approvate al primo tentativo.

**TASK-04.15.4** — Calcolare l'escalation rate:
contare le task che hanno almeno un evento `agent.blocked` nel periodo.
Dividere per il totale delle task completate nel periodo.

**TASK-04.15.5** — Implementare `MetricsPage` con:
`PeriodSelector`, `MetricsTile` per ogni metrica, `MetricsTrend`
che mostra il delta rispetto al periodo precedente.

**TASK-04.15.6** — Implementare tooltip descrittivo per ogni metrica:
usare `shadcn/ui Tooltip` con spiegazione in linguaggio semplice.

---

#### STORY-04.16 · Report mensile esportabile

```
Come utente,
voglio poter esportare un report mensile delle performance dell'agente,
per condividerlo con il team o per i miei record.
```

**Criteri di accettazione**
- [ ] Bottone "Esporta report" nella pagina metrics
- [ ] Il report è un file Markdown o PDF con:
  periodo di riferimento, tutte le metriche con valori e trend,
  lista delle task completate con cycle time per ognuna,
  lista delle task bloccate con motivo di blocco
- [ ] Il report viene generato lato server e scaricato dal browser
- [ ] Il nome del file include il periodo: `robindev-report-2026-02.md`

**TASK-04.16.1** — Implementare `generateMonthlyReport(workspaceId, month)`:
funzione server-side che costruisce il report in formato Markdown.

**TASK-04.16.2** — Implementare Route Handler `GET /api/reports/monthly?month=YYYY-MM`:
chiama `generateMonthlyReport()`, restituisce il file con header
`Content-Disposition: attachment; filename=robindev-report-YYYY-MM.md`.

**TASK-04.16.3** — Aggiungere bottone "Esporta report" nella pagina metrics
con `<a href="/api/reports/monthly?month=...">` e download attribute.

---

### EPIC-25 · Responsive e performance

**Descrizione**
Il gestionale deve funzionare su mobile. Non tutte le schermate
hanno la stessa priorità su mobile — questo epic identifica quali
ottimizzare per prime e le implementa.

---

#### STORY-04.17 · Ottimizzazione mobile — dashboard e task detail

```
Come utente in mobilità,
voglio poter controllare lo stato dell'agente e leggere la timeline
di una task dal mio telefono,
per non dover aprire il laptop per vedere cosa sta succedendo.
```

**Criteri di accettazione**
- [ ] Dashboard: layout a colonna singola su mobile,
  hero section con stato agente visibile above the fold,
  feed eventi leggibile senza zoom
- [ ] Task detail: timeline occupa tutta la larghezza su mobile,
  metadata collassabile (accordion) per risparmiare spazio
- [ ] Il `AgentStatusBadge` è visibile nell'header su mobile
- [ ] I bottoni di azione (Sblocca, Cancella) sono grandi abbastanza
  da essere tappabili (min 44px di altezza)
- [ ] Nessun overflow orizzontale su viewport 375px (iPhone SE)

**TASK-04.17.1** — Audit responsive della dashboard:
aprire su viewport 375px, identificare tutti i problemi,
fixarli con classi Tailwind responsive (`sm:`, `md:`).

**TASK-04.17.2** — Implementare metadata collassabile su mobile:
`<details>` nativo o componente `Accordion` shadcn/ui.
Di default collassato su mobile, espanso su desktop.

**TASK-04.17.3** — Verificare che tutti i bottoni di azione abbiano
altezza minima 44px su mobile.

---

#### STORY-04.18 · Performance — loading states e ottimizzazione query

```
Come utente,
voglio che le pagine si carichino velocemente e che lo stato
di loading sia chiaro,
per non pensare che l'applicazione sia rotta mentre aspetto i dati.
```

**Criteri di accettazione**
- [ ] Dashboard: first meaningful paint < 1.5s (misurato su connessione 4G)
- [ ] Lista task: first meaningful paint < 1s (fetch 20 task)
- [ ] Task detail: first meaningful paint < 1.5s (fetch task + eventi)
- [ ] Ogni pagina ha loading state esplicito: skeleton loader
  o spinner centrato — mai pagina bianca
- [ ] Le query Supabase non hanno N+1: nessuna query in loop
- [ ] I Server Components caricano i dati in parallelo dove possibile
  (`Promise.all` invece di `await` sequenziali)

**TASK-04.18.1** — Audit delle query esistenti: identificare N+1 e query lente.
Usare `EXPLAIN ANALYZE` su Supabase per le query più frequenti.

**TASK-04.18.2** — Ottimizzare le query critiche:
- Dashboard: una sola query per tutti i contatori (aggregazione SQL)
- Lista task: nessun join aggiuntivo per dati non mostrati nella card
- Task detail: `Promise.all` per fetch parallelo di task + eventi

**TASK-04.18.3** — Aggiungere `loading.tsx` per ogni route del App Router:
Next.js mostra automaticamente il loading state durante il fetch
del Server Component.

**TASK-04.18.4** — Misurare i tempi di caricamento con Chrome DevTools
Network throttling (4G) e verificare che rispettino i target.

---

## Definition of Done — Sprint 4

Lo sprint è completato quando **tutti** i seguenti criteri sono soddisfatti:

**Documentazione**
- [ ] `docs/ux-flow.md` con flow completo e information architecture
- [ ] `docs/design-tokens.md` con palette e typografia
- [ ] Tutte le props dei componenti critici documentate con JSDoc

**Gestionale**
- [ ] Dashboard con stato agente real-time, metriche, task attiva, feed
- [ ] Lista task con filtri, ricerca e ordinamento funzionanti
- [ ] Task detail completa: metadata editabile, timeline, PR card,
  deploy preview, lista commit, azioni contestuali
- [ ] Task creation form con validazione, preview TASK.md,
  indicatore qualità descrizione
- [ ] Pagina metrics con cycle time, PR approval rate, escalation rate
- [ ] Export report mensile funzionante

**Qualità**
- [ ] Zero errori TypeScript
- [ ] Dashboard carica in < 1.5s su connessione 4G simulata
- [ ] Zero overflow orizzontale su viewport 375px
- [ ] Tutti i bottoni di azione ≥ 44px di altezza su mobile

**Il test finale — UX review con persona esterna:**
Far usare il gestionale a una persona che non conosce Robin.dev
senza darle istruzioni. Deve essere in grado di:
- capire cosa fa il sistema guardando la dashboard per 30 secondi
- creare una task senza chiedere aiuto
- trovare la timeline di una task completata
- leggere le metriche e capire cosa significano

Se fallisce su uno di questi punti, il sprint non è finito.

---

## Stima effort

| Epic | Scope | Effort stimato |
|---|---|---|
| EPIC-18 · UX flow | Information architecture completa | ~5h |
| EPIC-19 · Design system | Token, componenti critici definiti | ~4h |
| EPIC-20 · Dashboard | Hero, metriche, feed eventi | ~7h |
| EPIC-21 · Task management | Lista + task detail completa | ~8h |
| EPIC-22 · Task creation | Form + validazione + preview + qualità | ~7h |
| EPIC-23 · Artifact integration | PR card, deploy preview, commit list | ~6h |
| EPIC-24 · Metrics | Calcolo metriche + pagina + export | ~7h |
| EPIC-25 · Responsive + perf | Mobile audit + ottimizzazioni | ~5h |
| **Totale stimato** | | **~49h** |

Lo sprint più lungo dei quattro perché è quasi interamente di frontend
e product — molte decisioni, molti componenti, molte interazioni da definire
e testare. Il test finale con persona esterna è non negoziabile.

---

## Rischi specifici di questo sprint

| Rischio | Probabilità | Mitigazione |
|---|---|---|
| UX review fallisce — il prodotto non è intuitivo | Media | La Fase A (UX flow) serve esattamente a questo. Se viene saltata, questo rischio diventa alto |
| Calcolo metriche da event store più complesso del previsto | Media | TASK-04.15.1 implementa prima la funzione server-side, si testa prima di costruire la UI |
| Deploy preview Vercel URL non disponibile subito dopo la PR | Media | L'orchestratore attende il webhook Vercel o fa polling su Vercel API prima di emettere `agent.deploy.staging` |
| Performance della lista task con 100+ task | Bassa | Paginazione a 20 elementi + indice su `(workspace_id, created_at)` già presente |
| Editing inline titolo/descrizione crea conflitti con aggiornamenti real-time | Bassa | Disabilitare editing mentre la task è `in_progress` |

---

## Collegamento con gli altri sprint

**Dipende da Sprint 1, 2 e 3:**
Schema, orchestratore funzionante, event store, funzioni di proiezione,
componenti real-time — tutto costruito negli sprint precedenti.
Sprint 4 non aggiunge infrastruttura. Assembla.

**Prepara Sprint 5:**
Il gestionale completo è il prerequisito per onboardare clienti reali.
Sprint 5 (multi-tenancy e provisioning) ha senso solo se il prodotto
è abbastanza solido da mostrare a qualcuno. La UX review del test finale
di Sprint 4 è il gate d'ingresso per Sprint 5.

---

*Robin.dev · Sprint 4 Backlog v1.0 · Carlo Ferrero · Febbraio 2026*
