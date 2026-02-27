# Runbook — Orchestratore Non Risponde

**Sprint:** 5 FASE B — STORY-05.16
**Versione:** 1.0
**Severità tipica:** P1–P2 (blocca tutte le task del workspace)

---

## Sintomi

- Task create dall'UI rimangono in stato `queued` o `backlog` per >5 minuti
- Agente mostra status `offline` nella pagina `/agents`
- Nessun evento `agent.phase.started` nella timeline delle task recenti

---

## Diagnosi — Ordine di Controllo

Eseguire i check in ordine. Fermarsi al primo che identifica il problema.

### Step 1 — Stato del servizio

```bash
ssh robin@<VPS_IP>
systemctl status robin-orchestrator-<CLIENT_SLUG>
```

**Output atteso:** `active (running)`

**Se `inactive` o `failed`:** andare a [Fix A — Riavvio servizio](#fix-a)

**Se `activating`:** aspettare 30s e ripetere

---

### Step 2 — Log recenti

```bash
journalctl -u robin-orchestrator-<CLIENT_SLUG> -n 50 --no-pager
```

Cercare:
- `Fatal startup error` → problema di configurazione (.env)
- `Redis connection refused` → andare a [Fix B — Redis down](#fix-b)
- `ANTHROPIC_API_KEY` errors → andare a [Fix C — API key](#fix-c)
- `WORKSPACE_ID` / `AGENT_ID` errors → andare a [Fix D — Env vars](#fix-d)
- `disk quota exceeded` / `ENOSPC` → andare a [Fix E — Disco pieno](#fix-e)

---

### Step 3 — Redis

```bash
redis-cli ping
```

**Output atteso:** `PONG`

**Se timeout o connection refused:** andare a [Fix B](#fix-b)

---

### Step 4 — Connettività Supabase

```bash
curl -s --max-time 5 https://ccgodxlviculeqsnlgse.supabase.co/rest/v1/ \
  -H "apikey: <ANON_KEY>" | head -c 100
```

**Output atteso:** risposta JSON

**Se timeout:** problema di rete. Verificare `curl -I https://google.com`.

---

### Step 5 — Spazio disco

```bash
df -h
```

**Output atteso:** utilizzo `/` < 90%

**Se >90%:** andare a [Fix E](#fix-e)

---

## Fix

### Fix A — Riavvio servizio {#fix-a}

```bash
# Riavviare
sudo systemctl restart robin-orchestrator-<CLIENT_SLUG>

# Verificare dopo 10s
sleep 10 && systemctl status robin-orchestrator-<CLIENT_SLUG>

# Controllare log per errori di avvio
journalctl -u robin-orchestrator-<CLIENT_SLUG> -n 20 --no-pager
```

**Post-fix check:** attendere 2 minuti e verificare che l'agente torni online
nella pagina `/agents` e che le task vengano processate.

---

### Fix B — Redis down {#fix-b}

```bash
# Verificare stato
systemctl status redis-server

# Riavviare
sudo systemctl restart redis-server
redis-cli ping

# Se non parte, controllare log
journalctl -u redis-server -n 20 --no-pager
```

**Causa comune:** Redis non si avvia perché la porta 6379 è occupata.
```bash
sudo lsof -i :6379
# Se un processo stale occupa la porta: sudo kill -9 <PID>
sudo systemctl start redis-server
```

---

### Fix C — API key non valida {#fix-c}

```bash
# Verificare che la chiave sia presente
grep ANTHROPIC_API_KEY /home/robin/robin-platform/apps/orchestrator/.env

# Testare la chiave
curl -s https://api.anthropic.com/v1/models \
  -H "x-api-key: <KEY>" | head -c 100
```

Se la chiave è scaduta o non valida, chiedere al cliente una nuova chiave
e aggiornare il .env:
```bash
nano /home/robin/robin-platform/apps/orchestrator/.env
# Aggiornare ANTHROPIC_API_KEY=...
sudo systemctl restart robin-orchestrator-<CLIENT_SLUG>
```

---

### Fix D — Variabili d'ambiente mancanti {#fix-d}

```bash
cat /home/robin/robin-platform/apps/orchestrator/.env | grep -v "KEY\|SECRET"
```

Verificare che `WORKSPACE_ID` e `AGENT_ID` siano valorizzati.
Se mancanti, recuperarli da Supabase:

```sql
-- In Supabase SQL Editor
SELECT id FROM workspaces WHERE slug = '<CLIENT_SLUG>';
SELECT id FROM agents WHERE workspace_id = '<WORKSPACE_UUID>';
```

Aggiornare `.env` e riavviare il servizio.

---

### Fix E — Disco pieno {#fix-e}

```bash
# Trovare i file più grandi
du -sh /home/robin/* 2>/dev/null | sort -rh | head -10

# Pulire log vecchi
sudo journalctl --vacuum-time=7d

# Pulire npm cache
npm cache clean --force

# Pulire git repository
cd /home/robin/repos/<CLIENT_SLUG>
git gc --prune=now
```

Se il disco è ancora pieno, valutare il resize del VPS su Hetzner Cloud.

---

## Template comunicazione al cliente

### Incidente < 30 min

```
Oggetto: Robin.dev — Breve interruzione risolta

Ciao [nome cliente],
c'è stata una breve interruzione del servizio Robin.dev (< 30 min).
Il servizio è ora tornato operativo.

Le task in coda verranno processate automaticamente.
Non è necessaria alcuna azione da parte tua.

Se hai domande, rispondimi a questo messaggio.
```

### Incidente 30 min — 2 ore

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

### Incidente > 2 ore

```
Oggetto: Robin.dev — Interruzione prolungata [AGGIORNAMENTO]

Ciao [nome cliente],
il ripristino richiede più tempo del previsto.

Causa identificata: [CAUSA]
Azione in corso: [AZIONE]
Nuova stima: [ORA]

Ti chiedo scusa per il disagio. Aggiornerò ogni ora
fino al ripristino completo.
```

---

## Post-mortem template

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

## Riferimenti

- `docs/runbook/provisioning.md` — configurazione iniziale
- `docs/adr/ADR-09-isolation-model.md` — architettura VPS
- Hetzner Console: https://console.hetzner.cloud
