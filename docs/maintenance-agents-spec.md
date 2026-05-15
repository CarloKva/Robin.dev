# Maintenance Agents — Implementation Spec

**Status:** Ready for implementation
**Owner:** Carlo Ferrero
**Last updated:** 2026-05-15
**Target sprint:** Maintenance Agents v1

This spec defines four built-in maintenance capabilities for Robin.dev:

- `spec_discovery`: compares configured spec files to repository implementation and surfaces missing, partial, or drifted requirements.
- `spec_impl`: implements approved spec findings with tests and opens a PR.
- `bug_discovery`: surfaces bugs grounded in Sentry/runtime evidence or high-confidence static analysis.
- `bug_impl`: fixes approved bug findings with a regression test and opens a PR.

Discovery capabilities are default-on for enabled repositories. Implementation capabilities are default-off and run only after explicit approval, unless a workspace owner opts into auto-implementation.

## Architecture Review Conclusion

The original direction is correct: reuse the existing orchestrator, BullMQ/Redis, Supabase, GitHub App credentials, provisioned agent VPSes, and PR review flow. The best implementation is **not** to add a new infrastructure tier or a dedicated maintenance VPS.

The implementation should make these corrections before build:

- Treat agents and capabilities as two different product concepts. An agent is the user's AI worker/employee backed by VPS compute. A capability is a product feature/profile/skill bundle the agent can use.
- Model capability assignment separately from project/repository execution policy. In v1 the built-in maintenance capabilities are available to every provisioned agent by default; schedule/budget/spec paths are configured per project/repository because the work targets a repository.
- Scope maintenance execution policy, runs, findings, locks, and budgets to **workspace + repository + capability definition**, not workspace only. The current product supports multiple repositories per workspace.
- Reuse existing agent VPSes, but select an online `agents` row assigned to the target repository. The current system provisions VPSes per agent, not one fixed VPS per workspace.
- Add a dedicated BullMQ queue/worker for maintenance jobs inside the existing orchestrator process. Do not overload `task.worker.ts`; the existing `JobPayload` has no `job.type` and is task-specific.
- Keep implementation agents integrated with the existing task/PR flow by creating or linking a `tasks` row for every approved finding.
- Use per-repository locks. Workspace-level locks would unnecessarily block unrelated repositories.
- Never let the model write to Supabase directly. The model emits JSON; the runner validates and writes using the service role.
- Store and enforce schedule/budget windows using the workspace IANA timezone, while persisting timestamps in UTC.

---

## 1. Goals & Non-Goals

### Goals

- Improve every enabled customer repository over time with low-founder-effort discovery and one-click approval for fixes.
- Reuse the existing orchestrator process, BullMQ/Redis, Supabase, GitHub App installation tokens, agent VPS provisioning, and PR review flow.
- Let each workspace owner control enablement, schedule, protected paths, spec paths, and budget per repository and capability.
- Default discovery agents on for enabled repositories. Keep implementation agents off unless manually triggered or explicitly opted into.
- Produce auditable findings with source lines, evidence paths, confidence, run history, and links to implementation tasks/PRs.

### Non-Goals

- No cross-workspace maintenance runs in v1.
- No dedicated maintenance VPSes or new IaC in v1.
- No direct merge automation. PRs still require founder/human review before merge.
- No broad "code cleanup" agent in v1. Ghost code and general doc drift can be future capability definitions.
- No support for arbitrary log vendors in v1. Sentry is the first runtime source.

---

## 2. Architectural Decisions

### AD-0. Product Model: Agents, Capabilities, and Projects

The UI must distinguish three concepts:

- **Agents:** user-managed AI workers/employees backed by VPS compute. These are the existing `agents` rows and VPS cards. Users can create, delete, assign repositories/projects, and monitor online/offline status.
- **Capabilities / Skills:** product features that an agent can use, such as Spec Coverage, Bug Discovery, Spec Implementation, and Bug Fix Implementation. A capability is a profile/prompt/tooling/hook/output-schema package, optionally composed from lower-level Claude Skills.
- **Projects / Repositories:** the work context assigned to agents. A repository is the concrete execution target for a capability run.

V1 built-in maintenance capabilities are globally available to every provisioned agent by default. Their **execution policy** is configured per repository: enabled/disabled, schedule, budget, spec paths, protected paths, and auto-implementation rules.

A scheduled capability run should execute once per due repository, on one selected online agent that:

1. is assigned to that repository/project,
2. has the requested capability available,
3. is online,
4. can acquire the repository mutation/read lock.

It should not fan out to every VPS by default.

Capability cards should show which agent executed the last run (`agent_runs.runner_agent_id`) and whether an eligible online agent is available for the selected repository.

**Why:** one VPS per capability would make default-on discovery expensive and confusing. It would also duplicate idle compute for every workspace/repository. The right product model is "capabilities run on your existing agents", with an optional future setting for dedicated capability runners if a customer needs isolation.

Future vertical/customer-defined skills should be assignable at the agent level. For example, a customer could create a "Frontend Agent" with design-system skills and a "Security Agent" with security-review skills, then assign each agent to different projects. The v1 maintenance capabilities are the generic default library that every agent starts with.

### AD-1. Reuse Existing Agent VPSes; Select by Repository

Robin.dev already provisions agent VPSes from rows in `agents`, and repositories are assigned through `agent_repositories`. A maintenance run targets one `repository_id`; the scheduler selects an online agent assigned to that repository from `agents_with_status`.

**Why:** this matches the current data model and avoids assuming exactly one VPS per workspace. Workspaces with multiple repositories can run maintenance independently per repo.

### AD-2. Use a Dedicated Maintenance Queue, Not `task.worker.ts` Job Types

Add a BullMQ queue named `maintenance-agents` and an agent-side worker:

- `apps/orchestrator/src/queues/maintenance.queue.ts`
- `apps/orchestrator/src/workers/maintenance.worker.ts`
- `apps/orchestrator/src/workers/maintenance-agent.runner.ts`

This runs inside the existing orchestrator process on agent VPSes. It uses the same Redis and deployment footprint as current task and bugfix workers.

**Why:** current task jobs use `JobPayload` and the BullMQ job name `tasks`; there is no reliable `job.type` dispatcher. A dedicated queue keeps payloads type-safe and avoids polluting task lifecycle semantics for read-only discovery runs.

### AD-3. Keep Implementation Runs Attached to Tasks

Every implementation run creates or links a `tasks` row:

- `tasks.source_finding_type = 'spec' | 'bug'`
- `tasks.source_finding_id = <finding id>`
- `tasks.repository_id = <finding repository>`

The maintenance worker persists task events, artifacts, status, and PR URLs using the same conventions as `task.worker.ts`.

**Why:** findings need an inbox lifecycle, but PR-producing work should remain visible in the existing task/PR review flow.

### AD-4. Profiles Live in Source Control

Profile bundles are checked into:

```text
apps/orchestrator/profiles/<agent-type>/
```

On provisioned VPSes they are available through the orchestrator app checkout:

```text
/opt/robin/app/apps/orchestrator/profiles/<agent-type>/
```

The existing startup/self-update path already refreshes `/opt/robin/app`, so no separate rsync step is required.

Profile bundle shape:

```text
system_prompt.md
allowed_tools.json
mcp_config.template.json
output_schema.json
hooks/
```

### AD-5. Discovery and Implementation Are Two Stages

Discovery agents only emit structured output. The runner validates and writes rows to `spec_findings` or `bug_findings`. Discovery agents never branch, commit, push, open PRs, or create tasks.

Implementation agents only run from approved findings or explicit auto-implementation rules.

**Why:** false positives are the dominant operational risk. Separating discovery from implementation gives founders a review gate and lets us tune discovery cheaply.

### AD-6. Capability Assignment Is Agent-Scoped; Execution Policy Is Repository-Scoped

There are two related but distinct configuration layers:

- **Capability assignment:** which agents have which skills/capabilities available. In v1, all built-in maintenance capabilities are available to every active agent by default.
- **Execution policy:** where and when a capability runs, with what budget and guardrails. This is repository-scoped in v1 because Spec Coverage and Bug Discovery inspect a concrete codebase.

`workspace_capability_configs` stores the execution policy and is scoped by:

```text
workspace_id + repository_id + capability_definition_id
```

This allows one repository to run Spec Coverage every 6 hours while another runs only during business windows.

Future vertical skills can add an `agent_capability_assignments` table if customers need to attach or remove skills per agent:

```sql
CREATE TABLE agent_capability_assignments (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  workspace_id uuid NOT NULL REFERENCES workspaces(id) ON DELETE CASCADE,
  agent_id uuid NOT NULL REFERENCES agents(id) ON DELETE CASCADE,
  capability_definition_id text NOT NULL REFERENCES capability_definitions(id),
  enabled boolean NOT NULL DEFAULT true,
  config jsonb NOT NULL DEFAULT '{}'::jsonb,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE(agent_id, capability_definition_id)
);
```

This table is not required for the v1 generic maintenance capabilities unless we want per-agent skill toggles immediately.

### AD-7. Serialize All Mutating Work by Repository Working Tree

V1 uses Redis locks per repository:

- discovery: `lock:repository:<repository_id>:maintenance`
- implementation: `lock:repository:<repository_id>:impl`

Implementation maintenance jobs must share the same repository-level mutation gate as normal task execution and sprint execution. A `spec_impl` or `bug_impl` run must never mutate `/home/agent/repos/<repository_id>` while a normal task, sprint task, or existing bugfix-pipeline job is mutating the same repository.

Discovery may run in parallel across different repositories, but not concurrently on the same repository in v1 unless the runner uses an isolated `git worktree` or temporary clone for that discovery run.

**Why:** the existing product already serializes sprint work per repository. Maintenance implementation must participate in that same constraint so founders can keep writing tasks and launching sprints exactly as before. Even read-only model tools still require runner-side `git fetch`, checkout, and worktree preparation; same-repo parallelism is not worth the initial race risk.

### AD-8. The Model Does Not Get Database Write Credentials

The runner invokes Claude with repo and MCP context. Claude emits JSON as the final output. The runner validates, dedupes, writes Supabase rows, updates tasks, and emits events.

**Why:** service-role Supabase credentials are global, not workspace-scoped. Keeping DB writes in runner code makes workspace constraints enforceable.

---

## 3. Database Schema

### 3.1 Existing Table Changes

#### `workspaces`

Schedules and daily budgets need a stable timezone.

```sql
ALTER TABLE workspaces
  ADD COLUMN IF NOT EXISTS timezone text NOT NULL DEFAULT 'UTC';

ALTER TABLE workspaces
  ADD CONSTRAINT workspaces_timezone_not_empty CHECK (length(trim(timezone)) > 0);
```

`timezone` must be an IANA timezone string such as `Europe/Rome` or `America/New_York`. Validate in application code with `Intl.supportedValuesOf('timeZone')` when available.

#### `tasks`

Implementation findings need a durable link back to the finding and a persisted plan.

```sql
ALTER TABLE tasks
  ADD COLUMN IF NOT EXISTS source_finding_type text
    CHECK (source_finding_type IS NULL OR source_finding_type IN ('spec', 'bug')),
  ADD COLUMN IF NOT EXISTS source_finding_id uuid,
  ADD COLUMN IF NOT EXISTS plan_json jsonb,
  ADD COLUMN IF NOT EXISTS tokens_used int NOT NULL DEFAULT 0,
  ADD COLUMN IF NOT EXISTS cost_usd numeric(10,4) NOT NULL DEFAULT 0;

CREATE INDEX IF NOT EXISTS idx_tasks_source_finding
  ON tasks(source_finding_type, source_finding_id)
  WHERE source_finding_type IS NOT NULL AND source_finding_id IS NOT NULL;
```

`source_finding_id` is intentionally polymorphic because it can point to either `spec_findings` or `bug_findings`.

### 3.2 New Tables

#### `capability_definitions`

Catalog of available maintenance capability types. Seeded by migration; workspace users can read but not edit.

```sql
CREATE TABLE capability_definitions (
  id text PRIMARY KEY,                  -- spec_discovery, spec_impl, bug_discovery, bug_impl
  display_name text NOT NULL,
  description text NOT NULL,
  kind text NOT NULL CHECK (kind IN ('discovery', 'implementation')),
  default_enabled boolean NOT NULL,
  default_schedule jsonb NOT NULL,
  daily_token_budget_default int NOT NULL CHECK (daily_token_budget_default > 0),
  per_run_token_cap_default int NOT NULL CHECK (per_run_token_cap_default > 0),
  profile_path text NOT NULL,           -- apps/orchestrator/profiles/spec-discovery
  created_at timestamptz NOT NULL DEFAULT now()
);
```

#### `workspace_capability_configs`

Per-repository maintenance configuration.

```sql
CREATE TABLE workspace_capability_configs (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  workspace_id uuid NOT NULL REFERENCES workspaces(id) ON DELETE CASCADE,
  repository_id uuid NOT NULL REFERENCES repositories(id) ON DELETE CASCADE,
  capability_definition_id text NOT NULL REFERENCES capability_definitions(id),
  enabled boolean NOT NULL,
  schedule jsonb NOT NULL,
  daily_token_budget int NOT NULL CHECK (daily_token_budget > 0),
  per_run_token_cap int NOT NULL CHECK (per_run_token_cap > 0),

  -- Implementation controls. Used only when capability_definition.kind = implementation.
  auto_implement boolean NOT NULL DEFAULT false,
  auto_implement_min_confidence numeric(3,2)
    CHECK (auto_implement_min_confidence IS NULL OR auto_implement_min_confidence BETWEEN 0 AND 1),

  -- Guardrails and source config.
  protected_paths text[] NOT NULL DEFAULT ARRAY[
    '.env*',
    'supabase/migrations/**',
    '.github/workflows/**'
  ]::text[],
  spec_paths text[] NOT NULL DEFAULT ARRAY['docs/spec.md']::text[],
  bug_noise_allowlist text[] NOT NULL DEFAULT ARRAY[]::text[],
  bug_source_config jsonb NOT NULL DEFAULT '{}'::jsonb,

  last_run_at timestamptz,
  next_run_at timestamptz,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),

  UNIQUE(workspace_id, repository_id, capability_definition_id)
);

CREATE INDEX idx_workspace_capability_configs_next_run
  ON workspace_capability_configs(next_run_at)
  WHERE enabled = true;

CREATE INDEX idx_workspace_capability_configs_repo
  ON workspace_capability_configs(workspace_id, repository_id);
```

`spec_paths` is a list of explicit repo-relative file paths, not globs. V1 UX supports up to 20 paths; default is `['docs/spec.md']`.

#### `agent_runs`

One row per scheduled, manual, webhook, or auto-triggered run.

```sql
CREATE TABLE agent_runs (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  workspace_id uuid NOT NULL REFERENCES workspaces(id) ON DELETE CASCADE,
  repository_id uuid NOT NULL REFERENCES repositories(id) ON DELETE CASCADE,
  workspace_capability_config_id uuid REFERENCES workspace_capability_configs(id) ON DELETE SET NULL,
  capability_definition_id text NOT NULL REFERENCES capability_definitions(id),
  runner_agent_id uuid REFERENCES agents(id) ON DELETE SET NULL,
  status text NOT NULL CHECK (
    status IN (
      'queued',
      'running',
      'completed',
      'failed',
      'cancelled',
      'budget_exceeded',
      'no_agent',
      'validation_failed',
      'skipped'
    )
  ),
  started_at timestamptz,
  completed_at timestamptz,
  tokens_used int NOT NULL DEFAULT 0,
  cost_usd numeric(10,4) NOT NULL DEFAULT 0,
  findings_created int NOT NULL DEFAULT 0,
  error_message text,
  trigger text NOT NULL CHECK (trigger IN ('schedule', 'manual', 'webhook', 'auto')),
  triggered_by text,                    -- Clerk user ID for manual actions
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX idx_agent_runs_workspace_recent
  ON agent_runs(workspace_id, created_at DESC);

CREATE INDEX idx_agent_runs_repo_recent
  ON agent_runs(repository_id, created_at DESC);

CREATE INDEX idx_agent_runs_budget
  ON agent_runs(workspace_id, repository_id, capability_definition_id, created_at);
```

#### `maintenance_events`

Append-only event stream for maintenance runs and findings. This is separate from `task_events` because discovery runs do not have a `task_id`.

```sql
CREATE TABLE maintenance_events (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  workspace_id uuid NOT NULL REFERENCES workspaces(id) ON DELETE CASCADE,
  repository_id uuid REFERENCES repositories(id) ON DELETE CASCADE,
  agent_run_id uuid REFERENCES agent_runs(id) ON DELETE SET NULL,
  event_type text NOT NULL CHECK (
    event_type IN (
      'agent.run.scheduled',
      'agent.run.started',
      'agent.run.completed',
      'agent.run.failed',
      'agent.run.budget_exceeded',
      'finding.created',
      'finding.triaged',
      'finding.auto_implemented'
    )
  ),
  actor_type text NOT NULL CHECK (actor_type IN ('agent', 'human', 'system')),
  actor_id text NOT NULL,
  payload jsonb NOT NULL DEFAULT '{}'::jsonb,
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX idx_maintenance_events_workspace_recent
  ON maintenance_events(workspace_id, created_at DESC);

CREATE INDEX idx_maintenance_events_run
  ON maintenance_events(agent_run_id)
  WHERE agent_run_id IS NOT NULL;
```

#### `spec_findings`

```sql
CREATE TABLE spec_findings (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  workspace_id uuid NOT NULL REFERENCES workspaces(id) ON DELETE CASCADE,
  repository_id uuid NOT NULL REFERENCES repositories(id) ON DELETE CASCADE,
  agent_run_id uuid NOT NULL REFERENCES agent_runs(id) ON DELETE CASCADE,
  requirement_text text NOT NULL,
  requirement_source_path text NOT NULL,
  requirement_source_line int,
  requirement_source_end_line int,
  status text NOT NULL CHECK (status IN ('implemented', 'partial', 'missing', 'drifted')),
  evidence_paths text[] NOT NULL DEFAULT ARRAY[]::text[],
  suggested_action text,
  confidence numeric(3,2) NOT NULL CHECK (confidence BETWEEN 0 AND 1),
  triage_state text NOT NULL DEFAULT 'pending'
    CHECK (triage_state IN ('pending', 'approved', 'rejected', 'snoozed', 'implemented')),
  triaged_by text,                       -- Clerk user ID
  triaged_at timestamptz,
  triage_note text,
  snoozed_until timestamptz,
  dedup_hash text NOT NULL,              -- sha256(repository_id || source path || source line || normalized requirement || status)
  task_id uuid REFERENCES tasks(id) ON DELETE SET NULL,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE(repository_id, dedup_hash)
);

CREATE INDEX idx_spec_findings_triage
  ON spec_findings(workspace_id, repository_id, triage_state);

CREATE INDEX idx_spec_findings_task
  ON spec_findings(task_id)
  WHERE task_id IS NOT NULL;
```

#### `bug_findings`

```sql
CREATE TABLE bug_findings (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  workspace_id uuid NOT NULL REFERENCES workspaces(id) ON DELETE CASCADE,
  repository_id uuid NOT NULL REFERENCES repositories(id) ON DELETE CASCADE,
  agent_run_id uuid NOT NULL REFERENCES agent_runs(id) ON DELETE CASCADE,
  title text NOT NULL,
  description text NOT NULL,
  severity text NOT NULL CHECK (severity IN ('P0', 'P1', 'P2', 'P3')),
  hypothesis text NOT NULL,
  repro_steps text,
  evidence jsonb NOT NULL,               -- { stack_trace?, log_lines?, code_excerpt?, sentry_issue_id?, commit_sha? }
  affected_paths text[] NOT NULL,
  suggested_fix_outline text,
  confidence numeric(3,2) NOT NULL CHECK (confidence BETWEEN 0 AND 1),
  source text NOT NULL CHECK (source IN ('sentry', 'static_analysis', 'commit_correlation')),
  source_ref text,                       -- e.g. Sentry issue ID/fingerprint
  external_issue_url text,
  triage_state text NOT NULL DEFAULT 'pending'
    CHECK (triage_state IN ('pending', 'approved', 'rejected', 'snoozed', 'implemented')),
  triaged_by text,                       -- Clerk user ID
  triaged_at timestamptz,
  triage_note text,
  snoozed_until timestamptz,
  dedup_hash text NOT NULL,
  task_id uuid REFERENCES tasks(id) ON DELETE SET NULL,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE(repository_id, dedup_hash)
);

CREATE INDEX idx_bug_findings_triage
  ON bug_findings(workspace_id, repository_id, triage_state);

CREATE INDEX idx_bug_findings_severity
  ON bug_findings(workspace_id, repository_id, severity, triage_state);

CREATE INDEX idx_bug_findings_source_ref
  ON bug_findings(repository_id, source, source_ref)
  WHERE source_ref IS NOT NULL;
```

### 3.3 Schedule Shape

```jsonc
// Always-on.
{ "mode": "always_on", "interval_minutes": 360 }

// Weekly windows evaluated in workspaces.timezone.
{
  "mode": "windows",
  "interval_minutes": 360,
  "windows": [
    { "weekday": "mon", "start": "09:00", "end": "18:00" },
    { "weekday": "tue", "start": "09:00", "end": "18:00" },
    { "weekday": "wed", "start": "09:00", "end": "18:00" },
    { "weekday": "thu", "start": "09:00", "end": "18:00" },
    { "weekday": "fri", "start": "09:00", "end": "16:00" }
  ]
}

// Disabled while preserving the user's config.
{ "mode": "disabled" }
```

Daily token budgets reset on the workspace-local calendar day. All timestamps remain stored as UTC `timestamptz`.

### 3.4 Bootstrap Configs

Configs are created when a repository is enabled, not when a workspace is created.

```sql
CREATE OR REPLACE FUNCTION bootstrap_repository_agent_configs()
RETURNS trigger AS $$
BEGIN
  INSERT INTO workspace_capability_configs (
    workspace_id,
    repository_id,
    capability_definition_id,
    enabled,
    schedule,
    daily_token_budget,
    per_run_token_cap,
    next_run_at
  )
  SELECT
    NEW.workspace_id,
    NEW.id,
    ad.id,
    ad.default_enabled,
    ad.default_schedule,
    ad.daily_token_budget_default,
    ad.per_run_token_cap_default,
    now() + ((random() * 30)::int || ' minutes')::interval
  FROM capability_definitions ad
  ON CONFLICT (workspace_id, repository_id, capability_definition_id) DO NOTHING;

  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER trg_bootstrap_repository_agent_configs
  AFTER INSERT ON repositories
  FOR EACH ROW
  WHEN (NEW.is_enabled = true)
  EXECUTE FUNCTION bootstrap_repository_agent_configs();
```

Backfill migration:

```sql
INSERT INTO workspace_capability_configs (
  workspace_id,
  repository_id,
  capability_definition_id,
  enabled,
  schedule,
  daily_token_budget,
  per_run_token_cap,
  next_run_at
)
SELECT
  r.workspace_id,
  r.id,
  ad.id,
  ad.default_enabled,
  ad.default_schedule,
  ad.daily_token_budget_default,
  ad.per_run_token_cap_default,
  now() + ((random() * 30)::int || ' minutes')::interval
FROM repositories r
CROSS JOIN capability_definitions ad
WHERE r.is_enabled = true
ON CONFLICT (workspace_id, repository_id, capability_definition_id) DO NOTHING;
```

### 3.5 RLS Policies

Use the existing `get_my_workspace_ids()` pattern from `docs/security.md`.

- `capability_definitions`: authenticated users can `SELECT`; no user writes.
- `workspace_capability_configs`: workspace members can `SELECT`; workspace owners can `UPDATE`.
- `spec_findings`, `bug_findings`, `agent_runs`, `maintenance_events`: workspace members can `SELECT`; workspace owners can triage/update findings; service role writes run output.

Do not reference `auth.users(id)` in these tables. The app uses Clerk user IDs stored as `text`.

For owner-only writes, add an owner helper instead of overloading `get_my_workspace_ids()`:

```sql
CREATE OR REPLACE FUNCTION get_my_owned_workspace_ids()
RETURNS SETOF uuid
LANGUAGE sql
SECURITY DEFINER
STABLE
AS $$
  SELECT workspace_id
  FROM workspace_members
  WHERE user_id = (auth.jwt() ->> 'sub')::text
    AND role = 'owner';
$$;
```

### 3.6 Realtime

Add `agent_runs`, `spec_findings`, `bug_findings`, and `maintenance_events` to Supabase Realtime publication if the inbox/run-history UI needs live updates.

---

## 4. The Four Agents

### 4.1 Spec Discovery Agent (`spec_discovery`)

**Goal.** Find configured spec requirements that are missing, partial, or drifted from implementation.

**Profile.** `apps/orchestrator/profiles/spec-discovery/`

- System prompt: read-only auditor; compare spec files to code; output structured findings only.
- Allowed tools: `Read`, `Grep`, `Glob`.
- Disallowed tools: `Edit`, `Write`, `Bash`.
- Hooks: tool allowlist enforcement.

**Inputs.**

- `workspace_capability_configs.spec_paths`, default `['docs/spec.md']`.
- Repository HEAD for `repository_id`.
- Existing `spec_findings` for dedup.

**Process.**

1. Runner validates that every `spec_path` is repo-relative, exists, and is not in `protected_paths`.
2. Runner invokes Claude with read-only tools and spec path context.
3. Claude extracts atomic requirements, each with source path and line span.
4. For each requirement, Claude identifies up to 5 implementation evidence paths using `Grep`/`Glob`/`Read`.
5. Claude classifies status as `implemented`, `partial`, `missing`, or `drifted`.
6. Claude emits JSON. Runner validates schema, source lines, confidence, evidence paths, protected paths, and max finding count.
7. Runner computes `dedup_hash` and inserts new pending `spec_findings`.

**Confidence rubric.**

- `1.00`: requirement is narrow, literal source span is valid, implementation evidence is direct.
- `0.70-0.90`: cross-file logic but evidence is concrete.
- `0.50-0.70`: requires inference about intent.
- `< 0.50`: runner drops the finding.

**Guardrails.**

- Max 50 surfaced findings per run.
- No writes, no shell commands, no PRs.
- Runner rejects findings whose `requirement_source_line` does not contain or anchor the claimed requirement.
- Runner rejects evidence paths matching `protected_paths`.

### 4.2 Spec Implementation Agent (`spec_impl`)

**Goal.** Implement one approved `spec_findings` row with tests and open a PR.

**Profile.** `apps/orchestrator/profiles/spec-impl/`

- System prompt: implement a single approved requirement; keep diff focused; write tests.
- Allowed tools: `Read`, `Grep`, `Glob`, `Edit`, `Write`, `Bash`.
- Hooks: write allowlist from approved plan + `protected_paths`.

**Inputs.**

- One `spec_findings` row with `triage_state = 'approved'`.
- Matching repository config and protected paths.
- Existing or newly-created `tasks` row linked to the finding.

**Process.**

1. UI approval creates a task if one does not already exist:
   - `type = 'feature'`
   - `repository_id = finding.repository_id`
   - `source_finding_type = 'spec'`
   - `source_finding_id = finding.id`
2. Runner acquires `lock:repository:<repository_id>:impl`.
3. Planning pass runs read-only. Claude returns:
   - file allowlist
   - test strategy
   - implementation summary per file
4. Runner persists the plan to `tasks.plan_json` and rejects plans touching protected paths.
5. Implementation pass runs with write hooks restricted to the plan allowlist.
6. Runner verifies:
   - branch name `feat/spec-<finding_id_short>-<slug>`
   - tests/typecheck/lint were attempted
   - PR URL exists
   - final changed files are a subset of the approved plan
   - diff size is within cap
7. Runner adds PR artifact and task events, sets task `in_review`, and updates finding to `implemented`.

**Auto trigger.**

Allowed only if all are true:

- implementation config `auto_implement = true`
- finding `confidence >= auto_implement_min_confidence`
- finding `status = 'missing'`
- planned change does not touch protected paths, dependency files, migrations, or workflow files
- repository mutation lock is available and no normal task/sprint job is active for the same repository

`drifted` findings never auto-implement in v1 because intent is ambiguous.

**Guardrails.**

- Single mutating job per repository across maintenance, normal task execution, sprint execution, and bugfix-pipeline jobs.
- Default protected paths include env files, migrations, and GitHub workflows.
- `package.json` dependency changes require the plan to explicitly include dependency changes and the PR body to justify them.
- Diff cap: 500 added lines. Larger changes fail as `needs_decomposition`; finding returns to `pending` with `triage_note` explaining the decomposition need.

### 4.3 Bug Discovery Agent (`bug_discovery`)

**Goal.** Surface real bugs grounded in Sentry evidence or high-confidence static analysis.

**Profile.** `apps/orchestrator/profiles/bug-discovery/`

- System prompt: evidence-first reasoning; distinguish root cause from symptom; conservative severity.
- Allowed tools: `Read`, `Grep`, `Glob`, plus configured Sentry MCP server.
- Disallowed tools: `Edit`, `Write`, `Bash`.

**V1 source decision.** Sentry is the only runtime provider in v1. Generic log providers are deferred. Static analysis is allowed but cannot produce P0/P1 findings.

**Inputs.**

- Sentry issues from the last 7 days when a Sentry MCP server is configured in `workspaces.mcp_config` or `bug_source_config`.
- Last 30 commits, collected by the runner and passed as context.
- Repository HEAD.
- Existing `bug_findings` and `bug_noise_allowlist`.

**Process.**

1. Runtime pass: pull Sentry issues, group by fingerprint/source ref, trace stack frames to source files, classify severity.
2. Static pass: scan for high-confidence bug patterns. Cap static-only findings at P2.
3. Commit correlation: compare Sentry first-seen timestamps with recent commits; add confidence only when file/function overlap is concrete.
4. Dedupe against existing `bug_findings` by source ref and dedup hash.
5. Dedupe against GitHub Issues when the GitHub App installation has Issues read permission.
6. Runner validates and inserts pending `bug_findings`.

**GitHub issue dedup decision.**

Use app-layer title similarity:

- exact normalized title match, or
- token cosine similarity `>= 0.82`, or
- same Sentry source ref present in issue title/body.

If the GitHub App lacks Issues permission, skip external issue dedup and rely on `bug_findings` dedup.

**Severity rubric.**

- `P0`: production data loss, auth bypass, or payment failure. Requires Sentry/runtime evidence.
- `P1`: recurring production user-facing error affecting material usage. Requires Sentry/runtime evidence.
- `P2`: confirmed defect with limited blast radius. Static-only findings cap here.
- `P3`: plausible bug or code smell with weak/no observed impact.

**Guardrails.**

- P0/P1 requires `evidence.stack_trace` or equivalent Sentry issue evidence.
- Static-only findings with `confidence < 0.75` are dropped.
- Max 30 surfaced findings per run.
- Fingerprints in `bug_noise_allowlist` are ignored.

### 4.4 Bug Fix Implementation Agent (`bug_impl`)

**Goal.** Fix one approved `bug_findings` row with a regression test and open a PR.

**Profile.** `apps/orchestrator/profiles/bug-impl/`

- System prompt: reproduce first; root cause over symptom; smallest safe fix.
- Allowed tools: `Read`, `Grep`, `Glob`, `Edit`, `Write`, `Bash`.
- Hooks: protected path enforcement and regression-test preservation.

**Inputs.**

- One `bug_findings` row with `triage_state = 'approved'`.
- Existing or newly-created linked task.

**Process.**

1. UI approval creates a task if one does not already exist:
   - `type = 'bug'`
   - `priority` mapped from severity
   - `repository_id = finding.repository_id`
   - `source_finding_type = 'bug'`
   - `source_finding_id = finding.id`
2. Runner acquires `lock:repository:<repository_id>:impl`.
3. Reproduction pass requires a failing test or a documented `cannot_reproduce` result.
4. Runner snapshots the regression test diff.
5. Implementation pass applies the smallest fix.
6. Runner verifies:
   - regression test still exists
   - assertion count did not decrease
   - target test passes
   - relevant suite/lint/typecheck were attempted
   - PR URL exists
7. Runner adds PR artifact and task events, sets task `in_review`, and updates finding to `implemented`.

**Auto trigger.**

- P0/P1: manual approval only.
- P2/P3: manual approval, or auto if config `auto_implement = true`, confidence threshold passes, and the repository mutation lock is available.

**Guardrails.**

- No regression test means no PR, unless the run exits `cannot_reproduce`.
- Max 3 non-test files changed. Larger changes fail as `needs_design`.
- Full-suite failure that was not present before the fix fails the run.

---

## 5. Scheduling System

### 5.1 Scheduler Service

New module:

```text
apps/orchestrator/src/scheduler/maintenance-scheduler.ts
```

Runs only in control-plane mode.

Loop every 60 seconds:

1. Query due configs:
   ```sql
   SELECT ...
   FROM workspace_capability_configs
   WHERE enabled = true
     AND next_run_at <= now()
   FOR UPDATE SKIP LOCKED
   ```
2. Join `workspaces.timezone`, `repositories`, and `capability_definitions`.
3. Skip disabled repositories.
4. Evaluate active windows in workspace timezone.
5. Compute daily budget using workspace-local day boundaries converted to UTC.
6. Select an online runner agent assigned to the repository.
7. Insert `agent_runs(status = 'queued')`.
8. Enqueue `MaintenanceJobPayload` on `maintenance-agents`.
9. Emit `agent.run.scheduled`.
10. Advance `next_run_at` with jitter, clamped to the next active window.

If no online agent is available, create `agent_runs(status = 'no_agent')`, emit a run event, and advance `next_run_at` by a short retry interval (default 30 minutes).

### 5.2 Active Window Evaluation

Helper module:

```text
apps/orchestrator/src/scheduler/window.ts
```

Pure functions:

- `isInsideWindow(schedule, nowUtc, timezone): boolean`
- `nextRunAt(schedule, nowUtc, timezone): Date`
- `localDayBoundsUtc(nowUtc, timezone): { startUtc: Date; endUtc: Date }`

Unit tests must cover DST transitions.

### 5.3 Manual Triggers

"Run now" bypasses schedule windows but still enforces:

- user must be workspace owner
- config must exist for repository + capability definition
- repository must be enabled
- daily budget must have remaining capacity
- online runner agent must be available

Manual runs set `trigger = 'manual'` and `triggered_by = <Clerk user id>`.

### 5.4 Webhook Triggers

- Spec discovery: GitHub `push` webhook touching any configured `spec_paths`.
- Bug discovery: Sentry webhook for a new issue/fingerprint or major regression.

Webhook-triggered runs skip active-window checks by default only for bug P0/P1 signals. Other webhook runs respect active windows.

---

## 6. Worker Integration

### 6.1 Queue and Payload

New shared type:

```typescript
export type MaintenanceJobPayload = {
  agentRunId: string;
  workspaceId: string;
  repositoryId: string;
  runnerAgentId: string;
  capabilityDefinitionId: "spec_discovery" | "spec_impl" | "bug_discovery" | "bug_impl";
  workspaceCapabilityConfigId: string;
  trigger: "schedule" | "manual" | "webhook" | "auto";
  findingId?: string;
};
```

Queue:

```text
maintenance-agents
```

Agent VPS startup in `apps/orchestrator/src/index.ts` adds `createMaintenanceWorker()` next to `createWorker()` and `createBugfixWorker()`.

### 6.2 Runner Flow

`runMaintenanceAgent`:

1. Load `agent_runs`, config, repository, workspace, and capability definition.
2. Verify `runnerAgentId === AGENT_ID`.
3. Set `agent_runs.status = 'running'`, `started_at = now()`.
4. Acquire the proper Redis lock.
5. Prepare repository at `/home/agent/repos/<repository_id>`:
   - refresh GitHub App installation token
   - clone if missing
   - fetch + checkout default branch for discovery
   - create implementation branch for impl runs
6. Load profile bundle from `capability_definitions.profile_path`.
7. Render MCP config from profile template + workspace config. Sentry is included only when configured.
8. Invoke Claude through the Claude Agent SDK where possible, matching the existing `bugfix.worker.ts` pattern.
9. Parse final JSON output and validate against `output_schema.json`.
10. Persist findings or PR/task result.
11. Update `agent_runs` with status, tokens, cost, findings count, error.
12. Release locks and set agent status idle/error.

### 6.3 Profile Bundle Format

```text
apps/orchestrator/profiles/
├── spec-discovery/
│   ├── system_prompt.md
│   ├── allowed_tools.json
│   ├── mcp_config.template.json
│   ├── output_schema.json
│   └── hooks/
│       └── validate-tool-use.sh
├── spec-impl/
│   └── ...
├── bug-discovery/
│   └── ...
└── bug-impl/
    └── ...
```

### 6.4 Output Contracts

Discovery output:

```json
{
  "findings": [],
  "summary": "string",
  "tokens_used": 0,
  "cost_usd": 0
}
```

Implementation output:

```json
{
  "pr_url": "string",
  "branch": "string",
  "files_changed": ["string"],
  "tests_added": ["string"],
  "tests_run": ["string"],
  "tokens_used": 0,
  "cost_usd": 0
}
```

Invalid JSON, schema mismatch, protected path violations, or missing required evidence marks the run `validation_failed`.

---

## 7. Web App Changes

The current app uses `apps/web/app/(dashboard)` routes rather than `/workspace/[id]` page routes. Keep that pattern.

The navigation should keep **Agents** and **Maintenance** separate:

- **Agents** = AI workers/employees backed by VPS compute. This is where users create/delete agents, assign repositories/projects, inspect compute health, and eventually manage agent-specific skills.
- **Maintenance** = built-in generic capabilities. This is where users configure Spec Coverage, Bug Discovery, Spec Implementation, and Bug Fix Implementation per repository/project.

### 7.1 Pages

- `apps/web/app/(dashboard)/maintenance/page.tsx` — maintenance overview, repository selector, agent cards, schedules.
- `apps/web/app/(dashboard)/maintenance/inbox/page.tsx` — unified triage queue.
- `apps/web/app/(dashboard)/maintenance/runs/page.tsx` — run history with repository and agent filters.

The existing `apps/web/app/(dashboard)/agents/page.tsx` should remain focused on provisioned compute agents/VPSes.

Maintenance capability cards should not look like provisioned agent/VPS cards. They should show:

- capability definition name, e.g. `Spec Coverage`
- repository scope
- enabled/disabled state
- schedule and budget
- last run result
- last runner VPS, e.g. `Ran on Agent A`
- availability state, e.g. `No online runner assigned to this repository`

### 7.2 When Users Need More Agents

Users create more agents/VPSes when they need more compute capacity or isolation, not when they simply want another capability.

Good reasons to create another agent:

- run work in parallel across multiple repositories
- keep sprint/task latency low while maintenance runs in the background
- isolate a high-risk or high-cost repository
- have separate agents for production-critical work vs backlog/maintenance
- specialize agents with different skill sets, e.g. frontend, backend, security, QA
- add redundancy so scheduled capabilities still run if one VPS is offline

Good reasons to enable/configure a capability instead:

- add Spec Coverage, Bug Discovery, or implementation automation to an existing repository
- change schedule, budget, protected paths, or auto-implementation settings
- run a one-off maintenance scan
- tune what the existing agent pool does without adding compute cost
- give an existing agent a new generic skill when no extra compute or specialization is needed

V1 capabilities are not just raw Claude Skills. A capability is a product-level package: profile prompt, allowed tools, hooks, output schema, scheduler settings, DB config, and UI controls. Claude Skills can be one implementation ingredient inside a capability.

The built-in maintenance capabilities are generic defaults shared by all agents. Future vertical capabilities can be installed per agent, so the product can support both shared company-wide skills and agent/project-specific specialization.

### 7.3 API Routes

- `GET /api/maintenance/configs?repository_id=...`
- `PATCH /api/maintenance/configs/[configId]`
- `POST /api/maintenance/configs/[configId]/run-now`
- `GET /api/maintenance/inbox?repository_id=...&type=...&state=...`
- `POST /api/maintenance/findings/[type]/[id]/triage`
- `GET /api/maintenance/runs?repository_id=...&capability_definition_id=...`

Triage route actions:

- `approve`
- `reject`
- `snooze`
- `mark_implemented`

Approval of implementation findings enqueues a `spec_impl` or `bug_impl` maintenance job and creates a linked task if needed.

### 7.4 UI Components

- `<MaintenanceCapabilityCard>` — capability definition, repository, enabled state, last run, next run, daily budget.
- `<ScheduleEditor>` — always-on/windows/disabled, interval, timezone display.
- `<SpecPathsEditor>` — list editor for repo-relative spec files.
- `<ProtectedPathsEditor>` — guarded path list.
- `<FindingCard>` — summary, confidence, source/evidence, approve/reject/snooze.
- `<RunHistoryTable>` — status, trigger, repository, runner agent, token usage, findings count.

---

## 8. Event Catalog Additions

Add to `docs/events.md` and `packages/shared-types/src/index.ts`.

These events are written to `maintenance_events`. Implementation runs also write the normal task-scoped events to `task_events` after a linked task exists.

| Event | Payload | Producer | Consumer |
|---|---|---|---|
| `agent.run.scheduled` | `{ workspace_id, repository_id, capability_definition_id, agent_run_id }` | scheduler | analytics |
| `agent.run.started` | `{ agent_run_id, runner_agent_id }` | worker | UI |
| `agent.run.completed` | `{ agent_run_id, findings_created, tokens_used, cost_usd }` | worker | UI, analytics |
| `agent.run.failed` | `{ agent_run_id, error }` | worker | alerts |
| `agent.run.budget_exceeded` | `{ agent_run_id, budget, used }` | scheduler | UI |
| `finding.created` | `{ finding_id, type, repository_id, severity?, confidence }` | worker | UI inbox |
| `finding.triaged` | `{ finding_id, type, new_state, by_user_id }` | web | analytics |
| `finding.auto_implemented` | `{ finding_id, type, task_id }` | scheduler | UI |

---

## 9. Seed Data

```sql
INSERT INTO capability_definitions (
  id,
  display_name,
  description,
  kind,
  default_enabled,
  default_schedule,
  daily_token_budget_default,
  per_run_token_cap_default,
  profile_path
) VALUES
('spec_discovery',
  'Spec Coverage',
  'Compares configured spec files to the repository and surfaces missing or drifted requirements.',
  'discovery',
  true,
  '{"mode": "always_on", "interval_minutes": 360}',
  2000000,
  500000,
  'apps/orchestrator/profiles/spec-discovery'),

('spec_impl',
  'Spec Implementation',
  'Implements approved spec findings with tests and opens a PR.',
  'implementation',
  false,
  '{"mode": "always_on", "interval_minutes": 60}',
  5000000,
  1000000,
  'apps/orchestrator/profiles/spec-impl'),

('bug_discovery',
  'Bug Discovery',
  'Finds bugs using Sentry and high-confidence static analysis.',
  'discovery',
  true,
  '{"mode": "always_on", "interval_minutes": 720}',
  2000000,
  500000,
  'apps/orchestrator/profiles/bug-discovery'),

('bug_impl',
  'Bug Fix Implementation',
  'Fixes approved bug findings with a regression test and opens a PR.',
  'implementation',
  false,
  '{"mode": "always_on", "interval_minutes": 60}',
  3000000,
  500000,
  'apps/orchestrator/profiles/bug-impl')
ON CONFLICT (id) DO UPDATE SET
  display_name = EXCLUDED.display_name,
  description = EXCLUDED.description,
  kind = EXCLUDED.kind,
  default_enabled = EXCLUDED.default_enabled,
  default_schedule = EXCLUDED.default_schedule,
  daily_token_budget_default = EXCLUDED.daily_token_budget_default,
  per_run_token_cap_default = EXCLUDED.per_run_token_cap_default,
  profile_path = EXCLUDED.profile_path;
```

---

## 10. Resolved Decisions

1. **Spec format:** support a list of explicit repo-relative paths. Default `['docs/spec.md']`. No globs in v1.
2. **Log source:** Sentry only in v1. Generic logs are deferred until there is a concrete provider and credential model.
3. **GitHub issue dedup:** exact normalized title, token cosine `>= 0.82`, or same Sentry source ref. Skip when the GitHub App lacks Issues permission.
4. **Budget reset window:** workspace-local calendar day from `workspaces.timezone`; stored and queried as UTC ranges.
5. **Discovery concurrency:** parallel across different repositories; serialized per repository in v1.
6. **Notifications:** defer Slack/email digests. V1 shows findings in the in-app maintenance inbox only.

No open product/architecture questions remain for v1 implementation.

---

## 11. Rollout Plan

### Phase 0 — Foundations

- Migrations: table changes, new tables, RLS, `maintenance_events`, seed data, backfill.
- Shared TypeScript types for configs, runs, findings, and `MaintenanceJobPayload`.
- Maintenance queue + dry-run scheduler with no Claude execution.
- Profile bundle skeletons.

### Phase 1 — Spec Discovery

- `spec_discovery` runner and validators.
- Maintenance overview page, config editor, and read-only inbox.
- Dogfood on Robin.dev repository.
- Tune confidence thresholds and dedup.

### Phase 2 — Triage + Bug Discovery

- Triage actions.
- `bug_discovery` with Sentry MCP integration.
- GitHub issue dedup when permission is available.

### Phase 3 — Implementation Agents

- `spec_impl` two-pass plan/implementation runner.
- `bug_impl` reproduction-first runner.
- Task/PR event integration.
- Shared repository mutation locks, token/cost enforcement, validation failure handling.

### Phase 4 — Customer Rollout

- Feature flag per workspace.
- Onboarding panel on Maintenance page.
- Dashboards for false-positive rate, PR merge rate, and cost per merged PR.

### Kill Switch Criteria

Monitor weekly after customer rollout:

- Discovery false-positive rate `(rejected / total)` > 30%.
- Implementation PR merge rate `(merged / opened)` < 50%.
- Cost per merged PR > $20.

Any threshold breach for two consecutive weeks disables the relevant capability definition globally until review.

---

## 12. Security & Isolation

- Runner uses the existing Supabase service role, but Claude never receives it.
- All runner writes include `workspace_id` and `repository_id` from the trusted BullMQ payload and freshly loaded DB rows.
- Git access uses fresh GitHub App installation tokens, not stored PATs.
- Sentry credentials are only exposed through the configured MCP server for `bug_discovery`.
- Profile bundles are committed source files and reviewed like code.
- Discovery profiles have no `Bash`, `Edit`, or `Write`.
- Implementation write hooks enforce approved plan paths and `protected_paths`.
- Runner performs final diff validation before pushing/accepting PR output.
- Shared repository locks prevent concurrent mutation of the same working tree by maintenance jobs, normal tasks, sprint tasks, and bugfix-pipeline jobs.

---

## 13. Implementation Checklist

- Add migrations and RLS tests.
- Add shared types in `packages/shared-types/src/index.ts`.
- Add `maintenance.queue.ts`, `maintenance.worker.ts`, `maintenance-agent.runner.ts`.
- Start maintenance scheduler only when `CONTROL_PLANE=true`.
- Start maintenance worker only on agent VPS mode.
- Add profile bundles under `apps/orchestrator/profiles/`.
- Add validation schemas for each profile output.
- Add web API routes and dashboard pages.
- Add event type definitions and docs.
- Add unit tests for scheduler windows, budget day bounds, dedup hashes, and validators.
- Add integration test for approve finding -> task -> maintenance impl job -> PR artifact update.

---

## 14. Cross-References

- Existing architecture: `docs/architecture.md`
- DB schema conventions: `docs/schema.md`
- RLS pattern: `docs/security.md`
- Event catalog: `docs/events.md`
- Agent provisioning: `apps/orchestrator/src/workers/agent.provisioning.worker.ts`
- Worker entrypoint: `apps/orchestrator/src/index.ts`
- Existing task worker: `apps/orchestrator/src/workers/task.worker.ts`
- Existing bugfix SDK pattern: `apps/orchestrator/src/workers/bugfix.worker.ts`
- Current agent DB helpers: `apps/web/lib/db/agents.ts`
