# Task: Input & Form — Standardizzare tutti i campi input con stile iOS 18

**Type:** chore
**Priority:** high
**Task ID:** 7d7fee8e-374f-4712-9057-d75304a912c8

## Description

## Obiettivo
Aggiornare `components/ui/input.tsx` e `components/ui/textarea.tsx` con lo stile iOS 18, e applicare le nuove specifiche a tutti i form esistenti.

## Specifiche Input
```
height: 44px (h-11)
border-radius: 10-12px (rounded-xl)
border: 1px solid #D1D1D6 (border-[#D1D1D6])
background: white (dark: #1C1C1E)
padding: px-3.5
font-size: text-sm (15px)
placeholder-color: #8E8E93

focus:
  border-color: #007AFF
  ring: ring-2 ring-[#007AFF]/20
  outline: none

error state:
  border-color: #FF3B30
  ring: ring-2 ring-[#FF3B30]/20

disabled:
  opacity-50 cursor-not-allowed
```

## Specifiche Label
```
font-size: text-sm
font-weight: font-medium
color: #1C1C1E (dark: white)
margin-bottom: mb-1.5
```

## Struttura form field consigliata
Creare un componente `FormField` wrapper (se non esiste) che include:
- Label sopra
- Input
- Messaggio di errore sotto (text-xs text-[#FF3B30], appare con animazione fade)
- Messaggio helper sotto (text-xs text-[#8E8E93])

## Textarea
Applicare gli stessi border/focus/color token, min-height: 100px, resize-y.

## Criteri di accettazione
- [ ] `input.tsx` aggiornato con le nuove classi
- [ ] `textarea.tsx` aggiornato
- [ ] Tutti i form esistenti (onboarding, settings, create task modal) usano i nuovi stili
- [ ] Error state visivamente distinguibile
- [ ] Focus ring blu visibile
- [ ] Dark mode funzionante

## Required Steps (ALL mandatory — do not skip any)

1. Sync with `main` and create a new branch from the latest upstream to avoid merge conflicts:
   ```bash
   git fetch origin
   git checkout -b feat/7d7fee8e-374f-4712-9057-d75304a912c8 origin/main
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
5. Run `git push origin feat/7d7fee8e-374f-4712-9057-d75304a912c8`
6. Open a Pull Request from `feat/7d7fee8e-374f-4712-9057-d75304a912c8` to `main`
7. After opening the PR, verify CI status checks pass:
   ```bash
   gh pr checks <PR_URL> --watch
   ```
   If any check fails (lint, typecheck, build), fix the issue, push to the same branch, and wait for CI again before reporting.
8. Output the PR URL on the **very last line** of your response in this exact format:
   `{"pr_url":"<url>","branch":"feat/7d7fee8e-374f-4712-9057-d75304a912c8"}`

> IMPORTANT: You MUST create a branch, commit, push, and open a PR. Do not skip steps 4–8.
> If you only output text without committing and creating a PR, the task will be considered failed.
> If you cannot proceed, write your question to `BLOCKED.md` in the repository root instead.

## Notes

- Follow the conventions in `CLAUDE.md` if it exists
- Keep changes focused on this task only
- Write tests if the codebase has a test suite
