# Runbook — Robin.dev

**Last updated:** 2026-03-05

---

## 1. Orchestratore Non Risponde

**Severità tipica:** P1–P2 (blocca tutte le task del workspace)

### Sintomi

- Task create dall'UI rimangono in stato `queued` o `backlog` per >5 minuti
- Agente mostra status `offline` nella pagina `/agents`
- Nessun evento `agent.phase.started` nella timeline delle task recenti

### Diagnosi — Ordine di Controllo

Eseguire i check in ordine. Fermarsi al primo che identifica il problema.

**Step 1 — Stato del servizio**

```bash
ssh robin@<VPS_IP>
systemctl status robin-orchestrator-<CLIENT_SLUG>
```

Output atteso: `active (running)`

Se `inactive` o `failed`: → Fix A. Se `activating`: aspettare 30s e ripetere.

**Step 2 — Log recenti**

```bash
journalctl -u robin-orchestrator-<CLIENT_SLUG> -n 50 --no-pager
```

Cercare:
- `Fatal startup error` → problema di configurazione (.env)
- `Redis connection refused` → Fix B
- `ANTHROPIC_API_KEY` errors → Fix C
- `WORKSPACE_ID` / `AGENT_ID` errors → Fix D
- `disk quota exceeded` / `ENOSPC` → Fix E

**Step 3 — Redis**

```bash
redis-cli ping
# Output atteso: PONG
```

Se timeout o connection refused: → Fix B.

**Step 4 — Connettività Supabase**

```bash
curl -s --max-time 5 https://ccgodxlviculeqsnlgse.supabase.co/rest/v1/ \
  -H "apikey: <ANON_KEY>" | head -c 100
# Output atteso: risposta JSON
```

Se timeout: problema di rete. Verificare `curl -I https://google.com`.

**Step 5 — Spazio disco**

```bash
df -h
# Output atteso: utilizzo `/` < 90%
```

### Fix A — Riavvio servizio

```bash
sudo systemctl restart robin-orchestrator-<CLIENT_SLUG>
sleep 10 && systemctl status robin-orchestrator-<CLIENT_SLUG>
journalctl -u robin-orchestrator-<CLIENT_SLUG> -n 20 --no-pager
```

Post-fix: attendere 2 minuti e verificare agente online in `/agents`.

### Fix B — Redis down

```bash
systemctl status redis-server
sudo systemctl restart redis-server
redis-cli ping

# Se non parte: porta 6379 occupata?
sudo lsof -i :6379
# sudo kill -9 <PID> se necessario
sudo systemctl start redis-server
```

### Fix C — API key non valida

```bash
grep ANTHROPIC_API_KEY /home/robin/robin-platform/apps/orchestrator/.env
curl -s https://api.anthropic.com/v1/models -H "x-api-key: <KEY>" | head -c 100
```

Se scaduta, chiedere al cliente una nuova chiave:
```bash
nano /home/robin/robin-platform/apps/orchestrator/.env
# Aggiornare ANTHROPIC_API_KEY=...
sudo systemctl restart robin-orchestrator-<CLIENT_SLUG>
```

### Fix D — Variabili d'ambiente mancanti

```bash
cat /home/robin/robin-platform/apps/orchestrator/.env | grep -v "KEY\|SECRET"
```

Se `WORKSPACE_ID` o `AGENT_ID` mancanti, recuperarli da Supabase SQL Editor:

```sql
SELECT id FROM workspaces WHERE slug = '<CLIENT_SLUG>';
SELECT id FROM agents WHERE workspace_id = '<WORKSPACE_UUID>';
```

### Fix E — Disco pieno

```bash
du -sh /home/robin/* 2>/dev/null | sort -rh | head -10
sudo journalctl --vacuum-time=7d
npm cache clean --force
cd /home/robin/repos/<CLIENT_SLUG> && git gc --prune=now
```

Se il disco è ancora pieno: valutare resize VPS su Hetzner Cloud.

### Template comunicazione al cliente

**Incidente < 30 min:**
```
Oggetto: Robin.dev — Breve interruzione risolta

Ciao [nome cliente],
c'è stata una breve interruzione del servizio Robin.dev (< 30 min).
Il servizio è ora tornato operativo.
Le task in coda verranno processate automaticamente.
Non è necessaria alcuna azione da parte tua.
```

**Incidente 30 min — 2 ore:**
```
Oggetto: Robin.dev — Interruzione in corso

Ciao [nome cliente],
stiamo riscontrando un'interruzione del servizio Robin.dev iniziata
intorno alle [ORA].
Le task create durante il periodo di interruzione sono in stato
di attesa e verranno elaborate automaticamente al ripristino.
Stima ripristino: [ORA STIMATA]
Ti aggiornerò appena il servizio è tornato operativo.
```

**Incidente > 2 ore:**
```
Oggetto: Robin.dev — Interruzione prolungata [AGGIORNAMENTO]

Ciao [nome cliente],
il ripristino richiede più tempo del previsto.
Causa identificata: [CAUSA]
Azione in corso: [AZIONE]
Nuova stima: [ORA]
Ti chiedo scusa per il disagio. Aggiornerò ogni ora fino al ripristino completo.
```

### Post-mortem template

```markdown
# Post-mortem — [DATA]

**Durata:** [HH:MM] — [HH:MM] (X minuti)
**Impatto:** workspace <SLUG> — X task bloccate

## Timeline
- HH:MM — Primo segnale (come rilevato)
- HH:MM — Diagnosi completata
- HH:MM — Fix applicato
- HH:MM — Servizio ripristinato

## Causa radice
[Descrizione tecnica]

## Fix applicato
[Azioni eseguite]

## Prevenzione futura
[Cosa fare per evitare che si ripeta]
```

---

## 2. Task Bloccata Senza Risposta

### Definizione "task bloccata"

- Status `in_progress` o `review_pending` da >4 ore senza aggiornamenti
- Evento `agent.blocked` emesso e il cliente non ha risposto entro 24h
- Status `queued` da >30 minuti

### SLA Policy

| Scenario | Azione | Responsabile |
|----------|--------|--------------|
| Task `in_progress` > 4h senza eventi | Notifica cliente | Operator |
| Task `agent.blocked` > 24h senza risposta | Escalation + notifica | Operator |
| Task `queued` > 30 min | Verifica orchestratore | Operator |
| Task bloccata nel weekend | Lunedì mattina entro le 9:00 | Operator |
| Task `in_progress` > 48h | Intervento manuale | Operator |

### Diagnosi

**Identificare la task bloccata:**

```sql
SELECT id, title, status, updated_at,
       extract(epoch from (now() - updated_at))/3600 AS hours_stuck
FROM tasks
WHERE status IN ('in_progress', 'queued')
  AND updated_at < now() - interval '4 hours'
ORDER BY hours_stuck DESC;
```

**Verificare l'ultimo evento:**

```sql
SELECT event_type, actor_type, created_at, payload
FROM task_events
WHERE task_id = '<TASK_ID>'
ORDER BY created_at DESC LIMIT 10;
```

Interpretazione:
- Ultimo evento è `agent.blocked` → cliente deve rispondere
- Ultimo evento è `agent.phase.started` ore fa → agente probabilmente crashato
- Nessun evento recente → orchestratore non ha processato la task

**Verificare log orchestratore:**

```bash
ssh robin@<VPS_IP>
journalctl -u robin-orchestrator-<CLIENT_SLUG> -n 100 --no-pager | grep <TASK_ID>
```

### Procedura di sblocco manuale

**Caso A: task bloccata su `agent.blocked` (cliente deve rispondere)**

Notificare il cliente via email con la domanda dell'agente (da `agent.blocked.payload.question`). Il cliente risponde via UI (Human Comment).

**Caso B: task bloccata in `in_progress` senza progressi (agente crashato)**

```sql
-- Via service role key (bypassa RLS)
UPDATE tasks
SET status = 'queued', updated_at = now()
WHERE id = '<TASK_ID>' AND status = 'in_progress';

INSERT INTO task_events (task_id, workspace_id, event_type, actor_type, actor_id, payload)
SELECT id, workspace_id, 'task.state.changed', 'human', 'operator-manual',
       '{"from": "in_progress", "to": "queued", "note": "Manual reset — agent crash"}'::jsonb
FROM tasks WHERE id = '<TASK_ID>';
```

Dopo il reset, la task verrà ripresa automaticamente.

**Caso C: task `queued` non processata (BullMQ non funzionante)**

```bash
# SSH tunnel per Bull Board
ssh -L 3001:localhost:3001 robin@<VPS_IP>
# Browser: http://localhost:3001/admin/queues

# Verifica coda manuale
redis-cli LRANGE bull:task-queue:wait 0 -1
```

Se il job non è in coda, reinserire manualmente:

```bash
node -e "
const { Queue } = require('bullmq');
const q = new Queue('robin-tasks', { connection: { host: '127.0.0.1', port: 6379 } });
q.add('<TASK_TITLE>', { taskId: '<UUID>', workspaceId: '<UUID>', agentId: '<UUID>' });
"
```

**Caso D: task da cancellare definitivamente**

```sql
UPDATE tasks SET status = 'cancelled', updated_at = now()
WHERE id = '<TASK_ID>';

INSERT INTO task_events (task_id, workspace_id, event_type, actor_type, actor_id, payload)
SELECT id, workspace_id, 'task.state.changed', 'human', 'operator-manual',
       '{"from": "<CURRENT_STATUS>", "to": "cancelled", "note": "Cancelled by operator"}'::jsonb
FROM tasks WHERE id = '<TASK_ID>';
```

### Weekend policy

- Task bloccate che entrano nel weekend vengono gestite il lunedì mattina
- Il cliente viene notificato il venerdì con ETA lunedì
- Non eseguire sblocchi manuali nel weekend a meno di task urgente confermata

### Comunicazione al cliente (agent.blocked)

```
Oggetto: Robin.dev — Il tuo agente ha una domanda

Ciao [nome cliente],

Il tuo agente Robin.dev sta lavorando alla task "[TITOLO TASK]" e ha bisogno
di una risposta per continuare.

Domanda dell'agente:
> [TESTO DI agent.blocked.payload.question]

Rispondi direttamente nel gestionale Robin.dev:
→ [LINK DIRETTO ALLA TASK]

Appena rispondi, l'agente riprende il lavoro automaticamente.
```

---

## 3. Aggiornamento Orchestratore su VPS Clienti

**Downtime atteso:** < 30 secondi per VPS (graceful shutdown)

### Quando aggiornare

- Nuova release di `apps/orchestrator`
- Aggiornamento dipendenze (sicurezza)
- Cambiamento a `packages/shared-types` che impatta il worker
- Aggiornamento Claude Code CLI

**Non aggiornare** durante:
- Task `in_progress` su quel workspace
- Fine settimana (a meno di hotfix urgente)
- Orari di punta del cliente

### Aggiornamento singolo VPS

**1. Verificare nessuna task in esecuzione**

```bash
ssh robin@<VPS_IP>
journalctl -u robin-orchestrator-<CLIENT_SLUG> -n 5 --no-pager
# Verificare: nessun "Processing job" recente
```

Oppure via SQL: `SELECT count(*) FROM tasks WHERE workspace_id = '<ID>' AND status = 'in_progress';` → atteso: 0

**2. Pull e build**

```bash
cd /home/robin/robin-platform
git pull origin main
npm install --workspace=packages/shared-types --silent
npm install --workspace=apps/orchestrator --silent
npm run build --workspace=apps/orchestrator
```

Se il build fallisce: non procedere. Correggere prima.

**3. Riavvio graceful**

```bash
sudo systemctl restart robin-orchestrator-<CLIENT_SLUG>
sleep 10
systemctl status robin-orchestrator-<CLIENT_SLUG>
journalctl -u robin-orchestrator-<CLIENT_SLUG> -n 20 --no-pager
# Output atteso: active (running) + "Robin.dev Orchestrator ready"
```

**4. Verificare heartbeat**

Attendere 30-60 secondi → agente torna online in `/agents`.

**5. Smoke test (opzionale, raccomandato)**

```bash
node scripts/smoke-test.ts --workspace-id <WORKSPACE_ID>
```

### Aggiornamento batch (tutti i VPS)

Prerequisiti: file `scripts/clients.env` (non committato):

```bash
CLIENTS=(
  "acme:1.2.3.4"
  "beta-corp:5.6.7.8"
  "gamma:9.10.11.12"
)
```

Script di batch:

```bash
#!/usr/bin/env bash
source scripts/clients.env
FAILED=()

for entry in "${CLIENTS[@]}"; do
  SLUG="${entry%%:*}"
  VPS_IP="${entry##*:}"
  echo "━━━ Updating ${SLUG} (${VPS_IP}) ━━━"

  IN_PROGRESS=$(ssh -o ConnectTimeout=5 robin@${VPS_IP} \
    "journalctl -u robin-orchestrator-${SLUG} --since '5 minutes ago' --no-pager 2>/dev/null | grep -c 'Processing job'" 2>/dev/null || echo "0")

  if [[ "$IN_PROGRESS" -gt 0 ]]; then
    echo "  SKIP: job in progress on ${SLUG}"
    continue
  fi

  ssh -o ConnectTimeout=10 robin@${VPS_IP} "
    cd /home/robin/robin-platform
    git pull origin main --quiet
    npm install --workspace=packages/shared-types --silent
    npm install --workspace=apps/orchestrator --silent
    npm run build --workspace=apps/orchestrator --silent 2>&1 | tail -3
    sudo systemctl restart robin-orchestrator-${SLUG}
    sleep 5
    systemctl is-active robin-orchestrator-${SLUG}
  " 2>/dev/null && echo "  OK: ${SLUG} updated" || {
    echo "  FAIL: ${SLUG} update failed"
    FAILED+=("$SLUG")
  }
  sleep 2
done

echo ""
if [[ ${#FAILED[@]} -gt 0 ]]; then
  echo "FAILED: ${FAILED[*]}"
else
  echo "All VPS updated successfully"
fi
```

### Rollback

```bash
ssh robin@<VPS_IP>
cd /home/robin/robin-platform
PREV_COMMIT=$(git rev-parse HEAD)  # Salvare PRIMA del pull
echo "Previous commit: $PREV_COMMIT"

git log --oneline -5
git checkout <PREV_COMMIT_HASH>
npm run build --workspace=apps/orchestrator
sudo systemctl restart robin-orchestrator-<CLIENT_SLUG>
```

### Aggiornamento Claude Code CLI

```bash
ssh robin@<VPS_IP>
npm install -g @anthropic-ai/claude-code
claude --version
# L'heartbeat aggiornerà claude_code_version in /agents entro 30s
```

### Cosa succede ai job in-flight durante il restart

1. systemd invia SIGTERM al processo Node.js
2. Il processo chiama `worker.close()` (graceful shutdown)
3. Smette di accettare nuovi job, aspetta che quelli attivi finiscano
4. Timeout: se un job attivo non finisce entro 30s, viene terminato forzatamente
5. I job terminati forzatamente rientrano in WAITING in Redis (non persi)
6. Il nuovo processo li riprende

**Risultato:** 0 job persi. Al massimo un job può essere ritentato.

### Checklist post-aggiornamento

- [ ] Servizio in stato `active (running)`
- [ ] Log di avvio senza errori
- [ ] Agente online nella pagina `/agents` entro 60s
- [ ] Versioni aggiornate visibili nella card agente
- [ ] Smoke test PASS (per aggiornamenti major)

---

## 4. Aggiornamento CLAUDE.md Cliente

### Quando aggiornare

Aggiornare il CLAUDE.md quando:

- **Stack cambia:** nuovo framework, cambio package manager, introduce TypeScript
- **Convenzioni cambiano:** nuovo pattern per API routes, nuove regole di naming
- **Aree sensibili espanse:** nuove directory da non toccare (es. `payments/`, `infra/`)
- **Comandi cambiano:** `npm` → `pnpm`, test runner aggiornato, lint config modificata
- **Branch policy cambia:** rename `main` → `master`, introduzione di `develop`
- **Feedback post-task:** l'agente ha fatto errori ricorrenti che il CLAUDE.md avrebbe evitato

**Non aggiornare** per preferenze estetiche senza impatto sull'agente.

### Procedura di aggiornamento

**1. Identificare la modifica necessaria**

```bash
cat /home/robin/repos/<CLIENT_SLUG>/CLAUDE.md
```

Sezioni del CLAUDE.md:
- `==INVARIANT==` — **non modificare mai** (protocollo ADWP, regole sicurezza)
- `==WORKSPACE==` — sezione modificabile (comandi, path, branch policy)
- `==STACK==` — sezione modificabile (pattern specifici dello stack)

**2. Fare la modifica su branch dedicato**

```bash
cd /home/robin/repos/<CLIENT_SLUG>
git checkout main && git pull origin main
git checkout -b chore/update-claude-md-$(date +%Y%m%d)
nano CLAUDE.md
```

**3. Testare la modifica**

- [ ] I comandi aggiornati funzionano nel contesto del repository
- [ ] I path sensibili aggiornati esistono nella struttura del progetto
- [ ] La branch policy è coerente con i branch esistenti su GitHub

**4. Commit con formato standard**

```bash
git add CLAUDE.md
git commit -m "chore(claude): update <cosa è cambiato>"
# Esempi:
# chore(claude): update test command to use vitest
# chore(claude): add src/payments/ to sensitive areas
```

**5. Push e PR**

```bash
git push origin chore/update-claude-md-$(date +%Y%m%d)
# Aprire PR su GitHub, chiedere review al cliente
```

**6. Verificare con test task dopo il merge**

Creare una task di verifica:
```
Titolo: "Verifica CLAUDE.md aggiornato"
Tipo: chore
Descrizione: "Leggi il CLAUDE.md aggiornato e conferma che tutte le
sezioni siano corrette. Rispondi con un breve summary delle informazioni
principali che hai letto (stack, comandi principali, branch policy)."
```

### Rollback CLAUDE.md

```bash
cd /home/robin/repos/<CLIENT_SLUG>
git log -- CLAUDE.md --oneline
git checkout <commit_hash> -- CLAUDE.md
git commit -m "chore(claude): revert to working version"
git push
```

### Checklist pre-aggiornamento

- [ ] Nessuna task in esecuzione sul workspace del cliente
- [ ] La modifica è in `==WORKSPACE==` o `==STACK==` (mai `==INVARIANT==`)
- [ ] Il commit segue la convention `chore(claude): ...`
- [ ] La PR è stata reviewata dal cliente
- [ ] Test task eseguita dopo il merge con successo

---

## 5. Provisioning Manuale (Emergency Fallback)

> **ATTENZIONE:** Il provisioning normale avviene automaticamente via dashboard.
> Usare questa procedura solo in caso di fallimento del provisioning automatico o per debug.
> Flusso normale: `docs/flows/agent-provisioning.md`

**Durata stimata:** < 2 ore
**Prerequisiti:** Accesso Hetzner Cloud, Supabase, Clerk Dashboard, GitHub org cliente

### Variabili di riferimento

```bash
CLIENT_SLUG="acme"
CLIENT_NAME="Acme Corp"
CLIENT_EMAIL="tech@acme.com"
VPS_IP=""           # da compilare dopo FASE 1.3
GITHUB_ORG="acme-org"
GITHUB_REPO="acme-product"
ANTHROPIC_API_KEY=""
CLERK_USER_ID=""
```

### FASE 1 — Infrastruttura VPS

**1.1 — Creare VPS su Hetzner Cloud**

```
Location:    Falkenstein (FSN1)
Image:       Ubuntu 24.04 LTS
Type:        CX22 (2 vCPU, 4 GB RAM, 40 GB NVMe)
SSH Keys:    Chiave SSH Robin.dev admin
Name:        robin-${CLIENT_SLUG}
Labels:      client=${CLIENT_SLUG}, role=orchestrator
```

Verifica: `ping -c 3 $VPS_IP` — 0 pacchetti persi.

**1.2 — Primo accesso SSH:** `ssh root@$VPS_IP`

**1.3 — Creare utente non-root**

```bash
useradd -m -s /bin/bash robin
usermod -aG sudo robin
mkdir -p /home/robin/.ssh
cp /root/.ssh/authorized_keys /home/robin/.ssh/
chown -R robin:robin /home/robin/.ssh
chmod 700 /home/robin/.ssh && chmod 600 /home/robin/.ssh/authorized_keys
```

### FASE 2 — Sistema e Dipendenze

**2.1 — Node.js 22 LTS**
```bash
curl -fsSL https://deb.nodesource.com/setup_22.x | sudo -E bash -
sudo apt-get install -y nodejs
node --version  # atteso: v22.x.x
```

**2.2 — Redis locale**
```bash
sudo apt-get install -y redis-server
sudo sed -i 's/^bind .*/bind 127.0.0.1/' /etc/redis/redis.conf
sudo systemctl enable redis-server && sudo systemctl start redis-server
redis-cli ping  # atteso: PONG
```

**2.3 — Git e tool:** `sudo apt-get install -y git curl wget unzip build-essential`

**2.4 — Claude Code CLI:** `npm install -g @anthropic-ai/claude-code`

### FASE 3 — Configurazione Orchestratore

**3.1 — Clonare il repository**
```bash
cd /home/robin
git clone https://github.com/CarloKva/Robin.dev.git robin-platform
cd robin-platform
npm install --workspace=apps/orchestrator
npm install --workspace=packages/shared-types
```

**3.2 — Generare SSH key per GitHub cliente**
```bash
ssh-keygen -t ed25519 -C "robin-agent-${CLIENT_SLUG}@robin.dev" \
  -f /home/robin/.ssh/id_ed25519_${CLIENT_SLUG} -N ""
cat /home/robin/.ssh/id_ed25519_${CLIENT_SLUG}.pub
```

Aggiungere la chiave pubblica come Deploy Key con write access in:
`GitHub → ${GITHUB_ORG}/${GITHUB_REPO} → Settings → Deploy keys`

**3.3 — Configurare variabili d'ambiente**
```bash
cat > /home/robin/robin-platform/apps/orchestrator/.env << EOF
NODE_ENV=production
SUPABASE_URL=https://ccgodxlviculeqsnlgse.supabase.co
SUPABASE_SERVICE_ROLE_KEY=<service_role_key>
REDIS_URL=redis://127.0.0.1:6379
ANTHROPIC_API_KEY=${ANTHROPIC_API_KEY}
REPOSITORY_PATH=/home/robin/repos/${CLIENT_SLUG}
WORKSPACE_ID=<da compilare in FASE 4>
EOF
chmod 600 /home/robin/robin-platform/apps/orchestrator/.env
```

**3.4 — Clonare il repository cliente**
```bash
mkdir -p /home/robin/repos
GIT_SSH_COMMAND="ssh -i /home/robin/.ssh/id_ed25519_${CLIENT_SLUG}" \
  git clone git@github.com:${GITHUB_ORG}/${GITHUB_REPO}.git /home/robin/repos/${CLIENT_SLUG}
```

**3.5 — Configurare systemd service**
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

cd /home/robin/robin-platform
npm run build --workspace=apps/orchestrator
sudo systemctl daemon-reload
sudo systemctl enable robin-orchestrator-${CLIENT_SLUG}
```

### FASE 4 — Integrazione Supabase

**4.1 — Creare workspace nel database**
```sql
INSERT INTO workspaces (name, slug) VALUES ('${CLIENT_NAME}', '${CLIENT_SLUG}') RETURNING id;
-- Salvare il WORKSPACE_ID restituito
```

Aggiornare `.env`: `sed -i "s/WORKSPACE_ID=.*/WORKSPACE_ID=${WORKSPACE_UUID}/" .env`

**4.2 — Creare account Clerk per il cliente**

Clerk Dashboard → Users → Invite User → Email: `${CLIENT_EMAIL}`

```sql
INSERT INTO workspace_members (workspace_id, user_id, role)
VALUES ('${WORKSPACE_UUID}', '${CLERK_USER_ID}', 'owner');
```

**4.3 — Creare record agente**
```sql
INSERT INTO agents (workspace_id, name, type)
VALUES ('${WORKSPACE_UUID}', 'Robin Agent', 'claude') RETURNING id;
```

```bash
echo "AGENT_ID=${AGENT_UUID}" >> /home/robin/robin-platform/apps/orchestrator/.env
```

**4.4 — Avviare e verificare servizio**
```bash
sudo systemctl start robin-orchestrator-${CLIENT_SLUG}
journalctl -u robin-orchestrator-${CLIENT_SLUG} -n 50 --no-pager
# Atteso: "Worker started", "Connected to Redis", nessun errore
```

### FASE 5 — Verifica e Go-Live

**5.1 — Test end-to-end**

Creare task di test:
```
Titolo: "Test di provisioning — eliminare dopo verifica"
Tipo: chore, Priorità: low
Descrizione: "Aggiungi un commento al README con la data di oggi."
```

Verifica: task deve transitare `pending → queued → in_progress → completed`.

**5.2 — Verifica isolamento RLS**

Eseguire TEST-01 e TEST-05 da `docs/security.md`.

**5.3 — Documentare provisioning**
```
Cliente: ${CLIENT_NAME}
VPS IP: ${VPS_IP}
Workspace ID: ${WORKSPACE_UUID}
Agent ID: ${AGENT_UUID}
Clerk User ID: ${CLERK_USER_ID}
SSH Key fingerprint: $(ssh-keygen -lf /home/robin/.ssh/id_ed25519_${CLIENT_SLUG}.pub)
```

### Punti di fallimento noti

| Fase | Problema | Sintomo | Recovery |
|------|----------|---------|----------|
| 1.1 | VPS bloccata in Initializing | Console Hetzner: status ≠ Running | Delete + ricrea VPS |
| 2.4 | Claude CLI non installabile | `npm ERR!` permission denied | `npm config set prefix ~/.local` |
| 3.2 | Deploy key rifiutata | `Permission denied (publickey)` | Verificare write access |
| 3.3 | `.env` con permessi sbagliati | Variabili non caricate | `chmod 600 .env` |
| 3.5 | Build fallisce | TypeScript errors | `npm run typecheck --workspace=apps/orchestrator` |
| 4.1 | workspace slug duplicato | `unique constraint` | Scegliere slug diverso |
| 5.1 | Task non processata | Log: nessuna attività | Verificare REDIS_URL e BullMQ |
