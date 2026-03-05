# Onboarding — Robin.dev

**Last updated:** 2026-03-05

---

## 1. Checklist onboarding cliente

Completare in ordine. Ogni step ha un criterio di successo verificabile.

- [ ] VPS provisionate con `provision-vps.sh` (o procedura manuale in `docs/runbook.md §5`)
- [ ] Workspace creato con `scripts/create-workspace.ts`
- [ ] Deploy key aggiunta a GitHub con write access
- [ ] `.env` compilato e `systemctl` service avviato
- [ ] Smoke test PASS (`scripts/smoke-test.ts`)
- [ ] Prima task reale eseguita con successo
- [ ] CLAUDE.md committato nel repository del cliente
- [ ] Cliente ha accesso al gestionale Robin.dev
- [ ] Scheda cliente compilata e committata in `docs/clients/<slug>.md`

---

## 2. Scheda cliente (template)

Creare `docs/clients/<slug>.md` copiando questo template.
**Nessun dato sensibile in chiaro** (no password, no API key, no token).

```markdown
# Scheda Cliente — {{CLIENT_NAME}}

## Identificativi

| Campo | Valore |
|-------|--------|
| Slug | `{{CLIENT_SLUG}}` |
| Nome | {{CLIENT_NAME}} |
| Email referente tecnico | {{CLIENT_EMAIL}} |
| Data provisioning | {{PROVISIONING_DATE}} |

## Infrastruttura

| Campo | Valore |
|-------|--------|
| Workspace ID | `{{WORKSPACE_UUID}}` |
| Agent ID | `{{AGENT_UUID}}` |
| Clerk User ID | `{{CLERK_USER_ID}}` |
| VPS IP | `{{VPS_IP}}` |
| VPS Nome | `robin-{{CLIENT_SLUG}}` |
| VPS Regione | Hetzner FSN1 |
| SSH Key fingerprint | `{{SSH_KEY_FINGERPRINT}}` |

## Repository

| Campo | Valore |
|-------|--------|
| GitHub Org | `{{GITHUB_ORG}}` |
| GitHub Repo | `{{GITHUB_REPO}}` |
| Branch principale | `main` |
| Deploy Key | `robin-agent-{{CLIENT_SLUG}}@robin.dev` |

## Stack

Framework:       Next.js 15 / Express / altro
Package manager: npm / pnpm / bun
Test runner:     jest / vitest / playwright
Node version:    22

## Link operativi

- Hetzner Console: https://console.hetzner.cloud → robin-{{CLIENT_SLUG}}
- Supabase Dashboard: https://supabase.com/dashboard/project/ccgodxlviculeqsnlgse/editor → filtro workspace_id
- GitHub Deploy Key: https://github.com/{{GITHUB_ORG}}/{{GITHUB_REPO}}/settings/keys

## Storico operativo

YYYY-MM-DD — Provisioning completato. Smoke test PASS.
YYYY-MM-DD — Prima task eseguita: [titolo task]

## Note tecniche

(Particolarità del progetto non nel CLAUDE.md)

## Offboarding

Data richiesta:
Data esecuzione:
Script: offboard-workspace.ts --workspace-id {{WORKSPACE_UUID}} --slug {{CLIENT_SLUG}}
VPS eliminata: [ ] sì / [ ] no
Deploy key revocata: [ ] sì / [ ] no
```

---

## 3. Questionario onboarding tecnico

Da compilare con il cliente (CTO/Lead developer) prima di creare il CLAUDE.md.
**Tempo stimato:** 15–30 minuti.

### Sezione 1 — Identificativi Progetto

**1.1** Nome del progetto/prodotto: `_______________`

**1.2** GitHub username o organization name: `_______________`

**1.3** Nome del repository principale: `_______________`

**1.4** Altri repository su cui Robin potrebbe lavorare:
- [ ] No, solo il repository principale
- [ ] Sì: `_______________`

**1.5** Branch principale:
- [ ] `main` | [ ] `master` | [ ] Altro: `_______________`

### Sezione 2 — Stack Tecnologico

**2.1** Linguaggio/runtime principale:
- [ ] TypeScript/Node.js | [ ] JavaScript/Node.js | [ ] Python | [ ] Go | [ ] Rust | [ ] Altro: `___`

**2.2** Framework principale:
- [ ] Next.js (App Router) | [ ] Next.js (Pages Router) | [ ] React | [ ] Express.js | [ ] Fastify | [ ] NestJS | [ ] Django/FastAPI | [ ] Altro: `___`

**2.3** Database e ORM:
- [ ] Supabase (PostgreSQL) | [ ] PostgreSQL + Prisma | [ ] PostgreSQL + raw SQL | [ ] MySQL | [ ] MongoDB | [ ] SQLite | [ ] Altro: `___`

**2.4** Autenticazione:
- [ ] Clerk | [ ] NextAuth/Auth.js | [ ] Supabase Auth | [ ] Auth0 | [ ] JWT custom | [ ] Nessuna

**2.5** Package manager: [ ] npm | [ ] pnpm | [ ] bun | [ ] yarn

**2.6** Versione Node.js richiesta: `_______________`

**2.7** Monorepo?
- [ ] No
- [ ] Sì, con: [ ] npm workspaces | [ ] pnpm workspaces | [ ] Turborepo | [ ] Nx
- Workspace principale di Robin: `_______________`

### Sezione 3 — Comandi di Sviluppo

| Comando | Valore |
|---------|--------|
| Dev server | `_______________` (porta: `___`) |
| Tutti i test | `_______________` |
| Test singolo file | `_______________` |
| Build produzione | `_______________` |
| Lint | `_______________` |
| Type check | `_______________` |
| Altri comandi (con scopo) | `_______________` |

### Sezione 4 — Convenzioni del Codice

**4.1** Config ESLint/Prettier/Biome: [ ] Sì (file: `___`) | [ ] No

**4.2** Stile indentazione: [ ] 2 spazi | [ ] 4 spazi | [ ] Tab

**4.3** Naming file: [ ] PascalCase | [ ] camelCase | [ ] kebab-case | [ ] snake_case | [ ] Misto: `___`

**4.4** Commit messages: [ ] Conventional Commits | [ ] Libero | [ ] Personalizzato: `___`

**4.5** TypeScript settings particolari (es. `strict: true`, `exactOptionalPropertyTypes`): `___`

**4.6** Pattern/architettura predominante (es. feature folders, domain-driven): `___`

### Sezione 5 — Branch Policy e Pull Request

**5.1** Naming branch: [ ] `feat/<name>` | [ ] `feature/<name>` | [ ] `<ticket-id>-<desc>` | [ ] Personalizzato: `___`

**5.2** Reviewer PR di Robin (GitHub username/team): `_______________`

**5.3** Check obbligatori prima del merge (CI, coverage, approval): `_______________`

**5.4** Strategia merge: [ ] Squash | [ ] Rebase | [ ] Merge commit | [ ] Non importa

**5.5** La PR deve includere: [ ] Link ticket | [ ] Screenshot/GIF UI | [ ] "How to test" | [ ] CHANGELOG

### Sezione 6 — Aree Sensibili del Repository

**6.1** File/directory che Robin NON deve modificare senza istruzioni esplicite:
```
(es. .env*, infra/, terraform/, deploy/, prisma/migrations/)
_______________
_______________
```

**6.2** Aree particolarmente delicate (pagamenti, auth, dati personali): `_______________`

**6.3** Script che NON devono essere eseguiti (es. deploy, DB seed prod): `_______________`

**6.4** GitHub Actions / CI/CD:
- [ ] No CI/CD
- [ ] Sì, Robin PUO' modificare i workflow
- [ ] Sì, Robin NON deve modificare i workflow (path: `___`)

### Sezione 7 — Ambiente di Sviluppo

**7.1** Dipendenze di sistema (es. Docker, PostgreSQL locale, Redis): `_______________`

**7.2** Setup locale: File: `___` · Comando setup: `_______________`

**7.3** Variabili d'ambiente per i test:
- [ ] No, i test girano senza .env
- [ ] Sì, necessario .env con: `___`
- [ ] Sì, c'è un `.env.test` o `.env.example`

**7.4** I test usano: [ ] Mock | [ ] Database locale | [ ] Database di test su cloud

### Sezione 8 — Contesto Aggiuntivo

**8.1** Pattern o convenzioni non standard che Robin deve conoscere: `_______________`

**8.2** Librerie interne o utility custom frequenti: `_______________`

**8.3** Parti del codebase più instabili/in evoluzione da evitare: `_______________`

**8.4** Bug ricorrenti o gotcha da evitare: `_______________`

**8.5** Come gestire l'incertezza:
- [ ] Fermarsi e chiedere sempre (BLOCKED.md)
- [ ] Fare una scelta ragionevole e documentarla nella PR
- [ ] Dipende dall'area: `_______________`

### Sezione 9 — Note Finali

**9.1** Altro che il team Robin.dev deve sapere: `_______________`

**9.2** Contatto tecnico di riferimento:
- Nome: `___` · Email/Slack: `___` · Disponibilità: `___`

### Checklist compilazione questionario

- [ ] Sezione 2 (stack): linguaggio, framework, package manager compilati
- [ ] Sezione 3 (comandi): tutti verificati e testati localmente
- [ ] Sezione 5 (PR policy): reviewer configurato
- [ ] Sezione 6 (aree sensibili): lista completa path da non toccare

---

## 4. Compilazione CLAUDE.md

**Prerequisiti:** questionario onboarding compilato.
**Output:** `CLAUDE.md` committato nel repository del cliente.
**Durata:** 30–45 minuti.

### STEP 1 — Raccogliere il questionario

Verificare sezioni critiche compilate: 2 (stack), 3 (comandi), 5 (branch policy), 6 (aree sensibili).

### STEP 2 — Copiare il template

```bash
cp /path/to/robin-platform/docs/templates/CLAUDE.md ./CLAUDE.md
```

### STEP 3 — Compilare la sezione WORKSPACE

Sostituire tutti i placeholder `{{...}}` con i valori reali dal questionario.

| Placeholder | Sezione questionario | Esempio |
|-------------|---------------------|---------|
| `{{WORKSPACE_SLUG}}` | 1.1 | `acme` |
| `{{GITHUB_ACCOUNT}}` | 1.2 | `acme-org` |
| `{{MAIN_BRANCH}}` | 1.5 | `main` |
| `{{DEV_COMMAND}}` | 3.1 | `npm run dev` |
| `{{TEST_COMMAND}}` | 3.2 | `npm test` |
| `{{BUILD_COMMAND}}` | 3.4 | `npm run build` |
| `{{LINT_COMMAND}}` | 3.5 | `npm run lint` |
| `{{TYPECHECK_COMMAND}}` | 3.6 | `npx tsc --noEmit` |
| `{{PACKAGE_MANAGER}}` | 2.5 | `npm` |
| `{{NODE_VERSION}}` | 2.6 | `22` |
| `{{SENSITIVE_PATHS}}` | 6.1+6.3 | `.env*, infra/, migrations/` |
| `{{TEST_COMMAND_SINGLE}}` | 3.3 | `npx jest src/foo.test.ts` |
| `{{DEPLOY_NOTES}}` | 6.4+9.1 | `Non pushare su production direttamente.` |

Verificare nessun placeholder rimanente:
```bash
grep -n '{{' CLAUDE.md
# Atteso: nessun output
```

### STEP 4 — Attivare la variante stack

Il template ha due varianti stack in commento HTML:

**Se Next.js + Supabase (2.2 = Next.js, 2.3 = Supabase):**
1. Trovare `=== VARIANTE A: Next.js + Supabase ===`
2. Rimuovere `<!--` che la precede
3. Rimuovere `=== END VARIANTE A ===` con `-->` che la segue
4. Eliminare l'intera VARIANTE B

**Se Node.js API pura (2.1 = Node.js, 2.2 = Express/Fastify/NestJS):**
Procedura speculare: attivare VARIANTE B, eliminare VARIANTE A.

**Se stack non coperto:** scrivere sezione custom `## Stack: <nome stack>` basandosi su Sezioni 4 e 8.

### STEP 5 — Review con il cliente

Inviare il CLAUDE.md compilato al contatto tecnico (Sezione 9.2) per review.

Checklist review:
```
[ ] I comandi nella Sezione "Development Commands" sono corretti e testati?
[ ] La lista "Sensitive Areas" è completa?
[ ] Le PR Conventions corrispondono al vostro workflow?
[ ] I Testing Requirements corrispondono al vostro setup?
[ ] C'è qualcosa nella sezione Stack che non rispecchia il vostro codebase?
```

### STEP 6 — Commit nel repository cliente

```bash
git checkout -b chore/add-claude-md
git add CLAUDE.md
git commit -m "chore: add Robin.dev agent configuration (CLAUDE.md)"
git push origin chore/add-claude-md
gh pr create \
  --title "chore: add Robin.dev agent configuration (CLAUDE.md)" \
  --body "Aggiunta configurazione per l'agente Robin.dev." \
  --reviewer <github_username_cliente>
```

### Gestione casi speciali

**Monorepo:** aggiungere in WORKSPACE dopo "Repository":
```markdown
### Monorepo Structure
This is a monorepo. Robin primarily operates on the `<workspace>` package.
```

**CI obbligatorio prima del merge:** aggiungere in "Testing Requirements":
```markdown
### CI Requirements
Before opening a PR, ensure all tests pass, lint is clean, and types are correct.
Do not open a PR if any CI check is failing.
```

**Aree sensibili con path multipli:** usare lista puntata con commenti per categoria.

---

## 5. Template CLAUDE.md

Il file `docs/templates/CLAUDE.md` ha tre sezioni:

### Sezione A — `==INVARIANT==` (NON modificare)

Contiene il protocollo ADWP, le regole di sicurezza, e le istruzioni di integrazione Robin.dev. Questa sezione è identica per tutti i clienti.

**ADWP Protocol:**
- **A — Analyse:** Leggere TASK.md, esplorare il codebase, non scrivere codice
- **D — Design:** Piano di implementazione chiaro. Se bloccato: scrivere in `BLOCKED.md` e fermarsi
- **W — Write:** Implementare il piano. Un task = una concernenza. No refactoring non richiesto
- **P — Proof:** Eseguire test, lint, typecheck. Nessun PR con check falliti

**BLOCKED.md Protocol:**
```
# Blocked

**Task ID:** <task_id from TASK.md>
**Phase:** <Analyse | Design | Write | Proof>
**Question:** <specific question>
**Context:** <what you've already tried or considered>
```

**Security Rules invarianti:**
- Mai committare secrets, API keys, token
- Mai pushare direttamente su `{{MAIN_BRANCH}}`
- Mai modificare `.env*` senza istruzioni esplicite

### Sezione B — `==WORKSPACE==` (modificabile)

Compilare con i dati specifici del cliente: comandi, path, branch policy, PR conventions, testing requirements.

### Sezione C — `==STACK==` (decommentare la variante)

**VARIANTE A — Next.js + Supabase:**
- Server vs Client Components: prefer Server Components per data fetching
- `createServerClient()` sempre nei Route Handlers (mai service role key)
- RLS enforced a livello DB — non bypassare
- `exactOptionalPropertyTypes: true` — usare `field: T | undefined`
- Pattern file: `app/(dashboard)/<route>/page.tsx` (SC), `<Name>Client.tsx` (CC), `lib/db/<domain>.ts`

**VARIANTE B — Node.js API:**
- JWT verification su ogni endpoint protetto
- Parameterized queries — mai concatenazione SQL
- Structured error responses: `{ error: string, code: string }`
- Mock external services nei test

---

## 6. Manutenzione del CLAUDE.md

Il CLAUDE.md non è "set and forget". Aggiornarlo quando:

1. Il cliente cambia stack
2. Cambiano i comandi di sviluppo
3. Si aggiungono aree sensibili
4. Robin apre PR su path sbagliati ripetutamente

Per gli aggiornamenti: usare la procedura del runbook (`docs/runbook.md §4`).
Commit format: `chore(claude): update <cosa è cambiato>`.

---

## Riferimenti

- `docs/runbook.md §5` — provisioning manuale VPS
- `docs/runbook.md §4` — aggiornamento CLAUDE.md
- `docs/security.md §3` — test RLS post-provisioning
- `scripts/create-workspace.ts` — creazione workspace
- `scripts/smoke-test.ts` — verifica post-provisioning
- `scripts/offboard-workspace.ts` — offboarding
- `apps/orchestrator/src/agent/claude.runner.ts` — come l'agente legge CLAUDE.md
