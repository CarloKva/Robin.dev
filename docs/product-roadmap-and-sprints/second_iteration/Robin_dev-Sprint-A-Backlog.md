# Robin.dev — Sprint A Backlog
## GitHub OAuth + Agent Setup da Dashboard

**Versione 1.0 · Carlo Ferrero · Febbraio 2026**

---

## Obiettivo dello sprint

Il founder può creare agenti, connetterli a repository GitHub reali, e
avere tutto questo configurato dalla dashboard — senza che Carlo tocchi
un server manualmente.

Al termine di questo sprint, il setup di un nuovo agente è un flusso
di prodotto, non una procedura operativa.

**Cosa ottieni concretamente alla fine:**
Il founder apre Robin.dev per la prima volta. Fa login con Clerk.
Connette il proprio account GitHub tramite OAuth — esattamente come
farebbe su Vercel. Vede le sue repository. Crea un agente, lo associa
a una o più repo, e il sistema fa partire il provisioning della VPS in
automatico. La dashboard mostra l'agente come "online" quando è pronto.
Nessuna email a Carlo. Nessun intervento manuale. Nessuna CLI aperta
sul VPS.

Questo è il prerequisito per tutto il resto. Senza questo, Robin.dev
non è un prodotto — è un servizio gestito a mano.

---

## Prerequisiti da Sprint 3

Prima di iniziare, verificare che siano soddisfatti:

- [ ] Schema Supabase con tabelle `agents`, `workspaces`, `users` attivo e in produzione
- [ ] Clerk auth funzionante sul gestionale con sessioni stabili
- [ ] Orchestratore deployato su almeno un VPS Hetzner (quello di Carlo)
- [ ] BullMQ + Redis funzionanti e testati (Sprint 2)
- [ ] RLS attiva sulle tabelle esistenti

Se uno di questi manca, Sprint A non inizia.

---

## Struttura del backlog

```
Sprint A
├── FASE A — Analisi e Design
│   ├── EPIC-A1 · GitHub OAuth — ricerca e decisioni
│   └── EPIC-A2 · Agent provisioning — design del flusso
└── FASE B — Implementazione
    ├── EPIC-A3 · GitHub OAuth integration
    ├── EPIC-A4 · Repository selector
    ├── EPIC-A5 · Agent creation flow
    ├── EPIC-A6 · VPS provisioning automatico
    └── EPIC-A7 · Dashboard multi-agente
```

---

## Una nota sulla natura di questo sprint

Gli sprint 1–3 erano infrastrutturali e invisibili. Lo sprint 4 era di
frontend. Questo sprint è diverso: è il primo dove si costruisce qualcosa
che un cliente esterno tocca davvero nel suo primo minuto di utilizzo.

Il rischio principale non è tecnico. È di UX. GitHub OAuth fatto male
(redirect confusi, errori criptici, permessi eccessivi) distrugge la
fiducia nel prodotto prima ancora che il cliente crei il primo agente.

Il principio guida è: **ogni passo del setup deve essere ovvio senza
istruzioni**. Se serve spiegare cosa fare, il flusso è sbagliato.

---

## FASE A — Analisi e Design

---

### EPIC-A1 · GitHub OAuth — ricerca e decisioni

**Descrizione**
Prima di scrivere una riga di codice, capire esattamente come funziona
l'integrazione GitHub OAuth nel contesto di Robin.dev. Non è banale:
Robin ha bisogno di agire sulle repository del cliente in modo autonomo,
il che richiede permessi specifici, token che sopravvivono alla sessione,
e una strategia per quando il token scade o viene revocato.

---

#### STORY-A.01 · ADR su GitHub OAuth e permission model

```
Come architect del sistema,
voglio documentare le decisioni su come Robin.dev accede a GitHub
per conto del cliente,
per non scoprire a metà implementazione che il modello di permessi
non supporta quello che ci serve.
```

**Criteri di accettazione**
- [ ] ADR-10 scritto e committed in `docs/adr/`
- [ ] Le due opzioni principali analizzate: GitHub App vs OAuth App
- [ ] Decisione su quale scopo OAuth richiedere (scope minimi necessari)
- [ ] Strategia di storage del token documentata: dove vive, come viene
  cifrato, cosa succede quando scade
- [ ] Strategia di revoca documentata: cosa succede se il cliente
  disconnette Robin.dev da GitHub

**SPIKE-A.01.A · GitHub App vs OAuth App: analisi completa**
*Time-box: 3h*

Domande da rispondere:

GitHub App:
- Pro: permessi granulari a livello di repository, token di breve durata
  (installation token), il cliente può vedere Robin.dev nella lista delle
  app installate sul suo GitHub org, non richiede che un utente specifico
  autorizzi
- Contro: setup più complesso, richiede una GitHub App registrata da Carlo,
  il token di installazione scade ogni ora (va refreshato)

OAuth App:
- Pro: setup più semplice, token di lunga durata, ben documentato
- Contro: permessi meno granulari (accesso a tutte le repo o nessuna),
  il token è legato all'utente che ha autorizzato (se quell'utente
  lascia l'azienda, il token smette di funzionare)

Domanda concreta: per i primi 3–5 clienti pilota, quale approccio
garantisce la migliore UX di setup con il minor rischio operativo?

Output: `docs/spikes/spike-A1-github-auth.md` con analisi e raccomandazione.

**TASK-A.01.1** — Documentare gli scope OAuth minimi necessari:
Robin ha bisogno di leggere la lista delle repo (`repo` o `read:user`?),
clonare le repo sull'agente, creare branch, aprire PR, leggere i commenti
sulle PR. Verificare quale combinazione di scope copre tutto questo con
il principio del minimo privilegio.

**TASK-A.01.2** — Documentare la strategia di storage del token:
il token GitHub non può stare in chiaro nel database. Opzioni:
Supabase Vault (se disponibile), colonna cifrata con chiave in env,
rotazione automatica. Valutare pro/contro e scegliere.

**TASK-A.01.3** — Documentare cosa succede in questi scenari di errore:
token scaduto durante un task in esecuzione, cliente revoca l'accesso
durante un task, repo eliminata o rinominata tra la creazione del task
e l'esecuzione. Per ogni scenario: cosa mostra la dashboard, cosa riceve
il cliente in notifica, come si riprende.

**TASK-A.01.4** — Scrivere ADR-10 con la decisione finale e le conseguenze.

---

#### STORY-A.02 · Modello dati per GitHub connection e repositories

```
Come architect del sistema,
voglio definire lo schema dati per gestire la connessione GitHub
di ogni workspace e le repository associate agli agenti,
per non dover migrare il database a sprint finito.
```

**Criteri di accettazione**
- [ ] Schema delle nuove tabelle definito e discusso prima dell'implementazione
- [ ] Relazioni tra `workspaces`, `github_connections`, `repositories`,
  `agents`, `agent_repositories` chiare e normalizzate
- [ ] I campi sensibili (token) identificati e la strategia di
  cifratura definita
- [ ] Migration script scritto e testato in ambiente locale
- [ ] RLS policies per le nuove tabelle definite

**TASK-A.02.1** — Definire la tabella `github_connections`:
un workspace può avere una sola connessione GitHub attiva. Campi necessari:
`workspace_id`, `github_user_id`, `github_login`, `access_token` (cifrato),
`token_scope`, `connected_at`, `last_refreshed_at`, `status`.

**TASK-A.02.2** — Definire la tabella `repositories`:
le repo che il cliente ha selezionato per uso con Robin.dev. Campi:
`workspace_id`, `github_repo_id`, `full_name` (es. `acme/backend`),
`default_branch`, `is_private`, `last_synced_at`.

**TASK-A.02.3** — Definire la tabella `agent_repositories`:
relazione many-to-many tra agenti e repository. Campi: `agent_id`,
`repository_id`, `assigned_at`. Un agente può lavorare su più repo;
una repo può essere assegnata a più agenti.

**TASK-A.02.4** — Aggiornare la tabella `agents` con i nuovi campi
necessari: `status` (provisioning | online | offline | error),
`vps_ip`, `vps_id` (ID Hetzner), `provisioned_at`.

**TASK-A.02.5** — Scrivere le RLS policies per le nuove tabelle:
un utente può leggere solo le righe del proprio workspace. Nessuna
eccezione. Testare con un secondo workspace fittizio.

---

### EPIC-A2 · Agent provisioning — design del flusso

**Descrizione**
Definire ogni passo del processo che va dal click su "Crea agente"
al momento in cui l'agente è online e pronto a ricevere task.
L'output è un documento di flusso che guida l'intera implementazione
della Fase B, eliminando le ambiguità durante il coding.

---

#### STORY-A.03 · Flusso di provisioning end-to-end

```
Come product designer (sono io),
voglio mappare ogni passo del provisioning di un nuovo agente,
dal click sulla dashboard all'agente online,
per non dover prendere decisioni di architettura mentre scrivo codice.
```

**Criteri di accettazione**
- [ ] Documento `docs/flows/agent-provisioning.md` scritto
- [ ] Ogni passo del flusso ha: responsabile (frontend/backend/VPS),
  input, output, tempo atteso, cosa mostra la UI durante l'attesa
- [ ] I casi di errore sono documentati: VPS non risponde, GitHub
  clone fallisce, health check non passa
- [ ] Il flusso è validato: può essere spiegato in 5 minuti a voce
  senza che sembri ambiguo

**TASK-A.03.1** — Documentare il flusso happy path:
```
1. Utente clicca "Crea agente" → form con nome e repo selection
2. Submit → backend crea record `agent` con status=provisioning
3. Backend chiama Hetzner API → crea VPS
4. Backend persiste VPS IP sul record agent
5. Backend SSH sul VPS → esegue script di setup (Node, orchestratore, env)
6. Orchestratore si avvia → si registra su Supabase (health check)
7. Backend aggiorna agent status=online
8. Dashboard mostra l'agente come "Pronto"
```
Per ogni step: chi fa cosa, quanto dura, cosa vede il founder.

**TASK-A.03.2** — Documentare i failure modes per ogni step:
se la chiamata Hetzner fallisce al passo 3, cosa succede? Il record
agent rimane in `status=provisioning` per sempre? C'è un timeout?
C'è un retry? Come lo vede il founder?

**TASK-A.03.3** — Definire la strategia di comunicazione asincrona
del provisioning: il provisioning dura 3–5 minuti. Il founder non
può aspettare davanti al browser. Opzioni: polling dalla dashboard,
webhook che aggiorna Supabase Realtime, email/notifica Slack quando
pronto. Decidere e documentare.

**TASK-A.03.4** — Definire lo script di setup VPS: cosa installa,
in che ordine, come verifica che ogni step è andato a buon fine.
Documentare ogni passo con il comando corrispondente (senza scriverlo
come codice — solo come descrizione operativa).

---

#### STORY-A.04 · ADR su Hetzner API e strategia di provisioning

```
Come architect del sistema,
voglio documentare le decisioni sull'integrazione con Hetzner
per il provisioning automatico dei VPS,
per non dover ricercare tutto durante l'implementazione.
```

**Criteri di accettazione**
- [ ] ADR-11 scritto e committed
- [ ] Hetzner Cloud API valutata: autenticazione, come si crea un VPS,
  come si monitora lo startup, come si elimina (per offboarding)
- [ ] Tipo di VPS scelto per gli agenti (size, datacenter, OS)
- [ ] Strategia SSH per lo script di setup documentata: chiave SSH
  pre-configurata, come viene generata e dove viene conservata
- [ ] Alternativa a Hetzner valutata (nel caso Hetzner API abbia
  limitazioni non previste): Hetzner rimane la scelta principale

**SPIKE-A.04.A · Hetzner Cloud API: valutazione per provisioning automatico**
*Time-box: 2h*

Domande da rispondere:
- Come funziona l'autenticazione Hetzner API (token, rate limits)?
- Quanto tempo impiega un VPS Hetzner CX21 ad essere SSH-raggiungibile
  dall'avvio della creazione? (empiricamente, non sulla carta)
- È possibile passare uno script di cloud-init al momento della creazione
  per evitare una connessione SSH separata?
- Come si gestisce la chiave SSH: chiave dedicata per Robin.dev,
  generata una volta e conservata dove?
- Quali sono i limiti di rate dell'API Hetzner per la creazione di VPS?

Output: `docs/spikes/spike-A2-hetzner-api.md` con risposte e raccomandazione.

---

## FASE B — Implementazione

---

### EPIC-A3 · GitHub OAuth integration

**Descrizione**
Implementare il flusso completo di connessione GitHub: il founder autorizza
Robin.dev ad accedere ai suoi repository, il token viene conservato in modo
sicuro, e la connessione sopravvive alla sessione. Il tutto senza mai
mostrare un messaggio di errore criptico.

---

#### STORY-A.05 · Flusso OAuth GitHub — connect e callback

```
Come founder,
voglio poter connettere il mio account GitHub a Robin.dev
con un click e senza configurazione manuale,
per non dover leggere documentazione prima di iniziare.
```

**Criteri di accettazione**
- [ ] Pagina Settings con sezione "Connessioni" visibile
- [ ] Bottone "Connetti GitHub" che avvia il flusso OAuth
- [ ] Redirect a GitHub con gli scope corretti (definiti in ADR-10)
- [ ] Callback gestito correttamente: token conservato secondo la
  strategia definita in TASK-A.01.2
- [ ] Dopo il connect: pagina aggiornata con stato "Connesso" e
  nome account GitHub del founder
- [ ] Se il founder già ha una connessione attiva: non si mostra
  il bottone connect ma lo stato con opzione "Disconnetti"
- [ ] Errori gestiti con messaggi in linguaggio naturale, non codici HTTP

**TASK-A.05.1** — Implementare Route Handler `GET /api/auth/github`:
costruisce l'URL di autorizzazione GitHub con scope e state parameter
(anti-CSRF), redirige il browser.

**TASK-A.05.2** — Implementare Route Handler `GET /api/auth/github/callback`:
riceve il code da GitHub, lo scambia con il token, verifica lo state
parameter, cifra il token e lo persiste in `github_connections`,
redirige al Settings con indicazione di successo.

**TASK-A.05.3** — Implementare `GitHubConnectionCard` in Settings:
componente che mostra lo stato della connessione (connessa/non connessa),
il nome account GitHub se connessa, il bottone appropriato (connetti/disconnetti).

**TASK-A.05.4** — Implementare la disconnessione:
Route Handler `DELETE /api/auth/github` che revoca il token su GitHub
e cancella il record `github_connections`. Prima di permettere la
disconnessione, verificare che non ci siano agenti attivi — in quel caso
mostrare un warning con la lista degli agenti da eliminare prima.

---

#### STORY-A.06 · Token lifecycle — scadenza e refresh

```
Come sistema,
voglio gestire in modo trasparente la scadenza e il refresh
del token GitHub,
per non interrompere un task in esecuzione per un problema
di autenticazione evitabile.
```

**Criteri di accettazione**
- [ ] Il sistema rileva token scaduto prima di iniziare un task
- [ ] Se il token è scaduto e il refresh è possibile: refresh automatico
  senza intervento del founder
- [ ] Se il refresh non è possibile (token revocato): task sospesa,
  notifica al founder via email e dashboard con azione richiesta chiara
- [ ] `last_refreshed_at` aggiornato ad ogni refresh
- [ ] Log degli eventi di refresh e revoca su `task_events`

**TASK-A.06.1** — Implementare `validateGitHubToken(workspaceId)`:
funzione richiamata dall'orchestratore prima di iniziare ogni task.
Verifica che il token sia valido chiamando `GET /user` su GitHub API.
Se 401: tenta refresh se possibile, altrimenti ritorna errore strutturato.

**TASK-A.06.2** — Implementare la gestione dell'errore di token revocato
nell'orchestratore: task passa a `status=blocked` con motivo
`github_token_invalid`, emette evento `agent.blocked` con messaggio
leggibile, invia notifica al founder.

**TASK-A.06.3** — Aggiungere indicatore di stato connessione GitHub
in dashboard: se il token è invalido, mostrare un banner persistente
con azione "Riconnetti GitHub" che porta direttamente al flusso OAuth.

---

### EPIC-A4 · Repository selector

**Descrizione**
Dopo aver connesso GitHub, il founder seleziona quali repository
rendere disponibili per gli agenti Robin. Il flusso deve essere
identico all'esperienza Vercel: lista di repo, click, fatto.

---

#### STORY-A.07 · Lista e selezione repository

```
Come founder,
voglio vedere tutte le mie repository GitHub e selezionare
quelle su cui gli agenti potranno lavorare,
per controllare esattamente a cosa Robin.dev ha accesso.
```

**Criteri di accettazione**
- [ ] Pagina o sezione "Repository" accessibile dopo la connessione GitHub
- [ ] Lista di tutte le repository dell'account/org GitHub del founder,
  con nome, visibilità (pubblica/privata) e branch default
- [ ] Possibilità di cercare/filtrare per nome
- [ ] Toggle per abilitare/disabilitare ogni repo
- [ ] Le repo abilitate vengono persistite in `repositories`
- [ ] Stato sincronizzato: se una repo viene eliminata su GitHub,
  viene marcata come non disponibile (non eliminata — c'è storico)
- [ ] Loading state esplicito durante il fetch delle repo da GitHub API

**TASK-A.07.1** — Implementare Route Handler `GET /api/github/repos`:
chiama GitHub API `/user/repos` (o `/orgs/{org}/repos` se l'account
è un'organizzazione), filtra per repo a cui il token ha accesso,
restituisce lista paginata con i campi necessari alla UI.

**TASK-A.07.2** — Implementare `RepositorySelector`:
componente con lista scrollabile di repo, search input, toggle per
abilitazione. Stato ottimistico: il toggle si aggiorna subito,
la chiamata API avviene in background.

**TASK-A.07.3** — Implementare Route Handler `POST /api/github/repos/enable`
e `DELETE /api/github/repos/{repoId}/disable`: upsert e soft delete
su tabella `repositories`.

**TASK-A.07.4** — Implementare la sincronizzazione: al momento della
connessione GitHub e una volta al giorno in automatico, verificare
che le repo abilitate esistano ancora. Se una repo è stata eliminata
o rinominata, aggiornare il record e notificare il founder.

---

#### STORY-A.08 · Dettaglio repository abilitata

```
Come founder,
voglio vedere lo stato di ogni repository abilitata —
quali agenti ci stanno lavorando, quante task sono state eseguite —
per avere una visione chiara di cosa sta succedendo su ogni repo.
```

**Criteri di accettazione**
- [ ] Click su una repo apre una vista di dettaglio
- [ ] Dettaglio mostra: nome, branch default, agenti assegnati,
  numero di task completate, ultima task eseguita
- [ ] Link diretto alla repo su GitHub (si apre in nuova tab)
- [ ] Se nessun agente è assegnato: call to action "Assegna un agente"

**TASK-A.08.1** — Implementare `RepositoryDetailPage` o drawer:
query che aggrega `agent_repositories` + `tasks` per la repo selezionata.

**TASK-A.08.2** — Implementare `AgentChip` inline nella lista:
ogni repo abilitata mostra in linea gli avatar degli agenti assegnati.
Click su un avatar porta al dettaglio agente.

---

### EPIC-A5 · Agent creation flow

**Descrizione**
Il founder crea un agente dalla dashboard: gli dà un nome, seleziona
le repository su cui lavorerà, e fa click su "Crea". Il resto è automatico.
Il flusso deve comunicare chiaramente che il provisioning è in corso
e quanto ci vorrà.

---

#### STORY-A.09 · Form di creazione agente

```
Come founder,
voglio creare un nuovo agente in meno di 2 minuti,
assegnargli le repository su cui lavorerà,
e non dover aprire nessun terminale.
```

**Criteri di accettazione**
- [ ] Bottone "Crea agente" accessibile dalla dashboard e dalla pagina agenti
- [ ] Form con: nome agente (libero, es. "Agent Alpha"), selezione
  repository tra quelle abilitate, conferma
- [ ] Validazione: nome non vuoto, almeno una repository selezionata,
  connessione GitHub attiva (altrimenti blocca con messaggio)
- [ ] Submit crea il record `agent` con `status=provisioning` e
  avvia il provisioning in background
- [ ] Il founder viene portato alla pagina dell'agente che mostra
  lo stato di provisioning in real-time

**TASK-A.09.1** — Implementare `AgentCreationForm`:
componente con input nome, `RepositoryMultiSelect` (checkbox su lista
delle repo abilitate), bottone submit. Validazione lato client prima
del submit.

**TASK-A.09.2** — Implementare Route Handler `POST /api/agents`:
crea record `agent` + record `agent_repositories` per ogni repo
selezionata, avvia job BullMQ `agent-provisioning` con l'ID dell'agente,
restituisce l'agente appena creato.

**TASK-A.09.3** — Implementare la validazione server-side: verificare
che la connessione GitHub del workspace sia attiva e valida prima di
accettare la creazione. Se non lo è, restituire errore strutturato
con indicazione di come risolverlo.

---

#### STORY-A.10 · Stato di provisioning in real-time

```
Come founder,
voglio vedere il progresso del provisioning del mio agente
senza dover fare refresh manuale,
per sapere quando è pronto senza stare a guardare lo schermo.
```

**Criteri di accettazione**
- [ ] Pagina agente mostra timeline di provisioning con step visibili:
  "VPS in creazione", "Setup in corso", "Health check", "Pronto"
- [ ] Ogni step si aggiorna in real-time via Supabase Realtime
  senza reload della pagina
- [ ] Tempo stimato residuo mostrato (basato su media empirica)
- [ ] Se il provisioning fallisce: messaggio chiaro di cosa è andato
  storto e azione per riprovare
- [ ] Notifica (email o Slack, configurabile) quando l'agente è pronto

**TASK-A.10.1** — Definire gli eventi di provisioning da emettere:
`agent.provisioning.started`, `agent.provisioning.vps_created`,
`agent.provisioning.setup_running`, `agent.provisioning.health_check`,
`agent.provisioning.completed`, `agent.provisioning.failed`.
Ogni evento include timestamp e payload contestuale.

**TASK-A.10.2** — Implementare subscription Supabase Realtime
sulla pagina agente: aggiornare la timeline ogni volta che un nuovo
evento di provisioning viene emesso.

**TASK-A.10.3** — Implementare `ProvisioningTimeline`:
componente che mostra i step con stato (pending/in_progress/done/error),
icone e timestamp. Stile coerente con la timeline task esistente di Sprint 3.

**TASK-A.10.4** — Implementare la notifica al completamento:
quando `agent.provisioning.completed` viene emesso, inviare email
via Resend e/o messaggio Slack (se configurato nel workspace) con
link diretto alla pagina dell'agente.

---

#### STORY-A.11 · Gestione agenti esistenti

```
Come founder,
voglio poter vedere tutti i miei agenti, il loro stato,
e poterli modificare o eliminare,
per mantenere il controllo della mia infrastruttura.
```

**Criteri di accettazione**
- [ ] Pagina "Agenti" con lista di tutti gli agenti del workspace
- [ ] Ogni agente mostra: nome, status (online/offline/provisioning/error),
  repository assegnate, ultima attività
- [ ] Click su un agente porta al suo dettaglio
- [ ] Possibilità di aggiungere o rimuovere repository da un agente esistente
- [ ] Possibilità di eliminare un agente (con conferma e warning se
  ci sono task in corso)
- [ ] L'eliminazione include il deprovisioning del VPS (Hetzner API)

**TASK-A.11.1** — Implementare `AgentsPage` con lista agenti:
query che aggrega `agents` + `agent_repositories` + ultima `task` per agente.

**TASK-A.11.2** — Implementare `AgentCard` nella lista:
nome, status badge (colore diverso per stato), repository chips,
ultima attività in formato relativo ("3 ore fa").

**TASK-A.11.3** — Implementare modifica repository assegnate:
drawer o modale con `RepositoryMultiSelect` precompilato. Submit fa
diff tra selezione attuale e nuova, aggiorna `agent_repositories`.

**TASK-A.11.4** — Implementare eliminazione agente:
Route Handler `DELETE /api/agents/{agentId}` che verifica assenza
di task in corso, avvia job `agent-deprovisioning` (elimina VPS su Hetzner,
cancella record), aggiorna stato a `deprovisioning` durante l'attesa.

---

### EPIC-A6 · VPS provisioning automatico

**Descrizione**
Il cuore operativo di questo sprint. Quando un founder crea un agente,
il sistema crea un VPS Hetzner, lo configura, installa l'orchestratore,
e lo rende operativo — tutto senza intervento manuale. Il processo è
asincrono, osservabile, e robusto ai fallimenti.

---

#### STORY-A.12 · Job di provisioning VPS

```
Come sistema,
voglio un job BullMQ che gestisce l'intero ciclo di vita
del provisioning di un VPS per un nuovo agente,
per poter creare agenti in modo affidabile e osservabile.
```

**Criteri di accettazione**
- [ ] Job `agent-provisioning` in BullMQ implementato e testato
- [ ] Il job emette eventi Supabase ad ogni step significativo
- [ ] Il job gestisce il fallimento di ogni step con retry configurabile
- [ ] Timeout globale del job: se dopo 15 minuti non è completato,
  il job fallisce e l'agente passa a `status=error`
- [ ] Il job è idempotente: se eseguito due volte sullo stesso agente,
  non crea due VPS

**TASK-A.12.1** — Implementare `AgentProvisioningWorker` BullMQ:
worker che esegue il job `agent-provisioning`. Sequenza dei passi:
1. Chiama Hetzner API per creare il VPS (con cloud-init se disponibile)
2. Aspetta che il VPS sia SSH-raggiungibile (polling con backoff)
3. Esegue lo script di setup via SSH
4. Verifica che l'orchestratore sia online (health check HTTP)
5. Aggiorna il record agente a `status=online`
Emettere evento Supabase ad ogni passo completato.

**TASK-A.12.2** — Implementare la chiamata Hetzner API per la creazione VPS:
autenticazione con API token (da env), parametri: server type (CX21),
datacenter (nbg1 o fsn1), image (Ubuntu 22.04), SSH key pre-configurata,
nome VPS derivato dall'ID agente per identificabilità.

**TASK-A.12.3** — Implementare il polling per startup VPS:
dopo la creazione, Hetzner impiega 30–90 secondi per avviare il VPS.
Polling con backoff esponenziale (5s, 10s, 20s) fino a SSH-raggiungibile.
Timeout: 5 minuti. Se scade: evento `agent.provisioning.failed` con
dettaglio "VPS non raggiungibile dopo 5 minuti".

**TASK-A.12.4** — Implementare lo script di setup via SSH:
connessione SSH con chiave pre-configurata, esecuzione dello script
di bootstrap che installa Node.js, clona l'orchestratore da GitHub,
copia il file `.env` con le variabili del workspace (Supabase URL,
Redis URL, Anthropic key, workspace ID), avvia il service systemd.

**TASK-A.12.5** — Implementare il health check post-setup:
dopo lo script di setup, l'orchestratore espone un endpoint `/health`.
Polling (max 2 minuti) finché non risponde con 200. Se non risponde:
evento di fallimento con log dell'ultima output SSH.

**TASK-A.12.6** — Implementare l'idempotenza del job:
prima di ogni step, verificare lo stato corrente del record agente.
Se il VPS è già stato creato (campo `vps_id` valorizzato), saltare
il passo di creazione. Questo protegge dal caso di job re-eseguito
dopo un crash parziale.

---

#### STORY-A.13 · Job di deprovisioning VPS

```
Come sistema,
voglio un job che elimina il VPS quando un agente viene eliminato,
per non lasciare risorse Hetzner abbandonate che generano costi.
```

**Criteri di accettazione**
- [ ] Job `agent-deprovisioning` implementato
- [ ] Il job elimina il VPS su Hetzner API
- [ ] Il job aggiorna il record agente a `status=deprovisioned`
- [ ] Se il VPS non esiste più su Hetzner (già eliminato manualmente):
  il job non fallisce ma continua e aggiorna il record
- [ ] Il job emette eventi per ogni step

**TASK-A.13.1** — Implementare `AgentDeprovisioningWorker` BullMQ:
1. Interrompe eventuali task in corso sull'agente (graceful shutdown)
2. Chiama Hetzner API per eliminare il VPS
3. Aggiorna il record agente a `status=deprovisioned`
Emettere evento ad ogni passo.

**TASK-A.13.2** — Implementare la gestione del caso "VPS non trovato":
se la chiamata Hetzner DELETE restituisce 404 (VPS già eliminato),
non fallire — loggare l'evento e continuare con l'aggiornamento del record.

---

#### STORY-A.14 · Gestione delle chiavi SSH

```
Come operator del sistema,
voglio che le chiavi SSH usate per il provisioning siano gestite
in modo sicuro e non dipendano dalla macchina di Carlo,
per poter eseguire il provisioning da qualsiasi ambiente.
```

**Criteri di accettazione**
- [ ] La chiave SSH usata per il provisioning è conservata in modo sicuro
  (non in chiaro in un file locale, non in git)
- [ ] La strategia di conservazione è documentata in `docs/ops/ssh-keys.md`
- [ ] Il worker di provisioning può accedere alla chiave dall'environment
  senza intervento manuale

**TASK-A.14.1** — Definire e implementare la strategia di conservazione
della chiave SSH: opzioni valutate sono variabile d'ambiente (base64-encoded
private key), Hetzner SSH key resource (la chiave viene registrata su
Hetzner e passata al VPS via ID), o secret manager esterno.
Documentare la scelta con motivazione.

**TASK-A.14.2** — Registrare la chiave SSH su Hetzner:
la chiave pubblica Robin.dev viene registrata una volta sulle Hetzner API
(`/ssh-keys`). Al momento della creazione del VPS, si passa l'ID della
chiave — il VPS viene configurato automaticamente senza step aggiuntivi.

---

### EPIC-A7 · Dashboard multi-agente

**Descrizione**
La dashboard deve riflettere il nuovo modello: un workspace può avere
più agenti, ognuno su repository diverse. Il founder deve capire in un
colpo d'occhio chi sta facendo cosa, su quale repo, con quale risultato.

---

#### STORY-A.15 · Dashboard aggiornata per multi-agente

```
Come founder,
voglio che la dashboard mi mostri lo stato di tutti i miei agenti
e delle loro repo in modo chiaro,
per non dover navigare tra pagine diverse per capire cosa sta succedendo.
```

**Criteri di accettazione**
- [ ] La sezione "Agenti attivi" in dashboard mostra tutti gli agenti
  del workspace con: nome, status, repo su cui stanno lavorando,
  task corrente (se attiva)
- [ ] Agente online con task attiva: mostra titolo task + fase ADWP corrente
- [ ] Agente online senza task: mostra "In attesa di task"
- [ ] Agente offline o in errore: badge di allerta con link al dettaglio
- [ ] Agente in provisioning: progress indicator con step corrente
- [ ] Click su un agente porta alla sua pagina di dettaglio
- [ ] Aggiornamento real-time via Supabase Realtime senza refresh

**TASK-A.15.1** — Aggiornare la query della dashboard per supportare
più agenti: query che restituisce tutti gli agenti del workspace con
il loro stato corrente e la task attiva (se esiste).

**TASK-A.15.2** — Implementare `AgentStatusGrid`:
componente che mostra gli agenti in una griglia (1 colonna su mobile,
2–3 su desktop). Ogni cella è un `AgentMiniCard`.

**TASK-A.15.3** — Implementare `AgentMiniCard`:
card compatta con nome agente, `StatusBadge` (colore per stato),
repo chips, task corrente o stato idle. Dimensioni contenute —
questa è una vista di sintesi, non di dettaglio.

**TASK-A.15.4** — Collegare la subscription Supabase Realtime:
quando lo stato di un agente cambia (nuovo evento `agent.*`),
aggiornare la card corrispondente senza re-fetchare tutta la dashboard.

---

#### STORY-A.16 · Pagina dettaglio agente

```
Come founder,
voglio una pagina dedicata a ogni agente che mi mostri
tutto quello che riguarda quell'agente,
per avere un punto di riferimento completo senza dover cercare.
```

**Criteri di accettazione**
- [ ] Route `/agents/{agentId}` implementata
- [ ] La pagina mostra: nome agente, status, VPS info (IP, uptime),
  repository assegnate, task in corso, ultime N task completate,
  timeline degli ultimi eventi
- [ ] Status badge aggiornato in real-time
- [ ] Azioni disponibili dalla pagina: modifica repo assegnate,
  elimina agente
- [ ] Se l'agente è in provisioning: mostra `ProvisioningTimeline`
  al posto della sezione task

**TASK-A.16.1** — Implementare `AgentDetailPage` con Server Component
per il fetch iniziale dei dati (agente, repo, ultime task) e Client
Component per la parte real-time.

**TASK-A.16.2** — Implementare `AgentInfoPanel`: nome, status, IP VPS,
data di creazione, uptime calcolato da `provisioned_at`.

**TASK-A.16.3** — Implementare `AgentRepositoryList` nella pagina:
lista delle repo assegnate con link a GitHub e link alla vista
filtrata delle task per quella repo.

**TASK-A.16.4** — Implementare `AgentTaskHistory`:
lista delle ultime 10 task gestite dall'agente con status, titolo,
e cycle time. Link a ogni task detail.

---

## Definition of Done — Sprint A

Lo sprint è completato quando **tutti** i seguenti criteri sono soddisfatti:

**GitHub Integration**
- [ ] OAuth connect/disconnect funzionante su account GitHub reale
- [ ] Token conservato in modo sicuro (non in chiaro nel DB)
- [ ] Lista repository fetchata correttamente da GitHub API
- [ ] Repository abilitate persistite e sincronizzate

**Agent Management**
- [ ] Form di creazione agente funzionante con selezione repository
- [ ] Provisioning avviato automaticamente alla creazione
- [ ] Timeline di provisioning aggiornata in real-time
- [ ] Pagina agenti con stato aggiornato in real-time
- [ ] Eliminazione agente con deprovisioning VPS automatico

**Provisioning**
- [ ] Job `agent-provisioning` testato su VPS Hetzner reale
- [ ] Job `agent-deprovisioning` testato su VPS Hetzner reale
- [ ] Chiave SSH gestita secondo la strategia definita (non in git)
- [ ] Fallimenti del provisioning mostrati in dashboard con messaggio leggibile

**Dashboard**
- [ ] Sezione agenti aggiornata per multi-agente
- [ ] Status di ogni agente aggiornato in real-time
- [ ] Navigazione agente → repo → task coerente e senza dead end

**Documentazione**
- [ ] ADR-10 (GitHub OAuth) scritto e committed
- [ ] ADR-11 (Hetzner provisioning) scritto e committed
- [ ] `docs/flows/agent-provisioning.md` scritto
- [ ] `docs/ops/ssh-keys.md` scritto
- [ ] Spike A1 e A2 prodotti e committed

**Il test finale — onboarding da zero:**
Partendo da un account GitHub reale (non quello di Carlo), seguire
il flusso senza istruzioni esterne:
- Connettere GitHub in meno di 2 minuti
- Selezionare almeno una repository
- Creare un agente e vederlo diventare online
- La dashboard mostra l'agente con lo stato corretto

Se uno di questi step richiede intervento manuale di Carlo, lo sprint
non è finito.

---

## Stima effort

| Epic | Scope | Effort stimato |
|---|---|---|
| EPIC-A1 · GitHub OAuth design | Spike, ADR, modello dati | ~6h |
| EPIC-A2 · Provisioning design | Flusso, ADR Hetzner, spike | ~5h |
| EPIC-A3 · GitHub OAuth integration | Connect, callback, token lifecycle | ~8h |
| EPIC-A4 · Repository selector | Lista repo, enable/disable, dettaglio | ~5h |
| EPIC-A5 · Agent creation flow | Form, provisioning feedback, gestione | ~7h |
| EPIC-A6 · VPS provisioning automatico | Job BullMQ, Hetzner API, SSH, health check | ~10h |
| EPIC-A7 · Dashboard multi-agente | Grid agenti, dettaglio agente, real-time | ~6h |
| **Totale stimato** | | **~47h** |

Lo sprint più tecnico fino ad ora per la complessità dell'integrazione
con API esterne (GitHub, Hetzner) e la natura asincrona del provisioning.
L'Epic A6 è il cuore e il rischio principale — va approcciato con uno
spike empirico su VPS reale prima di scrivere il worker.

---

## Rischi specifici di questo sprint

| Rischio | Probabilità | Mitigazione |
|---|---|---|
| GitHub OAuth scope insufficienti per clonare repo private | Media | SPIKE-A.01.A identifica gli scope esatti prima dell'implementazione. Non si inizia A3 senza questa risposta |
| Hetzner VPS impiega più di 5 minuti a essere SSH-raggiungibile | Bassa | SPIKE-A.04.A misura il tempo empiricamente. Il timeout del job viene calibrato su dati reali, non su stime |
| Script di setup VPS fallisce silenziosamente (exit code 0 ma setup incompleto) | Media | Il health check HTTP è il gate reale — non ci si fida dell'exit code dello script. Il VPS è "pronto" solo quando l'endpoint `/health` risponde 200 |
| Token GitHub revocato durante un task in esecuzione | Bassa | STORY-A.06 gestisce questo caso. Il task viene sospeso, non perso, e il founder riceve istruzioni precise |
| Hetzner API rate limit durante provisioning multiplo simultaneo | Bassa | Per i primi 3–5 clienti non è un problema. Da monitorare con > 10 clienti |
| Il flusso OAuth confonde il founder (permessi non chiari) | Media | Il bottone "Connetti GitHub" deve elencare esplicitamente cosa Robin può fare con i permessi richiesti, prima del redirect. Nessuna sorpresa |

---

## Collegamento con gli altri sprint

**Dipende da Sprint 1, 2 e 3:**
Schema Supabase, Clerk auth, BullMQ + Redis, orchestratore su VPS,
Supabase Realtime — tutto deve essere stabile prima di iniziare Sprint A.

**Prepara Sprint B:**
Il backlog management e lo sprint planning di Sprint B assumono che
gli agenti esistano già, siano associati a repository, e siano online.
Senza Sprint A, Sprint B non ha senso: crei task su quale agente?

---

*Robin.dev · Sprint A Backlog v1.0 · Carlo Ferrero · Febbraio 2026*
