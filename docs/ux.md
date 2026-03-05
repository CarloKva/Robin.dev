# UX — Robin.dev

**Last updated:** 2026-03-05

---

## 1. Principio guida

Ogni schermata risponde a **una domanda precisa** che l'utente si sta facendo.
Se una schermata non risponde a una domanda precisa, non va costruita.

---

## 2. Mappa delle schermate

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

### Navigazione sidebar

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

Link attivo: bordo sinistro del colore brand.

---

## 3. Flussi di utilizzo quotidiano

### Flusso creazione task

```
Task Creation (/tasks/new)
  ├── Compila form (titolo, descrizione, tipo, priorità)
  ├── Preview TASK.md si aggiorna in real-time mentre scrivi
  ├── Indicatore qualità descrizione (poor/fair/good)
  ├── Submit → ottimismo: task compare nella lista immediatamente
  └── Redirect → Task Detail con banner "Task creata — l'agente la prenderà in carico"
```

### Flusso monitoraggio task

```
Dashboard → [click task attiva] → Task Detail
  ├── Colonna sinistra: metadata + artifact (PR, deploy, commit)
  └── Colonna destra: timeline eventi real-time
       ├── Aggiornamenti automatici (nessun refresh)
       └── Badge "N new" se arrivano eventi mentre sei scrollato in alto
```

### Flusso task bloccata

```
Task Detail (task in stato "blocked")
  └── Alert rosso/ambra: motivo del blocco + campo risposta
       └── Invia risposta → evento "human.approved" emesso
            └── Agente riprende (status torna in_progress)
```

### Flusso di primo accesso

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

La dashboard vuota **non deve sembrare rotta**. Empty state illustrato con guida esplicita verso la prima azione.

---

## 4. Schermate — Dettaglio

### Dashboard (`/dashboard`)

**Domanda:** "Cosa sta succedendo adesso nel mio workspace?"

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
│  Feed eventi recenti                                            │
│  ● PR #42 aperta     · 5m fa  · "Fix login form"               │
│  ● Commit pushato    · 1h fa  · "Fix login form"               │
│  ● Task completata   · 2h fa  · "Add dark mode toggle"         │
│  [Vedi tutte le task →]                                         │
└─────────────────────────────────────────────────────────────────┘
```

**Stato: agente idle:**
```
│  [● Agente pronto]  Robin  · nessuna task in coda
│  [Assegna una task]   ← CTA primaria
```

---

### Task List (`/tasks`)

**Domanda:** "Dove sono tutte le mie task?"

**Filtri:**
- Stato: tutti | backlog | in_progress | in_review | blocked | done | failed
- Tipo: tutti | bug | feature | docs | refactor | chore
- Priorità: tutte | critical | high | medium | low
- Periodo: oggi | questa settimana | questo mese | tutto

**URL params:** `/tasks?status=blocked&type=bug&page=2` — il refresh mantiene i filtri.

**Ordinamento default:** task in_progress prima, poi per created_at DESC.

**Ricerca:** su titolo e descrizione con debounce 300ms (`ilike`).

**Paginazione:** 20 task per pagina. Paginazione classica (non infinite scroll) — l'infinite scroll perde la posizione al cambio filtro.

**Task card stati speciali:**
- `blocked`/`failed`: bordo sinistro rosso/arancione, sfondo leggermente tinto
- `in_progress`: bordo sinistro blu/indigo + indicatore fase corrente

---

### Task Detail (`/tasks/[id]`)

**Domanda:** "Cosa è successo esattamente su questa task?"

**Layout desktop (2 colonne):**
```
┌─────────────────────────────────────────────────────────────────┐
│  ← Tasks / Fix login form validation                            │
│                                                                 │
│  COLONNA SINISTRA (1/3)      │  COLONNA DESTRA (2/3)           │
│                              │                                  │
│  Titolo (editabile inline)   │  Timeline eventi                 │
│  Stato / Tipo / Priorità     │  ● task.created                  │
│  Agente / Creato / Durata    │  ● agent.phase.started           │
│                              │  ● agent.phase.completed         │
│  Metriche esecuzione         │  ● agent.commit.pushed           │
│  Fasi completate: 2/4        │                                  │
│  Commit: 3 · File: 7         │  [2 new events ↓]               │
│                              │                                  │
│  PR #42                      │                                  │
│  [open] fix/login-validation │                                  │
│  3 commit · 7 file · +145 -23│                                  │
│  [Apri su GitHub ↗]          │                                  │
│                              │                                  │
│  Deploy preview              │                                  │
│  [ready] robin-pr-42.vercel  │                                  │
│  [Apri preview ↗]            │                                  │
│                              │                                  │
│  Azioni                      │                                  │
│  [Sblocca] (solo se blocked) │                                  │
│  [Cancella] (solo se backlog)│                                  │
└─────────────────────────────────────────────────────────────────┘
```

**Layout mobile:** metadata in `<details>` accordion (collassato di default), timeline full-width, bottoni azione ≥ 44px.

**Editing inline:**
- Click su titolo → `<input>` editabile → blur/Enter salva
- Click su descrizione → `<textarea>` → blur/Ctrl+Enter salva
- Aggiornamento ottimistico via `PATCH /api/tasks/[id]`
- **Disabilitato** se task è `in_progress` (conflitto con agente)

**Azioni contestuali:**
- Sblocca: solo se status = `blocked`
- Cancella: solo se status = `backlog`|`blocked` — con AlertDialog di conferma
- Riassegna: solo se status = `backlog`

**Breadcrumb:** `Tasks / [titolo troncato a 40 char]`

---

### Task Creation (`/tasks/new`)

**Domanda:** "Come creo una task che l'agente capirà?"

**Accesso:**
- Bottone "+ Nuova task" (dashboard, task list)
- Shortcut `N` da qualsiasi pagina (fuori da un input)

**Layout:** form (sinistra) + preview TASK.md aggiornata in real-time (destra).

**Validazione:** client-side con Zod (feedback inline sui campi) + server-side identica nel Route Handler.

**Submit ottimistico:** task appare subito nella lista, redirect a Task Detail con banner, rollback se errore server.

---

### Metrics (`/metrics`)

**Domanda:** "Il sistema sta funzionando bene?"

**Periodo selezionabile:** 7gg | 30gg | 90gg

**Metriche:**
1. **Cycle time medio** — dal `task.created` al `task.completed` (ore)
2. **PR approval rate** — % PR approvate senza `fix(review):` commit successivi
3. **Escalation rate** — % task entrate in stato `blocked` almeno una volta
4. **Task completate** — conteggio con breakdown per tipo
5. **Accuracy rate** — % task completate senza rework post-merge

Ogni metrica ha tooltip esplicativo. Bottone "Esporta report" → download `robindev-report-YYYY-MM.md`.

---

## 5. Edge cases

### Dashboard

| Situazione | Comportamento |
|---|---|
| Agente offline (Realtime disconnesso) | Badge "Realtime offline" nell'header. Feed mostra ultimi dati cached. |
| Nessuna task nel workspace | Empty state "Come iniziare" con 3 passi + CTA "Crea la tua prima task" |
| Metriche tile in fetch | Skeleton loader con stesse dimensioni del tile reale |
| Errore fetch metriche tile | Tile mostra "—" con testo "Errore nel caricamento" |

### Task List

| Situazione | Comportamento |
|---|---|
| 0 task con filtri attivi | "Nessuna task corrisponde ai filtri" + link "Rimuovi filtri" |
| 0 task nel workspace | "Nessuna task" + CTA "Crea la tua prima task" |
| Ricerca senza risultati | "Nessun risultato per '[termine]'" |
| Errore fetch | Messaggio di errore con bottone "Riprova" |

### Task Detail

| Situazione | Comportamento |
|---|---|
| Task non trovata | redirect(`/tasks`) |
| PR chiusa su GitHub senza merge | PR card mostra stato "closed" con stile grigio |
| Deploy in errore | Deploy card mostra stato "error" + messaggio errore dal payload |
| Task in_progress + editing inline | Campi disabilitati con tooltip "L'agente sta lavorando su questa task" |
| Agente bloccato | Alert ambra/rosso con motivo + textarea per risposta |
| Nessun evento | Timeline con messaggio "Nessun evento registrato" |

### Task Creation

| Situazione | Comportamento |
|---|---|
| Submit con validazione fallita | Evidenzia campi invalidi, non naviga |
| Errore server al submit | Toast di errore, rimuove ottimismo dalla lista |
| Un solo agente disponibile | Campo agente pre-selezionato, non modificabile |
| Nessun agente disponibile | Messaggio "Nessun agente configurato" — bottone submit disabilitato |

---

## 6. Flusso rework (dashboard-driven)

### Principio

Il rework è una richiesta di correzione esplicita dopo aver revisionato il lavoro dell'agente. Il flusso è veloce e contestuale — il contesto dell'iterazione precedente è già presente.

### Passi

1. **Founder apre Task Detail** dalla dashboard (task in stato `in_review`)
2. **Vede la timeline completa** — PR #N, file modificati, commenti GitHub
3. **Clicca "Avvia rework"** — bottone visibile nella sezione Azioni
4. **Pannello di rework** (slide-in da destra su desktop, full-screen su mobile):

```
┌──────────────────────────────────────────────────────────────────┐
│  Rework #2 — Fix login form validation              [✕ Chiudi]   │
│──────────────────────────────────────────────────────────────────│
│  CONTESTO ITERAZIONE PRECEDENTE (read-only)                      │
│  Descrizione originale                                           │
│  File modificati nella PR #42 (+/- per file, max 7)             │
│  Commenti GitHub sulla PR (pre-compilati nella textarea)         │
│──────────────────────────────────────────────────────────────────│
│  ISTRUZIONI PER IL REWORK                                        │
│  [textarea — focus automatico — pre-compilata con commenti PR]   │
│──────────────────────────────────────────────────────────────────│
│  [Annulla]                              [Avvia rework →]         │
└──────────────────────────────────────────────────────────────────┘
```

5. **Submit** → server costruisce context document → task accodata su BullMQ
6. **Task passa a `rework`** — badge, timeline evento `task.rework_started`, toast "Rework avviato"
7. **Timeline live** durante il rework — stessa infrastruttura di `in_progress`

### Post-rework

- Quando l'agente completa, la task torna a `in_review` (richiede nuova review)
- **PR aggiornata, non sostituita** — il branch esistente riceve nuovi commit
- Eccezione: se la PR è stata chiusa/branch rimosso, l'agente apre una nuova PR con `agent.pr.opened`

**Sequenza di stati:**
```
backlog → in_progress → in_review
                              ↓ [rework]
                           rework → in_review → done
```

### Layout mobile (rework panel)

Due tab invece del layout verticale:
- Tab "Contesto" (default): descrizione originale, file modificati, commenti GitHub
- Tab "Istruzioni": textarea + bottoni di azione (sticky footer)
- Full-screen modal, touch target minimo 44×44px

### Edge cases rework

| Situazione | Comportamento |
|---|---|
| PR non ancora aperta | Bottone "Avvia rework" disabilitato con tooltip |
| Task già in rework | Bottone non visibile |
| GitHub API non disponibile | "Impossibile caricare i file modificati. Consulta la PR su GitHub." |
| Agente offline | Job rimane in coda, task in `rework` finché agente torna online |
| Founder chiude pannello senza submit | Testo perso (no autosave) — no confirm dialog |
| Iterazione #10+ | Nessun limite massimo, numero mostrato correttamente |

---

## 7. Design tokens

### Brand color: Violet

```
Violet scale:
50   → #f5f3ff
100  → #ede9fe
200  → #ddd6fe
300  → #c4b5fd
400  → #a78bfa
500  → #8b5cf6    (brand principale su sfondo chiaro)
600  → #7c3aed    (interazioni, link attivi)
700  → #6d28d9
800  → #5b21b6
900  → #4c1d95
950  → #2e1065    (brand principale su sfondo scuro)
```

**Motivazione:** colore dei dev tool premium (Linear, Raycast). Non il solito blu SaaS.

### Palette

#### Stati

| Token | Colore base | Uso |
|---|---|---|
| `state.success` | emerald-500 (#10b981) | Task completata, PR mergeata |
| `state.warning` | amber-500 (#f59e0b) | Task bloccata, attenzione |
| `state.error` | red-500 (#ef4444) | Task failed, errori |
| `state.info` | sky-500 (#0ea5e9) | Task in_progress, info neutral |

#### Superfici

| Token | Light | Dark | Uso |
|---|---|---|---|
| `surface.base` | white | neutral-950 | Background pagina |
| `surface.raised` | neutral-50 | neutral-900 | Card, sidebar |
| `surface.overlay` | neutral-100 | neutral-800 | Dropdown, modal |
| `surface.border` | neutral-200 | neutral-800 | Bordi |

#### Testo

| Token | Light | Dark | Uso |
|---|---|---|---|
| `text.primary` | neutral-900 | neutral-50 | Testo principale |
| `text.secondary` | neutral-600 | neutral-400 | Label, subtitle |
| `text.muted` | neutral-400 | neutral-600 | Placeholder, hint |

### Tipografia

**Font:** `Inter` (variabile), fallback `ui-sans-serif, system-ui, sans-serif`

| Nome | Size | Weight | Uso |
|---|---|---|---|
| `text-xs` | 12px | 400 | Label, badge, hint |
| `text-sm` | 14px | 400/500 | Body, form label |
| `text-base` | 16px | 400 | Testo corrente |
| `text-lg` | 18px | 500/600 | Subtitle sezione |
| `text-xl` | 20px | 600 | Titolo card |
| `text-2xl` | 24px | 700 | Titolo pagina |
| `text-3xl` | 30px | 700 | Numero metrica |

### Spacing

| Contesto | Spacing | Classi |
|---|---|---|
| Padding interno card | 16px-24px | `p-4` / `p-6` |
| Gap tra card | 16px | `gap-4` |
| Gap tra sezioni | 24px-32px | `gap-6` / `gap-8` |
| Padding pagina | 24px | `p-6` |
| Altezza header | 56px | `h-14` |
| Larghezza sidebar | 240px | `w-60` |

### Border radius

| Token | Valore | Uso |
|---|---|---|
| `rounded-sm` | `calc(var(--radius) - 4px)` | Badge, chip piccoli |
| `rounded-md` | `calc(var(--radius) - 2px)` | Input, button |
| `rounded-lg` | `var(--radius)` (8px) | Card, dialog |
| `rounded-xl` | 12px | Modal, pannelli |
| `rounded-full` | 9999px | Avatar, dot indicator |

### Componenti critici

#### TaskCard — badge status

| Status | BG | Testo |
|---|---|---|
| pending | neutral-100 | neutral-600 |
| queued | sky-100 | sky-700 |
| in_progress | brand-100 | brand-700 |
| review_pending | amber-100 | amber-700 |
| approved | emerald-100 | emerald-700 |
| rejected | red-100 | red-700 |
| completed | emerald-100 | emerald-800 |
| failed | red-100 | red-800 |
| cancelled | neutral-100 | neutral-500 |
| backlog | neutral-100 | neutral-500 |
| sprint_ready | blue-100 | blue-600 |
| rework | orange-100 | orange-700 |
| done | emerald-100 | emerald-800 |

#### TaskRow — dot indicator (`STATUS_COLORS` in `lib/task-constants.ts`)

| Status | Dot color |
|---|---|
| backlog | slate-300 (dark: slate-600) |
| sprint_ready | blue-400 |
| pending | slate-400 |
| queued | blue-500 |
| in_progress | blue-600 |
| in_review | yellow-500 |
| rework | orange-500 |
| review_pending | yellow-400 |
| approved | green-400 |
| rejected | red-400 |
| done | green-500 |
| completed | green-600 |
| failed | red-500 |
| cancelled | slate-400 |

#### Badge priorità

| Priorità | Colore |
|---|---|
| critical | red-600 |
| high | orange-500 |
| medium | amber-400 |
| low | neutral-400 |

#### AgentStatusBadge

| Status | Dot | Testo |
|---|---|---|
| idle | neutral-400 | "Agente pronto" |
| busy | emerald-500 (pulse) | "Lavora su: [titolo task troncato]" |
| error | red-500 | "Errore agente" |
| offline | zinc-400 | "Realtime offline" |

#### PRCard (stati PR)

| Stato | Badge |
|---|---|
| open | emerald-500 bg + "Open" |
| merged | violet-500 bg + "Merged" |
| closed | neutral-500 bg + "Closed" |
| draft | neutral-400 bg + "Draft" |

#### MetricsTile

```
Card: rounded-xl border surface.border p-6
Numero: text-3xl font-bold text.primary
Label: text-sm font-medium text.secondary
Trend: text-sm con ↑ (emerald) o ↓ (red) + delta
Tooltip: shadcn/ui Tooltip sul label
```

Tile "Richiedono attenzione" se count > 0: `border-l-4 border-state.warning`, `bg-amber-50` (light) / `amber-950/20` (dark).

#### Skeleton Loader

Usare `shadcn/ui Skeleton`. Dimensioni identiche al componente reale:
- MetricsTile skeleton: `h-32 w-full rounded-xl`
- TaskCard skeleton: `h-18 w-full rounded-lg`
- Timeline entry skeleton: `h-12 w-full`

### Allineamento shadcn/ui CSS variables

```css
/* Light mode */
:root {
  --background: 0 0% 100%;           /* surface.base white */
  --foreground: 0 0% 9%;             /* text.primary neutral-900 */
  --primary: 262 80% 63%;            /* brand.500 violet */
  --primary-foreground: 0 0% 100%;   /* white on brand */
  --muted: 0 0% 96%;                 /* surface.raised neutral-50 */
  --muted-foreground: 0 0% 32%;      /* text.secondary neutral-600 */
  --border: 0 0% 90%;                /* surface.border neutral-200 */
  --accent: 262 80% 63%;             /* brand violet per hover */
  --destructive: 0 84% 60%;          /* state.error red-500 */
}

/* Dark mode */
.dark {
  --background: 0 0% 4%;             /* surface.base neutral-950 */
  --foreground: 0 0% 98%;            /* text.primary neutral-50 */
  --primary: 262 70% 70%;            /* brand.400 violet chiaro */
  --primary-foreground: 0 0% 9%;     /* dark on brand */
  --muted: 0 0% 9%;                  /* surface.raised neutral-900 */
  --muted-foreground: 0 0% 64%;      /* text.secondary neutral-400 */
  --border: 0 0% 15%;                /* surface.border neutral-800 */
  --accent: 262 70% 70%;
  --destructive: 0 63% 31%;
}
```

### Regole di utilizzo

1. **Mai hex raw nel codice** — usare sempre classi Tailwind semantiche
2. **Mai classi hardcoded per status** — mappare sempre via oggetto costante
3. **Dark mode via Tailwind `dark:` prefix** — non CSS manual
4. **Skeleton loader per ogni async fetch** — nessuna pagina bianca
5. **Animazioni: solo `animate-pulse` e `animate-spin`**
