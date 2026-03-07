# Task: Dashboard — Redesign Agent Status Grid e Workspace Feed

**Type:** feature
**Priority:** medium
**Task ID:** f2dd3d57-85be-4226-b39a-f6b47cb5390f

## Description

## Obiettivo
Redesign dell'AgentStatusGrid e del WorkspaceFeed nella dashboard populated (`DashboardClient.tsx`) con stile iOS 18, status badge animati e timeline verticale.

## Agent Status Grid

### Layout
- Grid 2-3 colonne su desktop, 1 colonna su mobile
- Ogni agent card: rounded-ios-lg, shadow-ios-sm, bg-white dark:bg-[#1C1C1E], padding p-4

### Contenuto card agente
- Avatar con iniziali (cerchio 40px, bg colorato basato sul nome)
- Nome agente: font-semibold
- Status badge: usare StatusBadge component dello Step 1
  - Online: dot verde pulsante + testo "Online"
  - In esecuzione: dot blu pulsante + testo "In esecuzione"
  - Offline: dot grigio + testo "Offline"
- Task corrente: pill grigia con testo troncato (max 30 char + ellipsis)
  oppure "In attesa" se nessuna task attiva

### Hover
- scale(1.02) + shadow più profonda, transizione 200ms

---

## Workspace Feed

### Layout
- Card full-width, rounded-ios-lg, shadow-ios-sm
- Titolo sezione "Attività recente" con timestamp ultimo aggiornamento
- Lista eventi in timeline verticale con linea connettore a sinistra

### Ogni evento feed
- Dot colorato a sinistra connesso da linea verticale
- Icona differenziata per tipo evento:
  - PR aperta → GitPullRequest (viola)
  - Commit → GitCommit (blu)
  - Task completata → CheckCircle (verde)
  - Errore → AlertCircle (rosso)
  - Task creata → Plus (grigio)
- Testo evento con nome task in font-medium
- Timestamp relativo a destra: "3 min fa", "1h fa"
- Hover su evento cliccabile: bg leggero + cursor-pointer

### Empty state feed
- Testo "Nessuna attività recente" centrato, colore muted

## Criteri di accettazione
- [ ] Agent cards con avatar iniziali, nome, status badge e task corrente
- [ ] Dot pulsante per status Online e In esecuzione
- [ ] Hover scale funzionante sulle agent card
- [ ] Feed con timeline verticale e linea connettore
- [ ] Icone differenziate per tipo evento
- [ ] Timestamp relativo per ogni evento
- [ ] Empty state per feed senza eventi
- [ ] Responsive funzionante
- [ ] Dark mode funzionante

## Required Steps (ALL mandatory — do not skip any)

1. Sync with `main` and create a new branch from the latest upstream to avoid merge conflicts:
   ```bash
   git fetch origin
   git checkout -b feat/f2dd3d57-85be-4226-b39a-f6b47cb5390f origin/main
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
5. Run `git push origin feat/f2dd3d57-85be-4226-b39a-f6b47cb5390f`
6. Open a Pull Request from `feat/f2dd3d57-85be-4226-b39a-f6b47cb5390f` to `main`
7. After opening the PR, verify CI status checks pass:
   ```bash
   gh pr checks <PR_URL> --watch
   ```
   If any check fails (lint, typecheck, build), fix the issue, push to the same branch, and wait for CI again before reporting.
8. Output the PR URL on the **very last line** of your response in this exact format:
   `{"pr_url":"<url>","branch":"feat/f2dd3d57-85be-4226-b39a-f6b47cb5390f"}`

> IMPORTANT: You MUST create a branch, commit, push, and open a PR. Do not skip steps 4–8.
> If you only output text without committing and creating a PR, the task will be considered failed.
> If you cannot proceed, write your question to `BLOCKED.md` in the repository root instead.

## Notes

- Follow the conventions in `CLAUDE.md` if it exists
- Keep changes focused on this task only
- Write tests if the codebase has a test suite
