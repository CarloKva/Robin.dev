# Runbook — Compilazione CLAUDE.md per Nuovo Cliente

**Versione:** 1.0
**Prerequisiti:** Questionario onboarding compilato (`docs/templates/claude-md-questionnaire.md`)
**Output:** `CLAUDE.md` committato nel repository del cliente
**Durata stimata:** 30–45 minuti

---

## Panoramica

```
STEP 1: Raccogliere il questionario compilato
STEP 2: Copiare il template base
STEP 3: Compilare la sezione WORKSPACE
STEP 4: Attivare la variante stack corretta
STEP 5: Review con il cliente
STEP 6: Commit nel repository cliente
```

---

## STEP 1 — Raccogliere il Questionario

Assicurarsi di avere il questionario completato dal cliente (`docs/templates/claude-md-questionnaire.md`). Verificare che almeno queste sezioni siano compilate:

- **Sezione 2** (stack tecnologico): linguaggio, framework, package manager
- **Sezione 3** (comandi): tutti i comandi funzionanti
- **Sezione 5** (branch policy e PR)
- **Sezione 6** (aree sensibili)

Se mancano informazioni critiche, contattare il cliente prima di procedere.

---

## STEP 2 — Copiare il Template

```bash
# Nella root del repository del cliente (già clonato durante provisioning)
cp /path/to/robin-platform/docs/templates/CLAUDE.md ./CLAUDE.md
```

---

## STEP 3 — Compilare la Sezione WORKSPACE

Aprire `CLAUDE.md` e sostituire tutti i placeholder `{{...}}` nella sezione `==WORKSPACE==` con i valori reali dal questionario.

### Mapping questionario → placeholder

| Placeholder | Sezione questionario | Esempio valore |
|-------------|---------------------|----------------|
| `{{WORKSPACE_SLUG}}` | 1.1 (nome progetto, sluggificato) | `acme` |
| `{{GITHUB_ACCOUNT}}` | 1.2 (GitHub org/username) | `acme-org` |
| `{{MAIN_BRANCH}}` | 1.5 (branch principale) | `main` |
| `{{DEV_COMMAND}}` | 3.1 (avvia dev server) | `npm run dev` |
| `{{TEST_COMMAND}}` | 3.2 (esegui test) | `npm test` |
| `{{BUILD_COMMAND}}` | 3.4 (build) | `npm run build` |
| `{{LINT_COMMAND}}` | 3.5 (lint) | `npm run lint` |
| `{{TYPECHECK_COMMAND}}` | 3.6 (typecheck) | `npx tsc --noEmit` |
| `{{PACKAGE_MANAGER}}` | 2.5 (package manager) | `npm` |
| `{{NODE_VERSION}}` | 2.6 (versione Node) | `22` |
| `{{SENSITIVE_PATHS}}` | 6.1 + 6.3 (aree sensibili) | `.env*, infra/, migrations/` |
| `{{TEST_COMMAND_SINGLE}}` | 3.3 (test singolo file) | `npx jest src/foo.test.ts` |
| `{{DEPLOY_NOTES}}` | 6.4 + 9.1 (note deploy) | `Non pushare su production direttamente.` |

### Verifica placeholder rimanenti

```bash
grep -n '{{' CLAUDE.md
# Atteso: nessun output — tutti i placeholder compilati
```

---

## STEP 4 — Attivare la Variante Stack

In fondo al `CLAUDE.md` ci sono due varianti stack in commento HTML. Scegliere quella corretta:

### Se Next.js + Supabase (questionario 2.2 = Next.js, 2.3 = Supabase):

```bash
# Rimuovere i tag commento attorno a VARIANTE A
# Rimuovere l'intera VARIANTE B
```

Aprire il file e:
1. Trovare `=== VARIANTE A: Next.js + Supabase ===`
2. Rimuovere `<!--` che la precede
3. Rimuovere `=== END VARIANTE A ===` con `-->` che la segue
4. Eliminare l'intera VARIANTE B (da `=== VARIANTE B ===` a `=== END VARIANTE B ===`) incluso il blocco commento

### Se Node.js API pura (questionario 2.1 = Node.js, 2.2 = Express/Fastify/NestJS):

Procedura speculare: attivare VARIANTE B, eliminare VARIANTE A.

### Se stack non coperto da nessuna variante:

Scrivere una sezione custom `## Stack: <nome stack>` basandosi sulle risposte alle Sezioni 4 e 8 del questionario. Consultare il Lead Engineer Robin.dev se necessario.

---

## STEP 5 — Review con il Cliente

Prima di committare, inviare il `CLAUDE.md` compilato al contatto tecnico del cliente (Sezione 9.2 del questionario) per review.

**Checklist review (da condividere con il cliente):**

```
[ ] Tutti i comandi nella Sezione "Development Commands" sono corretti e testati?
[ ] La lista "Sensitive Areas" è completa? Manca qualche path critico?
[ ] Le PR Conventions corrispondono al vostro workflow?
[ ] I Testing Requirements corrispondono al vostro setup?
[ ] C'è qualcosa nella sezione Stack che non rispecchia il vostro codebase?
```

Attendere feedback esplicito ("LGTM" o modifiche richieste) prima di procedere.

---

## STEP 6 — Commit nel Repository Cliente

```bash
# Nel repository del cliente
git checkout -b chore/add-claude-md
git add CLAUDE.md
git commit -m "chore: add Robin.dev agent configuration (CLAUDE.md)"
git push origin chore/add-claude-md
```

Aprire una PR nel repository del cliente per review finale. La PR deve essere approvata da un developer del cliente prima del merge su `{{MAIN_BRANCH}}`.

```bash
# Con GitHub CLI (se disponibile)
gh pr create \
  --title "chore: add Robin.dev agent configuration (CLAUDE.md)" \
  --body "Aggiunta configurazione per l'agente Robin.dev. Vedere docs per dettagli." \
  --reviewer <github_username_cliente>
```

---

## Esempi di Compilazione

### Esempio A — Stack Next.js + Supabase (cliente Acme)

**Input dal questionario:**
```
1.1: Acme Dashboard
1.2: acme-org
1.3: acme-dashboard
1.5: main
2.5: npm
2.6: 22
3.1: npm run dev (porta 3000)
3.2: npm test
3.3: npx jest src/__tests__/<file>
3.4: npm run build
3.5: npm run lint
3.6: npx tsc --noEmit
6.1: .env*, .env.local, infra/, supabase/migrations/, prisma/migrations/
```

**Sezione WORKSPACE risultante:**

```markdown
## Project: acme

### Repository

\```
GitHub: acme-org
Main branch: main
\```

### Development Commands

\```bash
# Avviare il dev server
npm run dev

# Eseguire i test
npm test

# Build
npm run build

# Lint
npm run lint

# Type check
npx tsc --noEmit
\```

### Package Manager

Use `npm` for all dependency management. Do not use other package managers.

Required Node.js version: `22`

### Sensitive Areas — Do Not Modify Without Explicit Instructions

\```
.env*, .env.local, infra/, supabase/migrations/, prisma/migrations/
\```

[...resto della sezione...]
```

---

### Esempio B — Stack Node.js API (cliente BetaCorp)

**Input dal questionario:**
```
1.1: BetaCorp API
1.2: betacorp
1.3: betacorp-api
1.5: main
2.1: TypeScript/Node.js
2.2: Fastify
2.5: pnpm
2.6: 20
3.1: pnpm dev
3.2: pnpm test
3.3: pnpm test src/routes/__tests__/<file>
3.4: pnpm build
3.5: pnpm lint
3.6: pnpm typecheck
6.1: .env*, deploy/, k8s/, .github/workflows/
```

**Note specifiche per questa variante:**
- Attivare VARIANTE B (Node.js API) in fondo al template
- Aggiungere nota su Fastify se ci sono pattern specifici (es. plugin custom, schema validation)
- Verificare se usano Zod o similari per la validazione — aggiungere nota nella sezione Stack

---

## Gestione Casi Speciali

### Monorepo (questionario 2.7 = Sì)

Aggiungere nella sezione WORKSPACE, dopo il campo "Repository":

```markdown
### Monorepo Structure

This is a monorepo. Robin primarily operates on the `<workspace>` package.

\```bash
# All commands should be run from the repository root
# To run commands scoped to the primary workspace:
pnpm --filter <workspace-name> <command>
\```
```

### CI obbligatorio prima del merge (questionario 5.3)

Aggiungere in "Testing Requirements":

```markdown
### CI Requirements

Before opening a PR, ensure:
- All tests pass: `{{TEST_COMMAND}}`
- Lint is clean: `{{LINT_COMMAND}}`
- Types are correct: `{{TYPECHECK_COMMAND}}`

The CI pipeline runs these checks automatically. Do not open a PR if any check is failing.
```

### Aree sensibili con molteplici path (questionario 6.1 complesso)

Usare una lista puntata invece di testo inline:

```markdown
### Sensitive Areas — Do Not Modify Without Explicit Instructions

\```
# Authentication & secrets
.env*, .env.*

# Infrastructure
infra/
terraform/
k8s/
.github/workflows/

# Database
supabase/migrations/
prisma/migrations/

# Production config
config/production.*
\```
```

---

## Manutenzione CLAUDE.md

Il `CLAUDE.md` non è un documento "set and forget". Aggiornarlo quando:

1. **Il cliente cambia stack** (es. migra da Pages Router ad App Router): aggiornare la sezione stack
2. **Cambiano i comandi di sviluppo** (es. migrazione da npm a pnpm): aggiornare Sezione 3
3. **Si aggiungono aree sensibili** (es. nuova cartella `billing/`): aggiornare Sezione 6.1
4. **Robin apre PR su path sbagliati ripetutamente**: la lista sensitive paths è incompleta

Per gli aggiornamenti, usare la stessa procedura: modifica → review con cliente → PR.

---

## Riferimenti

- `docs/templates/CLAUDE.md` — template sorgente
- `docs/templates/claude-md-questionnaire.md` — questionario onboarding
- `docs/runbook/provisioning.md` — provisioning VPS (FASE 3.5 usa CLAUDE.md)
- `apps/orchestrator/src/agent/claude.runner.ts` — come l'agente legge CLAUDE.md
