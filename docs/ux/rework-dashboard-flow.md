# Robin.dev — Rework Flow (Dashboard-Driven)

**Sprint B · Marzo 2026**

---

## Principio guida

Il rework è una richiesta di correzione esplicita da parte del founder dopo aver revisionato il lavoro dell'agente. Il flusso deve essere veloce, contestuale e non richiedere di ricominciare da zero: tutto il contesto dell'iterazione precedente è già presente.

---

## Flusso Happy Path

### Passo 1 — Il founder apre la Task Detail dalla dashboard

**Trigger:** click su una task in stato `in_review` dalla Dashboard o dalla Task List.

**Timing:** transizione istantanea (navigazione client-side, `<Link>` Next.js).

**Feedback visivo:**
- Loading skeleton della colonna sinistra e della timeline per ~200ms
- Badge di stato visibile nell'header della pagina: `IN REVIEW`
- Il bottone "Avvia rework" è visibile nella sezione Azioni (colonna sinistra), ma non è il CTA principale — non distrae dal contenuto

---

### Passo 2 — Il founder vede la timeline completa

**Timing:** dati caricati con il rendering della pagina (Server Component fetch da Supabase).

**Contenuto visibile nella Task Detail:**

```
COLONNA SINISTRA                    COLONNA DESTRA
─────────────────────────           ────────────────────────────────────
Titolo task                         Timeline eventi (ordine cronologico)
Stato: [in_review]                  ● task.created          "Task creata"
Tipo / Priorità / Agente            ● agent.phase.started   "ANALYSIS iniziata"
                                    ● agent.phase.completed "ANALYSIS completata (18m)"
Metriche esecuzione                 ● agent.phase.started   "WRITE iniziata"
Fasi completate: 4/4               ● agent.commit.pushed   "Commit abc1234"
Commit: 3 · File modificati: 7     ● agent.phase.started   "PROOF iniziata"
                                    ● agent.pr.opened       "PR #42 aperta"
PR #42                              ● task.in_review        "In attesa di review"
[open] feat/fix-login
+145 -23 · 3 commit · 7 file
[Apri su GitHub ↗]

Diff summary (inline)
+ 3 funzioni aggiunte
~ 2 componenti modificati
- 1 import rimosso

Azioni
[Avvia rework]
```

**Comportamento del diff summary:** non mostra il diff completo. Mostra un riepilogo generato dall'agente al momento della PR:
- N file aggiunti / modificati / rimossi
- Descrizione sintetica (1-3 righe) estratta dal corpo della PR

**Link alla PR:** apre GitHub in nuova tab (`target="_blank"`).

---

### Passo 3 — Il founder clicca "Avvia rework"

**Timing:** click → pannello si apre in ~150ms (animazione slide-in da destra o modal full-width a seconda del breakpoint).

**Feedback visivo:**
- Pulsante "Avvia rework" mostra stato loading per 150ms mentre il pannello si carica
- Overlay semi-trasparente sulla Task Detail sottostante (non si perde il contesto)
- Focus automatico sulla textarea delle istruzioni

---

### Passo 4 — Il pannello di rework

Il pannello si divide in due sezioni: **Contesto** (read-only) e **Istruzioni** (editabile).

**Layout desktop:**

```
┌──────────────────────────────────────────────────────────────────┐
│  Rework #2 — Fix login form validation              [✕ Chiudi]   │
│──────────────────────────────────────────────────────────────────│
│                                                                  │
│  CONTESTO ITERAZIONE PRECEDENTE (read-only)                      │
│  ┌────────────────────────────────────────────────────────────┐  │
│  │ Descrizione originale                                      │  │
│  │ "Il form di login non valida l'email prima del submit.     │  │
│  │  Aggiungere validazione Zod sul campo email."              │  │
│  │                                                            │  │
│  │ File modificati nella PR #42                               │  │
│  │ • app/components/LoginForm.tsx      (+89 -12)              │  │
│  │ • lib/validations/auth.ts           (+34 -0)               │  │
│  │ • app/api/auth/login/route.ts       (+22 -8)               │  │
│  │ • __tests__/LoginForm.test.tsx      (+67 -3)               │  │
│  │ • ... e altri 3 file                                       │  │
│  │                                                            │  │
│  │ Commenti GitHub sulla PR (2)                               │  │
│  │ @carloferrero: "La validazione funziona ma il messaggio    │  │
│  │  di errore non è abbastanza chiaro per l'utente finale."   │  │
│  │ @carloferrero: "Manca il test per l'email con dominio      │  │
│  │  internazionale (.it, .eu)."                               │  │
│  └────────────────────────────────────────────────────────────┘  │
│                                                                  │
│  ISTRUZIONI PER IL REWORK                                        │
│  ┌────────────────────────────────────────────────────────────┐  │
│  │ Migliora i messaggi di errore: devono essere in italiano   │  │
│  │ e specifici (es. "Inserisci un'email valida" invece di     │  │
│  │ "Email non valida"). Aggiungi test per email .it e .eu.    │  │
│  │                                                            │  │
│  │ [textarea — focus automatico]                              │  │
│  └────────────────────────────────────────────────────────────┘  │
│                                                                  │
│  [Annulla]                              [Avvia rework →]         │
└──────────────────────────────────────────────────────────────────┘
```

**Contenuto della sezione Contesto:**

| Elemento | Dettaglio |
|---|---|
| Intestazione | "Stai avviando il rework #N" — N è il numero di iterazione (1-based, la prima esecuzione è l'iterazione #1, il primo rework è il #2) |
| Descrizione originale | Testo del campo `description` della task, read-only |
| File modificati | Lista dei file dalla PR (da GitHub API), con delta +/- per file. Max 7 file mostrati, link "e altri N file" se ce ne sono di più |
| Commenti GitHub | Commenti open sulla PR, pre-compilati nella textarea. Se non ci sono commenti, la textarea è vuota |

**Pre-compilazione della textarea:**
- Se esistono commenti GitHub sulla PR: ogni commento viene prepopolato come testo (non come citazione formattata) per facilitare la revisione e la modifica da parte del founder
- Il founder può modificare, cancellare o integrare il testo pre-compilato
- Il testo pre-compilato non è vincolante — il founder può sovrascriverlo completamente

**Validazione del form:**
- Il bottone "Avvia rework" è disabilitato se la textarea è vuota
- Nessun'altra validazione richiesta (qualsiasi testo è accettabile)

---

### Passo 5 — Submit → Robin costruisce il context document e avvia il rework

**Timing:** click "Avvia rework" → risposta entro ~500ms.

**Sequenza tecnica (invisibile al founder):**
1. `POST /api/tasks/[id]/rework` con `{ instructions: string }`
2. Il server costruisce il context document (TASK.md aggiornato con istruzioni + contesto iterazione precedente)
3. Il task viene aggiunto alla coda dell'agente (BullMQ)
4. Il job ID viene salvato nel record della task
5. La risposta HTTP 200 viene restituita

**Feedback visivo durante i 500ms:**
- Il bottone "Avvia rework" mostra spinner + testo "Avvio in corso..."
- Il pannello rimane aperto (non si chiude prima della risposta)
- Nessun overlay di loading sull'intera pagina

**In caso di errore (es. 500 da server):**
- Il pannello rimane aperto
- Sotto il bottone compare un messaggio di errore inline: "Impossibile avviare il rework. Riprova tra qualche secondo."
- Il bottone torna clickable
- Nessun toast — l'errore è contestuale al pannello

---

### Passo 6 — Task passa a status=rework con feedback real-time

**Timing:** entro 1-2 secondi dal submit (dopo che l'agente accetta il job dalla coda).

**Feedback visivo:**
- Il pannello si chiude automaticamente
- Il badge di stato nella Task Detail passa da `IN REVIEW` a `REWORK` (colore viola/indigo)
- Nella timeline compare un nuovo evento: `task.rework_started` — "Rework #2 avviato"
- Il toast di conferma appare in alto a destra: "Rework avviato — Robin è al lavoro"
- Il toast scompare dopo 4 secondi

**Aggiornamento via Supabase Realtime:**
- La Task Detail è già in ascolto sul canale Realtime della task specifica
- Nessun polling necessario
- L'aggiornamento di stato è immediato (WebSocket push)

---

### Passo 7 — Il founder vede la timeline aggiornarsi mentre l'agente lavora

**Timing:** aggiornamenti in tempo reale tramite Supabase Realtime (stessa infrastruttura usata per `in_progress`).

**Feedback visivo durante l'esecuzione del rework:**

```
Timeline (live)
● task.rework_started         "Rework #2 avviato"              2m fa
● agent.phase.started         "ANALYSIS iniziata"              1m 45s fa
● agent.phase.completed       "ANALYSIS completata (45s)"      1m fa
● agent.phase.started         "WRITE iniziata"                 58s fa
● agent.commit.pushed         "Commit def5678 pushato"         12s fa
● [spinner] agent.phase.started  "PROOF in corso..."          in corso
```

**Comportamento del badge "N new events":**
- Se il founder è scrollato in alto nella timeline e arrivano nuovi eventi, compare il badge "N nuovi eventi ↓" (stesso comportamento di `in_progress`)
- Click sul badge: scroll automatico all'ultimo evento

**Indicatore di stato nell'header:**
- Il badge `REWORK` è persistente fino a completamento
- La fase corrente dell'agente è visibile sotto al badge: "WRITE · 45s"

---

## Post-rework: comportamento dopo il completamento

### Status della task

Quando l'agente completa il rework, la task torna a stato `in_review`.

**Motivazione:** il rework produce una nuova PR (o aggiorna la PR esistente), che richiede nuovamente la review del founder. Il ciclo review → rework può ripetersi finché il founder approva.

**Sequenza di stati:**

```
backlog → in_progress → in_review
                              ↓ [founder clicca "Avvia rework"]
                           rework
                              ↓ [agente completa]
                           in_review  ← il founder rireviewa
                              ↓ [founder approva / merga PR]
                           done
```

### PR: aggiornamento vs nuova PR

**Comportamento: la PR esistente viene aggiornata, non se ne apre una nuova.**

**Motivazione:**
- Il founder ha già il contesto della PR aperta su GitHub
- I reviewer GitHub ricevono notifica automatica di nuovi commit (no spam)
- Mantenere una singola PR per task semplifica la tracciabilità

**Meccanismo:**
- L'agente pusha nuovi commit sul branch esistente della PR
- La PR su GitHub si aggiorna automaticamente
- Il diff summary nella Task Detail si aggiorna (via refresh del dato GitHub al completamento)
- Il numero della PR rimane lo stesso (#42)

**Eccezione:** se la PR è stata chiusa o il branch rimosso (es. merge parziale errato), l'agente apre una nuova PR e logga l'evento `agent.pr.opened` nella timeline.

### Notifiche al founder

Al completamento del rework, il founder riceve:

1. **Notifica in-app (toast):** "Rework #2 completato — PR #42 aggiornata. Richiede review."
   - Toast persistente (non scompare automaticamente)
   - Bottone "Vai alla task →" nel toast

2. **Aggiornamento Dashboard:** la task appare nel feed eventi con badge `IN REVIEW` e l'indicatore "Richiede attenzione" (tile arancione se > 0)

3. **Notifica email (se configurata):** solo se il founder è offline al momento del completamento (non implementata in Sprint B — placeholder per futuro)

---

## Layout Mobile

### Breakpoint

Il pannello di rework ha un layout alternativo per schermi `< 768px`.

### Struttura a tab

Su mobile, il pannello usa due tab invece del layout verticale:

```
┌─────────────────────────────────────────┐
│  Rework #2                   [✕ Chiudi] │
│─────────────────────────────────────────│
│  [Contesto]        [Istruzioni]         │  ← tab attiva sottolineata
│─────────────────────────────────────────│
│                                         │
│  TAB CONTESTO (default):                │
│                                         │
│  Descrizione originale                  │
│  ─────────────────                      │
│  "Il form di login non valida..."       │
│                                         │
│  File modificati (PR #42)               │
│  ─────────────────                      │
│  • LoginForm.tsx          (+89 -12)     │
│  • auth.ts                (+34 -0)      │
│  • ... e altri 5 file                   │
│                                         │
│  Commenti GitHub (2)                    │
│  ─────────────────                      │
│  @carloferrero: "La validazione..."     │
│  @carloferrero: "Manca il test..."      │
│                                         │
│─────────────────────────────────────────│
│  [Passa alle istruzioni →]              │  ← CTA che switcha tab
└─────────────────────────────────────────┘
```

```
┌─────────────────────────────────────────┐
│  Rework #2                   [✕ Chiudi] │
│─────────────────────────────────────────│
│  [Contesto]        [Istruzioni]         │  ← tab Istruzioni attiva
│─────────────────────────────────────────│
│                                         │
│  TAB ISTRUZIONI:                        │
│                                         │
│  Scrivi le istruzioni per il rework:    │
│  ┌─────────────────────────────────┐    │
│  │ Migliora i messaggi di errore:  │    │
│  │ devono essere in italiano...    │    │
│  │                                 │    │
│  │ [textarea — altezza ~200px]     │    │
│  └─────────────────────────────────┘    │
│                                         │
│─────────────────────────────────────────│
│  [Annulla]        [Avvia rework →]      │  ← bottoni ≥ 44px altezza
└─────────────────────────────────────────┘
```

**Regole mobile:**
- Pannello occupa il 100% della viewport (full-screen modal)
- I bottoni di azione sono sempre visibili in fondo (sticky footer)
- Altezza minima textarea: 200px (non collassabile)
- La tab "Contesto" è quella aperta di default (il founder legge prima, poi scrive)
- Il CTA "Passa alle istruzioni →" nella tab Contesto facilita il flusso senza richiedere di trovare la tab manualmente
- Touch target minimo: 44×44px per tutti gli elementi interattivi

---

## Edge Cases

| Situazione | Comportamento |
|---|---|
| PR non ancora aperta (agente non ha ancora pushato) | Il bottone "Avvia rework" è disabilitato con tooltip: "Attendi che l'agente apra la PR prima di avviare un rework" |
| Task già in rework (rework in corso) | Il bottone "Avvia rework" non è visibile — la task è in stato `rework` |
| GitHub API non disponibile (file modificati non caricabili) | La sezione "File modificati" mostra: "Impossibile caricare i file modificati. Consulta la PR su GitHub." con link diretto |
| Nessun commento GitHub sulla PR | La sezione commenti non viene mostrata. La textarea è vuota |
| Rework avviato e agente offline | Il job rimane in coda (BullMQ). La task resta in stato `rework`. Nessun timeout automatico — il founder vedrà la task bloccata in rework finché l'agente non torna online |
| Il founder chiude il pannello dopo aver scritto ma prima di submittare | Il testo nella textarea viene perso (no autosave). Il pannello non chiede conferma alla chiusura — i contenuti erano già pre-compilati e riscrivibili |
| Iterazione #10 o superiore | Il sistema non impone un limite massimo di rework. Il numero viene mostrato correttamente ("Rework #10"). Nessun warning o blocco automatico |

---

*Robin.dev · UX Flow — Rework Dashboard-Driven · v1.0 · Sprint B · Marzo 2026*
