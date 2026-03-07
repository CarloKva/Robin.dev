# Task: Agents — Provisioning stepper animato stile Apple

**Type:** feature
**Priority:** medium
**Task ID:** 51c41aea-3a91-44c2-86eb-fd0c3a5b4a5c

## Description

## Obiettivo
Redesign del componente `ProvisioningTimeline` con stepper verticale animato stile Apple, ETA stimata e stati visivi chiari per ogni fase.

## Layout stepper
- Card centrata max-w-md, rounded-ios-xl, shadow-ios-md, bg-white dark:bg-[#1C1C1E], padding p-6
- Titolo "Configurazione agente in corso..." font-semibold
- ETA stimata sotto il titolo: "~3 minuti rimanenti" text-sm text-[#8E8E93], aggiornata dinamicamente
- Lista step verticale con linea connettore a sinistra

## Step del provisioning
1. Creazione VPS
2. Configurazione sistema
3. Installazione dipendenze
4. Test connessione
5. Agente pronto

## Ogni step
- **Cerchio indicatore** (32px):
  - Completato: bg-[#34C759], icona Check bianca
  - Corrente: bg-[#007AFF], loader spinner bianco animato (animate-spin)
  - In attesa: cerchio vuoto, bordo #D1D1D6, numero step muted
  - Errore: bg-[#FF3B30], icona X bianca
- **Label step**: font-medium text-sm, colore pieno se completato/corrente, muted se in attesa
- **Timestamp**: text-xs text-[#8E8E93], visibile solo se completato ("completato alle 14:32") o corrente ("in corso da 45s")
- **Linea connettore**: tra un cerchio e il successivo, colorata verde se step completato, grigia se in attesa

## Animazioni
- Quando uno step passa a completato: cerchio scala da 1→1.2→1 con colore che vira da blu a verde, durata 400ms
- Quando uno step diventa corrente: fade-in del loader, 200ms
- Linea connettore si "riempie" da grigio a verde con transizione width, 300ms

## Step completato finale
- Sostituire il titolo con "Agente pronto!" in verde
- Cerchio finale con icona Zap invece di Check
- CTA "Vai all'agente" appare con fade-in, filled blu

## Stato errore
- Step in errore: cerchio rosso + messaggio errore inline in rosso sotto la label
- CTA "Riprova" appare sotto lo stepper

## Criteri di accettazione
- [ ] 5 step con cerchi colorati correttamente per stato
- [ ] Spinner animato sullo step corrente
- [ ] Linea connettore colorata verde per step completati
- [ ] ETA stimata visibile e aggiornata
- [ ] Animazione transizione completato funzionante
- [ ] Stato finale con messaggio "Agente pronto!" e CTA
- [ ] Stato errore con messaggio e CTA "Riprova"
- [ ] Dark mode funzionante

## Required Steps (ALL mandatory — do not skip any)

1. Sync with `main` and create a new branch from the latest upstream to avoid merge conflicts:
   ```bash
   git fetch origin
   git checkout -b feat/51c41aea-3a91-44c2-86eb-fd0c3a5b4a5c origin/main
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
5. Run `git push origin feat/51c41aea-3a91-44c2-86eb-fd0c3a5b4a5c`
6. Open a Pull Request from `feat/51c41aea-3a91-44c2-86eb-fd0c3a5b4a5c` to `main`
7. After opening the PR, verify CI status checks pass:
   ```bash
   gh pr checks <PR_URL> --watch
   ```
   If any check fails (lint, typecheck, build), fix the issue, push to the same branch, and wait for CI again before reporting.
8. Output the PR URL on the **very last line** of your response in this exact format:
   `{"pr_url":"<url>","branch":"feat/51c41aea-3a91-44c2-86eb-fd0c3a5b4a5c"}`

> IMPORTANT: You MUST create a branch, commit, push, and open a PR. Do not skip steps 4–8.
> If you only output text without committing and creating a PR, the task will be considered failed.
> If you cannot proceed, write your question to `BLOCKED.md` in the repository root instead.

## Notes

- Follow the conventions in `CLAUDE.md` if it exists
- Keep changes focused on this task only
- Write tests if the codebase has a test suite
