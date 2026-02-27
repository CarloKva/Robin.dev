# Questionario Onboarding Tecnico — Robin.dev

**Versione:** 1.0
**Uso:** Da compilare con il cliente prima di creare il CLAUDE.md del loro repository.
**Tempo stimato:** 15–30 minuti
**Chi lo compila:** CTO/Lead developer del cliente, insieme al team Robin.dev

---

## Istruzioni

Questo questionario raccoglie tutte le informazioni necessarie per configurare l'agente Robin nel repository del cliente. Rispondere alle domande in modo preciso: ogni risposta si traduce direttamente in una configurazione dell'agente.

Per domande a scelta multipla, barrare/evidenziare le opzioni applicabili.

---

## Sezione 1 — Identificativi Progetto

**1.1** Come si chiama il progetto/prodotto?
```
Risposta: _______________________________________________
```

**1.2** Qual è il GitHub username o organization name?
```
Risposta: _______________________________________________
```

**1.3** Qual è il nome del repository principale in cui opererà Robin?
```
Risposta: _______________________________________________
```

**1.4** Ci sono altri repository su cui Robin potrebbe dover lavorare?
- [ ] No, solo il repository principale
- [ ] Sì: _______________________________________________

**1.5** Qual è il branch principale (quello su cui si fa il merge delle feature)?
- [ ] `main`
- [ ] `master`
- [ ] Altro: _______________________________________________

---

## Sezione 2 — Stack Tecnologico

**2.1** Seleziona il linguaggio/runtime principale:
- [ ] TypeScript/Node.js
- [ ] JavaScript/Node.js
- [ ] Python
- [ ] Go
- [ ] Rust
- [ ] Java/Kotlin
- [ ] Altro: _______________________________________________

**2.2** Seleziona il framework principale (se applicabile):
- [ ] Next.js (App Router)
- [ ] Next.js (Pages Router)
- [ ] React (Vite/CRA)
- [ ] Express.js
- [ ] Fastify
- [ ] NestJS
- [ ] Django/FastAPI
- [ ] Altro: _______________________________________________

**2.3** Database e ORM:
- [ ] Supabase (PostgreSQL)
- [ ] PostgreSQL + Prisma
- [ ] PostgreSQL + raw SQL
- [ ] MySQL/MariaDB
- [ ] MongoDB
- [ ] SQLite
- [ ] Nessuno
- [ ] Altro: _______________________________________________

**2.4** Autenticazione:
- [ ] Clerk
- [ ] NextAuth/Auth.js
- [ ] Supabase Auth
- [ ] Auth0
- [ ] JWT custom
- [ ] Nessuna
- [ ] Altro: _______________________________________________

**2.5** Package manager:
- [ ] npm
- [ ] pnpm
- [ ] bun
- [ ] yarn

**2.6** Versione Node.js richiesta (se applicabile):
```
Risposta: _______________________________________________
```

**2.7** Il progetto è un monorepo?
- [ ] No
- [ ] Sì, con: [ ] npm workspaces [ ] pnpm workspaces [ ] Turborepo [ ] Nx [ ] Altro: ______

Se monorepo, qual è il workspace su cui opererà Robin primariamente?
```
Risposta: _______________________________________________
```

---

## Sezione 3 — Comandi di Sviluppo

Indicare i comandi esatti da eseguire dalla root del repository (o dalla root del workspace se monorepo).

**3.1** Avviare il server di sviluppo locale:
```
Comando: _______________________________________________
Porta default: _______________________________________________
```

**3.2** Eseguire tutti i test:
```
Comando: _______________________________________________
```

**3.3** Eseguire un singolo file di test:
```
Comando: _______________________________________________
Esempio: _______________________________________________
```

**3.4** Build di produzione:
```
Comando: _______________________________________________
```

**3.5** Linting:
```
Comando: _______________________________________________
```

**3.6** Type checking:
```
Comando: _______________________________________________
```

**3.7** Ci sono altri comandi che Robin deve conoscere?
```
Comando: _______________ → Scopo: _______________________________________________
Comando: _______________ → Scopo: _______________________________________________
```

---

## Sezione 4 — Convenzioni del Codice

**4.1** Esiste un file di configurazione ESLint/Prettier/Biome?
- [ ] Sì (file: _______________)
- [ ] No — le convenzioni sono: _______________________________________________

**4.2** Stile di indentazione:
- [ ] 2 spazi
- [ ] 4 spazi
- [ ] Tab

**4.3** Convenzione di naming per i file:
- [ ] PascalCase (es. `UserProfile.tsx`)
- [ ] camelCase (es. `userProfile.ts`)
- [ ] kebab-case (es. `user-profile.ts`)
- [ ] snake_case (es. `user_profile.ts`)
- [ ] Misto (descrivere): _______________________________________________

**4.4** Stile dei commit messages:
- [ ] Conventional Commits (`feat:`, `fix:`, `chore:` ecc.)
- [ ] Libero
- [ ] Personalizzato: _______________________________________________

**4.5** Ci sono TypeScript settings particolari da conoscere?
```
Risposta (es. strict: true, exactOptionalPropertyTypes, ecc.): ___________________
```

**4.6** Pattern/architettura predominante nel codebase:
```
Risposta (es. feature folders, domain-driven, layered, ecc.): ___________________
```

---

## Sezione 5 — Branch Policy e Pull Request

**5.1** Naming convention per i branch:
- [ ] `feat/<name>` / `fix/<name>`
- [ ] `feature/<name>` / `bugfix/<name>`
- [ ] `<ticket-id>-<description>`
- [ ] Libero
- [ ] Personalizzato: _______________________________________________

**5.2** Chi deve essere aggiunto come reviewer delle PR di Robin?
```
GitHub username/team: _______________________________________________
```

**5.3** Ci sono check obbligatori prima del merge (CI, code coverage, approval)?
```
Risposta: _______________________________________________
```

**5.4** Il merge viene fatto con squash, rebase o merge commit?
- [ ] Squash and merge
- [ ] Rebase and merge
- [ ] Merge commit
- [ ] Non importa

**5.5** Le PR devono includere qualcosa di specifico?
- [ ] Link a ticket/issue
- [ ] Screenshot/GIF per modifiche UI
- [ ] Sezione "How to test"
- [ ] Aggiornamento CHANGELOG
- [ ] Altro: _______________________________________________

---

## Sezione 6 — Aree Sensibili del Repository

**6.1** Elenca i file/directory che Robin NON deve modificare senza istruzioni esplicite:
```
(es. .env*, infra/, terraform/, deploy/, prisma/migrations/, ecc.)
_______________________________________________
_______________________________________________
_______________________________________________
```

**6.2** Ci sono aree del codice particolarmente delicate (pagamenti, auth, dati personali)?
```
_______________________________________________
_______________________________________________
```

**6.3** Ci sono script che NON devono essere eseguiti (es. script di deploy, DB seed prod)?
```
_______________________________________________
```

**6.4** Il repository ha GitHub Actions o CI/CD? Robin può modificare questi file?
- [ ] No CI/CD
- [ ] Sì, Robin PUÒ modificare i workflow
- [ ] Sì, Robin NON deve modificare i workflow (path: _______________)

---

## Sezione 7 — Ambiente di Sviluppo

**7.1** Ci sono dipendenze di sistema da installare (oltre a Node.js)?
```
(es. Docker, PostgreSQL locale, Redis, ecc.)
_______________________________________________
```

**7.2** Come si configura l'ambiente locale? C'è un README o setup script?
```
File: _______________________________________________
Comando setup: _______________________________________________
```

**7.3** Ci sono variabili d'ambiente necessarie per far girare i test?
- [ ] No, i test girano senza .env
- [ ] Sì, necessario .env con: _______________________________________________
- [ ] Sì, c'è un `.env.test` o `.env.example` da seguire

**7.4** I test usano un database reale o un mock?
- [ ] Mock (nessun database necessario)
- [ ] Database locale (Robin dovrà avere accesso)
- [ ] Database di test su cloud (credenziali: _______________)

---

## Sezione 8 — Contesto Aggiuntivo

**8.1** Ci sono pattern o convenzioni non standard che Robin deve conoscere?
```
_______________________________________________
_______________________________________________
_______________________________________________
```

**8.2** Ci sono librerie interne o utility custom che Robin utilizzerà frequentemente?
```
(es. "usa sempre lib/api.ts per le chiamate API, non fetch direttamente")
_______________________________________________
_______________________________________________
```

**8.3** Quali sono le parti del codebase più instabili/in evoluzione da evitare?
```
_______________________________________________
```

**8.4** C'è qualcosa che è andato storto in passato (bug ricorrenti, gotcha da evitare)?
```
_______________________________________________
_______________________________________________
```

**8.5** Come preferite che Robin gestisca l'incertezza?
- [ ] Fermarsi e chiedere sempre (BLOCKED.md) — più lento ma più controllato
- [ ] Fare una scelta ragionevole e documentarla nella PR description
- [ ] Dipende dall'area (specificare): _______________________________________________

---

## Sezione 9 — Note Finali

**9.1** C'è altro che il team Robin.dev deve sapere prima di iniziare?
```
_______________________________________________
_______________________________________________
_______________________________________________
```

**9.2** Qual è il contatto tecnico di riferimento per domande durante l'onboarding?
```
Nome: _______________________________________________
Email/Slack: _______________________________________________
Disponibilità: _______________________________________________
```

---

## Checklist Compilazione

Prima di consegnare questo questionario al team Robin.dev, verificare:
- [ ] Sezione 2 (stack): almeno linguaggio, framework, package manager compilati
- [ ] Sezione 3 (comandi): tutti i comandi verificati e testati localmente
- [ ] Sezione 5 (PR policy): reviewer configurato
- [ ] Sezione 6 (aree sensibili): lista completa di path da non toccare

---

*Questionario versione 1.0 — Robin.dev Sprint 5*
*Template: `docs/templates/claude-md-questionnaire.md`*
