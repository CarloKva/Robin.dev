# Task: Task Detail — PR Card con status, commit list e link GitHub

**Type:** feature
**Priority:** medium
**Task ID:** 4f384eef-347f-434a-ab3c-91f91db130e8

## Description

## Obiettivo
Redesign del componente `PRCard` nel task detail con bordo colorato, status PR visivo, lista commit compatta e link diretto a GitHub.

## PR Card container
- Card rounded-ios-lg, shadow-ios-sm, bg-white dark:bg-[#1C1C1E]
- Bordo sinistro 3px colorato in base allo status PR:
  - open: viola (#8B5CF6)
  - merged: viola scuro (#6D28D9)
  - closed: rosso (#FF3B30)
  - draft: grigio (#8E8E93)
- Posizionata nella colonna sinistra del task detail, sotto la descrizione

## Header PR card
- Icona GitPullRequest (colore basato su status)
- Titolo PR: font-medium, troncato su 1 riga
- Status badge: pill colorata (open=viola, merged=viola scuro, closed=rosso, draft=grigio)
- Link "Apri su GitHub" con icona ExternalLink, allineato a destra, testo #007AFF

## Dettagli PR
- Numero PR: "#123" text-xs text-[#8E8E93]
- Branch: icona GitBranch + nome branch, text-xs, pill grigia
- Data apertura: text-xs text-[#8E8E93]

## Commit list
- Titolo sezione "Commit" con count pill
- Lista compatta, max 5 commit visibili, resto collassabile con "Mostra altri N"
- Ogni commit:
  - Hash corto (7 char): font-mono text-xs, bg-gray-100 dark:bg-[#2C2C2E] pill
  - Messaggio commit: text-sm, truncate 1 riga, flex-1
  - Timestamp: text-xs text-[#8E8E93] allineato a destra
- Separatore sottile tra commit

## Empty state
- Se nessuna PR collegata: placeholder con icona GitPullRequest muted + testo "Nessuna PR aperta" + sottotitolo "L'agente aprirà una PR quando inizierà a lavorare"

## Criteri di accettazione
- [ ] Bordo sinistro colorato corretto per ogni status PR
- [ ] Header con icona, titolo, status badge e link GitHub
- [ ] Branch e numero PR visibili
- [ ] Lista commit con hash, messaggio e timestamp
- [ ] Collasso commit oltre il quinto
- [ ] Empty state visibile quando nessuna PR collegata
- [ ] Dark mode funzionante

## Required Steps (ALL mandatory — do not skip any)

1. Sync with `main` and create a new branch from the latest upstream to avoid merge conflicts:
   ```bash
   git fetch origin
   git checkout -b feat/4f384eef-347f-434a-ab3c-91f91db130e8 origin/main
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
5. Run `git push origin feat/4f384eef-347f-434a-ab3c-91f91db130e8`
6. Open a Pull Request from `feat/4f384eef-347f-434a-ab3c-91f91db130e8` to `main`
7. After opening the PR, verify CI status checks pass:
   ```bash
   gh pr checks <PR_URL> --watch
   ```
   If any check fails (lint, typecheck, build), fix the issue, push to the same branch, and wait for CI again before reporting.
8. Output the PR URL on the **very last line** of your response in this exact format:
   `{"pr_url":"<url>","branch":"feat/4f384eef-347f-434a-ab3c-91f91db130e8"}`

> IMPORTANT: You MUST create a branch, commit, push, and open a PR. Do not skip steps 4–8.
> If you only output text without committing and creating a PR, the task will be considered failed.
> If you cannot proceed, write your question to `BLOCKED.md` in the repository root instead.

## Notes

- Follow the conventions in `CLAUDE.md` if it exists
- Keep changes focused on this task only
- Write tests if the codebase has a test suite
