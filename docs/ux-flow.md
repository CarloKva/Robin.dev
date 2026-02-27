# Robin.dev — UX Flow & Information Architecture

**Sprint 4 · Carlo Ferrero · Febbraio 2026**

---

## Principio guida

Ogni schermata risponde a **una domanda precisa** che l'utente si sta facendo.
Se una schermata non risponde a una domanda precisa, non va costruita.

---

## Mappa delle schermate

```
[Login / Signup]
      │
      ▼
[Onboarding workspace]   ← solo al primo accesso
      │
      ▼
[Dashboard]  ← schermata principale
      ├── [click task attiva]     → [Task Detail]
      ├── [click "Nuova task"]   → [Task Creation]  (/tasks/new)
      ├── [click "Tutte le task"] → [Task List]      (/tasks)
      └── [click "Metriche"]     → [Metrics]         (/metrics)

[Task List]  (/tasks)
      └── [click task]           → [Task Detail]

[Task Detail]  (/tasks/[id])
      ├── [PR aperta]            → GitHub (esterno, nuova tab)
      ├── [deploy preview]       → Vercel (esterno, nuova tab)
      └── [task bloccata]        → Unblock flow (inline, in-page)

[Task Creation]  (/tasks/new)
      └── [submit]               → [Task Detail] (redirect dopo creazione)

[Metrics]  (/metrics)
      └── [esporta report]       → Download file .md
```

---

## Flusso di utilizzo quotidiano

### 1. Login → Dashboard

L'utente arriva direttamente alla Dashboard dopo il login.
Nessun onboarding step se il workspace esiste già.

**Transizioni da Dashboard:**
- Click su task in corso → Task Detail
- Click su voce del feed → Task Detail della task correlata
- Click "Nuova task" (bottone primario) → Task Creation
- Click "Tutte le task" (link secondario) → Task List
- Click "Metriche" (sidebar) → Metrics
- Shortcut `N` (da qualsiasi pagina, fuori da input) → Task Creation

### 2. Flusso creazione task

```
Task Creation (/tasks/new)
  ├── Compila form (titolo, descrizione, tipo, priorità)
  ├── Preview TASK.md si aggiorna in real-time mentre scrivi
  ├── Indicatore qualità descrizione (poor/fair/good)
  ├── Submit → ottimismo: task compare nella lista immediatamente
  └── Redirect → Task Detail con banner "Task creata — l'agente la prenderà in carico"
```

### 3. Flusso monitoraggio task

```
Dashboard → [click task attiva] → Task Detail
  ├── Colonna sinistra: metadata + artifact (PR, deploy, commit)
  └── Colonna destra: timeline eventi real-time
       ├── Aggiornamenti automatici (nessun refresh)
       └── Badge "N new" se arriv eventi mentre sei scrollato in alto
```

### 4. Flusso task bloccata

```
Task Detail (task in stato "blocked")
  └── Alert rosso/ambra: motivo del blocco + campo risposta
       └── Invia risposta → evento "human.approved" emesso
            └── Agente riprende (status torna in_progress)
```

---

## Flusso di primo accesso

```
Signup
  └── [Clerk form] → Onboarding workspace (/onboarding/workspace)
       └── [crea workspace] → Dashboard vuota
            └── Empty state: "Come iniziare" (3 passi)
                 1. Crea la tua prima task →
                 2. L'agente lavora autonomamente →
                 3. Approva la PR prodotta
                    └── [CTA primaria] → Task Creation
```

La dashboard vuota **non deve sembrare rotta**. Guida esplicitamente
verso la prima azione con un empty state illustrato.

---

## Schermate — Dettaglio

---

### Dashboard (`/dashboard`)

**Domanda a cui risponde:** "Cosa sta succedendo adesso nel mio workspace?"

**Stato: agente attivo (ha una task in corso)**

```
┌─────────────────────────────────────────────────────────────────┐
│  LIVELLO PRIMARIO (above the fold)                              │
│                                                                 │
│  [● Agente attivo]  Robin (agent name)  · online da 3h 12m     │
│                                                                 │
│  Task in corso:                                                 │
│  "Fix login form validation"                                    │
│  Fase: WRITE · 42 minuti · Ultimo: "Commit pushato 3m fa"      │
│  [Vai alla task →]                                              │
│                                                                 │
│  ┌────────────┐  ┌──────────────┐  ┌──────────────────────┐    │
│  │ Completate │  │  In coda     │  │  Richiedono          │    │
│  │ 7          │  │  3           │  │  attenzione 2        │    │
│  │ questa     │  │              │  │  (sfondo arancione   │    │
│  │ settimana  │  │              │  │   se > 0)            │    │
│  └────────────┘  └──────────────┘  └──────────────────────┘    │
│                                                                 │
│  LIVELLO SECONDARIO (scroll)                                    │
│                                                                 │
│  Feed eventi recenti                                            │
│  ● PR #42 aperta     · 5m fa  · "Fix login form"               │
│  ● Commit pushato    · 1h fa  · "Fix login form"               │
│  ● Task completata   · 2h fa  · "Add dark mode toggle"         │
│  ● Fase DESIGN ini.. · 3h fa  · "Fix login form"               │
│  [Vedi tutte le task →]                                         │
│                                                                 │
│  LIVELLO TERZIARIO (visibile ma non principale)                 │
│  Sidebar: [+ Nuova task] [Tutte le task] [Metriche]             │
└─────────────────────────────────────────────────────────────────┘
```

**Stato: agente idle (nessuna task in corso)**

Il livello primario cambia:
```
│  [● Agente pronto]  Robin  · nessuna task in coda              │
│                                                                 │
│  [Assegna una task]   ← CTA primaria                           │
```

Le tre metric tile restano. Il feed mostra gli ultimi eventi anche se
l'agente non è attivo.

**Azioni disponibili:**
- Click su task attiva → Task Detail
- Click su voce feed → Task Detail della task
- Click "Assegna una task" / "Nuova task" → Task Creation

---

### Task List (`/tasks`)

**Domanda a cui risponde:** "Dove sono tutte le mie task?"

**Layout:**
```
┌─────────────────────────────────────────────────────────────────┐
│  Task   [+ Nuova task]                              [Cerca...]  │
│                                                                 │
│  Filtri: [Stato ▾] [Tipo ▾] [Priorità ▾] [Periodo ▾]           │
│  4 filtri attivi · [Rimuovi tutti]                              │
│                                                                 │
│  ┌─────────────────────────────────────────────────────────┐   │
│  │ ● Fix login form validation          [in_progress]      │   │
│  │   feature · high · Robin · 2h fa                        │   │
│  │   WRITE phase · PR #42 aperta                           │   │
│  └─────────────────────────────────────────────────────────┘   │
│  ┌─────────────────────────────────────────────────────────┐   │
│  │ ○ Add dark mode toggle               [completed]        │   │
│  │   feature · medium · Robin · 1 giorno fa                │   │
│  └─────────────────────────────────────────────────────────┘   │
│  ┌─────────────────────────────────────────────────────────┐   │
│  │ ⚠ Update API docs                    [blocked]          │   │
│  │   docs · high · Robin · 3 giorni fa                     │   │
│  │   Richiede attenzione                                    │   │
│  └─────────────────────────────────────────────────────────┘   │
│                                                                 │
│  [← Precedente]  Pagina 1 di 5  [Successiva →]                 │
└─────────────────────────────────────────────────────────────────┘
```

**Filtri definiti:**
- Stato: tutti | backlog | in_progress | in_review | blocked | done | failed
- Tipo: tutti | bug | feature | docs | refactor | chore
- Priorità: tutte | critical | high | medium | low
- Periodo: oggi | questa settimana | questo mese | tutto

**Ordinamento default:** task in_progress prima, poi per created_at DESC.

**Ricerca:** su titolo e descrizione con debounce 300ms (`ilike`).

**Paginazione:** 20 task per pagina, paginazione classica (non infinite scroll).
*Motivazione: infinite scroll crea problemi con filtri attivi (posizione nella lista
viene persa al cambio filtro). La paginazione esplicita mantiene lo stato.*

**URL params:** `/tasks?status=blocked&type=bug&page=2`
Il refresh mantiene i filtri attivi.

**Task card stati speciali:**
- `blocked` / `failed`: bordo sinistro rosso/arancione, sfondo leggermente tinto
- `in_progress`: bordo sinistro blu/indigo + indicatore fase corrente

**Azioni disponibili:**
- Click su card → Task Detail
- Filtri → aggiornano URL params (no full reload)
- Ricerca → debounce 300ms
- "+ Nuova task" → Task Creation

---

### Task Detail (`/tasks/[id]`)

**Domanda a cui risponde:** "Cosa è successo esattamente su questa task?"

**Layout desktop (2 colonne):**
```
┌─────────────────────────────────────────────────────────────────┐
│  ← Tasks / Fix login form validation                            │
│                                                                 │
│  COLONNA SINISTRA (1/3)      │  COLONNA DESTRA (2/3)           │
│                              │                                  │
│  Titolo (editabile inline)   │  Timeline eventi                 │
│  [fix login form validat...] │                                  │
│                              │  ● task.created                  │
│  Stato: [in_progress]        │    "Task creata"  2h fa         │
│  Tipo: [feature]             │                                  │
│  Priorità: [high]            │  ● agent.phase.started           │
│  Agente: Robin               │    "Fase ANALYSIS iniziata" 1h  │
│  Creato: 2h fa               │                                  │
│  Durata: 2h (in corso)       │  ● agent.phase.completed         │
│                              │    "ANALYSIS completata (30m)"  │
│  ─────────────────────────   │                                  │
│  Metriche esecuzione         │  ● agent.phase.started           │
│  Fasi completate: 2/4        │    "Fase WRITE iniziata"  45m   │
│  Commit: 3                   │                                  │
│  File modificati: 7          │  ● agent.commit.pushed           │
│                              │    "Commit abc1234 pushato"  3m  │
│  ─────────────────────────   │                                  │
│  PR #42                      │  [2 new events ↓]               │
│  [open] fix/login-validation │                                  │
│  3 commit · 7 file           │                                  │
│  +145 -23                    │                                  │
│  [Apri su GitHub ↗]          │                                  │
│                              │                                  │
│  Deploy preview              │                                  │
│  [ready] robin-pr-42.vercel  │                                  │
│  [Apri preview ↗]            │                                  │
│                              │                                  │
│  Commit                      │                                  │
│  abc1234 feat: add zod       │                                  │
│  def5678 fix: error msg      │                                  │
│  ghi9012 test: form tests    │                                  │
│                              │                                  │
│  ─────────────────────────   │                                  │
│  Azioni                      │                                  │
│  [Sblocca] (solo se blocked) │                                  │
│  [Cancella] (solo se backlog)│                                  │
└─────────────────────────────────────────────────────────────────┘
```

**Layout mobile (colonna singola):**
- Metadata in `<details>` accordion (collassato di default)
- Timeline occupa tutta la larghezza
- Bottoni azione ≥ 44px altezza

**Editing inline:**
- Click su titolo → `<input>` editabile → blur/Enter salva
- Click su descrizione → `<textarea>` → blur/Ctrl+Enter salva
- Aggiornamento ottimistico su Supabase via `PATCH /api/tasks/[id]`
- Editing disabilitato se task è `in_progress` (conflitto con agente)

**Azioni contestuali (visibili solo se hanno senso):**
- Sblocca: solo se status = `blocked`
- Cancella: solo se status = `backlog` | `blocked` — con AlertDialog di conferma
- Riassegna: solo se status = `backlog`

**Breadcrumb:** `Tasks / [titolo troncato a 40 char]`

---

### Task Creation (`/tasks/new`)

**Domanda a cui risponde:** "Come creo una task che l'agente capirà?"

**Layout (form + preview pannello):**
```
┌─────────────────────────────────────────────────────────────────┐
│  ← Tasks   Nuova task                                           │
│                                                                 │
│  COLONNA SINISTRA (form)     │  COLONNA DESTRA (preview)       │
│                              │                                  │
│  Titolo *                    │  Preview TASK.md                 │
│  [.................................]                             │
│                              │  # Fix login form validation     │
│  Descrizione *               │                                  │
│  [Es: Il form di login non   │  **Tipo:** bug                   │
│   valida l'email prima del   │  **Priorità:** high              │
│   submit. Aggiungere valid.. │                                  │
│   ...]                       │  ## Descrizione                  │
│                              │  Il form di login non...         │
│  Qualità: [████░░] fair      │                                  │
│  Suggerimento: includi       │  ## Criteri accettazione         │
│  comportamento atteso e      │  (da completare)                 │
│  passi per riprodurre.       │                                  │
│                              │                                  │
│  Tipo *          Priorità *  │                                  │
│  [bug      ▾]   [high    ▾]  │                                  │
│                              │                                  │
│  Agente                      │                                  │
│  [Robin           ▾]         │                                  │
│                              │                                  │
│  [Annulla]       [Crea task] │                                  │
└─────────────────────────────────────────────────────────────────┘
```

**Accesso al form:**
- Bottone "+ Nuova task" (dashboard, task list)
- Shortcut `N` da qualsiasi pagina (fuori da un input)

**Validazione:**
- Client-side con Zod: feedback inline sui campi (non solo al submit)
- Server-side identica con Route Handler `POST /api/tasks`

**Submit ottimistico:**
- Task appare subito nella lista
- Redirect a Task Detail con banner "Task creata — l'agente la prenderà in carico a breve"
- Rollback se errore server

---

### Metrics (`/metrics`)

**Domanda a cui risponde:** "Il sistema sta funzionando bene?"

**Layout:**
```
┌─────────────────────────────────────────────────────────────────┐
│  Metriche         [7 giorni ▾]           [Esporta report ↓]     │
│                                                                 │
│  ┌──────────────┐ ┌──────────────┐ ┌──────────────────────┐    │
│  │ Cycle time   │ │ PR approval  │ │ Escalation rate      │    │
│  │ medio        │ │ rate         │ │                      │    │
│  │ 4.2h         │ │ 87%          │ │ 12%                  │    │
│  │ ↓ -0.8h      │ │ ↑ +5%        │ │ ↓ -3%                │    │
│  │ vs 7gg prec. │ │ vs 7gg prec. │ │ vs 7gg prec.         │    │
│  │ [?]          │ │ [?]          │ │ [?]                  │    │
│  └──────────────┘ └──────────────┘ └──────────────────────┘    │
│                                                                 │
│  ┌──────────────┐ ┌──────────────────────────────────────┐      │
│  │ Task         │ │ Accuracy rate                        │      │
│  │ completate   │ │                                      │      │
│  │ 23           │ │ 91%                                  │      │
│  │ bug: 8       │ │ ↑ +2%                                │      │
│  │ feature: 12  │ │ [?]                                  │      │
│  │ docs: 3      │ │                                      │      │
│  └──────────────┘ └──────────────────────────────────────┘      │
└─────────────────────────────────────────────────────────────────┘
```

**Periodo selezionabile:** 7gg | 30gg | 90gg

**Metriche:**
1. **Cycle time medio** — dal `task.created` al `task.completed` (ore)
2. **PR approval rate** — % PR approvate senza `fix(review):` commit successivi
3. **Escalation rate** — % task entrate in stato `blocked` almeno una volta
4. **Task completate** — conteggio con breakdown per tipo
5. **Accuracy rate** — % task completate senza rework post-merge

Ogni metrica ha tooltip esplicativo su cosa misura e come viene calcolata.

**Export:** bottone "Esporta report" → download `robindev-report-YYYY-MM.md`

---

## Edge cases

### Dashboard

| Situazione | Comportamento |
|---|---|
| Agente offline (Realtime disconnesso) | Badge "Realtime offline" nell'header. Feed mostra ultimi dati cached. |
| Nessuna task nel workspace | Empty state "Come iniziare" con 3 passi + CTA "Crea la tua prima task" |
| Più task in_progress simultaneamente | Mostra la prima in ordine di created_at. Nota: architetturalmente non dovrebbe accadere. |
| Metriche tile in fetch | Skeleton loader con stesse dimensioni del tile reale |
| Errore fetch metriche tile | Tile mostra "—" con testo "Errore nel caricamento" |

### Task List

| Situazione | Comportamento |
|---|---|
| 0 task con filtri attivi | Empty state: "Nessuna task corrisponde ai filtri" + link "Rimuovi filtri" |
| 0 task nel workspace | Empty state: "Nessuna task" + CTA "Crea la tua prima task" |
| Ricerca senza risultati | "Nessun risultato per '[termine]'" |
| Errore fetch | Messaggio di errore con bottone "Riprova" |

### Task Detail

| Situazione | Comportamento |
|---|---|
| Task non trovata | redirect(`/tasks`) |
| PR chiusa su GitHub senza merge | PR card mostra stato "closed" con stile grigio |
| Deploy in errore | Deploy card mostra stato "error" + messaggio errore dal payload |
| Task in_progress + editing inline | Campi titolo/descrizione disabilitati con tooltip "L'agente sta lavorando su questa task" |
| Agente bloccato | Alert ambra/rosso con motivo + textarea per risposta |
| Nessun evento | Timeline con messaggio "Nessun evento registrato" |

### Task Creation

| Situazione | Comportamento |
|---|---|
| Submit con validazione fallita | Evidenzia campi invalidi, non naviga |
| Errore server al submit | Mostra toast di errore, rimuove ottimismo dalla lista |
| Un solo agente disponibile | Campo agente pre-selezionato, non modificabile |
| Nessun agente disponibile | Messaggio "Nessun agente configurato" — bottone submit disabilitato |

### Metrics

| Situazione | Comportamento |
|---|---|
| 0 task completate nel periodo | Metriche mostrano "0" o "N/A" con messaggio esplicativo |
| Periodo troppo breve per calcolare trend | Tile mostra valore senza freccia trend |
| Errore export | Toast di errore "Impossibile generare il report" |

---

## Navigazione sidebar

```
[Robin.dev logo]
──────────────
[Dashboard]        /dashboard
[Tasks]            /tasks
[Agents]           /agents
[Metrics]          /metrics
──────────────
[Settings]         /settings
```

Il link attivo è evidenziato con bordo sinistro del colore brand.

---

*Robin.dev · UX Flow v1.0 · Sprint 4 · Carlo Ferrero · Febbraio 2026*
