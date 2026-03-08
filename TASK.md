# Task: Reports — Redesign con metric cards, charts stile iOS e date range picker

**Type:** feature
**Priority:** medium
**Task ID:** ef7a9926-2be0-4f72-bb41-815aa771f30e

## Description

## Obiettivo
Redesign di `ReportsClient.tsx` con header date range picker, metric cards con trend, charts con stile iOS e bottone export.

## Page header
- Titolo "Reports" font-bold text-2xl
- Date range picker a destra: pill cliccabile che mostra il range selezionato (es. "1 Gen — 31 Gen 2025")
  - Click apre un popover con calendario o selezione rapida: "Ultima settimana", "Ultimo mese", "Ultimi 3 mesi", "Custom"
  - Stile pill: bg-white dark:bg-[#1C1C1E], border, rounded-xl, h-9, icona Calendar a sinistra
- Bottone "Esporta" a destra della pill: icona Download, variante secondary, rounded-xl

## Metric cards con trend
- Grid 4 colonne desktop / 2 tablet / 1 mobile
- Ogni card: rounded-ios-lg, shadow-ios-sm, bg-white dark:bg-[#1C1C1E], padding p-5
- Contenuto:
  - Icona Lucide in cerchio colorato (bg semantico/10)
  - Numero principale: font-bold text-3xl con count-up animation al mount
  - Label: text-sm text-[#8E8E93]
  - Trend indicator: freccia ↑ verde o ↓ rossa + percentuale + "vs settimana scorsa"
- Metriche: Task completate, PR aperte, Tempo medio completamento, Agenti attivi

## Charts
Usare la libreria charts già presente nel progetto (verificare recharts o chart.js). Applicare stile iOS:
- Colori: blu #007AFF, verde #34C759, arancio #FF9500
- Griglia: linee orizzontali sottili, colore #F2F2F7 dark:#2C2C2E
- Nessun bordo attorno al chart
- Tooltip: rounded-ios, shadow-ios-sm, bg-white dark:bg-[#1C1C1E]
- Label assi: text-xs text-[#8E8E93]

### Line chart — Velocità completamento task
- Card full-width, titolo "Task completate nel tempo"
- Area chart con gradiente sotto la linea (colore #007AFF, opacity 10%→0%)
- Punti dati evidenziati su hover

### Bar chart — Task per giorno
- Card metà larghezza, titolo "Task per giorno"
- Barre arrotondate in cima (borderRadius 4px)
- Colore barre: #007AFF

### Donut chart — Distribuzione status
- Card metà larghezza, titolo "Distribuzione status"
- Colori per status: done=verde, running=blu, failed=rosso, in_review=giallo
- Legenda sotto il donut con label e percentuale

## Export
- Click bottone "Esporta": dropdown con opzioni "Esporta CSV" e "Esporta PDF"
- CSV: genera e scarica file con i dati delle metric cards e tabelle
- PDF: placeholder toast "Funzionalità in arrivo"

## Criteri di accettazione
- [ ] Date range picker funzionante con selezioni rapide
- [ ] 4 metric cards con trend indicator
- [ ] Count-up animation al mount
- [ ] Line chart con area gradient
- [ ] Bar chart con barre arrotondate
- [ ] Donut chart con legenda
- [ ] Stile iOS applicato a tutti i chart (colori, griglia, tooltip)
- [ ] Bottone export con dropdown CSV/PDF
- [ ] Responsive funzionante
- [ ] Dark mode funzionante

## Required Steps (ALL mandatory — do not skip any)

1. Sync with `main` and create a new branch from the latest upstream to avoid merge conflicts:
   ```bash
   git fetch origin
   git checkout -b feat/ef7a9926-2be0-4f72-bb41-815aa771f30e origin/main
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
5. Run `git push origin feat/ef7a9926-2be0-4f72-bb41-815aa771f30e`
6. Open a Pull Request from `feat/ef7a9926-2be0-4f72-bb41-815aa771f30e` to `main`
7. After opening the PR, verify CI status checks pass:
   ```bash
   gh pr checks <PR_URL> --watch
   ```
   If any check fails (lint, typecheck, build), fix the issue, push to the same branch, and wait for CI again before reporting.
8. Output the PR URL on the **very last line** of your response in this exact format:
   `{"pr_url":"<url>","branch":"feat/ef7a9926-2be0-4f72-bb41-815aa771f30e"}`

> IMPORTANT: You MUST create a branch, commit, push, and open a PR. Do not skip steps 4–8.
> If you only output text without committing and creating a PR, the task will be considered failed.
> If you cannot proceed, write your question to `BLOCKED.md` in the repository root instead.

## Notes

- Follow the conventions in `CLAUDE.md` if it exists
- Keep changes focused on this task only
- Write tests if the codebase has a test suite
