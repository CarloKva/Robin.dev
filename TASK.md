# Task: Dashboard — Redesign metric tiles con sparkline e count-up animation

**Type:** feature
**Priority:** medium
**Task ID:** 1d5d3488-79fc-4b0c-b835-5a1910c4949d

## Description

## Obiettivo
Redesign dei 3 MetricsTile nella dashboard populated (`DashboardClient.tsx`) con numero grande, colore semantico, micro sparkline e animazione count-up al mount.

## Layout
- Grid 3 colonne su desktop, 1 colonna su mobile
- Ogni tile: card rounded-ios-lg, shadow-ios-sm, bg-white dark:bg-[#1C1C1E], padding p-5

## Contenuto ogni tile
- Numero principale: font-bold text-4xl, colore semantico
- Label descrittiva sotto: text-sm text-[#8E8E93]
- Icona Lucide in alto a destra: colore semantico, sfondo colorato pill (opacity 10%)
- Micro sparkline in basso: mini bar chart 7 valori (ultimi 7 giorni), altezza 32px

## Colori semantici per tipo
- Task completate → verde #34C759
- Task in coda → blu #007AFF
- Richiedono attenzione → arancio #FF9500

## Sparkline
- 7 barre verticali proporzionali ai valori
- Colore barra: stesso colore semantico della tile, opacity 60%
- Ultima barra: opacity 100% (oggi)
- Nessuna libreria chart pesante — implementare con div CSS o SVG inline semplice

## Count-up animation
- Al mount della tile, il numero anima da 0 al valore reale
- Durata: 1000ms, easing ease-out
- Usare `react-countup` se già presente, altrimenti implementare con useEffect + requestAnimationFrame

## Criteri di accettazione
- [ ] 3 tile con numero, label, icona e colore semantico corretto
- [ ] Sparkline 7 barre visibile in ogni tile
- [ ] Count-up animation funzionante al mount
- [ ] Colori semantici applicati correttamente per tipo metrica
- [ ] Grid responsive (3 colonne desktop, 1 mobile)
- [ ] Dark mode funzionante

## Required Steps (ALL mandatory — do not skip any)

1. Sync with `main` and create a new branch from the latest upstream to avoid merge conflicts:
   ```bash
   git fetch origin
   git checkout -b feat/1d5d3488-79fc-4b0c-b835-5a1910c4949d origin/main
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
5. Run `git push origin feat/1d5d3488-79fc-4b0c-b835-5a1910c4949d`
6. Open a Pull Request from `feat/1d5d3488-79fc-4b0c-b835-5a1910c4949d` to `main`
7. After opening the PR, verify CI status checks pass:
   ```bash
   gh pr checks <PR_URL> --watch
   ```
   If any check fails (lint, typecheck, build), fix the issue, push to the same branch, and wait for CI again before reporting.
8. Output the PR URL on the **very last line** of your response in this exact format:
   `{"pr_url":"<url>","branch":"feat/1d5d3488-79fc-4b0c-b835-5a1910c4949d"}`

> IMPORTANT: You MUST create a branch, commit, push, and open a PR. Do not skip steps 4–8.
> If you only output text without committing and creating a PR, the task will be considered failed.
> If you cannot proceed, write your question to `BLOCKED.md` in the repository root instead.

## Notes

- Follow the conventions in `CLAUDE.md` if it exists
- Keep changes focused on this task only
- Write tests if the codebase has a test suite
