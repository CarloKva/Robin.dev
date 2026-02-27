# Runbook — Task Bloccata Senza Risposta

**Sprint:** 5 FASE B — STORY-05.17
**Versione:** 1.0

---

## Definizione "task bloccata"

Una task è considerata bloccata quando:
- Status `in_progress` o `review_pending` da >4 ore senza aggiornamenti
- L'agente ha emesso evento `agent.blocked` e il cliente non ha risposto entro 24h
- Status `queued` da >30 minuti (agente non la prende in carico)

---

## SLA Policy

| Scenario | Azione | Responsabile |
|----------|--------|--------------|
| Task `in_progress` > 4h senza eventi | Notifica cliente | Operator |
| Task `agent.blocked` > 24h senza risposta | Escalation + notifica | Operator |
| Task `queued` > 30 min | Verifica orchestratore | Operator |
| Task bloccata nel weekend | Lunedì mattina entro le 9:00 | Operator |
| Task `in_progress` > 48h | Intervento manuale per sbloccare | Operator |

---

## Diagnosi

### 1. Identificare la task bloccata

Dalla UI Robin.dev → Tasks → filtrare per status `in_progress` o `review_pending`.

Oppure via SQL:
```sql
-- Task stuck in_progress per > 4 ore
SELECT id, title, status, updated_at,
       extract(epoch from (now() - updated_at))/3600 AS hours_stuck
FROM tasks
WHERE status IN ('in_progress', 'queued')
  AND updated_at < now() - interval '4 hours'
ORDER BY hours_stuck DESC;
```

### 2. Verificare l'ultimo evento

```sql
SELECT event_type, actor_type, created_at, payload
FROM task_events
WHERE task_id = '<TASK_ID>'
ORDER BY created_at DESC
LIMIT 10;
```

Interpretare:
- Ultimo evento è `agent.blocked` → il cliente deve rispondere
- Ultimo evento è `agent.phase.started` ore fa → agente probabilmente crashato
- Nessun evento recente → orchestratore non ha processato la task

### 3. Verificare log orchestratore (se `in_progress`)

```bash
ssh robin@<VPS_IP>
journalctl -u robin-orchestrator-<CLIENT_SLUG> -n 100 --no-pager | grep <TASK_ID>
```

---

## Procedura di sblocco manuale

### Caso A: task bloccata su `agent.blocked` (cliente deve rispondere)

Notificare il cliente via email con la domanda dell'agente (visibile nell'evento
`agent.blocked.payload.question`). Il cliente risponde via UI (Human Comment).

### Caso B: task bloccata in `in_progress` senza progressi (agente crashato)

```sql
-- Via service role key (accesso diretto, bypassa RLS)
-- Resettare task a 'queued' per rielaborazione
UPDATE tasks
SET status = 'queued', updated_at = now()
WHERE id = '<TASK_ID>'
  AND status = 'in_progress';

-- Emettere evento di reset
INSERT INTO task_events (task_id, workspace_id, event_type, actor_type, actor_id, payload)
SELECT id, workspace_id, 'task.state.changed', 'human', 'operator-manual',
       '{"from": "in_progress", "to": "queued", "note": "Manual reset — agent crash"}'::jsonb
FROM tasks WHERE id = '<TASK_ID>';
```

Dopo il reset, la task verrà ripresa automaticamente dalla prossima run del poller.

### Caso C: task `queued` non processata (BullMQ non funzionante)

```bash
# Verificare job in BullMQ via Bull Board
# SSH tunnel: ssh -L 3001:localhost:3001 robin@<VPS_IP>
# Browser: http://localhost:3001/admin/queues

# Oppure manualmente:
ssh robin@<VPS_IP>
redis-cli LRANGE bull:task-queue:wait 0 -1
```

Se il job non è in coda, la task non è stata enqueued. Verificare:
1. `REDIS_URL` nel .env è corretto
2. BullMQ worker è in ascolto sulla stessa queue
3. Il job può essere reinserito manualmente:

```bash
# Dal VPS come robin
node -e "
const { Queue } = require('bullmq');
const q = new Queue('robin-tasks', { connection: { host: '127.0.0.1', port: 6379 } });
q.add('<TASK_TITLE>', { taskId: '<UUID>', workspaceId: '<UUID>', agentId: '<UUID>', ... });
"
```

### Caso D: task da cancellare definitivamente

```sql
-- Solo se il cliente ha confermato di voler annullare la task
UPDATE tasks SET status = 'cancelled', updated_at = now()
WHERE id = '<TASK_ID>';

INSERT INTO task_events (task_id, workspace_id, event_type, actor_type, actor_id, payload)
SELECT id, workspace_id, 'task.state.changed', 'human', 'operator-manual',
       '{"from": "<CURRENT_STATUS>", "to": "cancelled", "note": "Cancelled by operator"}'::jsonb
FROM tasks WHERE id = '<TASK_ID>';
```

---

## Weekend policy

- Task bloccate che entrano nel weekend (venerdì sera) vengono gestite il lunedì mattina
- Il cliente viene notificato il venerdì con ETA lunedì
- Non eseguire sblocchi manuali nel weekend a meno di task urgente confermata dal cliente

---

## Comunicazione al cliente (task agent.blocked)

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

## Riferimenti

- `docs/runbook/incident-orchestrator-down.md` — se la task è stuck a causa dell'orchestratore
- `apps/web/app/api/tasks/[taskId]/events/route.ts` — endpoint per inviare human events
