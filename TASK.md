# Task: Context — Redesign layout due pannelli con doc list ed editor

**Type:** feature
**Priority:** medium
**Task ID:** 3f755dc3-003c-4ee7-b5d6-9ef74c277416

## Description

## Obiettivo
Redesign della pagina Context con layout a due pannelli stile Apple Notes: lista documenti a sinistra (30%) ed editor a destra (70%).

## Layout generale
- Altezza: calc(100vh - header height), overflow hidden
- Pannello sinistro: 30% width, border-r border-[#D1D1D6] dark:border-[#38383A], overflow-y-auto
- Pannello destro: 70% width, overflow-y-auto
- Su mobile: pannello sinistro occupa tutto lo schermo, tap su doc apre l'editor in overlay (back button per tornare alla lista)

## Pannello sinistro — Lista documenti
- Header: titolo "Context" font-semibold + bottone "Nuovo documento" icona Plus
- Search bar: input rounded-xl h-9 con icona Search, filtra la lista in tempo reale
- Lista doc card:
  - Icona tipo documento: FileText (generico), Code (codice), FileMarkdown (markdown)
  - Titolo documento: font-medium text-sm
  - Snippet contenuto: 2 righe, text-xs text-[#8E8E93], truncate
  - Data modifica: text-xs text-[#8E8E93] allineata a destra
- Doc selezionato: bg-[#007AFF]/10 dark:bg-[#007AFF]/15, bordo sinistro blu 2px
- Hover doc non selezionato: bg-gray-50 dark:bg-[#2C2C2E]/50
- Empty state: "Nessun documento" con CTA "Crea il primo documento"

## Pannello destro — Editor
- Toolbar minimalista in cima: icone Bold, Italic, Link, Code block — separate da divider verticale
- Titolo documento: input large, font-bold text-xl, no bordo, placeholder "Titolo documento"
- Area editor: textarea o rich text editor esistente, padding generoso
- Auto-save indicator in alto a destra:
  - Salvataggio in corso: icona Loader spin + "Salvataggio..." text-xs text-[#8E8E93]
  - Salvato: icona Check verde + "Salvato" text-xs text-[#34C759], scompare dopo 2s
- Empty state editor (nessun doc selezionato): illustrazione centrata + "Seleziona un documento per iniziare"

## Modal sincronizzazione GitHub
- Desktop: modal centrata max-w-lg, rounded-2xl, shadow-2xl
- Mobile: bottom drawer (stesso pattern Step 7)
- Contenuto: lista file dal repository con checkbox, search bar, bottone "Importa selezionati"
- Ogni file: icona tipo file, nome, path, checkbox a destra
- Stato importato: checkmark verde, testo muted

## Criteri di accettazione
- [ ] Layout due pannelli 30/70 funzionante su desktop
- [ ] Pannello sinistro con search e lista doc card
- [ ] Doc selezionato con bg blu e bordo sinistro
- [ ] Auto-save indicator funzionante
- [ ] Toolbar editor minimalista visibile
- [ ] Modal GitHub: lista file con checkbox e importazione
- [ ] Empty state per lista vuota e editor senza selezione
- [ ] Mobile: pannello lista a schermo intero con navigazione back
- [ ] Dark mode funzionante

## Required Steps (ALL mandatory — do not skip any)

1. Sync with `main` and create a new branch from the latest upstream to avoid merge conflicts:
   ```bash
   git fetch origin
   git checkout -b feat/3f755dc3-003c-4ee7-b5d6-9ef74c277416 origin/main
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
5. Run `git push origin feat/3f755dc3-003c-4ee7-b5d6-9ef74c277416`
6. Open a Pull Request from `feat/3f755dc3-003c-4ee7-b5d6-9ef74c277416` to `main`
7. After opening the PR, verify CI status checks pass:
   ```bash
   gh pr checks <PR_URL> --watch
   ```
   If any check fails (lint, typecheck, build), fix the issue, push to the same branch, and wait for CI again before reporting.
8. Output the PR URL on the **very last line** of your response in this exact format:
   `{"pr_url":"<url>","branch":"feat/3f755dc3-003c-4ee7-b5d6-9ef74c277416"}`

> IMPORTANT: You MUST create a branch, commit, push, and open a PR. Do not skip steps 4–8.
> If you only output text without committing and creating a PR, the task will be considered failed.
> If you cannot proceed, write your question to `BLOCKED.md` in the repository root instead.

## Notes

- Follow the conventions in `CLAUDE.md` if it exists
- Keep changes focused on this task only
- Write tests if the codebase has a test suite
