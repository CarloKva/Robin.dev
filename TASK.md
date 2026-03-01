# Task: Storico iterazioni nella task detail

**Type:** feature
**Priority:** medium
**Task ID:** 88de7272-7019-428e-a2c7-959167108a1b

## Description

Il founder deve poter vedere la storia completa di ogni iterazione di una task
direttamente nella task detail. Questa feature è autonoma — non dipende dal
rework engine, solo dal modello dati.

**Cosa implementare:**

Aggiornamento alla TaskDetailPage (o componente equivalente):

Sezione "Iterazioni" che mostra tutte le task_iterations per la task corrente,
ordinate per iteration_number crescente.

Componente IterationCard per ogni iterazione:
- Numero iterazione (es. "#1 — Esecuzione originale", "#2 — Rework")
- Trigger in linguaggio naturale: "Esecuzione originale" | "Rework da commenti GitHub" | "Rework dalla dashboard"
- Data di inizio e completamento (se presente)
- Stato con badge colorato: pending (grigio), running (blu), completed (verde), failed (rosso)
- Link alla PR (se presente)
- Summary dell'agente (se presente nel campo summary — potrebbe essere vuoto per ora)

Al click su una IterationCard: espandi una sezione con gli eventi della timeline
filtrati per iteration_number. Riutilizza i componenti della timeline esistente
di Sprint 3 — non reinventare nulla.

L'iterazione con l'iteration_number più alto è evidenziata come "corrente".

Query da implementare:
```typescript
// Recupera tutte le iterazioni per una task
const iterations = await prisma.taskIterations.findMany({
  where: { task_id: taskId },
  orderBy: { iteration_number: 'asc' }
})
```

**Acceptance Criteria:**
- Sezione "Iterazioni" visibile nella task detail
- IterationCard implementata con tutti i campi sopra
- Click su card espande la timeline filtrata per quella iterazione
- Iterazione corrente evidenziata visivamente
- Se nessuna iterazione esiste (task mai eseguita): la sezione non appare o mostra un messaggio neutro
- TypeScript strict: zero errori di tipo

## Required Steps (ALL mandatory — do not skip any)

1. Run `git checkout -b feat/88de7272-7019-428e-a2c7-959167108a1b` to create a new branch
2. Implement the task: create or edit files as needed
3. Run `git add -A && git commit -m "<descriptive message>"`
4. Run `git push origin feat/88de7272-7019-428e-a2c7-959167108a1b`
5. Open a Pull Request from `feat/88de7272-7019-428e-a2c7-959167108a1b` to `main`
6. Output the PR URL on the **very last line** of your response in this exact format:
   `{"pr_url":"<url>","branch":"feat/88de7272-7019-428e-a2c7-959167108a1b"}`

> IMPORTANT: You MUST create a branch, commit, push, and open a PR. Do not skip steps 3–6.
> If you only output text without committing and creating a PR, the task will be considered failed.
> If you cannot proceed, write your question to `BLOCKED.md` in the repository root instead.

## Notes

- Follow the conventions in `CLAUDE.md` if it exists
- Keep changes focused on this task only
- Write tests if the codebase has a test suite
