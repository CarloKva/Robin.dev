# Task: Audit trail delle azioni del founder

**Type:** feature
**Priority:** medium
**Task ID:** c8543089-8661-421e-b451-7227a2b2dd92

## Description

Ogni azione del founder sulla task deve essere tracciata in modo permanente
e distinta dagli eventi dell'agente nella timeline.

**Cosa implementare:**

Funzione `trackUserAction(userId, taskId, action, payload)`:
- Scrive un evento user.* su task_events
- Non può fallire silenziosamente — se la scrittura fallisce, logga ma non blocca l'operazione principale
- Il record è immutabile per design (nessun endpoint di update/delete sugli eventi)

Aggiungere il tracking ai Route Handler esistenti:
- POST /api/tasks → dopo la creazione, emetti user.task.created con il payload della task
- PATCH /api/tasks/{id} → dopo l'aggiornamento, emetti user.task.updated con diff dei campi (before/after)
- DELETE /api/tasks/{id} → prima della cancellazione, emetti user.task.deleted

Aggiornamento visualizzazione nella timeline:
- Gli eventi user.* devono essere visibili nella timeline della task
- Distinguerli visivamente dagli eventi agent.*: usa un'icona persona o avatar invece dell'icona agente
- Testo in linguaggio naturale per ogni tipo:
  - user.task.created → "Task creata"
  - user.task.updated → "Task modificata"
  - user.task.deleted → "Task eliminata"
  - user.rework.initiated → "Rework avviato dalla dashboard" (per uso futuro)

**Acceptance Criteria:**
- Funzione trackUserAction implementata e importabile
- Tracking aggiunto a POST, PATCH, DELETE /api/tasks
- Eventi user.* visibili nella timeline con icona distinta
- Il tracking non blocca mai l'operazione principale (try/catch interno)
- TypeScript strict: zero errori di tipo

## Required Steps (ALL mandatory — do not skip any)

1. Run `git checkout -b feat/c8543089-8661-421e-b451-7227a2b2dd92` to create a new branch
2. Implement the task: create or edit files as needed
3. Run `git add -A && git commit -m "<descriptive message>"`
4. Run `git push origin feat/c8543089-8661-421e-b451-7227a2b2dd92`
5. Open a Pull Request from `feat/c8543089-8661-421e-b451-7227a2b2dd92` to `main`
6. Output the PR URL on the **very last line** of your response in this exact format:
   `{"pr_url":"<url>","branch":"feat/c8543089-8661-421e-b451-7227a2b2dd92"}`

> IMPORTANT: You MUST create a branch, commit, push, and open a PR. Do not skip steps 3–6.
> If you only output text without committing and creating a PR, the task will be considered failed.
> If you cannot proceed, write your question to `BLOCKED.md` in the repository root instead.

## Notes

- Follow the conventions in `CLAUDE.md` if it exists
- Keep changes focused on this task only
- Write tests if the codebase has a test suite
