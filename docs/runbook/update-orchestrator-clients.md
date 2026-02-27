# Runbook — Aggiornamento Orchestratore su VPS Clienti

**Sprint:** 5 FASE B — STORY-05.18
**Versione:** 1.0
**Downtime atteso:** < 30 secondi per VPS (graceful shutdown)

---

## Quando aggiornare

- Nuova release di `apps/orchestrator` con bug fix o feature
- Aggiornamento dipendenze (sicurezza)
- Cambiamento a `packages/shared-types` che impatta il worker
- Aggiornamento Claude Code CLI

**Non aggiornare** durante:
- Task `in_progress` su quel workspace (attendere il completamento)
- Fine settimana (a meno di hotfix urgente)
- Orari di punta del cliente (coordinare via email)

---

## Aggiornamento singolo VPS

### 1. Verificare che nessuna task sia in esecuzione

```bash
ssh robin@<VPS_IP>
journalctl -u robin-orchestrator-<CLIENT_SLUG> -n 5 --no-pager
# Verificare: nessun "Processing job" recente
```

Oppure via Supabase:
```sql
SELECT count(*) FROM tasks
WHERE workspace_id = '<WORKSPACE_ID>' AND status = 'in_progress';
-- Atteso: 0
```

### 2. Pull e build

```bash
ssh robin@<VPS_IP>
cd /home/robin/robin-platform

# Pull aggiornamenti
git pull origin main

# Reinstall dipendenze (se package.json è cambiato)
npm install --workspace=packages/shared-types --silent
npm install --workspace=apps/orchestrator --silent

# Build
npm run build --workspace=apps/orchestrator
```

**Se il build fallisce:** non procedere. Correggere l'errore prima.

### 3. Riavvio graceful

```bash
sudo systemctl restart robin-orchestrator-<CLIENT_SLUG>
sleep 10
systemctl status robin-orchestrator-<CLIENT_SLUG>
journalctl -u robin-orchestrator-<CLIENT_SLUG> -n 20 --no-pager
```

**Output atteso:** `active (running)` + log `Robin.dev Orchestrator ready`

### 4. Verificare heartbeat

Attendere 30-60 secondi, poi controllare che il VPS torni online
nella pagina `/agents` del gestionale.

### 5. Smoke test post-aggiornamento (opzionale, raccomandato)

```bash
# Dal repository Robin.dev (non dal VPS)
node scripts/smoke-test.ts --workspace-id <WORKSPACE_ID>
```

---

## Aggiornamento batch (tutti i VPS)

### Prerequisiti

Avere un file `scripts/clients.env` (non committato) con la lista dei VPS:

```bash
# scripts/clients.env
CLIENTS=(
  "acme:1.2.3.4"
  "beta-corp:5.6.7.8"
  "gamma:9.10.11.12"
)
```

### Script di batch update

```bash
#!/usr/bin/env bash
# Eseguire da locale, richiede SSH access a tutti i VPS

source scripts/clients.env

FAILED=()

for entry in "${CLIENTS[@]}"; do
  SLUG="${entry%%:*}"
  VPS_IP="${entry##*:}"

  echo "━━━ Updating ${SLUG} (${VPS_IP}) ━━━"

  # Verify no job in progress
  IN_PROGRESS=$(ssh -o ConnectTimeout=5 robin@${VPS_IP} \
    "journalctl -u robin-orchestrator-${SLUG} --since '5 minutes ago' --no-pager 2>/dev/null | grep -c 'Processing job'" 2>/dev/null || echo "0")

  if [[ "$IN_PROGRESS" -gt 0 ]]; then
    echo "  SKIP: job in progress on ${SLUG}"
    continue
  fi

  # Pull + build + restart
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

  sleep 2  # Brief pause between restarts
done

echo ""
echo "═══ Batch update complete ═══"
if [[ ${#FAILED[@]} -gt 0 ]]; then
  echo "FAILED: ${FAILED[*]}"
  echo "Investigate manually with: ssh robin@<VPS_IP>"
else
  echo "All VPS updated successfully"
fi
```

---

## Rollback

Se l'aggiornamento causa problemi:

```bash
ssh robin@<VPS_IP>
cd /home/robin/robin-platform

# Trovare il commit precedente
git log --oneline -5

# Tornare al commit precedente
git checkout <PREV_COMMIT_HASH>

# Rebuild
npm run build --workspace=apps/orchestrator

# Riavviare
sudo systemctl restart robin-orchestrator-<CLIENT_SLUG>
```

**Nota:** il commit precedente viene identificato con `git log` prima dell'aggiornamento.
Salvare sempre il commit hash corrente prima del pull:

```bash
PREV_COMMIT=$(git rev-parse HEAD)
echo "Previous commit: $PREV_COMMIT"
```

---

## Aggiornamento Claude Code CLI

```bash
ssh robin@<VPS_IP>
npm install -g @anthropic-ai/claude-code

# Verificare versione
claude --version

# L'heartbeat aggiornerà automaticamente claude_code_version
# nella pagina /agents entro 30 secondi
```

---

## Checklist post-aggiornamento

- [ ] Servizio in stato `active (running)`
- [ ] Log di avvio senza errori
- [ ] Agente online nella pagina `/agents` entro 60s
- [ ] Versioni aggiornate visibili nella card agente
- [ ] Smoke test PASS (per aggiornamenti major)

---

## Riferimenti

- `docs/runbook/incident-orchestrator-down.md` — se l'aggiornamento causa downtime
- `docs/runbook/provisioning.md` — configurazione iniziale VPS
