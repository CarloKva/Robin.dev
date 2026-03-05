# Schema — Robin.dev

**Last updated:** 2026-03-05

---

## Convenzioni

- Primary key: `uuid` via `gen_random_uuid()`
- Tutte le tabelle: `created_at timestamptz DEFAULT now() NOT NULL`
- Tabelle mutabili: `updated_at timestamptz DEFAULT now() NOT NULL`
- Tabelle append-only (`task_events`): no `updated_at`
- Tabelle tenant: `workspace_id uuid NOT NULL REFERENCES workspaces(id) ON DELETE CASCADE`
- `user_id` colonne: Clerk user ID (stringa, es. `user_abc123`) — tipo `text`, non `uuid`

---

## Tabelle

### `workspaces`
Container tenant di primo livello.

| Colonna | Tipo | Note |
|---------|------|-------|
| id | uuid | PK |
| name | text | Display name |
| slug | text | UNIQUE, URL-safe |
| created_at | timestamptz | |
| updated_at | timestamptz | |

---

### `workspace_members`
Associazione utenti Clerk ↔ workspace con ruolo.

| Colonna | Tipo | Note |
|---------|------|-------|
| id | uuid | PK |
| workspace_id | uuid | FK → workspaces |
| user_id | text | Clerk user ID |
| role | workspace_role | `'owner' \| 'member'` |
| created_at | timestamptz | |
| updated_at | timestamptz | |

Unique constraint: `(workspace_id, user_id)`

---

### `agents`
Agenti AI che eseguono task.

| Colonna | Tipo | Note |
|---------|------|-------|
| id | uuid | PK |
| workspace_id | uuid | FK → workspaces |
| name | text | Display name |
| type | text | Agent type identifier |
| created_at | timestamptz | |
| updated_at | timestamptz | |
| slug | text | Unique, URL-safe (added 0006) |
| github_account | text | Nullable. GitHub account login (added 0006) |
| vps_ip | text | Nullable. Hetzner VPS public IP (added 0006) |
| vps_region | text | Default `'fsn1'` (added 0006) |
| last_seen_at | timestamptz | Nullable. Heartbeat — deriva online/offline status (added 0006) |
| orchestrator_version | text | Nullable. Semver orchestratore sul VPS (added 0006) |
| claude_code_version | text | Nullable. Semver Claude Code sul VPS (added 0006) |
| provisioning_status | agent_provisioning_status | NOT NULL DEFAULT `'pending'` (added 0007) |
| vps_id | bigint | Nullable. Hetzner server numeric ID (added 0007) |
| vps_created_at | timestamptz | Nullable. Quando la VPS Hetzner è stata creata (added 0007) |
| vps_online_at | timestamptz | Nullable. Quando la VPS ha raggiunto `running` (added 0009) |
| provisioned_at | timestamptz | Nullable. Quando l'orchestratore ha passato l'health check (added 0007) |
| provisioning_error | text | Nullable. Messaggio errore se provisioning fallito (added 0007) |
| avatar_url | text | Nullable. URL avatar agente (added 0011) |

---

### `agent_status`
Stato real-time agente. 1:1 con `agents`. Tabella separata per ridurre lock contention durante heartbeat.

| Colonna | Tipo | Note |
|---------|------|-------|
| agent_id | uuid | PK, FK → agents |
| status | agent_status_enum | Stato corrente |
| current_task_id | uuid | FK → tasks, nullable |
| last_heartbeat | timestamptz | |
| updated_at | timestamptz | |

---

### `tasks`
Unità di lavoro centrale. Si muove attraverso stati (status).

| Colonna | Tipo | Note |
|---------|------|-------|
| id | uuid | PK |
| workspace_id | uuid | FK → workspaces |
| title | text | |
| description | text | |
| status | task_status | Fase corrente |
| priority | task_priority | |
| type | text | NOT NULL DEFAULT `'feature'`. CHECK: `bug \| feature \| docs \| refactor \| chore` (added 0005) |
| assigned_agent_id | uuid | FK → agents, nullable |
| created_by_user_id | text | Clerk user ID |
| queued_at | timestamptz | Nullable. Set quando task è enqueued. Previene job duplicati. (added 0003) |
| created_at | timestamptz | |
| updated_at | timestamptz | |
| sprint_id | uuid | Nullable. FK → sprints (added 0010) |
| repository_id | uuid | Nullable. FK → repositories — target repo (added 0010) |
| preferred_agent_id | uuid | Nullable. FK → agents — override routing esplicito (added 0010) |
| sprint_order | int | Nullable. Posizione nella queue sprint (added 0010) |
| context | text | Nullable. Contesto aggiuntivo (link, screenshot, ref) (added 0010) |
| estimated_effort | text | Nullable. CHECK: `xs \| s \| m \| l` (added 0010) |
| current_iteration | int | NOT NULL DEFAULT 1. Iterazione corrente di rework (added 0012) |
| rework_count | int | NOT NULL DEFAULT 0. Totale cicli rework (added 0012) |
| last_rework_trigger | iteration_trigger | Nullable. Come è stato triggerato l'ultimo rework (added 0012) |
| pending_rework_comments | jsonb | Nullable. GitHub comment ID in attesa di processing (added 0012) |

---

### `task_artifacts`
Output prodotti durante l'esecuzione del task.

| Colonna | Tipo | Note |
|---------|------|-------|
| id | uuid | PK |
| task_id | uuid | FK → tasks |
| workspace_id | uuid | FK → workspaces (per RLS) |
| type | artifact_type | `pr \| commit \| deploy_preview \| test_report` |
| url | text | |
| title | text | |
| created_at | timestamptz | |
| updated_at | timestamptz | |

---

### `task_events`
Audit log append-only. Nessun UPDATE o DELETE consentito.

| Colonna | Tipo | Note |
|---------|------|-------|
| id | uuid | PK |
| task_id | uuid | FK → tasks |
| workspace_id | uuid | FK → workspaces (per RLS) |
| event_type | task_event_type | Cosa è successo |
| actor_type | actor_type | `'agent' \| 'human'` |
| actor_id | text | Agent ID o Clerk user ID |
| payload | jsonb | Dati specifici dell'evento |
| iteration_number | int | Nullable. Quale iterazione ha emesso questo evento (added 0012) |
| created_at | timestamptz | |

---

### `github_connections`
Installazione GitHub App per workspace. (Migration 0007)

| Colonna | Tipo | Note |
|---------|------|-------|
| id | uuid | PK |
| workspace_id | uuid | FK → workspaces. UNIQUE |
| installation_id | bigint | NOT NULL. GitHub App installation ID |
| github_account_id | bigint | NOT NULL. GitHub account/org numeric ID |
| github_account_login | text | NOT NULL. GitHub username o org |
| github_account_type | text | NOT NULL. CHECK: `User \| Organization` |
| status | text | NOT NULL DEFAULT `'connected'`. CHECK: `connected \| revoked \| suspended` |
| connected_at | timestamptz | |
| last_validated_at | timestamptz | Nullable. Ultima verifica installazione attiva |
| created_at | timestamptz | |
| updated_at | timestamptz | |

---

### `repositories`
Repository abilitate dal founder. (Migration 0007)

| Colonna | Tipo | Note |
|---------|------|-------|
| id | uuid | PK |
| workspace_id | uuid | FK → workspaces |
| github_repo_id | bigint | NOT NULL. GitHub numeric repo ID (stabile ai rename). UNIQUE per workspace. |
| full_name | text | NOT NULL. Es. `"acme/frontend"` |
| default_branch | text | NOT NULL DEFAULT `'main'` |
| is_private | boolean | NOT NULL DEFAULT true |
| is_enabled | boolean | NOT NULL DEFAULT true. False = soft-disabled |
| is_available | boolean | NOT NULL DEFAULT true. False = repo eliminata/inaccessibile su GitHub |
| last_synced_at | timestamptz | Nullable. Ultima verifica GitHub API |
| created_at | timestamptz | |
| updated_at | timestamptz | |

---

### `agent_repositories`
Many-to-many: agents ↔ repositories. (Migration 0007)

| Colonna | Tipo | Note |
|---------|------|-------|
| id | uuid | PK |
| agent_id | uuid | FK → agents ON DELETE CASCADE |
| repository_id | uuid | FK → repositories ON DELETE CASCADE |
| assigned_at | timestamptz | NOT NULL DEFAULT now() |

Unique constraint: `(agent_id, repository_id)`

---

### `sprints`
Container sprint. (Migration 0010)

| Colonna | Tipo | Note |
|---------|------|-------|
| id | uuid | PK |
| workspace_id | uuid | FK → workspaces |
| name | text | NOT NULL |
| goal | text | Nullable |
| status | text | NOT NULL DEFAULT `'planning'`. CHECK: `planning \| active \| completed \| cancelled` |
| started_at | timestamptz | Nullable |
| completed_at | timestamptz | Nullable |
| tasks_completed | int | NOT NULL DEFAULT 0 |
| tasks_failed | int | NOT NULL DEFAULT 0 |
| tasks_moved_back | int | NOT NULL DEFAULT 0 |
| avg_cycle_time_minutes | int | Nullable. Popolato alla chiusura sprint |
| created_at | timestamptz | |
| updated_at | timestamptz | |

---

### `task_templates`
Template per descrizioni task per tipo. (Migration 0010)

| Colonna | Tipo | Note |
|---------|------|-------|
| id | uuid | PK |
| workspace_id | uuid | FK → workspaces |
| task_type | text | NOT NULL |
| template_body | text | NOT NULL. Markdown template |
| is_default | boolean | NOT NULL DEFAULT false |
| created_at | timestamptz | |
| updated_at | timestamptz | |

Unique constraint: `(workspace_id, task_type, is_default)`

---

### `workspace_settings`
Configurazione notifiche per workspace. (Migration 0010)

| Colonna | Tipo | Note |
|---------|------|-------|
| workspace_id | uuid | PK, FK → workspaces |
| notify_email | text | Nullable. Resend recipient; null = email off |
| notify_slack_webhook | text | Nullable. Slack incoming webhook URL; null = off |
| created_at | timestamptz | |
| updated_at | timestamptz | |

---

### `task_iterations`
Storico esecuzioni per task — ogni ciclo di rework. (Migration 0012)

| Colonna | Tipo | Note |
|---------|------|-------|
| id | uuid | PK |
| task_id | uuid | FK → tasks ON DELETE CASCADE |
| iteration_number | int | NOT NULL. Monotonicamente crescente per task |
| trigger | iteration_trigger | NOT NULL. `initial \| github_comment \| dashboard` |
| triggered_by_user_id | text | Nullable. Null se triggerato da GitHub webhook |
| github_comment_ids | int[] | Nullable. IDs commenti GitHub che hanno triggerato il rework |
| pr_url | text | Nullable |
| pr_number | int | Nullable |
| started_at | timestamptz | Nullable |
| completed_at | timestamptz | Nullable |
| status | iteration_status | NOT NULL DEFAULT `'pending'`: `pending \| running \| completed \| failed` |
| context_snapshot_url | text | Nullable |
| summary | text | Nullable |
| created_at | timestamptz | |
| updated_at | timestamptz | |

---

### `context_documents`
Documenti di contesto workspace per la feature AI Brainstorm. (Migration 0008)

| Colonna | Tipo | Note |
|---------|------|-------|
| id | uuid | PK |
| workspace_id | uuid | FK → workspaces |
| title | text | NOT NULL |
| content | text | NOT NULL |
| source_repo_full_name | text | Nullable. Es. `"acme/frontend"` |
| source_path | text | Nullable. Path nel repo |
| source_sha | text | Nullable. Git SHA al momento della sync |
| last_synced_at | timestamptz | Nullable |
| created_at | timestamptz | |
| updated_at | timestamptz | |

---

## Enum

### `task_status`

| Valore | Aggiunto | Significato |
|--------|----------|-------------|
| `pending` | 0001 | Task creata, non ancora accodata |
| `queued` | 0001 | In coda BullMQ |
| `in_progress` | 0001 | Agente in esecuzione |
| `review_pending` | 0001 | PR aperta, in attesa di review umana |
| `approved` | 0001 | Approvata dal reviewer |
| `rejected` | 0001 | Rifiutata dal reviewer |
| `completed` | 0001 | Completata con successo (senza PR) |
| `failed` | 0001 | Fallimento permanente |
| `cancelled` | 0001 | Annullata dall'utente |
| `backlog` | 0006 | Nessun agente online alla creazione |
| `sprint_ready` | 0010 | Nello sprint, pronta per essere accodata |
| `in_review` | 0010 | Lavoro agente completato, review asincrona pre-merge |
| `rework` | 0010 | Restituita per rework dopo review |
| `done` | 0010 | PR mergeata / chiusa come fatto |

### `task_priority`

| Valore | Aggiunto |
|--------|----------|
| `low` | 0001 |
| `medium` | 0001 |
| `high` | 0001 |
| `urgent` | 0001 |
| `critical` | 0010 |

### `agent_provisioning_status`
(Migration 0007)

| Valore | Significato |
|--------|-------------|
| `pending` | Record creato, job provisioning non ancora partito |
| `provisioning` | VPS Hetzner in creazione |
| `online` | VPS + orchestratore healthy, pronto per task |
| `error` | Provisioning fallito (vedi `provisioning_error`) |
| `deprovisioning` | Eliminazione in corso |
| `deprovisioned` | VPS eliminata (record mantenuto per storico task) |

### `task_event_type` — valori aggiuntivi

| Valore | Aggiunto |
|--------|----------|
| `agent.provisioning.started` | 0007 |
| `agent.provisioning.vps_created` | 0007 |
| `agent.provisioning.setup_running` | 0007 |
| `agent.provisioning.health_check` | 0007 |
| `agent.provisioning.completed` | 0007 |
| `agent.provisioning.failed` | 0007 |
| `agent.deprovisioned` | 0007 |
| `task.pr_closed_without_merge` | 0013 |

### `iteration_trigger`
(Migration 0012): `initial | github_comment | dashboard`

### `iteration_status`
(Migration 0012): `pending | running | completed | failed`

---

## View

### `agents_with_status`
(Migration 0006, rebuild 0008, 0009). Unisce `agents` + `agent_status`, deriva `effective_status` da `last_seen_at`.

```sql
CASE
  WHEN a.last_seen_at IS NULL THEN 'offline'
  WHEN a.last_seen_at < now() - interval '2 minutes' THEN 'offline'
  ELSE COALESCE(s.status::text, 'idle')
END AS effective_status
```

Colonne: tutti i campi `agents` + `effective_status`, `raw_status`, `current_task_id`, `last_heartbeat`, `provisioning_status`, `vps_id`, `vps_created_at`, `vps_online_at`, `provisioned_at`, `provisioning_error`.

---

## Indici

```sql
-- RLS performance
CREATE INDEX ON workspace_members(user_id);
CREATE INDEX ON workspace_members(workspace_id);

-- Tenant isolation
CREATE INDEX ON agents(workspace_id);
CREATE INDEX ON tasks(workspace_id);
CREATE INDEX ON task_artifacts(workspace_id);
CREATE INDEX ON task_events(workspace_id);

-- Query patterns
CREATE INDEX ON tasks(assigned_agent_id);
CREATE INDEX ON tasks(status);
CREATE INDEX ON task_events(task_id);
CREATE INDEX ON task_artifacts(task_id);

-- 0003: partial index per poller
CREATE INDEX ON tasks(status, queued_at) WHERE queued_at IS NULL;

-- 0004: event sourcing
CREATE INDEX task_events_task_id_created_at_idx ON task_events (task_id, created_at ASC);
CREATE INDEX task_events_pr_url_gin_idx ON task_events USING GIN (payload) WHERE event_type = 'agent.pr.opened';
CREATE INDEX task_events_workspace_created_at_idx ON task_events (workspace_id, created_at DESC);
CREATE INDEX task_events_event_type_idx ON task_events (event_type);

-- 0005
CREATE INDEX ON tasks(workspace_id, type);

-- 0006
CREATE INDEX idx_agents_workspace_last_seen ON agents(workspace_id, last_seen_at DESC NULLS LAST);

-- 0007
CREATE INDEX idx_github_connections_workspace ON github_connections(workspace_id);
CREATE INDEX idx_repositories_workspace ON repositories(workspace_id);
CREATE INDEX idx_agent_repositories_agent ON agent_repositories(agent_id);
CREATE INDEX idx_agent_repositories_repository ON agent_repositories(repository_id);
CREATE INDEX idx_repositories_github_repo_id ON repositories(github_repo_id);
CREATE INDEX idx_agents_provisioning_status ON agents(provisioning_status);

-- 0010
CREATE INDEX idx_tasks_workspace_status ON tasks (workspace_id, status);
CREATE INDEX idx_tasks_sprint_order ON tasks (sprint_id, sprint_order) WHERE sprint_id IS NOT NULL;
CREATE INDEX idx_tasks_repo_status ON tasks (repository_id, status) WHERE repository_id IS NOT NULL;
CREATE INDEX idx_sprints_workspace ON sprints (workspace_id, status);

-- 0012
CREATE INDEX idx_task_iterations_task_id ON task_iterations (task_id, iteration_number);
CREATE INDEX idx_task_iterations_status ON task_iterations (status) WHERE status IN ('pending', 'running');
CREATE INDEX idx_task_events_iteration ON task_events (task_id, iteration_number) WHERE iteration_number IS NOT NULL;
```

---

## Pattern RLS

```sql
ALTER TABLE tasks ENABLE ROW LEVEL SECURITY;

CREATE POLICY "tasks_select" ON tasks
  FOR SELECT USING (workspace_id IN (SELECT get_my_workspace_ids()));

CREATE POLICY "tasks_insert" ON tasks
  FOR INSERT WITH CHECK (workspace_id IN (SELECT get_my_workspace_ids()));

CREATE POLICY "tasks_update" ON tasks
  FOR UPDATE USING (workspace_id IN (SELECT get_my_workspace_ids()));

CREATE POLICY "tasks_delete" ON tasks
  FOR DELETE USING (workspace_id IN (SELECT get_my_workspace_ids()));
```

`task_events` ha solo SELECT + INSERT (append-only — nessuna policy UPDATE/DELETE).

---

## Migration files

| File | Contenuto |
|------|-----------|
| `0001_initial_schema.sql` | Enum, tabelle, indici |
| `0002_rls_policies.sql` | `get_my_workspace_ids()` + tutte le policy |
| `0003_add_queued_at.sql` | `tasks.queued_at` + partial index |
| `0004_event_sourcing.sql` | Indici compositi/GIN + Realtime publication |
| `0005_add_task_type.sql` | `tasks.type` + check constraint |
| `0006_agent_registry.sql` | Extend `agents`, `backlog` status, view `agents_with_status`, `mark_stale_agents_offline()` |
| `0007_github_integration.sql` | `agent_provisioning_status` enum, campi provisioning su `agents`, `github_connections` + `repositories` + `agent_repositories` + RLS |
| `0008_update_agents_view_provisioning.sql` | Rebuild view con campi provisioning |
| `0008_context_documents.sql` | `context_documents` + RLS |
| `0009_add_vps_online_at.sql` | `agents.vps_online_at` + rebuild view |
| `0010_sprint_b.sql` | Nuovi status/priority, `sprints` + `task_templates` + `workspace_settings`, extend `tasks` |
| `0011_add_agent_avatar_url.sql` | `agents.avatar_url` |
| `0012_task_iterations.sql` | `iteration_trigger` + `iteration_status` enum, `task_iterations`, extend `tasks` + `task_events` |
| `0013_github_pr_webhook.sql` | `task.pr_closed_without_merge` event type |
