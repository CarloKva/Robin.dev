# Spike-A2 — Hetzner Cloud API per Provisioning Automatico

**Sprint:** A
**Stato:** Completato
**Data:** 2026-02-28
**Autore:** Carlo Ferrero
**Decisione derivata:** ADR-11
**Time-box rispettato:** ~2h

---

## Obiettivo

Valutare la Hetzner Cloud API per l'uso nel provisioning automatico delle VPS agente. Rispondere alle domande concrete: come funziona l'autenticazione, quanto tempo impiega una VPS a essere operativa, è possibile usare cloud-init, come si gestiscono le chiavi SSH, quali sono i rate limit.

---

## Autenticazione

Hetzner Cloud API usa **Bearer token authentication**. Il token viene generato nel Hetzner Cloud Console sotto "Security" → "API Tokens". I token sono a lunga durata (non scadono automaticamente) e hanno granularità Read o Read/Write.

```http
Authorization: Bearer <HETZNER_API_TOKEN>
```

**Strategia per Robin.dev:** un singolo API token con permesso Read/Write, conservato come variabile d'ambiente del backend (`HETZNER_API_TOKEN`). Questo token appartiene all'account Hetzner di Carlo (o dell'organizzazione Robin.dev).

---

## Rate Limits

Hetzner Cloud API impone i seguenti limiti:

| Tipo | Limite |
|---|---|
| Richieste totali | 3.600/ora per token |
| Creazione server | Nessun limite specifico (incluso nel rate generale) |
| Azioni parallele sullo stesso server | 1 azione alla volta per server |

**Implicazione pratica:** con 3–5 clienti pilota, il rate limit non è mai un problema. Anche con 50 clienti che provisionano contemporaneamente, 50 richieste sono trascurabili su 3.600/h. Da monitorare con > 100 clienti.

---

## Creazione di un server

### Endpoint

```
POST https://api.hetzner.cloud/v1/servers
```

### Payload minimo

```json
{
  "name": "robin-agent-{agent_id}",
  "server_type": "cx22",
  "image": "ubuntu-24.04",
  "location": "fsn1",
  "ssh_keys": ["{hetzner_ssh_key_id}"],
  "user_data": "#!/bin/bash\n..."
}
```

### Risposta

Hetzner restituisce immediatamente (< 500ms) con il record server:

```json
{
  "server": {
    "id": 12345678,
    "name": "robin-agent-abc",
    "status": "initializing",
    "public_net": {
      "ipv4": { "ip": "1.2.3.4" }
    }
  },
  "action": {
    "id": 98765,
    "status": "running"
  }
}
```

**Il campo `id`** (intero) è il `vps_id` da conservare nel record agente per operazioni future (eliminazione, monitoring).

**Il campo `status`** al momento della creazione è sempre `"initializing"` — il server non è ancora raggiungibile.

---

## Tempo di avvio VPS

**Processo di avvio in due fasi:**

1. **VPS running** (status passa da `initializing` a `running`): tipicamente **30–90 secondi**. Verificabile tramite `GET /v1/servers/{id}` — quando `status == "running"`, il VPS è avviato a livello OS.

2. **Cloud-init completato** (script di setup terminato): ulteriori **2–4 minuti** dopo lo status `running`. Il cloud-init script installa Node.js, clona il codice, configura systemd.

**Tempo totale atteso (avvio VPS → orchestratore online):** 3–5 minuti in condizioni normali.

### Polling strategy

```
POST /v1/servers → salva server.id → inizia polling

Polling GET /v1/servers/{id}:
- ogni 5s per i primi 60s
- ogni 10s tra 60s–180s
- timeout a 5 minuti

Quando status == "running":
  → inizia polling health check orchestratore

Health check GET http://{vps_ip}:3001/health:
- ogni 10s
- timeout a 5 minuti
```

**Nota:** non fare polling sull'azione Hetzner (`/v1/actions/{id}`) — è meno affidabile del polling sullo status del server per determinare la prontezza operativa.

---

## Cloud-init: eliminare il bisogno di SSH post-boot

Hetzner supporta **cloud-init** tramite il campo `user_data` nella chiamata di creazione server. Lo script viene eseguito automaticamente al primo avvio come root.

**Questo elimina il bisogno di una connessione SSH separata per il setup.** Non serve un SSH client nel provisioning worker — basta il campo `user_data`.

### Struttura dello script cloud-init

```bash
#!/bin/bash
set -euo pipefail

# 1. Aggiornamento sistema
apt-get update -qq && apt-get upgrade -y -qq

# 2. Installazione dipendenze
apt-get install -y -qq curl git

# 3. Node.js 22 LTS
curl -fsSL https://deb.nodesource.com/setup_22.x | bash -
apt-get install -y -qq nodejs

# 4. Redis locale
apt-get install -y -qq redis-server
systemctl enable redis-server
systemctl start redis-server

# 5. Clona orchestratore
git clone https://github.com/CarloKva/Robin.dev.git /opt/robin/orchestrator

# 6. Installa dipendenze orchestratore
cd /opt/robin/orchestrator/apps/orchestrator
npm install --production

# 7. Scrivi .env dall'environment passato tramite user_data (interpolato)
cat > /opt/robin/orchestrator/apps/orchestrator/.env <<'ENVEOF'
SUPABASE_URL={SUPABASE_URL}
SUPABASE_SERVICE_ROLE_KEY={SUPABASE_SERVICE_ROLE_KEY}
REDIS_URL=redis://127.0.0.1:6379
ANTHROPIC_API_KEY={ANTHROPIC_API_KEY}
WORKSPACE_ID={WORKSPACE_ID}
AGENT_ID={AGENT_ID}
ENVEOF

# 8. Crea systemd service
cat > /etc/systemd/system/robin-orchestrator.service <<'SERVICEEOF'
[Unit]
Description=Robin.dev Orchestrator
After=network.target redis-server.service

[Service]
Type=simple
User=root
WorkingDirectory=/opt/robin/orchestrator/apps/orchestrator
ExecStart=/usr/bin/node dist/index.js
Restart=always
RestartSec=10
EnvironmentFile=/opt/robin/orchestrator/apps/orchestrator/.env

[Install]
WantedBy=multi-user.target
SERVICEEOF

systemctl daemon-reload
systemctl enable robin-orchestrator
systemctl start robin-orchestrator
```

**I valori tra `{}` vengono interpolati dal provisioning worker** prima di inviare lo script a Hetzner — il worker sostituisce i placeholder con i valori reali del workspace.

**Sicurezza:** il campo `user_data` non è cifrato su Hetzner e può essere letto da chiunque abbia accesso API all'account. Per questo motivo, le credenziali sensibili (come `ANTHROPIC_API_KEY`) non devono essere incluse nel `user_data` in chiaro. La strategia alternativa è: il VPS al boot chiama un endpoint interno di Robin.dev per scaricare le sue credenziali, presentando l'`agent_id` e un bootstrap token temporaneo. Questo è più sicuro ma più complesso. Per il pilota: includere nel `user_data` è accettabile dato che l'account Hetzner è controllato da Carlo.

---

## Gestione chiavi SSH

### Perché le chiavi SSH restano utili anche con cloud-init

Anche usando cloud-init per il setup iniziale, le chiavi SSH rimangono necessarie per:
- Debug manuale in caso di problemi di provisioning
- Aggiornamenti dell'orchestratore senza ricreare il VPS
- Accesso di emergenza

### Hetzner SSH Key Resource

Hetzner permette di registrare chiavi SSH una volta sola e riutilizzarle per tutti i server:

```
POST /v1/ssh_keys
{
  "name": "robin-dev-provisioner",
  "public_key": "ssh-ed25519 AAAA..."
}
→ Risposta: { "ssh_key": { "id": 9876543 } }
```

L'ID restituito (`9876543`) viene passato nel campo `ssh_keys` alla creazione di ogni server. Il VPS viene automaticamente configurato con questa chiave pubblica — nessuno step SSH aggiuntivo.

### Strategia consigliata

1. Generare una coppia di chiavi Ed25519 dedicata a Robin.dev provisioner (fatta una volta da Carlo).
2. Registrare la chiave pubblica su Hetzner → ottenere l'SSH key ID.
3. Conservare l'SSH key ID come variabile d'ambiente (`HETZNER_SSH_KEY_ID`).
4. Conservare la chiave privata come variabile d'ambiente base64 (`ROBIN_SSH_PRIVATE_KEY_B64`).

Dettagli completi in `docs/ops/ssh-keys.md`.

---

## Eliminazione di un server (deprovisioning)

```
DELETE /v1/servers/{id}
```

- Se il server esiste: restituisce `200` con action di eliminazione in corso.
- Se il server non esiste (`404`): non fallire — è già eliminato. Logga e continua.
- Il server viene eliminato definitivamente in pochi secondi.
- I dati (disco) vengono cancellati da Hetzner automaticamente.

**Nessuna operazione di "shutdown graceful" prima della DELETE** — Hetzner gestisce lo spegnimento. L'orchestratore deve fare graceful shutdown autonomamente all'avvio del deprovisioning (segnale SIGTERM via API interna).

---

## Server type raccomandato

Confermato da ADR-09: **CX22** è il server type adeguato per l'orchestratore Robin.dev.

| Spec | Valore |
|---|---|
| Provider | Hetzner Cloud |
| Tipo | CX22 (AMD EPYC) |
| vCPU | 2 |
| RAM | 4 GB |
| Storage | 40 GB NVMe SSD |
| Banda inclusa | 20 TB/mese |
| OS | Ubuntu 24.04 LTS |
| Datacenter | FSN1 (Falkenstein, Germania) |
| Costo | ~€3.98/mese |

**Upgrade path:** se un cliente usa intensivamente l'agente (> 100 task/mese, sessioni Claude lunghe), il CX22 può essere upgradata a CX32 (4 vCPU, 8GB RAM) senza cambiare l'architettura.

**Scelta datacenter:** FSN1 (Falkenstein) per la minor latenza verso Supabase (che usa AWS eu-central-1, Frankfurt). NBG1 (Nuremberg) è alternativa equivalente nella stessa area geografica.

---

## Alternativa a Hetzner: valutazione rapida

Se Hetzner API avesse limitazioni non previste, le alternative immediate sono:

| Provider | Pro | Contro |
|---|---|---|
| **DigitalOcean** | API ben documentata, Droplets simili a VPS Hetzner | ~2× più costoso per spec equivalenti |
| **Vultr** | Prezzi competitivi, API simile | Meno datacenter EU, supporto più lento |
| **OVHcloud** | Datacenter EU, prezzi bassi | API meno moderna, UX peggiore |
| **AWS EC2** | Infrastruttura enterprise | Complessità IAM, costi variabili, overkill per v1.0 |

**Hetzner rimane la scelta principale** per il pilota. Non ci sono limitazioni note che possano bloccare l'implementazione. DigitalOcean è il fallback immediato se necessario — la logica del provisioning worker cambia solo nella chiamata API specifica, non nell'architettura.

---

## Checklist pre-implementazione

Prima di scrivere il worker BullMQ, verificare:

- [ ] Account Hetzner Cloud creato/disponibile per Robin.dev
- [ ] API token Read/Write generato e conservato in env
- [ ] Chiave SSH Ed25519 generata e registrata su Hetzner (`POST /v1/ssh_keys`) → ottenuto `HETZNER_SSH_KEY_ID`
- [ ] Test manuale: creare VPS via API, verificare tempo di startup, eliminare — tutto tramite curl/Postman
- [ ] Script cloud-init testato su VPS manuale: eseguire il bootstrap, verificare che l'orchestratore si avvii correttamente

---

## Riferimenti

- [Hetzner Cloud API Reference](https://docs.hetzner.cloud/)
- [Hetzner cloud-init documentation](https://docs.hetzner.cloud/#server-actions-create-a-server)
- [cloud-init documentation](https://cloud-init.io/)
- ADR-11: `docs/adr/ADR-11-hetzner-provisioning.md`
- ADR-09: `docs/adr/ADR-09-isolation-model.md`
- `docs/ops/ssh-keys.md`
