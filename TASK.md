# Task: Settings page redesign — layout stile Vercel Settings

**Type:** feature
**Priority:** medium
**Task ID:** 6f34d8cd-7e3b-4647-8e58-3e318262017c

## Description

## Obiettivo
Ridisegnare `app/(dashboard)/settings/page.tsx` con layout Vercel Settings: sidebar nav secondaria per sezioni, ogni sezione con header separatore, form shadcn/ui allineati, danger zone con border destructive.

## Skills da attivare
`web-design-guidelines`, `react-best-practices`, `composition-patterns`, `contrast-checker`

## Struttura layout
`grid grid-cols-4 gap-8` — sidebar nav `col-span-1`, contenuto sezione `col-span-3`

### Sidebar settings nav (colonna sinistra)
- Label gruppo: `text-xs font-medium text-muted-foreground uppercase tracking-wide mb-2`
- Nav items:
  ```
  General | GitHub | Agents | Billing | Danger Zone
  ```
- Ogni item: `text-sm px-3 py-1.5 rounded-md cursor-pointer`
- Stato default: `text-muted-foreground hover:text-foreground hover:bg-accent`
- Stato attivo: `text-foreground bg-accent font-medium`
- Navigazione: scroll-to-section con `id` anchor o routing con query param `?section=github`
- "Danger Zone" item: `text-destructive hover:text-destructive hover:bg-destructive/10`

### Contenuto sezioni (colonna destra)

**Pattern header sezione** (ripetuto per ogni sezione):
```jsx
<div className="border-b border-border pb-4 mb-6">
  <h2 className="text-base font-semibold text-foreground">General</h2>
  <p className="text-sm text-muted-foreground mt-1">Gestisci le impostazioni generali del workspace</p>
</div>
```

**Sezione General**
- Nome workspace: `<Input>` con label `text-sm font-medium` sopra
- Slug workspace: `<Input>` readonly con prefisso `robin.dev/` in `text-muted-foreground`
- Save button: `variant="default" size="sm"` allineato a destra

**Sezione GitHub**
- GitHub token: `<Input type="password">` con toggle show/hide (`Eye`/`EyeOff` Lucide)
- GitHub org/user: `<Input>`
- Stato connessione: badge `bg-emerald-50 text-emerald-700` "Connesso" o `bg-zinc-100 text-zinc-600` "Non configurato"

**Sezione Agents**
- VPS default: `<Input>` per IP
- SSH key path: `<Input>`
- Timeout task (min): `<Input type="number">`

**Sezione Billing**
- Layout placeholder: `border border-border rounded-lg p-6 text-center`
- Icona `CreditCard` Lucide + `text-sm text-muted-foreground "Gestione billing disponibile a breve"`

**Sezione Danger Zone**
- Container: `border border-destructive/50 rounded-lg p-4`
- Header: `text-base font-semibold text-destructive`
- Descrizione: `text-sm text-muted-foreground`
- Azioni distruttive (es. "Elimina workspace", "Reset dati"):
  - Ogni azione: layout `flex items-center justify-between py-3 border-b border-destructive/20 last:border-0`
  - Label + descrizione a sinistra, bottone a destra: `variant="outline" size="sm" className="border-destructive text-destructive hover:bg-destructive hover:text-destructive-foreground"`

### Compound component
Se la pagina supera 3 boolean props o sezioni props-dipendenti, applica `composition-patterns`:
- `<SettingsSection>`, `<SettingsSection.Header>`, `<SettingsSection.Body>`

## Note tecniche
- Mantieni logica save/fetch settings esistente — solo layer UI
- Zero modifiche a API routes, logica business o tipi TypeScript condivisi
- Testa in light e dark mode

## Criteri di accettazione
- [ ] Layout 1/4 + 3/4 con sidebar nav secondaria funzionante
- [ ] Nav item attivo evidenziato correttamente
- [ ] Ogni sezione con header `border-b border-border` e descrizione
- [ ] Danger zone con `border border-destructive/50` e bottoni destructive outlined
- [ ] "Danger Zone" nav item in `text-destructive`
- [ ] `contrast-checker` superato per testo destructive su sfondo card
- [ ] Dark mode verificata visivamente
- [ ] Zero modifiche a logica business o tipi condivisi

## Required Steps (ALL mandatory — do not skip any)

1. Sync with `staging` and create a new branch from the latest upstream to avoid merge conflicts:
   ```bash
   git fetch origin
   git checkout -b feat/6f34d8cd-7e3b-4647-8e58-3e318262017c origin/staging
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
5. Run `git push origin feat/6f34d8cd-7e3b-4647-8e58-3e318262017c`
6. Open a Pull Request from `feat/6f34d8cd-7e3b-4647-8e58-3e318262017c` to `staging`
7. After opening the PR, verify CI status checks pass:
   ```bash
   gh pr checks <PR_URL> --watch
   ```
   If any check fails (lint, typecheck, build), fix the issue, push to the same branch, and wait for CI again before reporting.
8. Output the PR URL on the **very last line** of your response in this exact format:
   `{"pr_url":"<url>","branch":"feat/6f34d8cd-7e3b-4647-8e58-3e318262017c"}`

> IMPORTANT: You MUST create a branch, commit, push, and open a PR. Do not skip steps 4–8.
> If you only output text without committing and creating a PR, the task will be considered failed.
> If you cannot proceed, write your question to `BLOCKED.md` in the repository root instead.

## Notes

- Follow the conventions in `CLAUDE.md` if it exists
- Keep changes focused on this task only
- Write tests if the codebase has a test suite
