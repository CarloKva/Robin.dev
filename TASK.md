# Task: Backlog "per repo" con repo selector in sidebar

**Type:** feature
**Priority:** high
**Task ID:** 7a6ca2e1-8ea5-45ab-9319-e23da0585dcb

## Description

Il backlog deve mostrare solo le task della repository attualmente selezionata. Selezione tramite select custom nella sidebar sotto il logo Robin.dev, UX ispirata al workspace switcher Vercel: dropdown con lista repo, indicatore repo attiva, ricerca. Cambio repo aggiorna scope di backlog e sprint.

FASE 1: Verificare tabella repositories e relazione con workspaces; come le task referenziano la repo; dove è la sidebar e stato globale; meccanismo "repo attiva" esistente; come backlog fetcha le task.

FASE 2: Persistenza repo: URL param (?repo=slug) + localStorage; componente RepoSelector (usa Select TASK-UI-01, icona/avatar, ricerca se repo > 5); propagazione filtro; empty state "nessuna repo selezionata".

FASE 3: Creare context/store repo attiva; RepoSelector in sidebar; modificare query backlog per repository_id; modificare pagina sprint; persistenza URL + localStorage; empty state.

FASE 4: Verificare filtro RLS; comportamento repo rimossa da localStorage; valutare indicatore "agente attivo"; URL ?repo=slug condivisibile.

Criteri di accettazione: RepoSelector in sidebar sotto logo (usa Select TASK-UI-01); nome repo attiva con icona; dropdown tutte le repo workspace; persistenza localStorage; /backlog filtra per repo; sprint filtra per repo; empty state se nessuna repo; URL ?repo=slug per link diretti.

## Required Steps (ALL mandatory — do not skip any)

1. Sync with `main` and create a new branch from the latest upstream to avoid merge conflicts:
   ```bash
   git fetch origin
   git checkout -b feat/7a6ca2e1-8ea5-45ab-9319-e23da0585dcb origin/main
   ```
2. Implement the task: create or edit files as needed
3. Run lint and type-check — **both must pass before committing** (see `CLAUDE.md` for exact commands):
   ```bash
   # example — use the commands defined in CLAUDE.md for this project
   npm run lint
   npx tsc --noEmit
   ```
   Fix all errors and warnings before continuing. Do not commit with failing checks.
4. Run `git add -A && git commit -m "<descriptive message>"`
5. Run `git push origin feat/7a6ca2e1-8ea5-45ab-9319-e23da0585dcb`
6. Open a Pull Request from `feat/7a6ca2e1-8ea5-45ab-9319-e23da0585dcb` to `main`
7. After opening the PR, verify CI status checks pass:
   ```bash
   gh pr checks <PR_URL> --watch
   ```
   If any check fails (lint, typecheck, build), fix the issue, push to the same branch, and wait for CI again before reporting.
8. Output the PR URL on the **very last line** of your response in this exact format:
   `{"pr_url":"<url>","branch":"feat/7a6ca2e1-8ea5-45ab-9319-e23da0585dcb"}`

> IMPORTANT: You MUST create a branch, commit, push, and open a PR. Do not skip steps 4–8.
> If you only output text without committing and creating a PR, the task will be considered failed.
> If you cannot proceed, write your question to `BLOCKED.md` in the repository root instead.

## Notes

- Follow the conventions in `CLAUDE.md` if it exists
- Keep changes focused on this task only
- Write tests if the codebase has a test suite
