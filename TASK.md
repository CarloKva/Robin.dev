# Task: Refactor flusso backlog/sprint — planning separato da esecuzione agente

**Type:** feature
**Priority:** high
**Task ID:** 29b191bf-12db-4dc7-8875-bed588ab4e95

## Description

Perfetto, ha senso. Ecco la task:

Titolo: Refactor flusso backlog/sprint — planning separato da esecuzione agente
Tipo: Feature · Priorità: Alta
Descrizione:
Attualmente la creazione di una task avvia immediatamente l'esecuzione dell'agente. Il comportamento desiderato è quello di un flusso Jira-like: le task vengono create nel backlog, pianificate in uno sprint, e l'agente le esegue sequenzialmente solo quando lo sprint viene avviato esplicitamente.
Inoltre la navigazione va semplificata: la tab "Tasks" va rimossa e backlog/sprint vanno unificati in un'unica sezione con due sub-tab.

Analisi preliminare richiesta (prima di implementare):
Prima di toccare qualsiasi cosa, l'agente deve analizzare e documentare nel PR:

Dove e perché la creazione di una task trigga l'esecuzione dell'agente — se è un event/webhook sul backend al momento della creazione, oppure se dipende dallo stato iniziale della task o dall'assegnazione dell'agente
Quale campo o stato determina che una task è "pronta per esecuzione" vs "in backlog"
Come è modellato attualmente il ciclo di vita task (stati possibili, transizioni)

L'implementazione deve seguire le conclusioni di questa analisi.

Acceptance Criteria:
Flusso backlog → sprint → esecuzione:

Creare una task dal backlog NON avvia l'agente — la task rimane in stato backlog finché non viene aggiunta a uno sprint
Una task può essere aggiunta a uno sprint senza che l'agente parta
L'agente inizia l'esecuzione delle task solo al momento dell'avvio esplicito dello sprint ("Avvia Sprint")
Quando lo sprint viene avviato, le task vengono eseguite sequenzialmente una dopo l'altra, non in parallelo
Se una task fallisce, lo sprint si ferma (o passa alla successiva — da definire in base all'analisi, ma il comportamento deve essere esplicito e non silente)

Navigazione:

La voce "Tasks" viene rimossa dalla sidebar
"Backlog" e "Sprint" diventano un'unica voce nella sidebar (es. "Backlog")
All'interno, due sub-tab: Backlog e Sprint, stile Jira
La sub-tab Backlog mostra tutte le task non ancora in sprint
La sub-tab Sprint mostra lo sprint corrente con le task assegnate e il pulsante "Avvia Sprint"

Creazione task:

Il form di creazione task non deve assegnare un agente obbligatoriamente al momento della creazione — l'assegnazione può avvenire dopo o al momento dell'avvio sprint
Il campo "Agente" nel form diventa opzionale


Note tecniche:

Non introdurre nuovi stati senza prima aver mappato quelli esistenti (vedi analisi preliminare)
L'esecuzione sequenziale delle task durante lo sprint deve essere gestita lato backend — non affidarsi al frontend per orchestrare l'ordine
Qualsiasi disaccoppiamento tra creazione e trigger dell'agente va fatto in modo che sia reversibile, nel caso si voglia reintrodurre la modalità "esecuzione immediata" in futuro come opzione

## Required Steps (ALL mandatory — do not skip any)

1. Run `git checkout -b feat/29b191bf-12db-4dc7-8875-bed588ab4e95` to create a new branch
2. Implement the task: create or edit files as needed
3. Run `git add -A && git commit -m "<descriptive message>"`
4. Run `git push origin feat/29b191bf-12db-4dc7-8875-bed588ab4e95`
5. Open a Pull Request from `feat/29b191bf-12db-4dc7-8875-bed588ab4e95` to `main`
6. Output the PR URL on the **very last line** of your response in this exact format:
   `{"pr_url":"<url>","branch":"feat/29b191bf-12db-4dc7-8875-bed588ab4e95"}`

> IMPORTANT: You MUST create a branch, commit, push, and open a PR. Do not skip steps 3–6.
> If you only output text without committing and creating a PR, the task will be considered failed.
> If you cannot proceed, write your question to `BLOCKED.md` in the repository root instead.

## Notes

- Follow the conventions in `CLAUDE.md` if it exists
- Keep changes focused on this task only
- Write tests if the codebase has a test suite
