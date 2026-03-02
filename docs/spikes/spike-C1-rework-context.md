# Spike C1 — Contesto di Esecuzione per il Rework di Claude Code

**Sprint:** C
**Stato:** Completato
**Data:** 2026-03-01
**Autore:** Agente Robin
**Task ID:** f5bf8d73-e693-4607-8f36-8d38e9e3d118

---

## Obiettivo

Claude Code è stateless: ogni esecuzione riparte da zero. Prima di implementare il rework,
stabilire concretamente cosa costituisce il contesto di una task completata, come trasmetterlo
a una nuova sessione, e quali sono i limiti pratici.

---

## 1. Cosa costituisce il contesto di una task completata

Analizzando il data model (`prisma/schema.prisma`) e l'interfaccia orchestratore-agente
(`docs/orchestrator-agent-interface.md`), il contesto di una task completata è composto da
questi elementi:

### 1.1 Elementi disponibili in Supabase

| Elemento | Tabella/campo | Disponibilità |
|---|---|---|
| Descrizione originale | `tasks.description` | Sempre presente |
| Timeline eventi | `task_events` (tutti i tipi) | Sempre presente |
| Fasi dell'agente | `task_events` dove `event_type = 'agent.phase.*'` | Sempre presente |
| Commit SHA e branch | `task_events` dove `event_type = 'agent.commit.pushed'` | Presente se l'agente ha committato |
| PR URL e numero | `task_events` dove `event_type = 'agent.pr.opened'`, `task_artifacts.type = 'pr'` | Presente se l'agente ha aperto una PR |
| Commenti human | `task_events` dove `event_type = 'human.commented'` | Presente se il founder ha commentato in-app |
| Istruzioni di rework | Da passare come input al rework — non è stored state | Nuovo input |

**Nota:** i `task_events` sono immutabili. Non contengono decisioni architetturali narrative
dell'agente — quelle erano nel flusso di ragionamento interno (stdout di Claude), non
persistito a lungo termine (solo il `stdoutTail` degli ultimi 10k caratteri in `JobResult`).

### 1.2 Elementi recuperabili via GitHub API

| Elemento | Endpoint GitHub | Note |
|---|---|---|
| File modificati nella PR | `GET /repos/{owner}/{repo}/pulls/{pr_number}/files` | Restituisce filename, patch, additions, deletions per file |
| Diff completo | `GET /repos/{owner}/{repo}/pulls/{pr_number}` con `Accept: application/vnd.github.diff` | Testo diff unificato; può essere grande |
| Commenti sulla PR | `GET /repos/{owner}/{repo}/pulls/{pr_number}/comments` | Commenti inline sul codice |
| Commenti issue della PR | `GET /repos/{owner}/{repo}/issues/{pr_number}/comments` | Commenti generali sulla PR |
| Commit della PR | `GET /repos/{owner}/{repo}/pulls/{pr_number}/commits` | Lista SHA + messaggi |

**Il PR number è recuperabile** dall'evento `agent.pr.opened.payload.pr_number` o dal
parsing dell'URL in `task_artifacts`.

### 1.3 Elementi disponibili sul VPS

| Elemento | Posizione | Note |
|---|---|---|
| CLAUDE.md | `{repositoryPath}/CLAUDE.md` | Convenzioni del workspace — già letto automaticamente da Claude Code all'avvio |
| Repository clonato | `{repositoryPath}/` | Il codice finale è già nel repo — Claude può leggere i file |

**Importante:** il CLAUDE.md viene letto automaticamente da Claude Code all'avvio se
si trova nella working directory. Non richiede passaggio esplicito.

### 1.4 Cosa non è disponibile

- **Ragionamento interno dell'agente originale:** il "perché" di ogni scelta è nel flusso
  di pensiero interno di Claude — non è persistito. Solo il `stdoutTail` (ultimi 10k char)
  è conservato in `JobResult`, ma non è scritto in DB.
- **Immagini nei commenti GitHub:** i commenti possono contenere immagini come
  riferimenti Markdown (`![alt](url)`). Non si serializzano in testo.
- **Variabili d'ambiente runtime:** come la chiave Anthropic API — già disponibili sul VPS.

---

## 2. Come si passa il contesto a Claude Code in una nuova sessione

Claude Code è invocato da `ClaudeRunner` come:

```bash
claude --print --dangerously-skip-permissions "Read the instructions in TASK.md and implement them."
```

Il contesto attuale arriva tramite `TASK.md`, scritto da `ClaudeRunner.buildTaskMd()` prima
del lancio. Per il rework, ci sono tre opzioni di delivery.

---

### Opzione A: File REWORK.md nella root del repo

**Meccanismo tecnico:**

`ClaudeRunner` costruisce un context document e lo scrive come `REWORK.md` nella root del
repo prima di lanciare Claude. Il prompt di avvio diventa:

```bash
claude --print --dangerously-skip-permissions "Read the instructions in REWORK.md and implement the rework."
```

Il contenuto di `REWORK.md` include:

```markdown
# Rework #N — [Task Title]

**Task ID:** [taskId]
**Iterazione:** N (la task originale era l'iterazione #1)

## Descrizione originale

[tasks.description]

## Cosa ha fatto l'agente nell'iterazione precedente

**Branch:** feat/[taskId]
**PR:** #42 — https://github.com/org/repo/pull/42
**Commit:** abc1234, def5678, ghi9012

**File modificati:**
- app/components/LoginForm.tsx    (+89 -12)
- lib/validations/auth.ts         (+34 -0)
- app/api/auth/login/route.ts     (+22 -8)

**Diff rilevante (file più significativi):**
[patch estratta da GitHub API, troncata se > 3000 token per file]

## Commenti del founder sulla PR

@carloferrero: "La validazione funziona ma il messaggio di errore non è abbastanza chiaro."
@carloferrero: "Manca il test per l'email con dominio internazionale (.it, .eu)."

## Istruzioni per il rework

[Testo scritto dal founder nel pannello di rework]

## Required Steps

1. Non creare un nuovo branch — pusha i commit sul branch esistente `feat/[taskId]`
2. Implementa le modifiche richieste
3. Committa e pusha
4. La PR #42 si aggiornerà automaticamente
5. Output: `{"pr_url":"...","branch":"feat/[taskId]"}`
```

`REWORK.md` viene rimosso da `ClaudeRunner` al termine dell'esecuzione (stesso pattern di `TASK.md`).

**Pro:**
- Estende il pattern TASK.md già funzionante in produzione — minima deviazione architetturale
- La dimensione del file è illimitata: nessun vincolo di shell arg o URL encoding
- Claude legge il file con accesso diretto al filesystem — nessun parsing intermedio
- Se Claude Code crasha e viene riavviato, il file è ancora lì
- Facile da testare manualmente (si può scrivere il file e lanciare claude a mano)
- Il file può essere gitignored in `.gitignore` per evitare commit accidentali

**Contro:**
- Aggiunge un file temporaneo al repository (rischio di commit accidentale se la pulizia fallisce)
- `REWORK.md` deve essere aggiunto a `.gitignore` del repo cliente
- Se il ClaudeRunner crasha prima della pulizia, il file rimane — il prossimo run lo sovrascriverà (accettabile)

---

### Opzione B: Contesto passato come prompt iniziale al comando Claude Code

**Meccanismo tecnico:**

Il context document viene passato direttamente come argomento stringa al comando:

```bash
claude --print --dangerously-skip-permissions "<full context string>"
```

In Node.js, tramite `spawn()`:

```typescript
spawn(claudePath, [
  "--print",
  "--dangerously-skip-permissions",
  contextString, // stringa con tutto il contesto
], { cwd: payload.repositoryPath, ... })
```

Alternativa: usare stdin (se Claude Code supporta `--input-file -`):

```typescript
spawn(claudePath, ["--print", "--dangerously-skip-permissions", "-"], {
  stdio: ["pipe", "pipe", "pipe"]
})
process_.stdin.write(contextString)
process_.stdin.end()
```

**Pro:**
- Nessun file temporaneo da gestire
- Il contesto è immediatamente disponibile come primo turn della conversazione
- Non richiede pulizia post-esecuzione

**Contro:**
- Limite di dimensione degli argomenti shell: `ARG_MAX` su Linux è tipicamente 2MB
  (verificabile con `getconf ARG_MAX`). Sufficiente per contesti normali ma rischioso
  con diff grandi.
- Caratteri speciali nel diff (backtick, virgolette, newline) richiedono escaping attento
  in `spawn()` — Node.js gestisce questo correttamente tramite array di argomenti, non
  tramite shell interpolation, quindi il rischio è basso ma presente.
- La stringa del prompt non è persistita: se Claude Code crasha, il contesto è perso.
- Più difficile da debuggare: non c'è un file da ispezionare.
- Claude Code potrebbe troncare argomenti troppo lunghi silenziosamente.

---

### Opzione C: Conversation history di Claude (resume dell'ID conversazione originale)

**Meccanismo tecnico:**

Claude Code supporta la flag `--resume <conversation_id>` per riprendere una sessione
esistente. Se l'ID della conversazione originale viene conservato, è possibile riprenderla:

```bash
claude --print --dangerously-skip-permissions --resume <conversation_id> \
  "Il founder ha richiesto queste modifiche: [istruzioni rework]"
```

**Implementazione:**
1. Alla fine dell'esecuzione originale, `ClaudeRunner` estrae il conversation ID dall'output
   JSON di Claude Code (campo `session_id` o equivalente).
2. Il conversation ID viene salvato in `task_events` come payload dell'evento
   `task.completed`: `{ conversation_id: "abc-123", duration_seconds: 450 }`.
3. Al rework, `ClaudeRunner` recupera il conversation ID da Supabase e passa `--resume`.

**Pro:**
- Contesto di massima fedeltà: Claude ricorda tutto il ragionamento, le alternative
  considerate e scartate, il perché di ogni decisione.
- Non richiede costruzione esplicita del context document — zero overhead di serializzazione.
- I file modificati e il codice sono già parte della memoria della sessione.

**Contro:**
- **Disponibilità incerta:** non è documentato che il `--resume` funzioni in modalità
  `--print` (headless). È una funzionalità primariamente progettata per sessioni interattive.
- **Scadenza:** i conversation ID scadono dopo un periodo non documentato (probabilmente
  30 giorni o meno). Se il rework avviene settimane dopo, il resume fallisce.
- **Opacità:** non è chiaro quanto contesto venga realmente mantenuto vs. quanto venga
  troncato da Anthropic lato server dopo la scadenza della finestra di contesto originale.
- **Accoppiamento API:** dipende da un dettaglio implementativo di Claude Code che potrebbe
  cambiare senza notice in aggiornamenti futuri.
- **Schema DB:** richiede l'aggiunta di `conversation_id` al payload di `task.completed`,
  con potenziale migrazione Supabase.
- **Non testabile facilmente:** non si può verificare manualmente senza accesso al sistema
  headless completo.

---

## 3. Limiti pratici

### 3.1 Dimensione del diff e finestra di contesto

**Finestra di contesto di Claude Sonnet:** 200.000 token di input (~150.000 parole, o
~600.000 caratteri di codice).

**Stima empirica per un diff tipico:**

| Scenario | File modificati | Token stimati del diff |
|---|---|---|
| Task piccola (fix bug) | 2–5 file, ~50 righe | ~1.000–3.000 token |
| Task media (feature) | 5–15 file, ~200 righe | ~5.000–15.000 token |
| Task grande (refactor) | 20–50 file, ~500 righe | ~30.000–80.000 token |
| Task XL (rework architettura) | 100+ file, 2000+ righe | 200.000+ token → **supera il limite** |

**Regola pratica:** includere il diff completo è sicuro per task fino a ~50 file di dimensione
media. Per task più grandi, includere solo i file più rilevanti (quelli con più modifiche o
esplicitamente menzionati nei commenti del founder). L'API GitHub `pulls/{n}/files` restituisce
già le patch ordinate per numero di modifiche — si può troncare ai primi N file.

**Soluzione concreta:** definire un budget massimo di token per il diff (es. 50.000 token ≈
200.000 caratteri). Se la somma delle patch supera questo budget, includere solo i file il cui
`changes` (additions + deletions) è maggiore di una soglia, con una nota in REWORK.md che
indica i file omessi.

### 3.2 Commenti GitHub con immagini

GitHub permette di includere immagini nei commenti come:
- Markdown inline: `![descrizione](https://user-images.githubusercontent.com/...)`
- Drag & drop: immagini caricate su `github.com/user-attachments/assets/...`

Queste immagini **non possono essere serializzate in testo puro**. L'approccio corretto:

1. Filtrare i commenti per escludere le immagini inline dal testo serializzato.
2. Sostituire ogni immagine con un placeholder: `[Immagine non includibile nel contesto testuale]`.
3. Conservare il testo del commento attorno all'immagine.

L'esclusione è sicura: i commenti significativi per il rework sono descrittivi, non
grafici. Screenshot di bug o mockup UI possono essere persi senza impatto critico — il
founder può includerli nelle istruzioni testuali del rework.

**Implementazione regex:** rimuovere i blocchi `![...](...)\n?` dal testo del commento prima
della serializzazione.

### 3.3 Tempo di costruzione del context document

| Operazione | Latenza stimata |
|---|---|
| Query Supabase `task_events` | 50–150ms |
| GitHub API `pulls/{n}/files` | 200–400ms |
| GitHub API `issues/{n}/comments` | 150–300ms |
| GitHub API `pulls/{n}/comments` | 150–300ms |
| Serializzazione e scrittura file | < 10ms |
| **Totale** | **~600ms–1.100ms** |

Con chiamate parallele (Promise.all per le tre GitHub API calls), il tempo reale è:
max(Supabase, max(GitHub calls)) ≈ **300–500ms** nel caso tipico.

Questo è ampiamente entro il limite di 500ms dichiarato nel flusso UX
(`docs/ux/rework-dashboard-flow.md` passo 5: "risposta entro ~500ms"). Il context document
può essere costruito in parallelo con l'aggiunta del job alla coda BullMQ.

### 3.4 Idempotenza e race conditions

Il context document viene costruito al momento del submit del rework, non al momento
dell'esecuzione dell'agente. Se l'agente viene messo in coda e aspetta (perché l'agente è
busy), il contesto costruito al submit è quello corretto — non cambierà durante l'attesa.

---

## 4. Raccomandazione

**Adottare l'Opzione A: REWORK.md nella root del repo.**

**Motivazione concreta:**

1. **Zero deviazione architetturale:** `ClaudeRunner` già scrive e cancella `TASK.md`. La
   logica per `REWORK.md` è identica — si aggiunge un metodo `buildReworkMd(payload)` e si
   cambia il prompt di avvio. La modifica al `ClaudeRunner` è ≤ 30 righe.

2. **Nessun limite di dimensione:** il file può essere di qualunque dimensione entro la
   finestra di contesto di Claude (200k token). Non ci sono vincoli di shell arg o encoding.

3. **Debuggabilità:** in caso di problemi, si può ispezionare `REWORK.md` sul VPS prima che
   venga cancellato. Si può anche lanciare Claude manualmente con lo stesso file per
   riprodurre il comportamento.

4. **Robustezza ai crash:** se Claude Code crasha durante l'esecuzione, `REWORK.md` è ancora
   presente per il retry (BullMQ riprova il job). Con l'Opzione B (prompt), il contesto
   sarebbe nei parametri del job BullMQ — anche lì accessibile, ma meno ispezionabile.

5. **L'Opzione B** è valida ma più fragile: dipende dall'escaping corretto di caratteri
   speciali nel diff e ha un soft limit di 2MB per gli arg shell che può essere raggiunto
   da diff grandi. È un'ottimizzazione prematura rispetto all'Opzione A.

6. **L'Opzione C** è esclusa: il `--resume` in modalità `--print` non è documentato come
   supportato, i conversation ID scadono, e l'accoppiamento con dettagli interni di Claude
   Code introduce fragility inaccettabile per un sistema di produzione.

**Implementazione raccomandata:**

```typescript
// In ClaudeRunner — aggiunta per rework
async runRework(payload: ReworkPayload, hooks: ClaudeRunnerHooks = {}): Promise<JobResult> {
  const reworkMdPath = path.join(payload.repositoryPath, "REWORK.md");
  fs.writeFileSync(reworkMdPath, this.buildReworkMd(payload), "utf-8");
  // ...spawn con prompt "Read the instructions in REWORK.md and implement the rework."
  // finally: fs.unlinkSync(reworkMdPath)
}
```

**Aggiunta a `.gitignore` del template repo:**

```
REWORK.md
TASK.md
BLOCKED.md
```

---

*Robin.dev · Spike C1 · Contesto di esecuzione rework · v1.0 · Sprint C · Marzo 2026*
