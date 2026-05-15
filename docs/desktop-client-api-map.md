# Mappa API e Realtime — client desktop Robin.dev

**Scopo:** brief tecnico per progettare un client desktop (es. menu bar macOS) allineato a quanto esiste oggi nel monorepo.  
**Aggiornamento:** 2026-05-15 (derivato da `apps/web`, `packages/shared-types`, `docs/events.md`).

---

## Autenticazione e accesso dati

| Canale | Meccanismo |
|--------|------------|
| Web app | Clerk (sessione cookie) + `requireWorkspace()` nelle Route Handler |
| Supabase browser | `NEXT_PUBLIC_SUPABASE_URL` + `NEXT_PUBLIC_SUPABASE_ANON_KEY` + JWT Clerk template **`supabase`** → `supabase.realtime.setAuth(token)` prima delle subscription |
| Eccezione | `SprintDetailGroupedView` usa client anonimo senza `setAuth` — per un client desktop conviene uniformare sempre JWT + RLS |
| SSO KVA | `GET /api/auth/session` — Bearer KVA; **non** è il flusso standard del gestionale Clerk |

---

## Endpoint REST rilevanti

Base: `apps/web/app/api/`. Salvo note, richiedono sessione Clerk e workspace implicito (`requireWorkspace()`).

### Agenti

| Metodo | Path | Note |
|--------|------|------|
| `POST` | `/api/agents` | Crea agente, `agent_repositories`, enqueue provisioning BullMQ |
| `DELETE` | `/api/agents/[agentId]` | Blocco se task `queued` / `in_progress`; enqueue deprovisioning |
| `POST` | `/api/agents/[agentId]/retry-provisioning` | Stati `pending` / `error` |
| `POST` | `/api/admin/update-agents` | **Solo owner** — `PUBLISH` Redis `robin:update` (restart orchestratori), non è un canale UI |

**Non esiste `GET /api/agents`.** Lista/dettaglio: Server Component + DB (`getAgentsForWorkspace`, view `agents_with_status` — `apps/web/lib/db/agents.ts`).

### Repository (GitHub + DB)

| Metodo | Path | Note |
|--------|------|------|
| `GET` | `/api/github/repos` | Install GitHub App + merge con `repositories` DB |
| `POST` | `/api/github/repos/enable` | Abilita repo |
| `DELETE` | `/api/github/repos/[repoId]` | Soft-disable |
| `GET` | `/api/repositories/[repoId]/check` | Preflight accesso + `clone_url` |

### Task

| Metodo | Path | Note |
|--------|------|------|
| `GET` | `/api/tasks` | Query: `status`, `type`, `priority`, `search`, `page`, `pageSize` |
| `POST` | `/api/tasks` | Crea task; esecuzione non parte finché non si avvia sprint (o altri flussi) |
| `GET` / `PATCH` / `DELETE` | `/api/tasks/[taskId]` | PATCH emette `task.state.changed` se cambia `status` |
| `GET` | `/api/tasks/[taskId]/events` | Fino a 500 eventi, ordine cronologico |
| `POST` | `/api/tasks/[taskId]/events` | Solo umano: `human.approved`, `human.rejected`, `human.commented` |
| `POST` | `/api/tasks/bulk` | `add_to_sprint`, `set_priority`, `cancel`, `move_to_backlog` |
| `POST` | `/api/tasks/bugfix` | Enqueue bugfix BullMQ; richiede agente online |
| `POST` | `/api/tasks/attachments` | Multipart upload allegati |

### Sprint (stato task)

| Metodo | Path | Note |
|--------|------|------|
| `GET` / `POST` | `/api/sprints` | Lista / crea |
| `GET` / `PATCH` / `DELETE` | `/api/sprints/[sprintId]` | DELETE solo sprint `planning` |
| `POST` | `/api/sprints/[sprintId]/start` | `sprint_ready` → `queued`, job per repo, eventi |

*(Altre route sprint es. `from-backlog` per pianificazione — fuori scope minimo mock.)*

### Workspace

| Metodo | Path | Note |
|--------|------|------|
| `POST` | `/api/workspaces` | Onboarding |
| `PATCH` | `/api/workspace` | Nome workspace |
| `PATCH` | `/api/workspaces/[id]` | `mcp_config`, solo owner |

### “Chat” lato web oggi

| Metodo | Path | Note |
|--------|------|------|
| `POST` | `/api/ai/brainstorm` | Chat Anthropic + context docs — **non** è comando diretto al worker Claude Code sugli agenti VPS |

---

## Realtime (Supabase `postgres_changes`)

Pattern: WebSocket Realtime; nome canale è convenzione client. **Sempre** JWT `setAuth` per coerenza RLS (come `useAgentStatus`, `useActiveTask`, terminale sprint).

### Tabella `task_events` (append-only)

Riferimento semantico: [`docs/events.md`](./events.md). Tipi TypeScript: `TaskEventType`, `EventPayloadMap` in `packages/shared-types`.

| Sorgente codice | Evento DB | Filtro | Uso UX |
|-----------------|-----------|--------|--------|
| `useDashboardFeed` | `INSERT` | `workspace_id=eq.{workspaceId}` | Feed attività workspace |
| `useAgentStatus` | `INSERT` | stesso | Stato derivato idle/busy/error (hero) |
| `useActiveTask` | `INSERT` | stesso | Task attiva + override stati |
| `useTaskEventsFeed`, `TaskTerminalPanel` (`SprintActiveTable`) | `INSERT` | `task_id=eq.{taskId}` | Timeline / log inline |

### Tabella `tasks`

| Sorgente codice | Evento DB | Filtro | Uso UX |
|-----------------|-----------|--------|--------|
| `SprintActiveTable`, `SprintDetailGroupedView` | `UPDATE` | `sprint_id=eq.{sprintId}` | Righe sprint aggiornate |

### Agenti

| Sorgente codice | Evento DB | Filtro | Uso UX |
|-----------------|-----------|--------|--------|
| `AgentStatusGrid` | `agents` `*` | `workspace_id=eq.{workspaceId}` | Su change → refetch aggregato |
| `AgentStatusGrid` | `agent_status` `*` | (nessun filter workspace nel codice attuale) | Su change → refetch |
| `AgentsClient` | `agents` `*` | `workspace_id=eq.{workspaceId}` | Lista agenti live |
| `AgentsClient` | `agent_status` `*` | globale | Refetch lista |

Refetch tipico: view `agents_with_status`, `agent_status.current_task_id`, join `agent_repositories` → `repositories.full_name`, titoli task.

### Provisioning

| Sorgente codice | Evento DB | Filtro | Uso UX |
|-----------------|-----------|--------|--------|
| `ProvisioningTimeline` | `UPDATE` `agents` | `id=eq.{agentId}` | Step provisioning |

### Ops (diagnostica)

| Sorgente codice | Evento DB | Filtro | Uso UX |
|-----------------|-----------|--------|--------|
| `OpsPanel` | `UPDATE` `ops_runs` | `id=eq.{runId}` | Stato run |

---

## Non disponibile come API desktop “diretta”

- Code **BullMQ** / heartbeat worker: effetti osservabili tramite **DB** e `task_events`, non REST dedicato nel web.
- **`robin:update` Redis:** comando operativo orchestratori, non stream per utente finale.

---

## Implicazioni prodotto / design

1. **Shoot-and-forget verso esecuzione agente:** oggi passa da **REST** (crea/aggiorna task, avvia sprint, bugfix enqueue) + **propagazione via DB**; non c’è WebSocket bidirezionale “chat con il processo sul VPS”.
2. **Chat conversazionale “con l’agente”** sul modello produzione ≠ `POST /api/ai/brainstorm` (brainstorm è altro flusso).
3. Per mock **overview agenti ↔ repo ↔ task in corso**, la reference implementativa più vicina è **`AgentStatusGrid`** + realtime su **`agents` / `agent_status`** + **`task_events`** per avanzamenti e blocchi (`agent.blocked`, `task.failed`, `human.*`, ecc.).

---

## Prompt per Claude Design (copia-incolla)

```
Stai progettando i mock UI per un client desktop Robin.dev (macOS, stile menu bar / popover tipo VPN: stretto, gerarchico, dark, sezioni scrollabili).

Contesto prodotto:
- Robin è un SaaS che orchestra agenti Claude Code su VPS per workspace cliente: task su repo GitHub, PR, review founder.
- Il desktop NON esegue l’agente: è un pannello di controllo e invio comandi.

Dati e live updates (non inventare backend diversi):
- Auth: Clerk + Supabase Realtime con JWT; oppure in futuro session token verso le stesse API Next.
- Lista agenti e mapping agente→repository: oggi arriva da Supabase (view agents_with_status, agent_repositories, agent_status.current_task_id), con postgres_changes su tabelle agents e agent_status; a volte refetch aggregato come in AgentStatusGrid.
- Stato task e “log”: tabella task_events (INSERT) filtrata per workspace o per task_id; catalogo tipi evento in docs/events.md / shared-types TaskEventType.
- Aggiornamenti riga task in sprint: postgres_changes UPDATE su tasks con sprint_id.

API REST già esistenti utili al mock (testi/label azioni): GET /api/tasks, POST /api/tasks, GET/PATCH /api/tasks/[id], GET/POST /api/tasks/[id]/events (eventi umani), POST /api/sprints/[id]/start, GET /api/github/repos, POST /api/github/repos/enable, GET /api/repositories/[id]/check.
Non esiste GET /api/agents (i dati agente sono da Supabase lato server o replicando le query del client).

Attenzione: POST /api/ai/brainstorm è chat Anthropic di supporto/backlog, NON è il canale comando all’agente di esecuzione.

Consegna: wireframe o high-fidelity del popover + eventuale finestra espansa — sezioni per (1) stato connessione/workspace, (2) agenti attivi/offline con repo collegate e task corrente, (3) sprint o coda sintetica con stati blocked/in progress/done, (4) azione rapida “nuova task” o link al web per flussi lunghi, (5) dove inserire commenti umani su task se serve sblocco. Indica chiaramente cosa è live (realtime) vs snapshot iniziale.
```
