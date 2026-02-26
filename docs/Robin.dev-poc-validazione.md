# Robin.dev — Documento Tecnico di Validazione
**Autonomous Agentic Development Workflow · POC v1.0**

> Autore: Carlo Ferrero / IronDev · 25 Febbraio 2026 · Stato: Validato in sessione live

---

## 1. Executive Summary

Questa sessione ha prodotto la validazione end-to-end di un sistema di sviluppo software autonomo basato su agenti AI. Il risultato è un flusso funzionante in cui un essere umano scrive una specifica su un'interfaccia web, e un agente AI residente su un server remoto la prende in carico, la lavora autonomamente, produce codice reale, e apre una Pull Request su GitHub — senza alcun intervento manuale intermedio.

Il sistema è stato validato in condizioni reali: server VPS Hetzner attivo, repository GitHub di produzione, deploy su Vercel, e agente Claude Code operativo in modalità headless.

Questo documento descrive l'architettura, i componenti, il protocollo adottato, e la roadmap per portare il sistema in produzione scalabile.

---

## 2. Visione e Modello Operativo

### 2.1 Il problema che risolve

Il modello tradizionale di sviluppo software richiede che un developer sia presente, attivo e concentrato per eseguire lavoro. Anche con strumenti AI come Copilot o Cursor, il developer rimane il collo di bottiglia: deve guidare ogni azione, revisionare ogni output, triggerare ogni passo.

Robin.dev sposta il baricentro. Il developer diventa un product manager del proprio agente: scrive specifiche chiare, revisiona output, approva deploy. L'esecuzione è completamente delegata.

### 2.2 Il modello operativo validato

Il flusso che funziona oggi è il seguente:

1. Il developer accede al gestionale da qualsiasi dispositivo, ovunque si trovi.
2. Crea una task con titolo, descrizione, tipo e priorità, e la assegna all'agente.
3. L'orchestratore sul VPS rileva la task entro 15 secondi.
4. L'agente analizza il codebase, pianifica, implementa, testa e committa.
5. L'agente apre una Pull Request su GitHub e aggiorna il log della task.
6. Il developer riceve la notifica, fa code review e approva o richiede modifiche.

Il developer non ha mai aperto un editor, non ha mai scritto una riga di codice, non ha mai lanciato un terminale. Ha solo scritto una specifica e fatto review della PR.

---

## 3. Architettura del Sistema

### 3.1 Componenti

| Componente | Tecnologia | Ruolo |
|---|---|---|
| Gestionale | Next.js + Vercel | Interfaccia web per creare e monitorare le task. Accessibile da browser e mobile. |
| Database | SQLite su Vercel | Persistenza delle task con activity log. Schema semplice, zero configurazione. |
| API REST | Next.js API Routes | Endpoint per CRUD task, aggiornamento stati, append log. CORS abilitato per chiamate dal VPS. |
| VPS | Hetzner CX23 | Server Ubuntu 24.04 sempre attivo. Host dell'orchestratore e dell'agente. |
| Orchestratore | Node.js | Processo che fa polling sull'API ogni 15s, gestisce il ciclo di vita delle task, lancia Claude Code. |
| Agente | Claude Code | Eseguito in modalità headless. Legge TASK.md, analizza il codebase, scrive codice, committa, apre PR. |
| Repository | GitHub | Repository di produzione. L'agente ha un account dedicato (kva-agent) con token di accesso. |
| Deploy preview | Vercel bot | Genera automaticamente un ambiente di preview per ogni PR aperta dall'agente. |

### 3.2 Topologia di rete

Il gestionale è deployato su Vercel e raggiungibile da qualsiasi client via HTTPS. Il VPS Hetzner comunica con il gestionale tramite chiamate HTTP verso l'URL pubblico Vercel, e con GitHub tramite token di accesso HTTPS. Non esistono connessioni inverse: il VPS non espone porte pubbliche e non richiede accesso diretto da parte del developer.

Questa separazione è intenzionale: il layer di esecuzione (VPS) è isolato dal layer di interfaccia (gestionale). È possibile scalare i due layer indipendentemente — aggiungere VPS senza modificare il gestionale, o evolvere il gestionale senza toccare i VPS.

### 3.3 Flusso dati

Ogni task ha un ciclo di vita tracciato nel database. L'activity log registra ogni transizione di stato, ogni azione dell'agente, ogni errore con timestamp ISO. Il gestionale mostra questi log in tempo reale tramite polling ogni 10 secondi.

L'agente comunica con il gestionale esclusivamente tramite le API REST: aggiorna lo stato della task, appende voci al log, e segnala eventuali blocchi. Non ha accesso diretto al database.

### 3.4 Ciclo di vita di una task

```
backlog → intake → intake-ok → in-analysis → in-planning
→ in-progress → in-testing → in-documentation
→ in-review → in-demo → deployed → done
```

Stati speciali: `blocked` (agente bloccato, attende input umano), `proposed` (task proposta dall'agente ma non ancora approvata).

---

## 4. ADWP — Agentic Development Workflow Protocol

### 4.1 Cos'è ADWP

ADWP (Agentic Development Workflow Protocol) è il protocollo comportamentale che governa come l'agente esegue il lavoro. Non è una semplice lista di istruzioni: è un sistema di fasi obbligatorie con input e output verificabili, checkpoint umani, escalation strutturata e rendicontazione automatica.

Il protocollo risolve il problema fondamentale degli agenti AI non strutturati: tendono ad agire in modo opaco, saltare fasi, fare assunzioni arbitrarie, e produrre output non tracciabili. ADWP introduce disciplina procedurale senza sacrificare l'autonomia esecutiva.

### 4.2 Le 9 fasi

| Fase | Descrizione |
|---|---|
| **INTAKE** | Ricezione e validazione della task. L'agente verifica la completezza della specifica e identifica eventuali ambiguità prima di procedere. |
| **ANALYSIS** | Analisi del codebase. L'agente mappa i file coinvolti, identifica dipendenze e rischi, stima la complessità. |
| **PLANNING** | Piano di esecuzione. L'agente scompone il lavoro in sotto-task atomiche, crea il branch, definisce la strategia di testing. |
| **IMPLEMENTATION** | Sviluppo. L'agente scrive il codice con commit atomici seguendo la convenzione Conventional Commits. |
| **TESTING** | Verifica qualità. L'agente esegue i test esistenti, scrive nuovi test, fa linting e type checking. |
| **DOCUMENTATION** | Documentazione. L'agente aggiorna README, JSDoc e CHANGELOG. Pulisce la storia dei commit. |
| **REVIEW** | Pull Request. L'agente apre la PR con template strutturato, assegna reviewer, gestisce il feedback. |
| **DEPLOYMENT** | Deploy. Sub-fase automatica (staging) e sub-fase con checkpoint umano obbligatorio (produzione). |
| **REPORTING** | Rendicontazione finale. L'agente produce un report con tempo per fase, metriche, e proposte proattive. |

### 4.3 Principi fondamentali

- **Determinismo prima dell'autonomia** — le fasi sono predefinite e non inventabili dall'agente.
- **Nessuna fase saltabile** — ogni fase ha input obbligatori e produce output verificabili.
- **Tracciabilità completa** — ogni azione produce un record nell'activity log.
- **Human-in-the-loop** — i checkpoint critici (merge su main, deploy produzione) richiedono approvazione umana.
- **Proattività strutturata** — l'agente può proporre task ma non auto-assegnarsi lavoro fuori scope.

### 4.4 Sistema di escalation

ADWP prevede tre livelli di escalation.

- **Level 1 — Soft block:** genera un warning ma l'agente continua con best effort.
- **Level 2 — Hard block:** si attiva per specifiche ambigue o rischi architetturali. L'agente si ferma e scrive le domande in `AGENT_QUESTIONS.md`.
- **Level 3 — Critical block:** si attiva per rischi sui dati o sistemi critici. L'agente notifica tutti i canali disponibili e non riprende senza approvazione esplicita.

### 4.5 Proattività controllata

L'agente può proporre nuove task ma non può auto-assegnarle. Le proposte appaiono nel Final Report con stato `proposed`, massimo 3 per ciclo. Il developer le approva o le ignora. Questo previene il "rumore agentico" — l'agente che genera lavoro non richiesto interferendo con il backlog pianificato.

### 4.6 Metriche di performance

ADWP definisce un set di metriche per misurare l'agente nel tempo:

- **Accuracy rate** — percentuale di task completate senza rework post-merge.
- **Estimation accuracy** — delta tra stima e consuntivo per fase.
- **PR approval rate** — percentuale di PR approvate al primo tentativo.
- **Rework rate** — percentuale di commit `fix(review)` sul totale.
- **Cycle time** — tempo medio dalla creazione della task al merge.
- **Escalation rate** — frequenza di blocchi Level 2 e 3.

---

## 5. Identità dell'Agente

### 5.1 kva-agent come collaboratore

Un elemento distintivo dell'architettura è che l'agente opera con un'identità separata e riconoscibile. `kva-agent` è un account GitHub dedicato, con nome utente, avatar, email verificata e token di accesso proprio. I suoi commit, le sue PR e le sue code review sono attribuiti a questo account come a qualsiasi developer del team.

Questa scelta non è estetica: ha implicazioni pratiche rilevanti. È possibile tracciare il contributo dell'agente nel tempo, misurarne le performance, limitarne o espanderne i permessi senza toccare gli account degli sviluppatori umani. L'agente è un collaboratore del repo, non un processo anonimo.

### 5.2 File di configurazione dell'agente

L'agente riceve le istruzioni operative tramite due file nel repository:

**`CLAUDE.md`** nella root del repo — definisce il flusso obbligatorio, le regole di commit, le credenziali Git, il comportamento in caso di dubbio, e l'identità dell'agente. È il punto di configurazione principale.

**`.adwp/config.yml`** — permette di customizzare il protocollo per ogni progetto: branch di riferimento, soglie di complessità, requisiti di test coverage, policy di deploy.

---

## 6. Cosa è Stato Validato

### 6.1 Flusso end-to-end

La sessione del 25 febbraio 2026 ha validato il seguente flusso completo in condizioni reali:

- Creazione task sul gestionale web con assegnazione a `kva-agent`.
- Rilevamento automatico della task da parte dell'orchestratore entro 15 secondi.
- Aggiornamento dello stato da `backlog` a `in_progress` con log visibile in tempo reale.
- Scrittura di `TASK.md` nel repository con la specifica completa.
- Lancio di Claude Code in modalità headless con prompt strutturato.
- Esecuzione del lavoro da parte dell'agente nel repository reale.
- Apertura automatica della Pull Request su GitHub con account `kva-agent`.
- Aggiornamento dello stato a `in_review` con activity log completo.
- Trigger automatico del bot Vercel per deploy preview della PR.

### 6.2 Infrastruttura validata

- VPS Hetzner CX23 attivo e accessibile (IP: 77.42.71.71, Helsinki).
- Utente `agent` non-root con permessi corretti su repository e orchestratore.
- Node.js v24.14.0 e Claude Code v2.1.52 installati e funzionanti.
- Autenticazione GitHub CLI configurata per `kva-agent` con token classic.
- Credenziali Git con email verificata per attribuzione corretta dei commit.
- API key Anthropic configurata nelle variabili d'ambiente dell'utente `agent`.
- Gestionale Next.js deployato su Vercel con API REST funzionanti.

### 6.3 Limiti del POC attuale

- L'orchestratore processa una task alla volta — nessun parallelismo.
- L'orchestratore si avvia manualmente — systemd non ancora configurato.
- Timeout di Claude Code fissato a 5 minuti — sufficiente solo per task semplici.
- Nessuna notifica push al developer quando la PR è pronta.
- Il gestionale non ha autenticazione utente — accesso libero via URL.
- SQLite non è adatto a carichi multi-tenant in produzione.

---

## 7. Roadmap verso la Produzione

### 7.1 Priorità immediata — Stabilità

Prima di qualsiasi espansione, il sistema deve essere stabile e autonomo.

- Configurare **systemd** sul VPS per avvio automatico al boot e riavvio in caso di crash.
- Aumentare il timeout di Claude Code per task di media complessità (target: 15-20 minuti).
- Aggiungere **notifiche push** al developer via webhook (Slack o email) quando la PR è pronta o la task si blocca.
- Implementare un meccanismo di **retry con backoff esponenziale** per errori transitori dell'API.

### 7.2 Scalabilità — Multi-agente

Il modello è progettato per scalare orizzontalmente. Ogni agente è un VPS indipendente con il proprio account GitHub, la propria configurazione ADWP, e il proprio scope di repository.

- Aggiungere supporto nel gestionale per **multiple queue di agenti** con visibilità separata.
- Implementare il **parallelismo nell'orchestratore** per gestire più task contemporaneamente sullo stesso VPS.
- Definire **policy di routing automatico**: task di tipo `bug` all'agente di manutenzione, `feature` al principale.
- Creare un **dashboard di monitoraggio** con metriche aggregate per tutti gli agenti attivi.

### 7.3 Qualità — Metriche e feedback loop

Implementare il tracking delle metriche ADWP significa costruire un feedback loop che permette di migliorare le istruzioni dell'agente sulla base di dati reali, non di impressioni. Il ciclo è: misura → analizza → aggiorna CLAUDE.md → misura di nuovo.

### 7.4 Produzione — Database e autenticazione

Per un uso multi-utente o multi-team, il sistema richiede due upgrade infrastrutturali fondamentali:

- Migrazione del database da **SQLite a PostgreSQL** (Supabase o Neon) per supportare scritture concorrenti e query analitiche.
- Introduzione di un sistema di **autenticazione** sul gestionale (Clerk o Auth.js) per separare i workspace per team o cliente.
- **API rate limiting** e API key per proteggere gli endpoint dall'accesso non autorizzato.

---

## 8. Considerazioni Strategiche

### 8.1 Posizionamento nel mercato

La maggior parte dei sistemi agentic AI esistenti (Devin, SWE-agent, GitHub Copilot Workspace) opera in modalità reattiva: il developer invoca l'agente e aspetta una risposta sincrona. Robin.dev introduce un modello **asincrono e proattivo** in cui l'agente lavora in background mentre il developer fa altro.

La combinazione di identità separata per l'agente, protocollo strutturato obbligatorio, e gestionale come punto di controllo unico differenzia il sistema dagli approcci esistenti. Non è uno strumento di coding assistito — è un modello operativo per team che vogliono scalare la capacità produttiva senza scalare il numero di developer.

### 8.2 Applicabilità

Il sistema è immediatamente applicabile a qualsiasi progetto web con repository GitHub e deploy automatizzato. Il caso d'uso ideale sono le PMI che hanno bisogno di manutenzione continua (bug fix, piccole feature, aggiornamenti contenuto) senza sostenere il costo di un developer dedicato a tempo pieno.

Il modello è estendibile a repository multipli su un singolo VPS, a team con più sviluppatori che condividono un pool di agenti, e a workflow più complessi che includono test automatizzati, deploy staging, e approvazioni multi-stadio.

### 8.3 Timing

Siamo nel 2026 e questo approccio è ancora frontier. Gli strumenti su cui si basa (Claude Code in modalità headless, GitHub CLI, VPS commodity) sono tutti production-ready ma la loro combinazione in un sistema integrato e protocollarizzato è inedita. Il vantaggio competitivo non è nei singoli componenti — tutti accessibili — ma nel protocollo e nel modello operativo.

---

## 9. Riferimenti Tecnici

### URL e accessi

- Gestionale: `https://poc-pink-theta.vercel.app`
- Repository: `github.com/kakashi-ventures/kva-website`
- VPS: `77.42.71.71` (Hetzner Helsinki, Ubuntu 24.04 LTS)
- Agente GitHub: `github.com/kva-agent`

### File chiave sul VPS

| Path | Descrizione |
|---|---|
| `/home/agent/orchestrator/orchestrator.js` | Processo principale di orchestrazione |
| `/home/agent/kva-website/CLAUDE.md` | Istruzioni comportamentali per l'agente |
| `/home/agent/kva-website/.adwp/config.yml` | Configurazione protocollo ADWP per il repo |
| `/home/agent/.bashrc` | Variabili d'ambiente inclusa `ANTHROPIC_API_KEY` |
| `/home/agent/.config/gh/hosts.yml` | Configurazione GitHub CLI per `kva-agent` |
| `/home/agent/.git-credentials` | Credenziali HTTPS per git push |

### Stack tecnologico completo

| Layer | Tecnologia |
|---|---|
| Frontend gestionale | Next.js 14, App Router, TypeScript, Tailwind CSS |
| Database | SQLite con better-sqlite3 |
| Deploy gestionale | Vercel (serverless) |
| Orchestratore | Node.js v24 LTS |
| Agente | Claude Code v2.1.52 (Anthropic), modalità headless |
| Version control | GitHub + GitHub CLI per apertura PR |
| VPS | Hetzner CX23 — 2 vCPU, 4GB RAM, 40GB SSD (~4€/mese) |

### Comandi operativi essenziali

Avvio manuale orchestratore:
`su - agent && cd ~/orchestrator && node orchestrator.js`

Verifica log orchestratore (dopo setup systemd):
`journalctl -u Robin.dev-orchestrator -f`

Verifica stato agente GitHub:
`su - agent && gh auth status`

Reset permessi repository:
`chown -R agent:agent /home/agent/kva-website`

---

*IronDev · Robin.dev POC · Febbraio 2026*
