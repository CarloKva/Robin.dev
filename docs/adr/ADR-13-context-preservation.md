# ADR-13 — Context Preservation per il Rework degli Agenti

**Data:** 2026-03-01
**Stato:** Accepted
**Contesto:** Sprint C — Rework execution context (EPIC-C1)
**Spike:** `docs/spikes/spike-C1-rework-context.md`

---

## Contesto

Claude Code è stateless: ogni esecuzione riparte da zero senza memoria delle sessioni
precedenti. Quando il founder richiede un rework (revisione di una task già implementata),
l'agente nella nuova sessione non sa nulla di ciò che ha fatto in precedenza.

Per rendere il rework efficace, l'agente deve ricevere un context document che descriva:
- cosa era stato chiesto nella task originale,
- cosa l'agente ha implementato,
- quale codice ha modificato,
- cosa il founder ha commentato sulla PR,
- cosa il founder vuole cambiare nel rework.

Questo ADR documenta dove conservare questo context document, quale formato adottare,
per quanto tempo trattenerlo, e come gestire rework multipli.

---

## Decisione 1 — Dove conservare il context document

**Decisione:** file `REWORK.md` temporaneo nella root del repository sul VPS dell'agente,
costruito immediatamente prima del lancio di Claude Code e rimosso al termine.

**Non** si usa una colonna `context_snapshot` su `tasks`, **non** si usa Supabase Storage.

### Alternative analizzate

#### Alternativa A — `REWORK.md` su filesystem VPS (scelta adottata)

`ClaudeRunner` costruisce il context document e lo scrive come `REWORK.md` nella root del
repository prima di invocare Claude. Il prompt di avvio diventa:

```
"Read the instructions in REWORK.md and implement the rework."
```

Il file viene rimosso da `ClaudeRunner` al termine dell'esecuzione (blocco `finally`).

**Pro:**
- Estende il pattern `TASK.md` già funzionante in produzione — minima deviazione architetturale.
- Dimensione illimitata: nessun vincolo di shell arg, colonna DB, o URL encoding.
- Claude legge il file con accesso diretto al filesystem — zero parsing intermedio.
- Robustezza ai crash: se Claude Code crasha, `REWORK.md` è ancora presente per il retry
  automatico di BullMQ. Il job riscriverà il file prima del retry.
- Debuggabilità: si può ispezionare `REWORK.md` sul VPS prima della pulizia. Si può
  riprodurre il comportamento lanciando Claude manualmente con lo stesso file.
- Coerente con la gestione di `TASK.md` e `BLOCKED.md` — stesso ciclo di vita temporaneo.

**Contro:**
- Il file è non-persistente: se il VPS viene distrutto e riavviato, `REWORK.md` non sopravvive.
  Accettabile: il file viene ricostruito da dati persistenti (Supabase + GitHub API) ad ogni run.
- Rischio di commit accidentale se la pulizia fallisce. Mitigato: aggiungere `REWORK.md`
  al `.gitignore` del repo template del workspace.
- Se la pulizia fallisce E il repo viene pushato, il file sarà visibile nella PR — non è
  un'informazione sensibile, ma è rumore. Probabilità molto bassa: `finally` viene eseguito
  anche su eccezione.

#### Alternativa B — Colonna `context_snapshot` JSON su `tasks`

Aggiungere una colonna `context_snapshot JSONB` alla tabella `tasks`. Il context document
viene serializzato come JSON e salvato lì.

**Pro:**
- Persistente: sopravvive al riavvio del VPS.
- Consultabile via Supabase Dashboard per debug.

**Contro:**
- Limite pratico di dimensione: PostgreSQL supporta JSONB fino a 255 MB per cella, ma
  Supabase ha policy di row size che rendono JSON grandi (diff con 50+ file) problematici.
  Il diff di una task grande (20–50 file) può superare facilmente i 500 KB serializzato.
- Richiede migrazione schema (ALTER TABLE + aggiornamento tipi Prisma/TypeScript).
- Il contesto è dati derivati (costruito da Supabase + GitHub API) — conservarlo nel DB
  duplica informazioni già presenti in forma primaria altrove.
- Overhead di serializzazione/deserializzazione JSON per dati che verranno usati una sola volta.

**Motivo del rifiuto:** dati derivati duplicati nel DB, con rischio di dimensione e overhead
di migrazione. Il file su VPS è più semplice e sufficiente per lo scope del problema.

#### Alternativa C — Supabase Storage (file object)

Il context document viene serializzato come file Markdown e caricato su un bucket Supabase
Storage (`context-documents/{taskId}/rework-{n}.md`).

**Pro:**
- Persistente e scalabile: Supabase Storage gestisce file di qualsiasi dimensione.
- Accessibile da qualunque nodo (non legato al VPS specifico).

**Contro:**
- Complessità aggiuntiva: upload, download, gestione bucket, policy di accesso.
- Latenza: upload + download aggiunge 200–500ms al percorso critico del rework.
- Il context document è usato una sola volta (al lancio dell'agente) e poi può essere
  eliminato — la persistenza inter-VPS non è un requisito reale.
- Introduce una dipendenza di runtime su Supabase Storage nel `ClaudeRunner` — un servizio
  in più che può fallire.

**Motivo del rifiuto:** complessità non giustificata. Il file su VPS copre tutti i requisiti
reali a costo zero di infrastruttura.

---

## Decisione 2 — Struttura del context document

Il file `REWORK.md` ha la seguente struttura esatta. Ogni sezione è obbligatoria; se i dati
non sono disponibili, la sezione include una nota esplicita invece di essere omessa.

```markdown
# Rework #{N} — {task.title}

**Task ID:** {task.id}
**Iterazione:** {N} (la task originale era l'iterazione #1)
**Branch:** feat/{task.id}

---

## Descrizione originale

{task.description}

---

## Cosa ha fatto l'agente nell'iterazione #{N-1}

**PR:** #{pr_number} — {pr_url}
**Commit:** {sha_1}, {sha_2}, ...

**File modificati:**
- {filename_1}  (+{additions} -{deletions})
- {filename_2}  (+{additions} -{deletions})
[... fino a tutti i file, senza limite di numero nell'elenco]

**Diff rilevante:**
[Patch dei file con più modifiche, fino a un budget massimo di 200.000 caratteri totali.
 Se il diff supera il budget, vengono inclusi i file con più righe modificate fino al
 raggiungimento del limite. I file esclusi sono elencati in calce con una nota.]

---

## Commenti del founder sulla PR

{commenti_issue_pr e commenti_inline_pr da GitHub API, in ordine cronologico}

Formato per ogni commento:
@{author} [{data}]: "{testo}"
[Se il commento contiene immagini: le immagini sono sostituite con il placeholder
 "[Immagine non serializzabile in testo]"]

[Se nessun commento: "Nessun commento sulla PR #{pr_number}."]

---

## Contesto delle iterazioni precedenti

[Presente solo per rework N ≥ 3. Include il summary delle ultime 2 iterazioni precedenti
 a quella corrente, non il diff completo — solo: PR number, file modificati (elenco),
 commenti del founder. Vedere la sezione "Gestione rework multipli" in ADR-13.]

[Assente per rework N=2 (prima iterazione di rework): non c'è storia precedente oltre
 l'iterazione originale, già documentata nella sezione precedente.]

---

## Istruzioni per il rework

{testo scritto dal founder nel pannello di rework — campo obbligatorio non vuoto}

---

## Required Steps

1. Non creare un nuovo branch — lavora sul branch esistente `feat/{task.id}`
2. Leggi i file modificati nell'iterazione precedente per capire lo stato attuale del codice
3. Implementa le modifiche richieste
4. Committa e pusha sul branch esistente
5. La PR #{pr_number} si aggiornerà automaticamente
6. Output dell'ultima riga: `{"pr_url":"{pr_url}","branch":"feat/{task.id}"}`
```

### Budget per il diff

- Budget massimo: **200.000 caratteri** (~50.000 token) per il diff totale incluso in `REWORK.md`.
- Selezione file: si ordinano i file per `changes` decrescente (additions + deletions)
  e si includono i primi file finché il budget non è esaurito.
- File omessi: se alcuni file vengono esclusi per limite di budget, viene aggiunta una nota:
  ```
  [File omessi dal diff per limite di budget: {file_1}, {file_2}, ...]
  [Il codice corrente è disponibile nel repository — leggi i file direttamente.]
  ```
- Ratio token/caratteri: approssimazione 1 token ≈ 4 caratteri per codice sorgente.

### Gestione immagini nei commenti GitHub

Le immagini Markdown nei commenti (`![alt](url)`) vengono sostituite con il placeholder
`[Immagine non serializzabile in testo]` prima della serializzazione. Il testo circostante
viene preservato. Implementazione: regex `!\[([^\]]*)\]\([^)]+\)` → placeholder.

---

## Decisione 3 — Policy di retention

**Il context document (`REWORK.md`) non viene conservato oltre la durata dell'esecuzione.**

| Evento | Azione |
|--------|--------|
| `ClaudeRunner` lancia Claude Code | `REWORK.md` scritto su filesystem VPS |
| Claude Code termina (successo o errore) | `REWORK.md` eliminato dal blocco `finally` |
| VPS riavviata o distrutta | `REWORK.md` non esiste — ricostruibile da dati primari |
| Task eliminata dal founder | Nessuna azione richiesta su `REWORK.md` (già non esiste) |

**Motivazione:** `REWORK.md` è un documento derivato, non un documento primario. I dati
primari da cui viene costruito (Supabase `task_events`, GitHub API, istruzioni del founder)
sono già persistenti nei sistemi appropriati. Non ha senso mantenere una copia derivata
quando i dati originali sono sempre disponibili per ricostruirla.

**Cosa succede quando la task viene eliminata:**
- La `task` viene eliminata da Supabase con cascade su `task_events` e `task_artifacts`.
- Il branch `feat/{task.id}` e la PR GitHub non vengono eliminati automaticamente
  (azione manuale del founder se necessario).
- `REWORK.md` non esiste al momento dell'eliminazione (era già stato rimosso post-esecuzione).
- Non è richiesta alcuna azione di cleanup aggiuntiva.

---

## Decisione 4 — Gestione rework multipli

**Definizioni:**
- Iterazione #1: l'esecuzione originale della task.
- Rework #1 (iterazione #2): il primo rework.
- Rework #2 (iterazione #3): il secondo rework. E così via.

**Regola: includere nel context document le ultime 2 iterazioni precedenti, non tutte.**

| Iterazione corrente | Contesto incluso |
|---------------------|-----------------|
| Rework #1 (iter. #2) | Iterazione #1 (completa: diff + commenti) |
| Rework #2 (iter. #3) | Iterazione #2 (completa), summary iterazione #1 |
| Rework #3 (iter. #4) | Iterazione #3 (completa), summary iterazione #2 |
| Rework #N (iter. N+1) | Iterazione #N (completa), summary iterazione #N-1 |

**"Completa"** significa: diff dei file modificati (nel budget), commenti PR, PR URL e commit SHA.

**"Summary"** significa: solo PR number, elenco file modificati (senza patch/diff), commenti PR.
Il diff completo delle iterazioni più vecchie viene omesso per contenere le dimensioni del context
document entro la finestra di contesto.

**Motivazione della soglia "ultime 2":**

- Una sola iterazione precedente è insufficiente: per il rework #3, l'agente non saprebbe perché
  alcune scelte del rework #1 erano state fatte, rendendo il codice opaco.
- Tre o più iterazioni complete (con diff) saturerebbero rapidamente il budget di token:
  3 diff da 50.000 token = 150.000 token → rimane poco spazio per l'iterazione corrente
  e per il ragionamento di Claude.
- Il summary dell'iterazione N-1 (senza diff) è sufficiente per dare contesto storico:
  l'agente sa cosa era stato modificato e cosa il founder aveva detto, anche senza il codice
  esatto delle modifiche — può leggere il file corrente dal repository.

**Costruzione del context per rework #N:**

I dati di ogni iterazione precedente sono recuperabili da:
1. `task_events` in Supabase filtrati per timestamp (ogni iterazione ha un `task.started`
   e `task.completed` che delimitano gli eventi di quell'esecuzione).
2. GitHub API per il diff e i commenti della PR (la PR è unica per task — si accumula nel tempo).

Per distinguere i commenti di iterazioni diverse: usare il timestamp del commento e i
timestamp degli eventi `task.started` e `task.completed` corrispondenti.

---

## Conseguenze

### Conseguenze positive

1. **Minima deviazione architetturale.** `ClaudeRunner` aggiunge un metodo `buildReworkMd()`
   e `runRework()` — strutturalmente identici a `buildTaskMd()` e `run()`. La modifica è
   ≤ 50 righe di TypeScript.

2. **Nessuna migrazione schema.** Non si tocca il DB Supabase per questo ADR.
   Non è richiesta una colonna `context_snapshot`, non è richiesto un bucket Storage.

3. **Debuggabilità.** In caso di rework che produce risultati inattesi, si può:
   - Ispezionare il `REWORK.md` residuo sul VPS (se la pulizia non è ancora avvenuta).
   - Ricostruire il context document manualmente dalle stesse fonti (Supabase + GitHub API)
     e lanciare Claude Code a mano per riprodurre il comportamento.

4. **Robustezza ai crash.** BullMQ riprova il job automaticamente. Al retry, `ClaudeRunner`
   riscrive `REWORK.md` prima di rilanciare Claude — il file è sempre fresco.

5. **Contesto calibrato per iterazioni multiple.** La regola "ultime 2 iterazioni" garantisce
   che l'agente abbia contesto storico sufficiente senza saturare la finestra di contesto di
   Claude Sonnet (200.000 token).

### Conseguenze negative

1. **Contesto non persistente tra VPS.** Se il VPS viene distrutto e riassegnato,
   `REWORK.md` non sopravvive — ma viene ricostruito alla prossima esecuzione. Non è un
   problema pratico perché `REWORK.md` esiste solo durante l'esecuzione.

2. **Latenza aggiuntiva al lancio del rework (~300–500ms).** La costruzione del context
   document richiede chiamate a Supabase e GitHub API. Accettabile: il lancio dell'agente
   ha già una latenza di setup (clone, env check) che oscura questo overhead. Con chiamate
   parallele (Promise.all), il tempo effettivo è ~300ms nel caso tipico.

3. **Dipendenza da GitHub API per il diff.** Se GitHub API non è disponibile al momento
   del lancio del rework, il context document sarà costruito senza il diff (con nota esplicita).
   L'agente può comunque leggere i file dal repository clonato — il diff era un'accelerazione
   cognitiva, non un prerequisito.

4. **`REWORK.md` richiede aggiunta al `.gitignore`.** Va aggiunto al template `.gitignore`
   dei workspace dei clienti per evitare commit accidentali. Azione one-time al provisioning.

---

## Implementazione

### Aggiunta a `.gitignore` del template repo

```gitignore
# File temporanei Robin.dev (generati prima del lancio dell'agente)
TASK.md
REWORK.md
BLOCKED.md
```

### Interfaccia TypeScript (`ReworkPayload`)

```typescript
interface ReworkPayload {
  taskId: string;
  taskTitle: string;
  taskDescription: string;
  iterationNumber: number;         // N del rework corrente (2 per il primo rework)
  branch: string;                  // feat/{taskId}
  prNumber: number;
  prUrl: string;
  reworkInstructions: string;      // testo del founder — obbligatorio non vuoto
  previousIterations: IterationSummary[];  // ultime 2 iterazioni precedenti
  repositoryPath: string;
}

interface IterationSummary {
  iterationNumber: number;
  prNumber: number;
  prUrl: string;
  commitShas: string[];
  modifiedFiles: FileChange[];
  prComments: string;             // testo serializzato dei commenti
  diff?: string;                  // presente solo per l'iterazione più recente (N-1)
}

interface FileChange {
  filename: string;
  additions: number;
  deletions: number;
  patch?: string;                 // patch unificata, presente nel diff dell'iterazione N-1
}
```

### Struttura metodo `ClaudeRunner`

```typescript
async runRework(payload: ReworkPayload, hooks: ClaudeRunnerHooks = {}): Promise<JobResult> {
  const reworkMdPath = path.join(payload.repositoryPath, "REWORK.md");
  fs.writeFileSync(reworkMdPath, this.buildReworkMd(payload), "utf-8");
  try {
    return await this.spawnClaude(
      payload.repositoryPath,
      "Read the instructions in REWORK.md and implement the rework.",
      hooks
    );
  } finally {
    fs.rmSync(reworkMdPath, { force: true });
  }
}
```

---

## Riferimenti

- `docs/spikes/spike-C1-rework-context.md` — analisi completa delle opzioni e limiti pratici
- `docs/ux/rework-dashboard-flow.md` — flusso UX del rework dal punto di vista del founder
- `docs/orchestrator-agent-interface.md` — interfaccia ClaudeRunner / payload esecuzione
- ADR-09: Modello di isolamento infrastrutturale (VPS dedicata per cliente)
- ADR-11: Provisioning VPS con cloud-init
