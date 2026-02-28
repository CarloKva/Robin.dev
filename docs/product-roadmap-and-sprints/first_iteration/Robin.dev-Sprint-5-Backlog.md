# Robin.dev — Sprint 5 Backlog
## Multi-tenancy e provisioning

**Versione 1.0 · Carlo Ferrero · Febbraio 2026**

---

## Obiettivo dello sprint

Il sistema gestisce più clienti in isolamento completo.
Ogni cliente ha il proprio workspace, il proprio VPS, il proprio agente GitHub.
Il provisioning di un nuovo cliente è documentato, riproducibile e non richiede
più di 2 ore. Al termine di questo sprint si possono onboardare i primi 3 pilota.

**Cosa ottieni concretamente alla fine:**
Hai tre clienti reali con workspace separati. Il cliente A non può vedere,
nemmeno accidentalmente, i dati del cliente B. Onboardare un quarto cliente
richiede eseguire uno script e seguire una checklist — non inventare nulla,
non improvvisare. Se un cliente decide di andarsene, hai una procedura
documentata per cancellare tutto ciò che lo riguarda entro 24 ore.

Questo è lo sprint che trasforma Robin.dev da "progetto personale funzionante"
a "servizio che può avere clienti paganti".

---

## Prerequisiti da Sprint 4

Prima di iniziare, verificare che siano soddisfatti:

- [ ] UX review Sprint 4 superata con persona esterna
- [ ] Gestionale completo: dashboard, lista task, task detail, creation form, metrics
- [ ] Orchestratore stabile: almeno 72h di uptime continuo senza intervento manuale
- [ ] RLS attiva e testata su tutte le tabelle
- [ ] Nessuna vulnerabilità di sicurezza nota nel gestionale

Se il gestionale non ha passato la UX review, Sprint 5 non inizia.
Onboardare clienti su un prodotto che non funziona è peggio di non onboardarli.

---

## Struttura del backlog

```
Sprint 5
├── FASE A — Analisi e Design
│   ├── EPIC-26 · Modello di isolamento e sicurezza
│   └── EPIC-27 · Design del provisioning workflow
└── FASE B — Implementazione
    ├── EPIC-28 · Isolamento infrastrutturale verificato
    ├── EPIC-29 · Agent registry e routing
    ├── EPIC-30 · Script di provisioning
    ├── EPIC-31 · CLAUDE.md per cliente
    ├── EPIC-32 · Offboarding e data governance
    └── EPIC-33 · Runbook operativo completo
```

---

## Una nota sul cambio di natura di questo sprint

Gli sprint precedenti costruivano il prodotto. Questo sprint costruisce
il **servizio** attorno al prodotto.

La differenza è fondamentale. Un prodotto richiede che il codice funzioni.
Un servizio richiede che il codice funzioni, che la documentazione operativa
esista, che ci sia una procedura per ogni scenario, che i dati dei clienti
siano al sicuro, che si possa rispondere alla domanda "cosa succede se questo
cliente vuole andarsene?"

La parte tecnica di questo sprint è relativamente contenuta — l'isolamento
RLS è già in gran parte implementato, il VPS è già configurato dal Sprint 2.
La parte operativa è quella che richiede più lavoro: script, checklist, runbook,
test di sicurezza, procedure di offboarding. Cose che non si vedono nella demo
ma che fanno la differenza tra un servizio professionale e un progetto precario.

---

## FASE A — Analisi e Design

---

### EPIC-26 · Modello di isolamento e sicurezza

**Descrizione**
Decidere definitivamente il modello di isolamento per cliente e verificare
che l'implementazione RLS esistente sia effettivamente sicura. Non si assume
che funzioni — si testa che funzioni con scenari di attacco espliciti.

---

#### STORY-05.01 · ADR sul modello di isolamento infrastrutturale

```
Come architect del sistema,
voglio documentare e chiudere la decisione sul modello di isolamento
per cliente a livello infrastrutturale,
per non dover riprogettare l'infrastruttura quando si aggiunge
il terzo o il quinto cliente.
```

**Criteri di accettazione**
- [ ] ADR-09 scritto e committed
- [ ] Le due opzioni principali analizzate in profondità:
  VPS dedicata vs worker process isolato per workspace
- [ ] La decisione considera: sicurezza, costo mensile per cliente,
  complessità operativa, scalabilità fino a 20 clienti
- [ ] Il costo reale per cliente è documentato con cifre concrete
- [ ] La decisione è coerente con il pricing comunicato ai clienti pilota

**SPIKE-05.01.A · VPS dedicata vs processo isolato: analisi completa**
*Time-box: 3h*

Domande da rispondere:

VPS dedicata per cliente:
- Pro: isolamento totale (network, filesystem, memoria, processi),
  crash non impatta altri clienti, facile da cancellare al momento
  dell'offboarding
- Contro: costo fisso per cliente anche se non usa il servizio,
  N VPS da monitorare e aggiornare, provisioning più lento

Worker process isolato per workspace:
- Pro: costo infrastrutturale ridotto, provisioning più veloce
- Contro: isolamento meno forte se non containerizzato,
  un leak di memoria impatta tutti i worker

Terza opzione: container Docker per workspace.
- Pro: isolamento forte con costo condiviso
- Contro: overhead Docker su VPS small, complessità aggiuntiva

Domanda concreta: per i primi 10 clienti a €800-1200/mese,
qual è il modello che massimizza il margine mantenendo sicurezza accettabile?

Output: `docs/spikes/spike-11-isolation-model.md` con analisi costi/benefici
e raccomandazione.

**TASK-05.01.1** — Costruire tabella costi per cliente per ogni modello:
costi fissi (VPS, Redis, monitoring) e costi variabili (API Anthropic
per N task/mese) per 3 scenari di utilizzo (10 task/mese, 30 task/mese,
60 task/mese).

**TASK-05.01.2** — Valutare la complessità operativa con 10 clienti
per ogni modello: quante VPS? Quanti systemd service? Come si aggiornano
tutti in modo coordinato?

**TASK-05.01.3** — Scrivere ADR-09 con decisione finale e conseguenze.

---

#### STORY-05.02 · Security review dell'isolamento Supabase

```
Come responsabile della sicurezza del sistema,
voglio verificare con test espliciti che l'isolamento RLS funzioni
in ogni scenario possibile,
per poter garantire ai clienti che i loro dati non sono accessibili ad altri.
```

**Criteri di accettazione**
- [ ] Test suite di isolamento scritta ed eseguita
- [ ] I seguenti scenari sono testati e risultano tutti bloccati:
  - Utente workspace A legge task di workspace B
  - Utente workspace A legge task_events di workspace B
  - Utente workspace A aggiorna task di workspace B
  - Utente workspace A inserisce task con workspace_id di B
  - Chiamata API con JWT valido di A, body con workspace_id di B
- [ ] Risultati documentati in `docs/security/rls-tests.md`
- [ ] Se trovate vulnerabilità, chiuse prima di procedere con il resto

**SPIKE-05.02.A · Pattern di attacco RLS su Supabase**
*Time-box: 2h*

Domande da rispondere:
- Quali sono i pattern di attacco più comuni contro RLS su Supabase?
  (JWT manipulation, workspace_id injection, bypass via funzioni
  PostgreSQL con SECURITY DEFINER)
- Le policy attuali usano `auth.uid()` correttamente?
- Come si testa RLS in modo sistematico?

Output: `docs/spikes/spike-12-rls-security.md` con pattern di attacco
e checklist di verifica.

**TASK-05.02.1** — Scrivere lo script di test di isolamento SQL:
creare 2 workspace con utenti separati, inserire dati in entrambi,
eseguire ogni scenario di attacco con JWT di workspace A
cercando dati di workspace B.

**TASK-05.02.2** — Eseguire lo script e documentare ogni risultato.
Se un test fallisce (= vulnerabilità), fermarsi e fixare subito.

**TASK-05.02.3** — Testare gli endpoint API del gestionale:
ogni Route Handler verificato con JWT di A e workspace_id di B
nei path params e nel body.

**TASK-05.02.4** — Scrivere `docs/security/rls-tests.md` con
scenari, risultati e fix eventualmente applicate.

---

### EPIC-27 · Design del provisioning workflow

**Descrizione**
Definire ogni passo del processo di onboarding di un nuovo cliente,
dall'acquisto del VPS al primo task eseguito. L'output è una checklist
operativa che può essere seguita senza improvvisare nulla.

---

#### STORY-05.03 · Provisioning checklist completa

```
Come operator del servizio,
voglio una checklist completa per onboardare un nuovo cliente,
per completare il provisioning in meno di 2 ore
senza dover ricordare cosa fare.
```

**Criteri di accettazione**
- [ ] Checklist scritta in `docs/runbook/provisioning.md`
- [ ] Ogni passo è atomico e verificabile con comando esatto
- [ ] Divisa in fasi con tempo stimato per ognuna:
  pre-provisioning (15min), infrastruttura (45min),
  applicazione (30min), verifica (20min), consegna (10min)
- [ ] Prerequisiti per ogni fase espliciti
- [ ] Dry-run eseguita almeno una volta con cliente fittizio
- [ ] Totale < 2 ore

**TASK-05.03.1** — Mappare ogni passo del provisioning in sequenza,
dalla raccolta info cliente al primo task eseguito.
Per ogni passo: azione, comando, output atteso, verifica.

**TASK-05.03.2** — Identificare i punti di fallimento di ogni fase
e documentare il recovery per ognuno.

**TASK-05.03.3** — Dry-run completa della checklist su workspace fittizio.
Misurare il tempo reale per ogni fase, aggiornare le stime.

---

#### STORY-05.04 · Definizione CLAUDE.md template e personalizzazione

```
Come operator,
voglio un template CLAUDE.md che funziona per la maggior parte
dei progetti con minima personalizzazione,
per ridurre il tempo di configurazione senza sacrificare la qualità.
```

**Criteri di accettazione**
- [ ] Template `docs/templates/CLAUDE.md` scritto con sezione invariante
  (protocollo ADWP, regole sicurezza) e sezione variabile per cliente
  (stack, convenzioni, branch policy)
- [ ] Le variabili da sostituire sono esplicite: `{{WORKSPACE_SLUG}}`,
  `{{GITHUB_ACCOUNT}}`, ecc.
- [ ] Varianti per stack più comuni: Next.js + Supabase, API Node.js
- [ ] Guida alla personalizzazione in `docs/runbook/claude-md-customization.md`

**TASK-05.04.1** — Scrivere il template base partendo dal CLAUDE.md
validato nel POC. Separare sezione invariante da sezione variabile.

**TASK-05.04.2** — Scrivere varianti per Next.js + Supabase e API Node.js.

**TASK-05.04.3** — Scrivere guida alla personalizzazione con esempi.

---

## FASE B — Implementazione

---

### EPIC-28 · Isolamento infrastrutturale verificato

**Descrizione**
Implementare il modello deciso in ADR-09 e verificarlo con test
espliciti su workspace reali.

---

#### STORY-05.05 · Implementazione isolamento secondo ADR-09

```
Come sistema,
voglio che ogni cliente abbia un ambiente di esecuzione isolato,
per garantire che un problema su un workspace non impatti gli altri.
```

**Criteri di accettazione**
- [ ] Modello di isolamento implementato secondo ADR-09
- [ ] Filesystem del cliente A non accessibile dal processo del cliente B
- [ ] Credenziali del cliente A non accessibili dal processo del cliente B
- [ ] Crash del worker cliente A non impatta il worker cliente B
- [ ] Configurazione di rete documentata

**TASK-05.05.1** — Configurare l'isolamento secondo il modello scelto
in ADR-09. Documentare ogni step con i comandi eseguiti.

**TASK-05.05.2** — Scrivere la lista di verifiche di isolamento
da eseguire dopo ogni provisioning.

**TASK-05.05.3** — Eseguire le verifiche su due workspace di test
e documentare i risultati.

---

#### STORY-05.06 · Test di isolamento su workspace reali

```
Come responsabile della sicurezza,
voglio eseguire i test di isolamento su due workspace reali,
per avere evidenza documentata che i dati dei clienti sono separati.
```

**Criteri di accettazione**
- [ ] workspace-test-A e workspace-test-B creati con dati realistici
- [ ] Tutti i test definiti in STORY-05.02 eseguiti su questi workspace
- [ ] Tutti i test: PASS
- [ ] Risultati in `docs/security/isolation-test-results.md`
  con data e firma

**TASK-05.06.1** — Creare i due workspace di test con almeno 5 task
con eventi ciascuno.

**TASK-05.06.2** — Eseguire tutta la test suite e documentare ogni risultato.

**TASK-05.06.3** — Eseguire i test sugli endpoint API del gestionale.

**TASK-05.06.4** — Scrivere `docs/security/isolation-test-results.md`.

---

### EPIC-29 · Agent registry e routing

**Descrizione**
Il sistema deve sapere quali agenti esistono, a quale workspace appartengono
e come assegnare automaticamente le task all'agente corretto.

---

#### STORY-05.07 · Agent registry completo

```
Come sistema,
voglio un registro centralizzato di tutti gli agenti,
per gestirli e monitorarli da un'unica fonte di verità.
```

**Criteri di accettazione**
- [ ] Migration `0004_agent_registry.sql` applicata con schema completo:
  `id`, `workspace_id`, `name`, `slug`, `github_account`, `vps_ip`,
  `vps_region`, `status`, `last_seen_at`, `orchestrator_version`,
  `claude_code_version`, `created_at`
- [ ] Heartbeat dell'orchestratore aggiorna `status`, `last_seen_at`,
  `orchestrator_version`, `claude_code_version` ogni 30s
- [ ] Agente assente > 2 minuti → marcato automaticamente `offline`
- [ ] Pagina `/agents` nel gestionale: lista agenti con stato real-time,
  versioni software, VPS info, ultima attività

**TASK-05.07.1** — Creare migration con tabella `agents` e indici.

**TASK-05.07.2** — Aggiornare il heartbeat dell'orchestratore per includere
le versioni software nel payload.

**TASK-05.07.3** — Implementare il marcaggio automatico `offline`:
cron job Supabase o logica nel gestionale che controlla `last_seen_at`.

**TASK-05.07.4** — Implementare pagina `/agents` con card per ogni agente
e aggiornamento real-time via Supabase Realtime.

---

#### STORY-05.08 · Routing automatico delle task

```
Come sistema,
voglio che ogni task venga assegnata automaticamente all'agente
corretto del workspace,
per non richiedere selezione manuale per ogni task.
```

**Criteri di accettazione**
- [ ] Task creata → assegnata automaticamente all'agente online del workspace
- [ ] Se nessun agente online: task rimane in `backlog` con warning nel gestionale
- [ ] Worker BullMQ processa solo job del proprio workspace
- [ ] `agentId` incluso nel `JobPayload` e verificato dall'orchestratore
- [ ] Se il workspace ha più agenti: round-robin di default

**TASK-05.08.1** — Aggiornare `POST /api/tasks`: cercare agente online
del workspace e assegnare la task. Se nessun agente, creare task
con `agentId: null`.

**TASK-05.08.2** — Aggiornare `JobPayload` in `shared-types` con
`agentId: string` obbligatorio.

**TASK-05.08.3** — Aggiornare il producer BullMQ per includere `agentId`
e il worker per verificarlo prima di processare.

**TASK-05.08.4** — Implementare warning "Nessun agente online" nel gestionale.

---

### EPIC-30 · Script di provisioning

**Descrizione**
Automatizzare ogni passo ripetibile del provisioning per eliminare
errori di battitura e ridurre il tempo di setup.

---

#### STORY-05.09 · Script di setup VPS

```
Come operator,
voglio uno script che configuri un VPS nuovo dalla baseline
all'orchestratore funzionante,
per eliminare errori di configurazione.
```

**Criteri di accettazione**
- [ ] Script `scripts/provision-vps.sh` esegue: update sistema,
  installazione Node.js v24, GitHub CLI, creazione utente `agent`,
  installazione Claude Code, deploy orchestratore, configurazione systemd
- [ ] Idempotente: eseguirlo due volte non rompe nulla
- [ ] Accetta parametri: `--workspace-slug`, `--github-account`,
  `--supabase-url`, `--redis-url`
- [ ] Stampa riepilogo finale con next steps manuali
- [ ] Testato su VPS Hetzner CX23 fresh

**TASK-05.09.1** — Scrivere `scripts/provision-vps.sh` con tutta
la sequenza di installazione e configurazione.

**TASK-05.09.2** — Testare su VPS fresh. Misurare il tempo di esecuzione.
Documentare errori incontrati e correzioni.

**TASK-05.09.3** — Rendere idempotente: aggiungere check "già installato?"
prima di ogni passo che potrebbe fallire se eseguito due volte.

---

#### STORY-05.10 · Script di setup workspace su Supabase

```
Come operator,
voglio uno script che crei il workspace e configuri l'agente su Supabase,
per eliminare errori di inserimento manuale.
```

**Criteri di accettazione**
- [ ] Script Node.js `scripts/create-workspace.ts` che:
  crea workspace su Supabase, crea agente nell'agent registry,
  genera API key per l'orchestratore, stampa riepilogo con tutti gli ID
- [ ] Valida i parametri prima di eseguire qualsiasi operazione
- [ ] Usa service role key di Supabase
- [ ] Output salvato in `logs/provisioning-[slug]-[timestamp].log`

**TASK-05.10.1** — Scrivere `scripts/create-workspace.ts` con
logica di creazione workspace, agente, e generazione API key.

**TASK-05.10.2** — Implementare generazione sicura API key:
`crypto.randomBytes(32).toString('hex')`. Salvare nel `.env` del VPS
e in Supabase (hashed, non in chiaro).

**TASK-05.10.3** — Testare su workspace di test. Verificare record
su Supabase e funzionamento API key.

---

#### STORY-05.11 · Script di smoke test post-provisioning

```
Come operator,
voglio uno script che verifichi il provisioning eseguendo un task reale,
per avere conferma automatica prima di consegnare l'accesso al cliente.
```

**Criteri di accettazione**
- [ ] Script `scripts/smoke-test.ts` che:
  crea task di test, attende che l'orchestratore la prenda in carico (max 60s),
  attende completamento o timeout (max 10 min),
  verifica che una PR sia stata aperta,
  stampa PASS o FAIL con dettaglio
- [ ] Usa repository di test separato dal codice di produzione del cliente
- [ ] Task sempre la stessa: "Aggiungi file `ROBINDEV_SMOKE_TEST.md`
  con data e ora corrente"
- [ ] Pulisce dopo di sé: chiude PR di test, cancella branch

**TASK-05.11.1** — Scrivere `scripts/smoke-test.ts`.

**TASK-05.11.2** — Creare `[org]/[slug]-smoke-test` repository per ogni
cliente durante il provisioning. Documentare nella checklist.

**TASK-05.11.3** — Testare lo smoke test su workspace reale. Verificare PASS.

---

### EPIC-31 · CLAUDE.md per cliente

**Descrizione**
Il CLAUDE.md è il cervello operativo dell'agente per un progetto specifico.
Deve essere personalizzato correttamente o l'agente produce output di bassa
qualità indipendentemente dall'infrastruttura.

---

#### STORY-05.12 · Processo di customizzazione CLAUDE.md

```
Come operator che onboarda un nuovo cliente,
voglio un processo chiaro per personalizzare CLAUDE.md,
per produrre un file di configurazione di qualità in meno di 30 minuti.
```

**Criteri di accettazione**
- [ ] Questionario `docs/templates/claude-md-questionnaire.md` con
  domande per raccogliere le informazioni necessarie dal cliente
- [ ] Procedura documentata: questionario → compilazione template →
  review con cliente → commit nel repository
- [ ] CLAUDE.md generato testato con smoke test prima di essere considerato pronto
- [ ] Personalizzazioni specifiche per cliente documentate nel registro clienti

**TASK-05.12.1** — Scrivere il questionario di onboarding tecnico:
stack, branch policy, comandi di sviluppo, convenzioni di codice,
aree sensibili del codebase, aree dove l'agente lavorerà più spesso.

**TASK-05.12.2** — Scrivere la guida alla compilazione del template
a partire dalle risposte del questionario.

**TASK-05.12.3** — Documentare il processo di review con cliente:
cosa si chiede di verificare, come si raccolgono le correzioni.

---

#### STORY-05.13 · Versioning e aggiornamento CLAUDE.md

```
Come operator,
voglio che le modifiche al CLAUDE.md siano versionabili
e che ci sia una procedura per aggiornarlo,
per migliorare la configurazione nel tempo senza perdere la storia.
```

**Criteri di accettazione**
- [ ] Ogni modifica al CLAUDE.md ha commit `chore(claude): [descrizione]`
- [ ] Storia modifiche tracciabile via `git log -- CLAUDE.md`
- [ ] `docs/runbook/update-claude-md.md` documenta: quando aggiornare,
  come testare la nuova versione, come fare rollback

**TASK-05.13.1** — Scrivere `docs/runbook/update-claude-md.md`.

---

### EPIC-32 · Offboarding e data governance

**Descrizione**
Il momento in cui un cliente se ne va è il momento in cui si misura
la professionalità del servizio. La cancellazione deve essere completa,
documentata e verificabile.

---

#### STORY-05.14 · Script di offboarding

```
Come operator,
voglio uno script di offboarding che cancelli tutti i dati del cliente
in modo documentato,
per garantire la cancellazione completa entro 24 ore dalla richiesta.
```

**Criteri di accettazione**
- [ ] Script `scripts/offboard-workspace.ts` che in sequenza:
  ferma il worker per il workspace, cancella job BullMQ del workspace,
  cancella tutti i dati Supabase del workspace (cascade),
  revoca accesso GitHub dell'agente al repository del cliente,
  genera report di cancellazione con lista di tutto ciò che è stato rimosso
- [ ] Richiede conferma esplicita prima delle operazioni irreversibili
  (digitare il nome del workspace)
- [ ] Report salvato in `logs/offboarding-[slug]-[timestamp].log`

**TASK-05.14.1** — Scrivere `scripts/offboard-workspace.ts` con
la sequenza di cancellazione e richiesta di conferma.

**TASK-05.14.2** — Implementare la cancellazione a cascata su Supabase:
eventi → artifact → task → agenti → membri → workspace.

**TASK-05.14.3** — Implementare generazione del report di cancellazione
con conteggi, timestamp e firma dell'operatore.

**TASK-05.14.4** — Testare su workspace-test-B. Verificare che dopo
l'esecuzione non rimanga nessun dato su Supabase.

---

#### STORY-05.15 · Data retention policy e export dati

```
Come responsabile del servizio,
voglio una policy documentata sulla retention dei dati
e uno strumento per esportarli,
per rispettare il GDPR e rispondere alle domande dei clienti.
```

**Criteri di accettazione**
- [ ] `docs/data-retention-policy.md` che definisce:
  retention durante l'attività, retention post-cancellazione (30gg),
  chi ha accesso ai dati, diritto alla portabilità
- [ ] Conformità GDPR base verificata: right to erasure, data portability,
  data minimization
- [ ] Route Handler `GET /api/workspace/export` che restituisce
  archivio ZIP con task, eventi e metriche in JSON

**TASK-05.15.1** — Scrivere la data retention policy.

**TASK-05.15.2** — Verificare conformità GDPR base.

**TASK-05.15.3** — Implementare `GET /api/workspace/export`:
query di tutte le task + eventi + metriche del workspace,
generazione archivio ZIP, risposta con header `Content-Disposition`.

---

### EPIC-33 · Runbook operativo completo

**Descrizione**
Il runbook è il documento che si apre quando qualcosa va storto alle 23:00.
Deve coprire gli scenari con probabilità reale di accadimento.

---

#### STORY-05.16 · Runbook: orchestratore non risponde

```
Come operator,
voglio una procedura documentata per diagnosticare e risolvere
il caso in cui l'orchestratore non risponde,
per ripristinare il servizio senza improvvisare.
```

**Criteri di accettazione**
- [ ] `docs/runbook/incident-orchestrator-down.md` scritto
- [ ] Copre: diagnosi (cosa controllare prima in ordine),
  fix per ogni causa comune (crash, Redis down, Supabase down,
  disco pieno), template comunicazione al cliente, post-mortem template

**TASK-05.16.1** — Scrivere la procedura di diagnosi con ordine preciso:
```
1. systemctl status robindev-orchestrator
2. journalctl -u robindev-orchestrator -n 50
3. redis-cli ping
4. curl health endpoint Supabase
5. df -h (spazio disco)
```

**TASK-05.16.2** — Scrivere il fix per ogni causa con comandi esatti
e verifica post-fix.

**TASK-05.16.3** — Scrivere il template di comunicazione al cliente
per ogni livello di severità (< 30min, 30min-2ore, > 2ore).

---

#### STORY-05.17 · Runbook: task bloccata senza risposta

```
Come operator,
voglio una procedura per gestire il caso in cui una task è bloccata
da più di N ore senza risposta del cliente,
per non lasciare risorse bloccate indefinitamente.
```

**Criteri di accettazione**
- [ ] `docs/runbook/incident-task-stuck.md` scritto
- [ ] Policy SLA definita: notifica cliente se bloccata > 24h,
  escalation se nessuna risposta dopo 48h, cosa si fa nel weekend
- [ ] Procedura di sblocco manuale via SQL documentata
  per quando il gestionale non è disponibile

**TASK-05.17.1** — Definire la policy SLA per task bloccate.

**TASK-05.17.2** — Scrivere la procedura di sblocco manuale
con query SQL esatta (usando service role).

---

#### STORY-05.18 · Runbook: aggiornamento orchestratore su VPS cliente

```
Come operator,
voglio una procedura documentata per aggiornare l'orchestratore
su tutti i VPS clienti,
per poter rilasciare fix e nuove versioni in modo controllato.
```

**Criteri di accettazione**
- [ ] `docs/runbook/update-orchestrator-clients.md` scritto
- [ ] Procedura per aggiornamento singolo VPS e batch update di tutti i VPS
- [ ] Downtime atteso documentato (target: < 30 secondi)
- [ ] Procedura di rollback documentata
- [ ] Checklist post-aggiornamento (health check, smoke test)

**TASK-05.18.1** — Scrivere la procedura per aggiornamento singolo VPS.

**TASK-05.18.2** — Scrivere lo script per batch update:
loop su tutti i VPS clienti con aggiornamento sequenziale e verifica.

---

#### STORY-05.19 · Registro clienti interno

```
Come operator,
voglio un registro interno con tutte le informazioni operative
di ogni cliente,
per non dover cercare i dettagli ogni volta che faccio
un'operazione su un workspace.
```

**Criteri di accettazione**
- [ ] Template `docs/clients/template.md` con: identificativi workspace,
  VPS info, repository, contatto referente tecnico, storico operativo,
  link operativi (Betterstack, Supabase dashboard, Hetzner console)
- [ ] Nessun dato sensibile in chiaro nel registro (no password, no API key)
- [ ] Scheda creata per ogni cliente pilota
- [ ] Registro versionato con Git

**TASK-05.19.1** — Scrivere il template scheda cliente.

**TASK-05.19.2** — Creare scheda per ciascuno dei 3 clienti pilota.

---

## Definition of Done — Sprint 5

Lo sprint è completato quando **tutti** i seguenti criteri sono soddisfatti:

**Sicurezza**
- [ ] Test RLS su workspace reali: tutti PASS
- [ ] Test isolamento infrastrutturale: tutti PASS
- [ ] Risultati documentati in `docs/security/`

**Provisioning**
- [ ] `provision-vps.sh` testato su VPS fresh
- [ ] `create-workspace.ts` testato su workspace reale
- [ ] `smoke-test.ts`: PASS su workspace di test
- [ ] Checklist completa, dry-run in < 2 ore

**Offboarding e governance**
- [ ] `offboard-workspace.ts` testato su workspace di test
- [ ] `docs/data-retention-policy.md` scritto
- [ ] Export dati funzionante via API

**Operatività**
- [ ] Runbook con 3 scenari di incident documentati
- [ ] Procedura aggiornamento orchestratore documentata
- [ ] Registro clienti con template e schede per i 3 pilota
- [ ] CLAUDE.md template e processo di personalizzazione documentati

**Clienti pilota**
- [ ] 3 workspace reali provisionate con script (non manualmente)
- [ ] Smoke test PASS su tutti e 3
- [ ] Primo task reale eseguito con successo su almeno 1 workspace cliente

**Il test finale — provisioning da zero:**
Partendo da un VPS Hetzner appena acquistato e seguendo solo
la checklist (nessun altro documento aperto), provisionare un quarto
workspace (cliente fittizio) in meno di 2 ore. Al termine:
smoke test PASS, task reale eseguita, zero passi improvvisati.
Cronometrare ogni fase. Se si supera il limite, identificare
quale fase ha rallentato e ottimizzarla prima di considerare
lo sprint completato.

---

## Stima effort

| Epic | Scope | Effort stimato |
|---|---|---|
| EPIC-26 · Isolamento e sicurezza | 2 spike, ADR, test suite | ~7h |
| EPIC-27 · Design provisioning | Checklist, questionario, template | ~5h |
| EPIC-28 · Isolamento verificato | Test reali su 2 workspace | ~4h |
| EPIC-29 · Agent registry e routing | Migration, routing, pagina agents | ~6h |
| EPIC-30 · Script provisioning | 3 script + test su VPS real | ~8h |
| EPIC-31 · CLAUDE.md cliente | Template, processo, versioning | ~4h |
| EPIC-32 · Offboarding | Script, data retention, export | ~6h |
| EPIC-33 · Runbook | 3+ scenari + aggiornamento + registro | ~5h |
| **Totale stimato** | | **~45h** |

---

## Rischi specifici di questo sprint

| Rischio | Probabilità | Mitigazione |
|---|---|---|
| Test di isolamento trovano vulnerabilità RLS | Media | STORY-05.02 si esegue prima di tutto il resto. Vulnerabilità trovate bloccano lo sprint finché non sono chiuse |
| Script provisioning non funziona su VPS fresh | Media | TASK-05.09.2 testa su VPS fresh prima di dichiarare lo script completo |
| Smoke test fallisce per stack cliente non supportato | Bassa | Il questionario di onboarding identifica stack non supportati prima del provisioning |
| Provisioning supera le 2 ore | Media | Il test finale cronometra ogni fase e forza l'ottimizzazione di quella lenta |
| GDPR insufficiente per clienti enterprise | Bassa | La policy base soddisfa PMI. Per enterprise serve consulenza legale (fuori scope v1) |

---

## Dopo Sprint 5: cosa non è ancora fatto

Questo backlog copre la versione 1.0 di Robin.dev — il sistema minimo
per servire clienti paganti in modo professionale.

Ciò che rimane fuori dallo scope e che andrà affrontato in base
al feedback dei clienti pilota:

**Prodotto**
- Fatturazione automatica: con > 5 clienti ha senso integrare Stripe
- Dashboard multi-cliente: pannello admin aggregato per Carlo
- Supporto stack non-Next.js: varianti CLAUDE.md e test dedicati

**Distribuzione**
- Co-founder sales: la distribuzione è il collo di bottiglia dopo Sprint 5.
  Il prodotto esiste — serve qualcuno che lo venda.
- Content marketing: documentazione pubblica, case study dei pilota,
  presenza su community (Indie Hackers, X/Twitter)

**Operatività avanzata**
- SLA formale: uptime garantito richiede monitoring più sofisticato
- Alerting multi-livello: PagerDuty o equivalente per incident critici
- Backup e disaster recovery: procedura documentata per perdita VPS

---

*Robin.dev · Sprint 5 Backlog v1.0 · Carlo Ferrero · Febbraio 2026*
