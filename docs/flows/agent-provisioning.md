# Flusso di Provisioning Agente — End-to-End

**Sprint:** A
**Data:** 2026-02-28
**Autore:** Carlo Ferrero
**Riferimento backlog:** STORY-A.03 (EPIC-A2)

---

## Overview

Questo documento mappa ogni passo del processo che va dal click su "Crea agente" al momento in cui l'agente è online e pronto a ricevere task.

**Precondizione:** il workspace ha già una connessione GitHub attiva con almeno una repository abilitata.

**Tempo totale atteso (happy path):** 3–6 minuti.

---

## Diagramma del flusso happy path

```
Founder
  │
  ├─ [1] Click "Crea agente" → compila form (nome + repo selection)
  │
  ├─ [2] Submit form → POST /api/agents
  │         │
  │         └─ Frontend: agente card con status "Provisioning in corso..."
  │
Backend / API Route
  │
  ├─ [3] Crea record agents (provisioning_status = 'pending')
  ├─ [4] Crea record agent_repositories (one per repo selezionata)
  ├─ [5] Enqueue job BullMQ "agent-provisioning" con agentId
  ├─ [6] Emette evento agent.provisioning.started su task_events
  └─ [7] Risponde 201 con agente creato → frontend naviga a /agents/{id}

BullMQ Worker (apps/orchestrator)
  │
  ├─ [8] Legge config workspace da Supabase (SUPABASE_URL, SERVICE_ROLE_KEY, ecc.)
  ├─ [9] Verifica idempotenza: agent.vps_id == null?
  │
  ├─ [10] POST Hetzner API → crea VPS
  │         └─ Salva vps_id + vps_ip su agents → provisioning_status = 'provisioning'
  │         └─ Emette evento agent.provisioning.vps_created
  │
  ├─ [11] Polling GET /v1/servers/{vps_id} ogni 5s
  │         └─ Quando status == "running":
  │               └─ Emette evento agent.provisioning.setup_running
  │
  │         [Il cloud-init script gira sul VPS in autonomia]
  │
  ├─ [12] Polling GET http://{vps_ip}:3001/health ogni 10s
  │         └─ Quando risponde 200:
  │               └─ Aggiorna agents.provisioning_status = 'online'
  │               └─ Emette evento agent.provisioning.completed
  │
  └─ [Fine] Job completato ✓

Dashboard (Supabase Realtime)
  │
  └─ Subscription su task_events per agentId
       └─ Ogni evento aggiorna la ProvisioningTimeline in real-time
       └─ Quando completed: card agente diventa verde "Online"
       └─ Email/Slack inviato al founder: "Il tuo agente è pronto"
```

---

## Step per step — dettaglio completo

### [1–2] Form compilazione e submit

**Responsabile:** Frontend
**Input:** nome agente (stringa libera), lista repository selezionate (almeno 1)
**Output:** request `POST /api/agents`
**Tempo atteso:** istantaneo (azione utente)
**UI:** form con validazione lato client. Se connessione GitHub non attiva: blocco con banner "Prima connetti GitHub" + link a Settings.

---

### [3–7] Creazione record e accodamento job

**Responsabile:** Backend (Next.js Route Handler)
**Input:** nome agente, lista repository IDs, workspace ID (da sessione Clerk)
**Output:** record `agents` creato, job BullMQ accodato, risposta 201

**Azioni nel Route Handler:**
1. Verifica autenticazione (Clerk session) e appartenenza al workspace
2. Verifica connessione GitHub attiva per il workspace (`github_connections` con `status = 'connected'`)
3. Verifica che le repository selezionate appartengano al workspace
4. `INSERT INTO agents` con `provisioning_status = 'pending'`
5. `INSERT INTO agent_repositories` per ogni repo selezionata
6. `queue.add('agent-provisioning', { agentId })` su BullMQ
7. Emette evento `agent.provisioning.started` su `task_events` (payload: nome agente, workspace_id)
8. `return 201 { agent }`

**Tempo atteso:** < 500ms
**UI:** redirect automatico a `/agents/{id}` che mostra ProvisioningTimeline

---

### [8–9] Worker: inizializzazione e idempotenza

**Responsabile:** BullMQ Worker (apps/orchestrator)
**Input:** `{ agentId: uuid }`

**Azioni:**
1. Legge record `agents` con `agentId`
2. Legge configurazione workspace (SUPABASE_URL, SERVICE_ROLE_KEY, ANTHROPIC_API_KEY del workspace, ecc.)
3. Controlla idempotenza: `if (agent.vps_id != null) → vai direttamente a step [12]`

---

### [10] Creazione VPS Hetzner

**Responsabile:** BullMQ Worker
**Input:** configurazione workspace, HETZNER_API_TOKEN, HETZNER_SSH_KEY_ID
**Output:** VPS creata, `vps_id` e `vps_ip` salvati

**Azioni:**
1. Interpola le variabili del workspace nello script cloud-init
2. `POST https://api.hetzner.cloud/v1/servers` con payload:
   - `name: "robin-agent-{agentId}"`
   - `server_type: "cx22"`
   - `image: "ubuntu-24.04"`
   - `location: "fsn1"`
   - `ssh_keys: [HETZNER_SSH_KEY_ID]`
   - `user_data: <cloud-init script interpolato>`
3. Salva `agent.vps_id` e `agent.vps_ip` dal response
4. Aggiorna `provisioning_status = 'provisioning'`
5. Emette evento `agent.provisioning.vps_created` (payload: vps_id, vps_ip)

**Tempo atteso:** < 2s (risposta API Hetzner è quasi istantanea)
**UI:** ProvisioningTimeline → step "VPS in creazione" ✓, step "Setup in corso" in progress

**Failure mode:** se la chiamata Hetzner fallisce (5xx, timeout, rate limit):
- Retry con backoff: 3 tentativi (5s, 15s, 45s)
- Se tutti i tentativi falliscono: emette `agent.provisioning.failed` con motivo "Hetzner API non disponibile", `provisioning_status = 'error'`

---

### [11] Polling startup VPS

**Responsabile:** BullMQ Worker
**Input:** vps_id
**Output:** VPS in status `"running"`

**Azioni:**
1. Loop: `GET https://api.hetzner.cloud/v1/servers/{vps_id}`
2. Polling ogni **5 secondi** per i primi 60 secondi
3. Polling ogni **10 secondi** tra 60s e 5 minuti
4. Quando `server.status == "running"`: emette evento `agent.provisioning.setup_running`

**Timeout:** 5 minuti. Se il VPS non raggiunge `running` entro 5 minuti:
- Emette `agent.provisioning.failed` con motivo "VPS non avviata in 5 minuti"
- `provisioning_status = 'error'`
- Il VPS viene eliminato su Hetzner (cleanup) per non lasciare risorse abbandonate

**Nota:** lo status `running` significa che il VPS è avviato a livello OS, ma il cloud-init script potrebbe non aver ancora terminato. Il gate reale è l'health check dell'orchestratore (step [12]).

**UI:** ProvisioningTimeline → step "Setup in corso" (il cloud-init sta girando sul VPS)
**Tempo stimato residuo mostrato:** "~3–4 minuti"

---

### [Cloud-init in autonomia sul VPS — non monitorato direttamente]

**Responsabile:** VPS (cloud-init)
**Durata stimata:** 2–4 minuti dopo il VPS `running`

Il cloud-init script installa Node.js, Redis, clona il codice dell'orchestratore, scrive il file `.env` con le variabili del workspace, e avvia il service systemd. Quando il service è avviato con successo, l'orchestratore espone l'endpoint `/health`.

Il worker non monitora questi step uno per uno — il health check è il gate unico e definitivo.

---

### [12] Polling health check orchestratore

**Responsabile:** BullMQ Worker
**Input:** vps_ip
**Output:** orchestratore online

**Azioni:**
1. Loop: `GET http://{vps_ip}:3001/health`
2. Polling ogni **10 secondi**
3. Quando risponde `200 { status: "ok" }`:
   - Aggiorna `agents.provisioning_status = 'online'`
   - Emette evento `agent.provisioning.completed`
   - Invia notifica al founder (email via Resend + Slack se configurato)
   - Job completato ✓

**Timeout:** 5 minuti. Se l'endpoint non risponde entro 5 minuti dal VPS `running`:
- Emette `agent.provisioning.failed` con motivo "Orchestratore non risponde — controllare il log cloud-init"
- `provisioning_status = 'error'`
- **Non elimina il VPS** (a differenza dello step 11) — il founder o Carlo devono poter fare SSH per diagnosticare

**UI:** ProvisioningTimeline → step "Health check" in progress
**Tempo stimato residuo mostrato:** "< 1 minuto"

---

## Failure modes per ogni step

| Step | Evento di errore | UI mostrata al founder | Azione del sistema | Recupero |
|---|---|---|---|---|
| [10] Hetzner API non risponde | `provisioning.failed` + motivo "Hetzner API non disponibile" | "Impossibile creare il server. Riprova tra qualche minuto." + bottone "Riprova" | 3 retry con backoff, poi `provisioning_status = 'error'` | Founder clicca "Riprova" → nuovo job enqueued |
| [11] VPS non avvia in 5 min | `provisioning.failed` + motivo "VPS non avviata in 5 minuti" | "Il server non si è avviato in tempo. Riprova." | VPS eliminata su Hetzner, `provisioning_status = 'error'` | Founder clicca "Riprova" → nuovo job enqueued |
| [12] Orchestratore non risponde in 5 min | `provisioning.failed` + motivo "Orchestratore non risponde — controllare log cloud-init" | "Il server è avviato ma l'agente non risponde. Contatta il supporto se il problema persiste." | `provisioning_status = 'error'`, VPS non eliminata | Carlo fa SSH: `ssh robin@{vps_ip}`, legge `/var/log/cloud-init-output.log` |
| GitHub clone fallisce (dentro cloud-init) | Non rilevato direttamente — l'orchestratore non si avvia → timeout step [12] | Stesso messaggio di step [12] | Stessa azione | Carlo fa SSH e verifica log |

---

## Comunicazione durante il provisioning

Il provisioning dura 3–6 minuti. Il founder non deve stare davanti al browser.

**Strategia:**

1. **Supabase Realtime** (per chi è nella pagina): la ProvisioningTimeline si aggiorna in real-time ad ogni evento `agent.provisioning.*`. Il founder vede i step avanzare senza refresh.

2. **Email via Resend** (quando l'agente è pronto): email automatica con subject "Il tuo agente {nome} è online" e link diretto a `/agents/{id}`. Viene inviata sull'email del founder Clerk.

3. **Slack** (opzionale, se configurato nel workspace): messaggio nel canale configurato nelle Settings del workspace.

Il founder può chiudere la tab dopo il submit — riceverà la notifica email quando l'agente è pronto.

---

## Script cloud-init — struttura dei placeholder

Il worker interpola i seguenti placeholder nello script cloud-init prima di inviarlo a Hetzner:

| Placeholder | Valore | Sensibilità |
|---|---|---|
| `{SUPABASE_URL}` | URL Supabase pubblico del workspace | Bassa |
| `{SUPABASE_SERVICE_ROLE_KEY}` | Chiave service role Supabase | **Alta** |
| `{ANTHROPIC_API_KEY}` | API key Anthropic del workspace | **Alta** |
| `{WORKSPACE_ID}` | UUID del workspace | Bassa |
| `{AGENT_ID}` | UUID dell'agente | Bassa |
| `{GITHUB_APP_ID}` | ID GitHub App di Robin.dev | Bassa |
| `{GITHUB_APP_PRIVATE_KEY}` | Chiave privata GitHub App (base64) | **Alta** |
| `{GITHUB_INSTALLATION_ID}` | Installation ID del workspace | Bassa |

**Nota sicurezza:** i valori ad alta sensibilità sono presenti nel `user_data` di Hetzner. Vedere ADR-11 per le implicazioni e il piano di migrazione futuro.

---

## Flusso di deprovisioning (eliminazione agente)

```
Founder
  └─ Click "Elimina agente" → conferma modale

Backend
  ├─ Verifica assenza task in corso (task.status IN ('in_progress', 'queued'))
  │   └─ Se task in corso: blocca con warning "Ci sono task attive. Attendere o annullare."
  ├─ Aggiorna agents.provisioning_status = 'deprovisioning'
  └─ Enqueue job BullMQ "agent-deprovisioning"

BullMQ Worker
  ├─ [1] Segnala all'orchestratore sul VPS di fermarsi gracefully
  │       (POST http://{vps_ip}:3001/shutdown con secret token)
  │       Timeout: 30 secondi. Se non risponde: procedi comunque.
  ├─ [2] DELETE https://api.hetzner.cloud/v1/servers/{vps_id}
  │       Se 404: logga "VPS già eliminata" e continua.
  └─ [3] Aggiorna agents.provisioning_status = 'deprovisioned'
         Emette evento agent.deprovisioned

Dashboard
  └─ Agente sparisce dalla lista agenti
     (soft delete: record rimane nel DB per storico task)
```

---

## Validazione del documento

Questo flusso è verificabile in 5 minuti spiegandolo a voce:

1. Il founder compila un form con nome e repository → il backend crea un record e mette un job in coda.
2. Il job chiama Hetzner per creare un VPS, passando uno script di setup come user_data.
3. Il job aspetta che il VPS si avvii (~1 min), poi aspetta che l'orchestratore risponda al suo health check (~3 min).
4. Quando l'health check risponde, l'agente è online. Il founder riceve una email.
5. La dashboard si aggiorna in tempo reale grazie a Supabase Realtime.

Se un step fallisce, la dashboard mostra il motivo con un messaggio in linguaggio naturale e un bottone di recupero.

---

## Riferimenti

- ADR-10: GitHub App authentication
- ADR-11: Hetzner cloud-init provisioning
- `docs/ops/ssh-keys.md`: gestione chiavi SSH
- EPIC-A6 backlog: `docs/product-roadmap-and-sprints/second_iteration/Robin_dev-Sprint-A-Backlog.md`
