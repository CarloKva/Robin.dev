# Runbook — Provisioning Nuovo Cliente Robin.dev

**Versione:** 1.0
**Durata stimata:** < 2 ore
**Prerequisiti:** Accesso Hetzner Cloud, Supabase, Clerk Dashboard, GitHub org cliente

---

## Panoramica

```
FASE 1: Infrastruttura VPS    (~20 min)
FASE 2: Sistema e dipendenze  (~20 min)
FASE 3: Configurazione Robin  (~30 min)
FASE 4: Integrazione Supabase (~15 min)
FASE 5: Verifica e go-live    (~20 min)
```

---

## Variabili di riferimento

Sostituire questi placeholder con i valori reali del cliente prima di iniziare.

```bash
# Identificativi cliente
CLIENT_SLUG="acme"                        # slug univoco, lowercase, no spazi
CLIENT_NAME="Acme Corp"                   # nome leggibile
CLIENT_EMAIL="tech@acme.com"              # contatto tecnico

# Infrastruttura
VPS_IP=""                                 # da compilare dopo FASE 1.3
VPS_NAME="robin-${CLIENT_SLUG}"

# Repository cliente
GITHUB_ORG="acme-org"                     # GitHub organization del cliente
GITHUB_REPO="acme-product"               # repository principale

# Credenziali (da ricevere dal cliente o generare)
ANTHROPIC_API_KEY=""                      # API key Claude del cliente
CLERK_USER_ID=""                          # user_xxx creato per il cliente
```

---

## FASE 1 — Infrastruttura VPS

### 1.1 — Creare VPS su Hetzner Cloud

**Azione:** Accedere a [console.hetzner.cloud](https://console.hetzner.cloud) → Progetto Robin.dev → Add Server.

**Configurazione:**
```
Location:    Falkenstein (FSN1)
Image:       Ubuntu 24.04 LTS
Type:        CX22 (2 vCPU, 4 GB RAM, 40 GB NVMe)
SSH Keys:    Selezionare la chiave SSH Robin.dev admin
Name:        robin-${CLIENT_SLUG}
Labels:      client=${CLIENT_SLUG}, role=orchestrator
Backups:     Abilitare (opzionale, +20% costo)
```

**Output atteso:** VPS in stato "Running" con IPv4 assegnato.

**Verifica:**
```bash
VPS_IP="<ip dalla console Hetzner>"
ping -c 3 $VPS_IP
# Atteso: 3 pacchetti trasmessi, 0 persi
```

**Recovery se fallisce:** Verificare che la SSH key sia stata aggiunta correttamente. Ricreare il server se lo stato rimane "Initializing" per >5 minuti.

---

### 1.2 — Primo accesso SSH e aggiornamento sistema

**Azione:**
```bash
ssh root@$VPS_IP
```

**Output atteso:** Shell root sul VPS Ubuntu 24.04.

**Verifica:**
```bash
uname -a
# Atteso: Linux robin-${CLIENT_SLUG} 6.x.x ... Ubuntu ...
```

---

### 1.3 — Creare utente non-root per l'orchestratore

**Azione:**
```bash
# Sul VPS (come root)
useradd -m -s /bin/bash robin
usermod -aG sudo robin
mkdir -p /home/robin/.ssh
cp /root/.ssh/authorized_keys /home/robin/.ssh/
chown -R robin:robin /home/robin/.ssh
chmod 700 /home/robin/.ssh
chmod 600 /home/robin/.ssh/authorized_keys
```

**Verifica:**
```bash
# Dal tuo terminale locale
ssh robin@$VPS_IP
# Atteso: shell come utente robin, senza password
whoami
# Atteso: robin
```

**Recovery se fallisce:** Controllare i permessi di `/home/robin/.ssh/authorized_keys`. Deve essere 600 e owned by `robin:robin`.

---

## FASE 2 — Sistema e Dipendenze

### 2.1 — Installare Node.js 22 LTS

**Azione:**
```bash
# Sul VPS come robin
curl -fsSL https://deb.nodesource.com/setup_22.x | sudo -E bash -
sudo apt-get install -y nodejs
```

**Verifica:**
```bash
node --version
# Atteso: v22.x.x
npm --version
# Atteso: 10.x.x
```

**Recovery se fallisce:** Verificare connessione internet: `curl -I https://deb.nodesource.com`. Se fallisce, verificare DNS e firewall Hetzner.

---

### 2.2 — Installare Redis locale

**Azione:**
```bash
sudo apt-get install -y redis-server
# Configurare bind su localhost only (sicurezza)
sudo sed -i 's/^bind .*/bind 127.0.0.1/' /etc/redis/redis.conf
sudo systemctl enable redis-server
sudo systemctl start redis-server
```

**Verifica:**
```bash
redis-cli ping
# Atteso: PONG
sudo systemctl status redis-server
# Atteso: active (running)
```

**Recovery se fallisce:** Controllare se la porta 6379 è già in uso: `sudo lsof -i :6379`.

---

### 2.3 — Installare Git e altri tool

**Azione:**
```bash
sudo apt-get install -y git curl wget unzip build-essential
git --version
# Atteso: git version 2.x.x
```

---

### 2.4 — Installare Claude Code CLI

**Azione:**
```bash
npm install -g @anthropic-ai/claude-code
```

**Verifica:**
```bash
claude --version
# Atteso: versione corrente Claude Code
```

**Recovery se fallisce:** Verificare che `npm` sia nel PATH e che l'utente abbia permessi di scrittura globali. Alternativa: `npm install -g --prefix /home/robin/.local @anthropic-ai/claude-code`.

---

## FASE 3 — Configurazione Orchestratore Robin.dev

### 3.1 — Clonare il repository orchestratore

**Azione:**
```bash
# Sul VPS come robin
cd /home/robin
git clone https://github.com/CarloKva/Robin.dev.git robin-platform
cd robin-platform
npm install --workspace=apps/orchestrator
npm install --workspace=packages/shared-types
```

**Verifica:**
```bash
ls apps/orchestrator/src/
# Atteso: agent/, errors/, events/, utils/, workers/, index.ts
```

---

### 3.2 — Generare SSH key per GitHub cliente

**Azione:**
```bash
# Sul VPS come robin
ssh-keygen -t ed25519 -C "robin-agent-${CLIENT_SLUG}@robin.dev" \
  -f /home/robin/.ssh/id_ed25519_${CLIENT_SLUG} \
  -N ""  # no passphrase

# Mostrare la chiave pubblica da aggiungere a GitHub
cat /home/robin/.ssh/id_ed25519_${CLIENT_SLUG}.pub
```

**Output atteso:** Chiave pubblica in formato `ssh-ed25519 AAAA... robin-agent-...`

**Azione manuale (cliente/admin):** Aggiungere la chiave pubblica come **Deploy Key** con accesso in **scrittura** nel repository GitHub del cliente:
- GitHub → `${GITHUB_ORG}/${GITHUB_REPO}` → Settings → Deploy keys → Add deploy key
- Title: `Robin.dev Agent`
- Allow write access: ✓

**Verifica:**
```bash
# Configurare SSH per usare la chiave del cliente
cat >> /home/robin/.ssh/config << EOF
Host github-${CLIENT_SLUG}
  HostName github.com
  User git
  IdentityFile /home/robin/.ssh/id_ed25519_${CLIENT_SLUG}
  IdentitiesOnly yes
EOF

# Test connessione
ssh -T git@github-${CLIENT_SLUG}
# Atteso: Hi acme-org/acme-product! You've successfully authenticated...
```

**Recovery se fallisce:** Verificare che la deploy key sia stata salvata correttamente su GitHub. Verificare permessi del file: `chmod 600 /home/robin/.ssh/id_ed25519_${CLIENT_SLUG}`.

---

### 3.3 — Configurare variabili d'ambiente

**Azione:**
```bash
# Sul VPS come robin
cat > /home/robin/robin-platform/apps/orchestrator/.env << EOF
# Robin.dev Orchestrator — ${CLIENT_NAME}
# Generato: $(date -u +"%Y-%m-%dT%H:%M:%SZ")

NODE_ENV=production

# Supabase (shared project, workspace isolato da RLS)
SUPABASE_URL=https://ccgodxlviculeqsnlgse.supabase.co
SUPABASE_SERVICE_ROLE_KEY=<service_role_key_from_supabase>

# Redis (locale, non esposto)
REDIS_URL=redis://127.0.0.1:6379

# Claude API (chiave del cliente)
ANTHROPIC_API_KEY=${ANTHROPIC_API_KEY}

# Repository cliente
REPOSITORY_PATH=/home/robin/repos/${CLIENT_SLUG}

# Workspace Supabase del cliente
WORKSPACE_ID=<workspace_uuid_da_compilare_in_fase_4>
EOF

chmod 600 /home/robin/robin-platform/apps/orchestrator/.env
```

**Verifica:**
```bash
cat /home/robin/robin-platform/apps/orchestrator/.env | grep -v KEY | grep -v SECRET
# Non mostrare valori sensibili
ls -la /home/robin/robin-platform/apps/orchestrator/.env
# Atteso: -rw------- (600)
```

---

### 3.4 — Clonare il repository cliente

**Azione:**
```bash
mkdir -p /home/robin/repos
cd /home/robin/repos

# Clonare usando l'SSH host alias configurato in 3.2
GIT_SSH_COMMAND="ssh -i /home/robin/.ssh/id_ed25519_${CLIENT_SLUG}" \
  git clone git@github.com:${GITHUB_ORG}/${GITHUB_REPO}.git ${CLIENT_SLUG}

ls /home/robin/repos/${CLIENT_SLUG}/
# Atteso: contenuto repository cliente
```

**Verifica:**
```bash
cd /home/robin/repos/${CLIENT_SLUG}
git log --oneline -5
# Atteso: ultimi 5 commit del repo cliente
```

---

### 3.5 — Configurare systemd service

**Azione:**
```bash
sudo tee /etc/systemd/system/robin-orchestrator-${CLIENT_SLUG}.service << EOF
[Unit]
Description=Robin.dev Orchestrator — ${CLIENT_NAME}
After=network.target redis.service
Requires=redis.service

[Service]
Type=simple
User=robin
WorkingDirectory=/home/robin/robin-platform/apps/orchestrator
EnvironmentFile=/home/robin/robin-platform/apps/orchestrator/.env
ExecStart=/usr/bin/node dist/index.js
Restart=on-failure
RestartSec=10
StandardOutput=journal
StandardError=journal
SyslogIdentifier=robin-${CLIENT_SLUG}

[Install]
WantedBy=multi-user.target
EOF

# Build e abilitazione
cd /home/robin/robin-platform
npm run build --workspace=apps/orchestrator

sudo systemctl daemon-reload
sudo systemctl enable robin-orchestrator-${CLIENT_SLUG}
```

**Verifica:**
```bash
sudo systemctl status robin-orchestrator-${CLIENT_SLUG}
# Atteso: enabled (ma non ancora started — WORKSPACE_ID non è ancora configurato)
```

**Recovery se fallisce:** Controllare errori di build: `npm run build --workspace=apps/orchestrator 2>&1 | tail -20`.

---

## FASE 4 — Integrazione Supabase

### 4.1 — Creare workspace nel database

**Azione:** Nella Supabase Dashboard → Table Editor → `workspaces` → Insert row:

```json
{
  "name": "${CLIENT_NAME}",
  "slug": "${CLIENT_SLUG}"
}
```

Oppure via SQL Editor:
```sql
INSERT INTO workspaces (name, slug)
VALUES ('${CLIENT_NAME}', '${CLIENT_SLUG}')
RETURNING id;
-- Salvare l'ID restituito: questo è il WORKSPACE_ID
```

**Output atteso:** UUID del workspace creato (es. `a1b2c3d4-...`).

**Azione:** Aggiornare il `.env` con il `WORKSPACE_ID`:
```bash
sed -i "s/WORKSPACE_ID=.*/WORKSPACE_ID=${WORKSPACE_UUID}/" \
  /home/robin/robin-platform/apps/orchestrator/.env
```

---

### 4.2 — Creare account Clerk per il cliente

**Azione:** Seguire la procedura di invito Clerk per il cliente:
1. Clerk Dashboard → Users → Invite User
2. Email: `${CLIENT_EMAIL}`
3. Annotare il `user_id` Clerk (es. `user_xxx`) dopo che il cliente accetta l'invito

**Azione:** Aggiungere l'utente Clerk al workspace:
```sql
INSERT INTO workspace_members (workspace_id, user_id, role)
VALUES ('${WORKSPACE_UUID}', '${CLERK_USER_ID}', 'owner');
```

---

### 4.3 — Creare record agente

**Azione:**
```sql
INSERT INTO agents (workspace_id, name, type)
VALUES ('${WORKSPACE_UUID}', 'Robin Agent', 'claude')
RETURNING id;
-- Salvare l'AGENT_ID
```

**Azione:** Aggiungere `AGENT_ID` al `.env`:
```bash
echo "AGENT_ID=${AGENT_UUID}" >> /home/robin/robin-platform/apps/orchestrator/.env
```

---

### 4.4 — Avviare e verificare servizio

**Azione:**
```bash
sudo systemctl start robin-orchestrator-${CLIENT_SLUG}
sudo systemctl status robin-orchestrator-${CLIENT_SLUG}
# Atteso: active (running)

# Verificare log di avvio
journalctl -u robin-orchestrator-${CLIENT_SLUG} -n 50 --no-pager
# Atteso: "Worker started", "Connected to Redis", nessun errore
```

**Recovery se fallisce:** `journalctl -u robin-orchestrator-${CLIENT_SLUG} -f` per log real-time. Errori comuni: `WORKSPACE_ID` mancante, Redis non raggiungibile, `ANTHROPIC_API_KEY` non valida.

---

## FASE 5 — Verifica e Go-Live

### 5.1 — Test end-to-end con task fittizio

**Azione:** Dalla UI Robin.dev (o via API), creare un task di test sul workspace del cliente:
```
Titolo: "Test di provisioning — eliminare dopo verifica"
Tipo: chore
Priorità: low
Descrizione: "Aggiungi un commento al README con la data di oggi. Questo è un task di verifica del provisioning."
```

**Verifica:**
```bash
# Monitorare log orchestratore
journalctl -u robin-orchestrator-${CLIENT_SLUG} -f
# Atteso: task picked up, TASK.md written, Claude spawned, events emitted
```

**Verifica nella UI:** Il task deve transitare `pending → queued → in_progress → completed`.

**Recovery se fallisce:** Verificare che la SSH key GitHub abbia permessi write. Verificare che `CLAUDE_BIN` sia nel PATH del service (`which claude` come utente robin).

---

### 5.2 — Verifica isolamento RLS

**Azione:** Eseguire TEST-01 e TEST-05 da `docs/security/rls-tests.md` per il workspace appena creato.

**Verifica:** Nessuna cross-workspace data leakage.

---

### 5.3 — Documentare provisioning completato

**Azione:** Creare record nella tabella interna di Robin.dev (o documento):
```
Cliente: ${CLIENT_NAME}
Data provisioning: $(date)
VPS IP: ${VPS_IP}
Workspace ID: ${WORKSPACE_UUID}
Agent ID: ${AGENT_UUID}
Clerk User ID: ${CLERK_USER_ID}
SSH Key fingerprint: $(ssh-keygen -lf /home/robin/.ssh/id_ed25519_${CLIENT_SLUG}.pub)
Task di test: [ID task creato in 5.1] — eliminare
```

---

## Punti di Fallimento Noti

| Fase | Problema | Sintomo | Recovery |
|------|----------|---------|----------|
| 1.1 | VPS bloccata in Initializing | Console Hetzner: status ≠ Running | Delete + ricrea VPS |
| 2.4 | Claude CLI non installabile | `npm ERR!` permission denied | `npm config set prefix ~/.local && npm install -g ...` |
| 3.2 | Deploy key rifiutata da GitHub | `Permission denied (publickey)` | Verificare write access sulla deploy key |
| 3.3 | `.env` con permessi sbagliati | Variabili non caricate | `chmod 600 .env` |
| 3.5 | Build orchestratore fallisce | TypeScript errors | `npm run typecheck --workspace=apps/orchestrator` |
| 4.1 | workspace slug duplicato | `unique constraint` SQL error | Scegliere slug diverso |
| 5.1 | Task non processato | Log: nessuna attività | Verificare REDIS_URL e connessione BullMQ |

---

## Riferimenti

- `docs/adr/ADR-09-isolation-model.md` — decisione architetturale
- `docs/security/rls-tests.md` — test suite sicurezza
- `docs/templates/CLAUDE.md` — template CLAUDE.md per il repo cliente
- `apps/orchestrator/src/` — codice orchestratore
