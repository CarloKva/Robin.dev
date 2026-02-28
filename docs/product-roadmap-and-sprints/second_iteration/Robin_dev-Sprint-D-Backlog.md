# Robin.dev — Sprint D Backlog
## Multi-tenancy Production + Provisioning Automatico

**Versione 1.0 · Carlo Ferrero · Febbraio 2026**

---

## Obiettivo dello sprint

Ogni cliente ha il proprio workspace isolato, il proprio agente
provisionato in automatico, e può completare l'onboarding in meno
di 15 minuti in autonomia — senza che Carlo tocchi nulla.

Al termine di questo sprint, Robin.dev è un servizio. Non un progetto
personale funzionante, non un prodotto beta gestito a mano: un servizio
che può avere clienti paganti, che garantisce isolamento dei dati tra
workspace, e che ha procedure documentate per ogni scenario operativo
incluso l'offboarding.

**Cosa ottieni concretamente alla fine:**
Un nuovo cliente riceve un link di invito. Fa signup, connette GitHub,
crea il suo primo agente. Tutto funziona come se fosse l'unico cliente
al mondo. I suoi dati non sono visibili agli altri clienti — nemmeno
accidentalmente. Se decide di andarsene, esiste una procedura per
cancellare tutto ciò che lo riguarda entro 24 ore. Se vuoi aggiungere
un quinto cliente domani, esegui uno script e segui una checklist —
non inventi nulla, non chiedi a nessuno.

Questo è lo sprint che trasforma Robin.dev in qualcosa che puoi vendere.

---

## Prerequisiti da Sprint C

Prima di iniziare, verificare che siano soddisfatti:

- [ ] Sprint C completato: ciclo completo task → PR → rework → merge
  funzionante end-to-end su dati reali
- [ ] Almeno un ciclo di rework GitHub-triggered testato su PR reale
- [ ] Notifiche email e Slack funzionanti e testate
- [ ] Nessun bug critico aperto sui flussi core (backlog, sprint, rework)
- [ ] RLS attiva su tutte le tabelle esistenti

Se il prodotto ha bug critici sui flussi core, Sprint D non inizia.
Onboardare clienti su un prodotto instabile è peggio di non onboardarli:
genera churning immediato e danni alla reputazione difficili da recuperare.

---

## Struttura del backlog

```
Sprint D
├── FASE A — Analisi e Design
│   ├── EPIC-D1 · Security review e modello di isolamento definitivo
│   └── EPIC-D2 · Design del processo di onboarding cliente
└── FASE B — Implementazione
    ├── EPIC-D3 · Isolamento multi-tenant verificato
    ├── EPIC-D4 · Onboarding self-service
    ├── EPIC-D5 · Workspace settings e configurazione
    ├── EPIC-D6 · Offboarding e data governance
    ├── EPIC-D7 · Operatività e runbook
    └── EPIC-D8 · Pricing e limiti di utilizzo
```

---

## Una nota sulla natura di questo sprint

Gli sprint A, B e C costruivano feature. Questo sprint costruisce
il **servizio** attorno alle feature.

La differenza è fondamentale. Le feature richiedono che il codice
funzioni. Il servizio richiede che il codice funzioni, che i dati
dei clienti siano al sicuro, che ci sia una procedura per ogni
scenario, che il pricing sia sostenibile, che si possa rispondere
alla domanda "cosa succede se questo cliente vuole andarsene?"

La parte tecnica di questo sprint è relativamente contenuta rispetto
agli sprint precedenti — l'isolamento RLS è già in parte implementato,
il provisioning VPS esiste da Sprint A. La parte operativa è quella
che richiede più attenzione: test di sicurezza espliciti, procedure
documentate, limiti di utilizzo, data governance. Cose che non si
vedono nella demo ma che fanno la differenza tra un servizio
professionale e un progetto precario.

Il principio guida è: **se non puoi spiegarlo in una procedura
scritta, non è pronto per la produzione.**

---

## FASE A — Analisi e Design

---

### EPIC-D1 · Security review e modello di isolamento definitivo

**Descrizione**
Prima di onboardare clienti reali, verificare con test espliciti
che l'isolamento funzioni in ogni scenario possibile. Non si assume
che funzioni — si prova che funzioni con scenari di attacco reali.
Una vulnerabilità scoperta dopo l'onboarding del primo cliente è
un problema esistenziale per il servizio.

---

#### STORY-D.01 · Security review completa dell'isolamento Supabase

```
Come responsabile della sicurezza del sistema,
voglio verificare con test espliciti che l'isolamento RLS
impedisca ogni forma di accesso cross-workspace,
per poter garantire ai clienti che i loro dati non sono accessibili ad altri.
```

**Criteri di accettazione**
- [ ] Test suite di isolamento scritta ed eseguita su ambiente di staging
- [ ] I seguenti scenari sono testati e risultano tutti bloccati:
  utente workspace A legge task di workspace B,
  utente workspace A legge task_events di workspace B,
  utente workspace A legge iterazioni di workspace B,
  utente workspace A legge github_connections di workspace B,
  utente workspace A aggiorna task di workspace B,
  utente workspace A inserisce task con workspace_id di B,
  chiamata API con JWT valido di A e workspace_id di B nel body,
  chiamata API con JWT valido di A e workspace_id di B nel path param
- [ ] Risultati documentati in `docs/security/rls-audit-v1.md`
- [ ] Zero vulnerabilità aperte al termine — se trovate, chiuse
  prima di procedere con qualsiasi altra cosa in questo sprint

**SPIKE-D.01.A · Pattern di attacco RLS su Supabase: aggiornamento**
*Time-box: 2h*

Questo spike aggiorna e estende SPIKE-05.02.A degli sprint precedenti
tenendo conto delle nuove tabelle introdotte negli sprint A, B e C:
`github_connections`, `repositories`, `agent_repositories`, `sprints`,
`task_iterations`, `repository_memory`, `task_templates`.

Domande da rispondere:
- Le nuove tabelle hanno RLS attiva e policy corrette?
- Esistono join o view che bypassano RLS aggirando le policy?
- Le funzioni PostgreSQL con `SECURITY DEFINER` esistenti espongono
  dati cross-workspace?
- I webhook endpoint (`/api/webhooks/github`) validano correttamente
  che il webhook appartiene a un workspace autorizzato?

Output: `docs/spikes/spike-D1-rls-audit.md` con lista tabelle,
policy attuali, vulnerabilità trovate e fix applicati.

**TASK-D.01.1** — Inventariare tutte le tabelle con RLS:
lista completa di ogni tabella nel database, stato RLS (attiva/non attiva),
policy esistenti. Qualsiasi tabella senza RLS attiva è una vulnerabilità
potenziale — documentare perché (es. tabella di sola lettura pubblica)
o attivarla.

**TASK-D.01.2** — Scrivere lo script di test di isolamento:
creare 2 workspace con utenti separati (usando Supabase Auth direttamente,
non Clerk — per controllare i JWT in modo preciso), inserire dati
in entrambi, eseguire ogni scenario di attacco con JWT di workspace A
cercando dati di workspace B.

**TASK-D.01.3** — Eseguire lo script e documentare ogni risultato.
Se un test fallisce (= vulnerabilità trovata), fermarsi immediatamente,
applicare il fix, rieseguire il test prima di continuare.

**TASK-D.01.4** — Testare i Route Handler del gestionale:
ogni endpoint API verificato con JWT di A e workspace_id di B
nei path params, query params e body. Verificare che il middleware
di autenticazione non sia bypassabile.

**TASK-D.01.5** — Scrivere `docs/security/rls-audit-v1.md` con
la lista completa degli scenari testati, i risultati, e i fix applicati.

---

#### STORY-D.02 · ADR sul modello di isolamento infrastrutturale definitivo

```
Come architect del sistema,
voglio chiudere definitivamente la decisione sul modello di isolamento
infrastrutturale per cliente,
per non dover riprogettare l'infrastruttura quando si raggiungono
i primi 10 clienti.
```

**Criteri di accettazione**
- [ ] ADR-14 scritto e committed
- [ ] La decisione è presa tra VPS dedicata per cliente vs container
  Docker per workspace vs processo isolato per workspace
- [ ] Il costo reale per cliente è documentato con cifre concrete
  per i tre scenari di utilizzo attesi (10 task/mese, 30 task/mese,
  60 task/mese)
- [ ] La decisione è coerente con il pricing comunicato ai clienti pilota
- [ ] La scalabilità fino a 20 clienti è verificata: il modello
  scelto è gestibile operativamente da un solo developer

**TASK-D.02.1** — Costruire la tabella dei costi per cliente per ogni
modello di isolamento. Costi da includere: VPS Hetzner (fisso mensile),
Redis (condiviso o dedicato), Supabase (piano in base al numero di
workspace), Anthropic API (variabile per task/mese), Monitoring
Betterstack (per VPS o aggregato). Calcolare margine operativo a
€800/mese, €1.200/mese, €2.000/mese per cliente.

**TASK-D.02.2** — Valutare la complessità operativa con 10 clienti
per ogni modello: quante VPS? Come si aggiornano tutte in modo
coordinato? Quanto tempo richiede un update dell'orchestratore
su tutti i VPS? Questo impatta direttamente il costo operativo
in ore di Carlo.

**TASK-D.02.3** — Scrivere ADR-14 con decisione finale,
motivazione, costi documentati e piano di revisione
(es. "questa decisione va rivista al raggiungimento di 15 clienti").

---

### EPIC-D2 · Design del processo di onboarding cliente

**Descrizione**
Definire ogni passo del processo di onboarding — dal momento in cui
un cliente decide di provare Robin.dev al momento in cui il suo primo
agente è online e pronto. L'obiettivo è 15 minuti in autonomia totale.
Ogni passo che richiede l'intervento di Carlo è un passo da eliminare
o automatizzare.

---

#### STORY-D.03 · Onboarding flow design end-to-end

```
Come product designer (sono io),
voglio mappare ogni passo dell'onboarding di un nuovo cliente,
dall'invito alla prima task avviata,
per costruire un flusso che non richiede il mio intervento
in nessun punto.
```

**Criteri di accettazione**
- [ ] Documento `docs/flows/onboarding.md` scritto
- [ ] Ogni passo del flusso ha: chi lo esegue (sistema/cliente/Carlo),
  quanto dura, cosa succede se va storto
- [ ] I passi manuali rimanenti (se esistono) sono identificati e
  giustificati — non si accetta un passo manuale senza una ragione
  esplicita e temporanea
- [ ] Il flusso è stato percorso mentalmente almeno una volta
  simulando un cliente che non conosce Robin.dev

**TASK-D.03.1** — Documentare il flusso happy path completo:
```
1. Carlo invia link di invito al cliente (email con link signup)
2. Cliente fa signup con email/Google via Clerk
3. Clerk webhook → crea workspace automaticamente
4. Onboarding wizard: connetti GitHub → seleziona repo → crea agente
5. Sistema provisiona VPS automaticamente (Sprint A)
6. Cliente vede agente online
7. Cliente crea prima task e avvia primo sprint
8. Prima PR arriva entro [X] minuti
```
Per ogni passo: timing atteso, feedback visivo, cosa succede in caso di errore.

**TASK-D.03.2** — Identificare tutti i passi che oggi richiedono
intervento manuale di Carlo e classificarli: da eliminare (automatizzabile
in questo sprint), da ridurre (semi-automatizzabile), da documentare
(accettabile come passo manuale per ora con motivazione).

**TASK-D.03.3** — Definire il contenuto dell'onboarding wizard:
quante schermate? Cosa mostra ognuna? Come si gestisce il caso in cui
il cliente esce a metà onboarding e torna dopo? Il progresso viene
salvato?

---

#### STORY-D.04 · Pricing e piano di accesso

```
Come founder di Robin.dev,
voglio definire il modello di pricing e i limiti di accesso
per i clienti pilota,
per avere chiarezza su cosa è incluso nel servizio
e cosa triggera una conversazione su un upgrade.
```

**Criteri di accettazione**
- [ ] Modello di pricing per i pilot documentato in `docs/business/pricing-pilot.md`
- [ ] Limiti di utilizzo definiti: numero massimo di agenti per workspace,
  numero massimo di task per mese, numero massimo di repository
- [ ] Cosa succede quando si raggiunge un limite: blocco hard, warning,
  notifica a Carlo
- [ ] Il pricing è sostenibile: il margine a ogni tier è positivo
  anche nel worst case di utilizzo

**TASK-D.04.1** — Definire i tier pilot con limiti e prezzi:
proposta da discutere e finalizzare. Esempio di struttura:
Starter (1 agente, 3 repo, 20 task/mese, €X/mese),
Growth (3 agenti, 10 repo, 60 task/mese, €Y/mese),
Scale (agenti illimitati, repo illimitate, task illimitate, €Z/mese).
Verificare che i margini siano positivi su ogni tier.

**TASK-D.04.2** — Calcolare il costo variabile per task:
ogni task costa: tempo VPS durante l'esecuzione (~ N minuti a €X/h),
token Anthropic API (~ N token a $X/M), overhead Redis e Supabase
(trascurabile per i primi clienti). Documentare il costo reale
per task nei tre scenari di complessità (task semplice, media, complessa).

**TASK-D.04.3** — Documentare la policy di fair use per il pilot:
durante il periodo pilota, i limiti sono enforced via warning
(non blocco hard) per dare flessibilità. Definire quando un cliente
ha "abusato" del servizio e come gestirlo.

---

## FASE B — Implementazione

---

### EPIC-D3 · Isolamento multi-tenant verificato

**Descrizione**
Implementare e verificare tutte le policy di isolamento mancanti,
chiudere le vulnerabilità trovate in Fase A, e aggiungere un layer
di test automatici che prevengono regressioni future.

---

#### STORY-D.05 · Fix vulnerabilità e completamento RLS

```
Come sistema,
voglio che ogni tabella del database abbia RLS attiva e policy corrette,
per garantire l'impossibilità matematica di accesso cross-workspace.
```

**Criteri di accettazione**
- [ ] Ogni tabella nel database ha RLS attiva
- [ ] Le vulnerabilità trovate in STORY-D.01 sono chiuse
- [ ] Le nuove policy sono scritte, testate e committed come migration
- [ ] Nessuna eccezione non documentata: se una tabella ha RLS disattivata,
  c'è un commento nel migration file che spiega perché

**TASK-D.05.1** — Applicare i fix alle vulnerabilità trovate in D.01.
Ogni fix è una migration separata con descrizione chiara del problema
risolto.

**TASK-D.05.2** — Attivare RLS su tutte le tabelle che ne sono prive:
per le tabelle di configurazione globale (es. `task_templates` di sistema,
non del workspace), aggiungere policy di sola lettura pubblica se
appropriato; per tutte le altre, policy `workspace_id = auth.uid()`.

**TASK-D.05.3** — Verificare i webhook endpoint: `POST /api/webhooks/github`
deve validare che il payload appartenga a una repository del workspace
corretto, prima di processare qualsiasi dato. Aggiungere il check
mancante se non presente.

---

#### STORY-D.06 · Test automatici di isolamento

```
Come sistema,
voglio una test suite automatica che verifica l'isolamento RLS
ad ogni deploy,
per non scoprire regressioni di sicurezza in produzione.
```

**Criteri di accettazione**
- [ ] Suite di test di isolamento implementata ed eseguibile con
  un singolo comando
- [ ] I test coprono tutti gli scenari di TASK-D.01.2
- [ ] I test girano in CI/CD (GitHub Actions) ad ogni push su main
- [ ] Un test fallito blocca il deploy — nessuna eccezione
- [ ] I test usano un database di staging dedicato, non quello di produzione

**TASK-D.06.1** — Implementare la test suite di isolamento con
Vitest o Jest: ogni scenario di TASK-D.01.2 diventa un test con
asserzione esplicita su cosa ci si aspetta (errore 403 o array vuoto,
non dati del workspace B).

**TASK-D.06.2** — Configurare il database di staging per i test:
un progetto Supabase separato dedicato esclusivamente ai test di
isolamento. Le credenziali sono in GitHub Actions secrets, non
in `.env` locale.

**TASK-D.06.3** — Aggiungere i test di isolamento alla pipeline CI/CD:
step dedicato in `.github/workflows/` che esegue i test di isolamento
dopo il build e prima del deploy. Se fallisce: deploy bloccato,
notifica Slack a Carlo.

---

### EPIC-D4 · Onboarding self-service

**Descrizione**
Il flusso di onboarding che un nuovo cliente percorre da solo, senza
aiuto. Ogni passo deve essere ovvio, ogni errore deve avere un messaggio
che spiega cosa fare — non un codice HTTP o una stack trace.

---

#### STORY-D.07 · Creazione workspace automatica al signup

```
Come sistema,
voglio che quando un nuovo utente fa signup,
il workspace venga creato automaticamente senza passi manuali,
per non richiedere l'intervento di Carlo per ogni nuovo cliente.
```

**Criteri di accettazione**
- [ ] Clerk webhook `user.created` triggerà la creazione automatica
  del workspace
- [ ] Il workspace viene creato con: nome derivato dall'email del founder
  (modificabile in seguito), piano `trial` di default, settings
  di default (notifiche email attive, Slack disattivato)
- [ ] L'utente viene rediretto all'onboarding wizard alla prima login
- [ ] Se il webhook Clerk fallisce (retry esaurito): alert a Carlo
  via Slack con dettaglio dell'errore e link all'utente su Clerk dashboard

**TASK-D.07.1** — Implementare Route Handler `POST /api/webhooks/clerk`:
riceve l'evento `user.created`, crea workspace e associa l'utente.
Validare il webhook con il signing secret di Clerk prima di processare.

**TASK-D.07.2** — Implementare la creazione workspace transazionale:
in un'unica transazione PostgreSQL: insert su `workspaces`,
insert su `workspace_members` con ruolo `owner`, insert su
`workspace_settings` con valori di default.

**TASK-D.07.3** — Implementare il redirect al wizard:
al primo login, verificare se il workspace ha completato l'onboarding
(flag `onboarding_completed` su `workspace_settings`). Se no: redirect
all'onboarding wizard invece della dashboard.

**TASK-D.07.4** — Implementare l'alert a Carlo in caso di fallimento
Clerk webhook: handler di errore che invia messaggio Slack con
`user_id`, `email`, timestamp e dettaglio dell'errore. Carlo può
creare il workspace manualmente in meno di 5 minuti con lo script
di provisioning.

---

#### STORY-D.08 · Onboarding wizard

```
Come nuovo cliente,
voglio essere guidato attraverso i passi di setup iniziale
da un wizard chiaro e progressivo,
per arrivare ad avere un agente online senza dover leggere
documentazione o chiedere aiuto.
```

**Criteri di accettazione**
- [ ] Wizard con massimo 4 schermate: benvenuto + GitHub connect,
  selezione repository, creazione primo agente, conferma e dashboard
- [ ] Ogni schermata ha: titolo chiaro, descrizione in linguaggio naturale
  (non tecnico), azione principale, indicatore di progresso (step 1/4)
- [ ] Il wizard è riprendibile: se il cliente esce alla schermata 2
  e torna il giorno dopo, riparte dalla schermata 2
- [ ] Al completamento: `onboarding_completed = true` su workspace_settings,
  il founder viene portato alla dashboard con un messaggio di benvenuto
- [ ] Se l'agente non è ancora online al termine del wizard:
  la dashboard mostra lo stato di provisioning in real-time
  (riutilizzando `ProvisioningTimeline` di Sprint A)

**TASK-D.08.1** — Implementare `OnboardingWizard`:
componente multi-step con gestione del progresso persistito in
`workspace_settings.onboarding_step`. Navigazione avanti/indietro,
validazione per ogni step prima di procedere.

**TASK-D.08.2** — Implementare `OnboardingStep1` — benvenuto e GitHub:
copy di benvenuto che spiega Robin.dev in 2 righe, bottone
"Connetti GitHub" che avvia il flusso OAuth di Sprint A,
conferma visiva dopo la connessione.

**TASK-D.08.3** — Implementare `OnboardingStep2` — selezione repository:
riutilizzare `RepositorySelector` di Sprint A. Almeno una repository
deve essere selezionata per procedere.

**TASK-D.08.4** — Implementare `OnboardingStep3` — creazione primo agente:
riutilizzare `AgentCreationForm` di Sprint A con UX leggermente
semplificata per il contesto onboarding (meno opzioni, testo più guidato).
Il submit avvia il provisioning in background e porta allo step 4.

**TASK-D.08.5** — Implementare `OnboardingStep4` — conferma e attesa:
schermata che mostra `ProvisioningTimeline` in real-time. Quando
l'agente diventa online, bottone "Vai alla dashboard" si attiva.
Copy che spiega al cliente cosa fare mentre aspetta (es. "Nel frattempo,
puoi creare le tue prime task nel backlog").

---

#### STORY-D.09 · Link di invito e accesso controllato

```
Come founder di Robin.dev,
voglio poter invitare clienti tramite link di invito personalizzati,
per controllare chi accede al servizio durante il periodo pilota
senza dover gestire manualmente ogni signup.
```

**Criteri di accettazione**
- [ ] Sistema di link di invito implementato: ogni link è monouso,
  ha una scadenza (30 giorni di default), e può essere associato
  a un piano specifico
- [ ] Chi fa signup senza link di invito valido viene messo in
  lista d'attesa (non rifiutato — preserva la lead)
- [ ] Carlo può generare link di invito da una pagina admin minimale
- [ ] I link usati e scaduti sono tracciati

**TASK-D.09.1** — Implementare la tabella `invitations`:
campi: `code` (UUID, unico), `email` (opzionale — invito personalizzato
o generico), `plan` (piano assegnato al workspace), `expires_at`,
`used_at`, `used_by_user_id`, `created_by`.

**TASK-D.09.2** — Implementare la validazione del codice invito al signup:
middleware che intercetta il signup di Clerk e verifica se è presente
un codice invito valido (passato come URL param o custom field Clerk).
Se valido: signup procede normalmente con piano assegnato.
Se non presente o scaduto: redirect a pagina lista d'attesa.

**TASK-D.09.3** — Implementare la pagina lista d'attesa:
form semplice (email + nome azienda + descrizione del progetto),
messaggio di conferma, invio email automatico di conferma ricezione.
I dati vanno in una tabella `waitlist` — Carlo li revisa e converte
in inviti quando opportuno.

**TASK-D.09.4** — Implementare la pagina admin per la gestione inviti:
route `/admin` accessibile solo a Carlo (autenticazione separata o
whitelist email). Mostra: lista d'attesa con bottone "Invita",
link di invito generati con stato (usato/non usato/scaduto),
bottone "Genera link generico".

---

### EPIC-D5 · Workspace settings e configurazione

**Descrizione**
Il founder deve poter configurare il proprio workspace — notifiche,
piano, informazioni di fatturazione, gestione dei membri del team.
Non tutto serve al primo giorno, ma alcune cose sono necessarie
prima dell'onboarding dei clienti pilota.

---

#### STORY-D.10 · Pagina Settings completa

```
Come founder di un workspace,
voglio una pagina di settings completa dove posso configurare
ogni aspetto del mio workspace,
per non dover contattare Carlo per cambiare qualcosa.
```

**Criteri di accettazione**
- [ ] Pagina `/settings` con sezioni: Workspace, GitHub, Notifiche,
  Piano e utilizzo, Danger zone
- [ ] Ogni sezione è modificabile in autonomia (nessun campo richiede
  intervento di Carlo)
- [ ] Le modifiche vengono salvate con feedback esplicito (successo/errore)
- [ ] La sezione "Piano e utilizzo" mostra l'utilizzo corrente vs limiti

**TASK-D.10.1** — Implementare `SettingsPage` con navigazione
a sezioni (sidebar o tab). Riutilizzare `GitHubConnectionCard`
di Sprint A per la sezione GitHub.

**TASK-D.10.2** — Implementare `WorkspaceSettings`:
nome workspace modificabile, timezone (per timestamp nelle notifiche),
logo (upload opzionale). Salvataggio via `PATCH /api/workspace`.

**TASK-D.10.3** — Implementare `NotificationSettings`:
toggle email, input webhook Slack con test di connessione, selezione
degli eventi che generano notifica (tutto attivo di default, founder
può disattivare specifiche categorie). Già parzialmente implementato
in Sprint B — completare e unificare.

**TASK-D.10.4** — Implementare `PlanUsagePanel`:
mostra per il mese corrente: agenti attivi vs limite, task eseguite
vs limite, repository abilitate vs limite. Barra di progresso per
ogni metrica. Se si supera l'80% di un limite: warning visivo.

**TASK-D.10.5** — Implementare `DangerZone`:
sezione con azioni irreversibili: elimina workspace (con doppia
conferma e typing del nome workspace), esporta tutti i dati (trigger
`GET /api/workspace/export`). Le azioni destructive sono rosse,
richiedono conferma esplicita, e generano un audit event.

---

#### STORY-D.11 · Gestione membri del workspace

```
Come founder del workspace,
voglio poter aggiungere altri membri del mio team al workspace,
per non essere l'unico che può gestire il backlog e revieware le PR.
```

**Criteri di accettazione**
- [ ] Sezione "Membri" in Settings con lista dei membri correnti
- [ ] Invito membro via email: il membro riceve un link di invito
  specifico per il workspace
- [ ] Ruoli definiti: `owner` (Carlo o il founder) e `member`
  (può creare task, gestire sprint, non può eliminare il workspace
  o disconnettere GitHub)
- [ ] Rimozione membro con conferma
- [ ] Un workspace ha sempre almeno un `owner` — non si può rimuovere
  l'ultimo owner

**TASK-D.11.1** — Implementare la tabella `workspace_members`
se non già presente: campi `workspace_id`, `user_id`, `role`,
`invited_at`, `joined_at`. RLS: visibile solo ai membri dello stesso
workspace.

**TASK-D.11.2** — Implementare il flusso di invito membro:
input email in Settings → crea record invitation con `workspace_id`
associato → invia email Resend con link → al click: signup/login
Clerk → webhook crea `workspace_member` per il workspace corretto.

**TASK-D.11.3** — Implementare il middleware di autorizzazione per ruolo:
verificare il ruolo del membro nelle operazioni sensibili (eliminazione
workspace, disconnessione GitHub, eliminazione agenti). Un `member`
che tenta operazioni da `owner` riceve 403 con messaggio esplicativo.

---

### EPIC-D6 · Offboarding e data governance

**Descrizione**
Un servizio professionale ha una procedura chiara per quando un cliente
se ne va. Non come difesa legale — ma perché è la cosa giusta da fare
e perché avere una procedura documentata protegge entrambe le parti.

---

#### STORY-D.12 · Script di offboarding cliente

```
Come operator del servizio,
voglio una procedura documentata e uno script parzialmente
automatizzato per offboardare un cliente,
per completare l'offboarding in meno di 1 ora
senza dimenticare nessun passo.
```

**Criteri di accettazione**
- [ ] `docs/runbook/offboarding.md` scritto con ogni passo in ordine
- [ ] Lo script automatizza i passi ripetibili: eliminazione dati Supabase,
  deprovisioning VPS, revoca token GitHub
- [ ] I passi manuali rimanenti (es. cancellazione account Hetzner
  se non automatizzabile) sono documentati con istruzioni precise
- [ ] Il processo è testato su un workspace fittizio prima di
  essere usato su un cliente reale
- [ ] Al termine dell'offboarding: zero dati del cliente rimasti
  nel sistema (verificabile con query di controllo)

**TASK-D.12.1** — Implementare `offboard-workspace.ts`:
script eseguibile via `tsx` che accetta `workspace_id` come argomento.
Sequenza:
1. Verifica che il workspace esista e sia in stato `active`
2. Mette il workspace in `status=offboarding` (impedisce nuovi task)
3. Aspetta il completamento dei task in corso (o li cancella con conferma)
4. Revoca il token GitHub (chiamata GitHub API)
5. Avvia deprovisioning di tutti gli agenti del workspace (job BullMQ)
6. Aspetta il completamento del deprovisioning
7. Elimina tutti i dati Supabase nell'ordine corretto (rispettando
   foreign key: task_events → task_iterations → tasks → sprints →
   agent_repositories → agents → repositories → github_connections →
   workspace_members → workspace_settings → workspace)
8. Log di ogni passo con timestamp

**TASK-D.12.2** — Implementare la query di verifica post-offboarding:
query che controlla che non rimanga nessun record associato al
workspace_id in nessuna tabella. Output: lista tabelle con conteggio
righe (devono essere tutte 0).

**TASK-D.12.3** — Testare lo script su workspace fittizio:
creare un workspace di test completo (agente, task, sprint, iterazioni),
eseguire lo script, verificare con la query di controllo che non
rimanga nulla.

---

#### STORY-D.13 · Export dati e data retention policy

```
Come cliente,
voglio poter esportare tutti i miei dati in qualsiasi momento,
per non essere vincolato a Robin.dev e per conformità GDPR.

Come operator,
voglio una policy di data retention documentata,
per sapere esattamente per quanto tempo conservo i dati dei clienti
e cosa cancello alla scadenza.
```

**Criteri di accettazione**
- [ ] `GET /api/workspace/export` implementato: restituisce archivio
  ZIP con tutti i dati del workspace in formato JSON leggibile
- [ ] L'export include: workspace info, tutti gli agenti, tutte le task
  con eventi e iterazioni, tutti gli sprint, repository memory
- [ ] L'export esclude: token GitHub (per sicurezza), dati di sistema
  non appartententi al cliente
- [ ] `docs/legal/data-retention-policy.md` scritto e pubblicato
- [ ] La policy definisce: per quanto tempo si conservano i dati
  di un workspace inattivo, cosa succede automaticamente alla scadenza

**TASK-D.13.1** — Implementare `generateWorkspaceExport(workspaceId)`:
funzione server-side che esegue le query per ogni entità del workspace
e assembla il JSON. Struttura: un file JSON per entità
(`tasks.json`, `sprints.json`, `agents.json`, etc.) compressi in ZIP.

**TASK-D.13.2** — Implementare Route Handler
`GET /api/workspace/export`:
chiama `generateWorkspaceExport()`, restituisce ZIP con header
`Content-Disposition: attachment; filename=robindev-export-{date}.zip`.
Aggiungere rate limiting: massimo 1 export per ora per workspace.

**TASK-D.13.3** — Scrivere `docs/legal/data-retention-policy.md`:
definire per ogni tipo di dato: quanto viene conservato dopo
la cancellazione del workspace (es. 30 giorni per permettere
ripensamenti), cosa viene eliminato immediatamente (token, credenziali),
cosa viene anonimizzato vs eliminato. Allineare con GDPR base.

---

### EPIC-D7 · Operatività e runbook

**Descrizione**
Il runbook è il documento che si apre quando qualcosa va storto alle
23:00. Deve coprire gli scenari con probabilità reale di accadimento,
con procedure chiare e comandi esatti. Non teoria — pratica.

---

#### STORY-D.14 · Runbook: orchestratore non risponde

```
Come operator,
voglio una procedura documentata per diagnosticare e risolvere
il caso in cui l'orchestratore di un cliente non risponde,
per ripristinare il servizio senza improvvisare.
```

**Criteri di accettazione**
- [ ] `docs/runbook/incident-orchestrator-down.md` scritto
- [ ] Copre: diagnosi in ordine (cosa controllare prima),
  fix per ogni causa comune (crash, Redis down, Supabase unreachable,
  disco pieno), comunicazione al cliente, post-mortem template
- [ ] Include comandi esatti per ogni passo di diagnosi e fix
- [ ] Downtime target definito: < 15 minuti per risoluzione problemi comuni

**TASK-D.14.1** — Scrivere la procedura di diagnosi in ordine di
probabilità decrescente:
```
1. Verificare status agente su dashboard Robin (primo controllo senza SSH)
2. Ping VPS (il VPS è raggiungibile?)
3. SSH sul VPS → systemctl status robindev-orchestrator
4. journalctl -u robindev-orchestrator -n 100 (ultimi 100 log)
5. redis-cli ping (Redis risponde?)
6. curl -s {supabase_url}/health (Supabase raggiungibile?)
7. df -h (spazio disco sufficiente?)
8. free -m (memoria disponibile?)
```

**TASK-D.14.2** — Scrivere il fix per ogni causa identificata:
crash del processo (restart + verifica causa nel log),
Redis non disponibile (restart Redis o failover a Redis secondario),
Supabase unreachable (attesa + comunicazione a cliente),
disco pieno (pulizia log + espansione volume),
memoria esaurita (restart + analisi memory leak).

**TASK-D.14.3** — Scrivere i template di comunicazione al cliente
per ogni livello di severità: < 15 minuti (non comunicare, risolvere
e basta), 15–60 minuti (email proattiva con stima di risoluzione),
> 60 minuti (email + Slack con aggiornamento ogni 30 minuti).

---

#### STORY-D.15 · Runbook: aggiornamento orchestratore su tutti i VPS

```
Come operator,
voglio una procedura documentata per aggiornare l'orchestratore
su tutti i VPS clienti in modo coordinato,
per rilasciare fix e nuove versioni senza causare downtime prolungato.
```

**Criteri di accettazione**
- [ ] `docs/runbook/update-orchestrator.md` scritto
- [ ] Procedura per aggiornamento singolo VPS con rollback documentato
- [ ] Script per aggiornamento sequenziale di tutti i VPS
- [ ] Downtime atteso per VPS: < 30 secondi (restart del service)
- [ ] Checklist post-aggiornamento: health check, smoke test, verifica log

**TASK-D.15.1** — Scrivere la procedura di aggiornamento singolo VPS:
```
1. Mettere in pausa la queue del workspace (BullMQ pause)
2. Attendere completamento task in corso (o timeout + notifica)
3. SSH sul VPS
4. git pull → npm install → systemctl restart robindev-orchestrator
5. Verificare health check endpoint
6. Riprendere la queue (BullMQ resume)
7. Verificare nei log che i job vengano processati normalmente
```

**TASK-D.15.2** — Implementare `update-orchestrator.sh`:
script bash che esegue la procedura di aggiornamento su un VPS
passato come argomento. Parametri: VPS IP, versione target (branch o tag Git).
Output: log colorato con timestamp per ogni passo, exit code 1 se
qualcosa fallisce.

**TASK-D.15.3** — Implementare `update-all-orchestrators.sh`:
loop su tutti i VPS in `agents` con `status=online`, chiama
`update-orchestrator.sh` in sequenza (non in parallelo — per evitare
downtime simultaneo su tutti i clienti). Genera un report
al termine con esito per ogni VPS.

---

#### STORY-D.16 · Monitoring e alerting

```
Come operator,
voglio che il sistema mi avvisi proattivamente quando qualcosa
non funziona,
per non scoprire i problemi dai clienti.
```

**Criteri di accettazione**
- [ ] Betterstack (o equivalente) configurato per monitorare:
  uptime del gestionale Vercel, health check di ogni VPS agente,
  Supabase (latenza query), Redis (connettività)
- [ ] Alert via Slack a Carlo per: VPS down, health check fallito,
  orchestratore non processa job da > 30 minuti, errore 5xx
  sul gestionale per > 1 minuto
- [ ] Dashboard di monitoring accessibile senza SSH
- [ ] Retention dei log: almeno 30 giorni

**TASK-D.16.1** — Configurare Betterstack Uptime per ogni VPS:
check HTTP sull'endpoint `/health` dell'orchestratore ogni 1 minuto.
Alert Slack se il check fallisce per 3 minuti consecutivi.

**TASK-D.16.2** — Configurare Betterstack Logs per l'aggregazione
dei log degli orchestratori: ogni orchestratore invia i log via
journald → Betterstack agent. Retention 30 giorni. Alert per
pattern di errore critici (`FATAL`, `UnhandledPromiseRejection`).

**TASK-D.16.3** — Implementare un endpoint `/health` standardizzato
sull'orchestratore se non già presente da Sprint 2: risponde JSON
con stato dei worker BullMQ, connettività Supabase, connettività Redis,
numero di job in coda. Questo è l'endpoint monitorato da Betterstack.

**TASK-D.16.4** — Configurare alert per job BullMQ stalled:
se un job rimane in `active` per più di 30 minuti senza progresso
(timeout del job), BullMQ lo marca come `stalled`. Aggiungere un
handler per l'evento `stalled` che invia alert Slack con workspace_id
e task_id.

---

#### STORY-D.17 · Registro clienti e documentazione operativa

```
Come operator,
voglio un registro interno con tutte le informazioni operative
di ogni cliente e una documentazione operativa di riferimento,
per non dover ricordare a memoria le specifiche di ogni workspace.
```

**Criteri di accettazione**
- [ ] Template `docs/clients/template.md` con tutti i campi operativi
- [ ] Scheda creata per ogni cliente pilota
- [ ] Il registro non contiene dati sensibili in chiaro (no API key,
  no password, no token)
- [ ] `docs/ops/emergency-contacts.md` con: chi contattare in caso
  di problema critico, escalation path, numeri di supporto Hetzner/Supabase

**TASK-D.17.1** — Scrivere il template scheda cliente con sezioni:
identificativi (workspace_id, nome azienda, contatto tecnico referente),
infrastruttura (VPS IP, VPS ID Hetzner, datacenter, piano Hetzner),
GitHub (organizzazione, repository abilitate, data connessione),
storico operativo (incidenti, update, note),
link operativi (Betterstack dashboard, Supabase dashboard, Hetzner console,
link alla pagina admin Robin per quel workspace).

**TASK-D.17.2** — Creare la scheda per ogni cliente pilota (3 schede).

**TASK-D.17.3** — Scrivere `docs/ops/emergency-contacts.md`:
supporto Hetzner (portal + numero emergenze), supporto Supabase
(canale Discord + supporto email), escalation interna (cosa fare
se Carlo non è disponibile e c'è un incidente critico).

---

### EPIC-D8 · Pricing e limiti di utilizzo

**Descrizione**
I limiti definiti in Fase A devono essere implementati nel sistema.
Non come blocco hard (troppo aggressivo per il periodo pilota),
ma come warning progressivi che informano il founder e Carlo.

---

#### STORY-D.18 · Enforcement dei limiti di utilizzo

```
Come sistema,
voglio verificare i limiti di utilizzo prima di eseguire
operazioni che potrebbero superarli,
per evitare che un cliente consumi più risorse del suo piano
senza che nessuno se ne accorga.
```

**Criteri di accettazione**
- [ ] Prima di creare un nuovo agente: verifica limite agenti del piano
- [ ] Prima di avviare uno sprint: verifica limite task/mese rimanenti
- [ ] Prima di abilitare una nuova repository: verifica limite repo del piano
- [ ] Al raggiungimento dell'80% di ogni limite: warning in dashboard
  e notifica email al founder
- [ ] Al raggiungimento del 100%: blocco soft (operazione non parte)
  con messaggio che spiega cosa fare (contattare Carlo per upgrade)
- [ ] Carlo riceve notifica Slack quando un workspace supera l'80%
  di qualsiasi limite

**TASK-D.18.1** — Implementare `checkPlanLimits(workspaceId, resource, count)`:
funzione che verifica lo stato di utilizzo per una risorsa (agents,
tasks_this_month, repositories) rispetto ai limiti del piano.
Restituisce: `allowed | warning | blocked` con percentuale di utilizzo.

**TASK-D.18.2** — Aggiungere il check ai Route Handler rilevanti:
`POST /api/agents` → check limite agenti,
`POST /api/sprints/{id}/start` → check limite task/mese,
`POST /api/github/repos/enable` → check limite repository.
Se `blocked`: 402 con messaggio strutturato.

**TASK-D.18.3** — Implementare `UsageSummary` nel `PlanUsagePanel`
di Settings: aggiornare in tempo reale quando si avvicinano i limiti.
Aggiungere un banner globale in dashboard quando un limite è all'80%.

**TASK-D.18.4** — Implementare le notifiche di limite a Carlo:
quando un workspace supera l'80% di qualsiasi limite, inviare
notifica Slack a Carlo con: nome workspace, risorsa, percentuale,
link alla scheda cliente nel registro.

---

## Definition of Done — Sprint D

Lo sprint è completato quando **tutti** i seguenti criteri sono soddisfatti:

**Sicurezza**
- [ ] Test RLS su tutte le tabelle: tutti PASS
- [ ] Test di isolamento cross-workspace: tutti PASS
- [ ] Test automatici di isolamento integrati in CI/CD e funzionanti
- [ ] Zero vulnerabilità aperte documentate in D.01

**Onboarding**
- [ ] Signup → wizard → agente online funzionante in autonomia < 15 minuti
  (cronometrato su account reale, non di Carlo)
- [ ] Link di invito funzionante: generazione, utilizzo, scadenza
- [ ] Lista d'attesa funzionante per signup senza invito
- [ ] Pagina admin per gestione inviti e lista d'attesa

**Settings e configurazione**
- [ ] Pagina Settings completa con tutte le sezioni
- [ ] Piano e utilizzo con limiti visualizzati correttamente
- [ ] Gestione membri del workspace funzionante
- [ ] Export dati funzionante: ZIP con tutti i dati in formato leggibile

**Offboarding e governance**
- [ ] Script offboarding testato su workspace fittizio: zero dati rimasti
- [ ] Data retention policy scritta e pubblicata
- [ ] Export dati con rate limiting funzionante

**Operatività**
- [ ] Monitoring Betterstack attivo su tutti i VPS e sul gestionale
- [ ] Alert Slack funzionanti per incidenti critici
- [ ] Runbook scritto per: orchestratore down, aggiornamento orchestratore
- [ ] Script di aggiornamento orchestratore testato su VPS reale
- [ ] Registro clienti con schede per i 3 pilota

**Pricing**
- [ ] Limiti di utilizzo enforced con warning all'80% e blocco soft al 100%
- [ ] Notifiche a Carlo al superamento dell'80% di ogni limite

**Il test finale — onboarding da zero su account reale:**
Inviare un link di invito a un account email che Carlo non usa normalmente.
Seguire il flusso senza istruzioni esterne:
- Signup in meno di 2 minuti
- Connessione GitHub in meno di 3 minuti
- Creazione agente e attesa online in meno di 10 minuti
- Creazione di 3 task in backlog, avvio sprint, prima PR ricevuta

Cronometrare ogni passo. Se il totale supera 15 minuti o se uno step
richiede intervento di Carlo, identificare il problema e risolverlo
prima di dichiarare lo sprint completato.

---

## Stima effort

| Epic | Scope | Effort stimato |
|---|---|---|
| EPIC-D1 · Security review | Spike, audit RLS, ADR isolamento, analisi costi | ~7h |
| EPIC-D2 · Onboarding design | Flow, pricing, limiti | ~5h |
| EPIC-D3 · Isolamento verificato | Fix, test automatici, CI/CD | ~6h |
| EPIC-D4 · Onboarding self-service | Webhook Clerk, wizard, inviti, lista d'attesa | ~9h |
| EPIC-D5 · Workspace settings | Settings completo, membri, piano, danger zone | ~7h |
| EPIC-D6 · Offboarding e governance | Script offboarding, export, data retention | ~6h |
| EPIC-D7 · Operatività e runbook | Monitoring, runbook, script aggiornamento, registro | ~7h |
| EPIC-D8 · Pricing e limiti | Enforcement limiti, notifiche, usage panel | ~5h |
| **Totale stimato** | | **~52h** |

Lo sprint più lungo in assoluto, ma anche quello con la natura più
distribuita: nessun epic singolo è preponderante, e molto del lavoro
è documentazione e procedure operative piuttosto che codice nuovo.
L'Epic D4 (onboarding self-service) è il più critico per il time-to-value
del cliente — va prioritizzato e testato end-to-end prima di procedere
con gli altri epic.

---

## Rischi specifici di questo sprint

| Rischio | Probabilità | Mitigazione |
|---|---|---|
| Test di isolamento trovano vulnerabilità RLS critiche | Media | STORY-D.01 si esegue prima di tutto il resto dello sprint. Vulnerabilità trovate bloccano ogni altra attività finché non sono chiuse. Non si onboarda nessun cliente con vulnerabilità aperte |
| Il wizard di onboarding supera i 15 minuti per problemi di UX | Media | Il test finale con account reale è non negoziabile. Se supera il limite, si identifica il collo di bottiglia e si risolve — non si dichiara lo sprint completato |
| Script di offboarding non elimina tutti i dati (foreign key non rispettate) | Media | TASK-D.12.2 implementa la query di verifica post-offboarding. Lo script non è accettato finché la query non restituisce zero per ogni tabella |
| Betterstack non supporta il tipo di monitoring necessario per i VPS | Bassa | Betterstack supporta HTTP monitor e log aggregation — sufficienti per i requisiti. Alternativa: UptimeRobot per uptime + Papertrail per log |
| Il costo reale per task supera le stime e rende il pricing non sostenibile | Media | TASK-D.02.2 calcola il costo reale prima di finalizzare il pricing. Se il margine è negativo su un tier, il tier va rivisto prima dell'onboarding |
| Il flusso di invito Clerk è più complesso del previsto da integrare | Bassa | Clerk supporta natively i custom fields al signup e i webhook `user.created`. Il rischio è basso ma va verificato con uno spike rapido se emergono dubbi |

---

## Dopo Sprint D: cosa non è ancora fatto

Sprint D completa la versione 1.0 di Robin.dev — il sistema minimo
per servire clienti paganti in modo professionale. Ciò che rimane
fuori dallo scope e che andrà affrontato in base al feedback dei
clienti pilota:

**Prodotto**
- Fatturazione automatica: con > 5 clienti ha senso integrare Stripe
  per gestire pagamenti, fatture, e downgrade automatici al superamento
  dei limiti
- Dashboard admin aggregata: vista multi-workspace per Carlo con
  stato di tutti i clienti, alert aggregati, metriche di sistema
- Supporto stack non-Node.js: varianti del CLAUDE.md e script di
  provisioning per repository Python, Go, Ruby
- App mobile nativa: la dashboard responsive funziona, ma una app
  dedicata migliorerebbe l'esperienza per le notifiche push

**Distribuzione**
- Documentazione pubblica: sito marketing, pricing pubblico, docs
  per i clienti — necessario per scalare oltre i pilota referenziati
- Case study pilota: le storie dei primi 3 clienti sono il miglior
  strumento di vendita
- Self-serve signup senza invito: quando il prodotto è stabile,
  aprire il signup libero con trial automatico

**Operatività avanzata**
- SLA formale: uptime garantito contrattualmente richiede monitoring
  più sofisticato e procedure di escalation più strutturate
- Backup e disaster recovery: procedura documentata per perdita
  completa di un VPS con tutti i dati
- Multi-region: per clienti con requisiti di data residency europei
  (già soddisfatti con Hetzner EU, ma da documentare esplicitamente)

---

## Collegamento con gli altri sprint

**Dipende da Sprint A, B e C:**
Agenti online, sprint e backlog funzionanti, rework flow operativo.
Sprint D assume che il prodotto sia stabile e completo nelle feature
core — non si onboardano clienti su un prodotto con bug critici aperti.

**È il termine della roadmap v3.0:**
Al termine di Sprint D, Robin.dev è pronto per i primi 3 clienti
pilota. Quello che viene dopo dipende dal feedback raccolto durante
il periodo pilota — non è pianificabile ora con utilità reale.

---

*Robin.dev · Sprint D Backlog v1.0 · Carlo Ferrero · Febbraio 2026*
