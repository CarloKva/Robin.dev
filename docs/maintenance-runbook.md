# Maintenance Agents — Operations Runbook

> Companion to [`maintenance-agents-spec.md`](./maintenance-agents-spec.md). Lists
> the exact commands for enabling/disabling the scheduler, triggering manual
> runs, and inspecting state. Use this when running Phase 1 dogfood or
> debugging any maintenance issue in production.

## Concepts at a glance

- **Scheduler** lives in the orchestrator process on the **control-plane VPS** (currently `77.42.71.71`).
  It is gated by `MAINTENANCE_SCHEDULER_DRY_RUN`. Default is `true` (dry-run logs only, no enqueue).
- **Worker** runs on each **agent VPS** (e.g. `46.225.212.237` for Robin.dev).
  It picks up `MaintenanceJobPayload` from the `maintenance-agents` BullMQ queue.
- **Config** rows live in `workspace_capability_configs` (one per workspace × repo × capability).

---

## Enable the scheduler in production (out of dry-run)

The orchestrator on the control-plane reads `MAINTENANCE_SCHEDULER_DRY_RUN` at startup.

```bash
# 1) SSH into the control-plane VPS
ssh -i ~/.ssh/<your-current-key> root@77.42.71.71

# 2) Find where env vars are loaded.
#    Two common layouts; only one will exist:
#      a) systemd unit drop-in:
ls /etc/systemd/system/robin-orchestrator.service.d/ 2>/dev/null
cat /etc/systemd/system/robin-orchestrator.service.d/override.conf 2>/dev/null
#      b) .env file consumed by ExecStart:
ls /opt/robin/.env /opt/robin/app/apps/orchestrator/.env 2>/dev/null

# 3) Set MAINTENANCE_SCHEDULER_DRY_RUN=false in whichever layout you have.
#    Example for systemd override:
mkdir -p /etc/systemd/system/robin-orchestrator.service.d
cat > /etc/systemd/system/robin-orchestrator.service.d/maintenance.conf <<'EOF'
[Service]
Environment=MAINTENANCE_SCHEDULER_DRY_RUN=false
EOF
systemctl daemon-reload

# Example for an existing .env file:
# sed -i 's/^MAINTENANCE_SCHEDULER_DRY_RUN=.*/MAINTENANCE_SCHEDULER_DRY_RUN=false/' /opt/robin/.env
# echo 'MAINTENANCE_SCHEDULER_DRY_RUN=false' >> /opt/robin/.env  # if missing

# 4) Restart and confirm
systemctl restart robin-orchestrator
journalctl -u robin-orchestrator -n 50 --no-pager | grep -i "MaintenanceScheduler started"
# Expect: "MaintenanceScheduler started" with "dryRun": false
```

### Revert to dry-run

Same procedure with `MAINTENANCE_SCHEDULER_DRY_RUN=true` (or remove the override entirely → defaults to dry-run because the runner treats anything other than `"false"` as truthy).

---

## Force-trigger a run

### Option A — via the web app (recommended, owner-only)

1. Open `https://<your-domain>/maintenance`.
2. Pick the repository.
3. Click **Run now** on the **Spec Coverage** card.
4. Watch `https://<your-domain>/maintenance/runs` for the new row.

The API does the same pre-flight checks as the scheduler: config exists, repo enabled, daily budget remaining, online runner available.

### Option B — schedule-driven (no UI)

Update `next_run_at` to make the scheduler pick the config on its next 60-second tick.

```sql
UPDATE workspace_capability_configs
SET next_run_at = NOW(), updated_at = NOW()
WHERE id = '<config-id>';
```

Find the config id:

```sql
SELECT c.id, r.full_name, c.capability_definition_id, c.enabled, c.spec_paths, c.next_run_at
FROM workspace_capability_configs c
JOIN repositories r ON c.repository_id = r.id
WHERE r.full_name = 'CarloKva/Robin.dev'
  AND c.capability_definition_id = 'spec_discovery';
```

---

## Robin.dev dogfood config

The bootstrap default for `spec_paths` is `{'docs/spec.md'}`. That file does **not** exist in this repo, so a default run would `validation_failed`. The Robin.dev `spec_discovery` config has been updated to:

```text
docs/maintenance-agents-spec.md
CLAUDE.md
apps/orchestrator/CLAUDE.md
apps/web/CLAUDE.md
```

To reset to default later:

```sql
UPDATE workspace_capability_configs
SET spec_paths = ARRAY['docs/spec.md']::text[], updated_at = NOW()
WHERE id = '12cc1b45-979f-4c00-a5f7-b1c79a577489';
```

---

## Inspect a run end-to-end

```sql
-- Most recent runs across all configs
SELECT id, status, trigger, tokens_used, findings_created, error_message, created_at, completed_at
FROM agent_runs
ORDER BY created_at DESC
LIMIT 10;

-- Findings produced by a specific run
SELECT id, status, confidence, requirement_source_path, requirement_source_line,
       LEFT(requirement_text, 80) AS requirement
FROM spec_findings
WHERE agent_run_id = '<agent-run-id>'
ORDER BY confidence DESC;

-- Maintenance events trail for one run
SELECT event_type, actor_type, actor_id, payload, created_at
FROM maintenance_events
WHERE agent_run_id = '<agent-run-id>'
ORDER BY created_at ASC;
```

Orchestrator-side observability:

```bash
# Control-plane scheduler tick logs
journalctl -u robin-orchestrator -f | grep -E "MaintenanceScheduler|maintenance-agents"

# Agent-side runner logs
ssh -i ~/.ssh/<your-key> root@<agent-ip>
journalctl -u robin-orchestrator -f | grep -E "Maintenance|spec-discovery"
```

---

## Common failure modes

| Symptom | Cause | Fix |
|---|---|---|
| `status='no_agent'` | No online idle agent assigned to repo. | Bring an agent online, or assign one via `/agents/[id]`. |
| `status='budget_exceeded'` | Daily token budget exhausted (workspace-local day). | Wait for day rollover (`workspaces.timezone`) or raise `daily_token_budget`. |
| `status='validation_failed'` with "No configured spec_paths exist" | `spec_paths` point to files not in the repo. | Update `workspace_capability_configs.spec_paths` to real files. |
| `status='validation_failed'` with "did not contain a valid JSON object" | Model output didn't include parseable JSON. | Check assistant transcripts; tighten system prompt; reduce `maxTurns`. |
| `status='skipped'` with "Runner mismatch" | Job routed to wrong agent. | Check `agent_repositories` for the repo and `agents_with_status.effective_status`. |
| Repeated `agent.run.scheduled` for same config when in dry-run | Known issue: dry-run doesn't advance `next_run_at`. | Tracked as `TASK-MAINTENANCE-02`. Cosmetic, no impact. |

---

## Phase 1 dogfood checklist (Robin.dev)

1. [ ] Confirm spec_paths point to real files (already set; see above).
2. [ ] Confirm an agent assigned to `CarloKva/Robin.dev` is online and idle (`/agents` page).
3. [ ] Disable dry-run on the control-plane (see "Enable the scheduler in production").
4. [ ] Click **Run now** at `/maintenance` for Spec Coverage on Robin.dev.
5. [ ] Watch `/maintenance/runs` until status flips off `queued`.
6. [ ] Open `/maintenance/inbox` (state=pending) — review the findings.
7. [ ] If false-positive rate looks high, tune in two places:
    - lower `confidence` floor or `max_findings` in `apps/orchestrator/src/services/spec-discovery.validator.ts`;
    - tighten the rubric in `apps/orchestrator/profiles/spec-discovery/system_prompt.md`.
8. [ ] If a P1-class operational issue surfaces, log it as a `TASK-MAINTENANCE-*` entry in `.robin.md`.

---

## Cross-references

- Spec: [`docs/maintenance-agents-spec.md`](./maintenance-agents-spec.md)
- Schema: `supabase/migrations/0019_maintenance_capabilities.sql`
- Runner: `apps/orchestrator/src/workers/maintenance-agent.runner.ts`
- Validator + dedup: `apps/orchestrator/src/services/spec-discovery.validator.ts`, `apps/orchestrator/src/services/dedup.ts`
- API: `apps/web/app/api/maintenance/`
- UI: `apps/web/app/(dashboard)/maintenance/`
- Backlog of follow-ups: `.robin.md` → `TASK-MAINTENANCE-01..07`
