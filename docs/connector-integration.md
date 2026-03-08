# Robin Dev — KVA Room Connector Integration

Robin Dev è un connettore di prima classe nel portfolio KVA Room. Espone dati e azioni tramite API autenticate che la Room può leggere, indicizzare nel Context Graph, e richiamare via Brook.

---

## Autenticazione

Tutti gli endpoint del connettore (eccetto `/api/connector/health` e `/api/connector/manifest`) richiedono un Bearer token emesso dal KVA SSO provider.

```http
Authorization: Bearer <kva-sso-jwt>
```

Il token è un JWT firmato HS256 con il secret condiviso `KVA_SSO_SECRET`. Payload atteso:

```json
{
  "sub": "kva-user-id",
  "email": "user@kva.com",
  "name": "Carlo Ferrero",
  "role": "admin",
  "kvaVentureId": "robin-dev",
  "workspaceId": "uuid-of-robin-dev-workspace",
  "iat": 1700000000,
  "exp": 1700003600
}
```

Il campo `workspaceId` è obbligatorio per tutti gli endpoint autenticati: indica quale workspace Robin Dev deve usare per rispondere.

---

## Endpoint

### `GET /api/connector/manifest`
Pubblico. Restituisce il manifest del connettore.

**Response `200`:**
```json
{
  "id": "robin-dev",
  "name": "Robin Dev",
  "version": "1.0.0",
  "description": "Sviluppo AI-native, vibe coding e agent workspace",
  "capabilities": ["investment-analysis", "vibe-coding", "agent-workspace"],
  "endpoints": {
    "health": "/api/connector/health",
    "entities": "/api/connector/entities",
    "actions": "/api/connector/actions",
    "events": "/api/connector/subscribe"
  },
  "widgetSlots": ["robin-dev-dashboard", "robin-dev-agent"],
  "authRequired": true,
  "kvaRoomCompatible": true
}
```

---

### `GET /api/connector/health`
Pubblico. Stato del connettore e del DB.

**Response `200`:**
```json
{
  "status": "ok",
  "connector": "robin-dev",
  "version": "1.0.0",
  "db": "connected",
  "timestamp": "2026-03-08T14:00:00.000Z"
}
```

Restituisce `503` con `"status": "degraded"` se il DB non risponde.

---

### `GET /api/auth/session`
Richiede Bearer token. Verifica il token SSO e restituisce il profilo utente sincronizzato.

**Response `200`:**
```json
{
  "user": {
    "id": "kva-user-id",
    "email": "user@kva.com",
    "name": "Carlo Ferrero",
    "role": "admin",
    "kvaVentureId": "robin-dev"
  },
  "workspaceId": "uuid-of-workspace",
  "authenticated": true
}
```

---

### `GET /api/connector/entities`
Richiede Bearer token. Restituisce le entità Robin Dev in formato KO-compatible per l'indicizzazione nel Context Graph.

**Query parameters:**

| Param | Tipo | Default | Descrizione |
|-------|------|---------|-------------|
| `type` | `Project \| Agent \| Output` | tutti | Filtra per tipo entità |
| `limit` | `number` (1–100) | `50` | Numero massimo di risultati |
| `cursor` | `uuid` | — | ID per paginazione cursor-based |

**Esempio request:**
```http
GET /api/connector/entities?type=Project&limit=20
Authorization: Bearer <token>
```

**Response `200`:**
```json
{
  "data": [
    {
      "id": "task-uuid",
      "type": "Project",
      "title": "Implementa endpoint /api/connector",
      "summary": "Sviluppo API REST per integrazione KVA Room connector...",
      "content": null,
      "metadata": {
        "source": "robin-dev",
        "createdAt": "2026-03-01T10:00:00.000Z",
        "updatedAt": "2026-03-08T14:00:00.000Z",
        "ownerId": "clerk-user-id",
        "tags": ["pending", "high"],
        "status": "pending"
      },
      "relations": null
    }
  ],
  "cursor": "next-page-uuid",
  "total": 20
}
```

**Mapping entità:**

| Tabella Robin Dev | Tipo KO | Note |
|-------------------|---------|------|
| `tasks` (status: completed, review_pending) | `Output` | |
| `tasks` (altri status) | `Project` | |
| `agents` | `Agent` | |

---

### `POST /api/connector/actions`
Richiede Bearer token. Esegue un'azione su Robin Dev.

**Request body:**
```json
{
  "action": "create_project",
  "params": { ... },
  "requestedBy": "brook",
  "sessionToken": "<jwt>"
}
```

**Azioni disponibili:**

#### `create_project`
Crea un nuovo task in Robin Dev.

```json
{
  "action": "create_project",
  "params": {
    "title": "Implementa feature X",
    "description": "Descrizione dettagliata...",
    "priority": "high",
    "repository_id": "uuid-del-repository"
  },
  "requestedBy": "brook",
  "sessionToken": "<jwt>"
}
```

**Response:**
```json
{
  "action": "create_project",
  "success": true,
  "data": { "id": "new-task-uuid", "title": "...", "status": "pending", ... },
  "error": null
}
```

#### `get_project_summary`
Restituisce il summary di un task con artefatti associati.

```json
{
  "action": "get_project_summary",
  "params": { "task_id": "task-uuid" },
  "requestedBy": "brook",
  "sessionToken": "<jwt>"
}
```

#### `run_agent`
Accoda un task per l'esecuzione da parte di un agente.

```json
{
  "action": "run_agent",
  "params": {
    "task_id": "task-uuid",
    "agent_id": "agent-uuid"
  },
  "requestedBy": "brook",
  "sessionToken": "<jwt>"
}
```

Il task viene impostato a `status: pending` e `queued_at: null` — il TaskPoller lo raccoglie entro ~5s.

#### `get_agent_output`
Recupera l'output di un agente: artefatti (PR, commit) e storico iterazioni.

```json
{
  "action": "get_agent_output",
  "params": { "task_id": "task-uuid" },
  "requestedBy": "brook",
  "sessionToken": "<jwt>"
}
```

---

### `POST /api/connector/subscribe`
Richiede Bearer token. Registra un URL webhook dove la Room riceverà gli eventi di Robin Dev.

**Request body:**
```json
{
  "url": "https://room.kva.ventures/api/connectors/robin-dev/events",
  "events": ["project.created", "agent.completed", "output.ready"]
}
```

**Response `201`:**
```json
{
  "subscription": {
    "id": "sub-uuid",
    "url": "https://room.kva.ventures/...",
    "events": ["project.created", "agent.completed", "output.ready"],
    "active": true,
    "created_at": "2026-03-08T14:00:00.000Z",
    "updated_at": "2026-03-08T14:00:00.000Z"
  }
}
```

### `GET /api/connector/subscribe`
Richiede Bearer token. Lista le subscription attive.

---

## Eventi in uscita

Robin Dev emette eventi verso tutti gli URL registrati via `/api/connector/subscribe`.

**Formato payload:**
```json
{
  "event": "project.created",
  "entityId": "task-uuid",
  "entityType": "Project",
  "payload": { "title": "...", "workspaceId": "..." },
  "timestamp": "2026-03-08T14:00:00.000Z",
  "source": "robin-dev"
}
```

**Header di sicurezza:**
```http
X-Robin-Signature: <hmac-sha256-hex>
X-Robin-Event: project.created
X-Robin-Source: robin-dev
```

Per verificare la firma: `HMAC-SHA256(body, CONNECTOR_WEBHOOK_SECRET)`.

**Tipi di evento:**

| Event | Trigger |
|-------|---------|
| `project.created` | Nuovo task creato via `create_project` |
| `agent.completed` | — (riservato per uso futuro) |
| `output.ready` | Task in stato `completed` o `review_pending`, chiamato via `get_agent_output` |

---

## Registrare Robin Dev come connettore nella Room

1. Aggiungi le variabili d'ambiente condivise (vedi `.env.example` sezione `KVA Room`):
   - `KVA_SSO_SECRET` — stesso valore su Robin Dev e KVA Room
   - `CONNECTOR_WEBHOOK_SECRET` — stesso valore su Robin Dev e KVA Room

2. Nella Room, registra il connettore con:
   ```json
   {
     "id": "robin-dev",
     "baseUrl": "https://robin-dev.vercel.app",
     "manifestUrl": "https://robin-dev.vercel.app/api/connector/manifest"
   }
   ```

3. Dopo la registrazione, la Room chiama `GET /api/connector/manifest` per scoprire gli endpoint.

4. Per il primo login SSO, la Room emette un JWT con `workspaceId` valorizzato (UUID del workspace Robin Dev dell'utente) e chiama `GET /api/auth/session` — Robin Dev sincronizza l'utente localmente.

5. Registra il webhook:
   ```http
   POST /api/connector/subscribe
   Authorization: Bearer <kva-sso-jwt>
   Content-Type: application/json

   {
     "url": "https://room.kva.ventures/api/connectors/robin-dev/events",
     "events": ["project.created", "agent.completed", "output.ready"]
   }
   ```

---

## Variabili d'ambiente richieste

| Variabile | Dove | Descrizione |
|-----------|------|-------------|
| `KVA_ROOM_URL` | `apps/web` | URL base della Room |
| `KVA_SSO_ISSUER` | `apps/web` | Issuer JWT (informativo) |
| `KVA_SSO_SECRET` | `apps/web` + Room | Secret condiviso HS256 |
| `CONNECTOR_WEBHOOK_SECRET` | `apps/web` + Room | Secret per firmare i webhook |

---

## Sicurezza

- Tutti gli endpoint autenticati usano verificazione JWT a tempo costante (`timingSafeEqual`) per prevenire timing attacks
- Il `SUPABASE_SERVICE_ROLE_KEY` non è mai esposto — il connettore usa `createSupabaseAdminClient()` solo lato server
- I dati restituiti da `/entities` sono read-safe: nessuna credenziale, nessun env var sensibile
- La firma dei webhook (`X-Robin-Signature`) permette alla Room di verificare l'autenticità dei payload in ingresso
