# Orchestrator ↔ Agent Interface Contract

**Last updated:** 2026-02-26

---

## Overview

The orchestrator and the agent (Claude Code) communicate through a well-defined
contract. The orchestrator knows nothing about how Claude Code works internally.
The agent knows nothing about BullMQ. The boundary between them is this document.

```
┌────────────────────┐       JobPayload        ┌──────────────────┐
│    Orchestrator    │ ───────────────────────► │  ClaudeRunner    │
│    (BullMQ Worker) │                          │  (child_process) │
│                    │ ◄─────────────────────── │                  │
└────────────────────┘   JobResult | JobError   └──────────────────┘
                                                        │
                                                        ▼
                                               Claude Code (headless)
                                               working on git repo
```

---

## JobPayload

Passed from the queue to the agent runner. Contains everything the agent needs
to execute the task — no further DB lookups required during execution.

```typescript
type JobPayload = {
  // Identity
  taskId: string           // UUID — Supabase tasks.id
  workspaceId: string      // UUID — for Supabase writes

  // Repository
  repositoryUrl: string    // https://github.com/org/repo.git
  branch: string           // working branch (e.g. "feat/task-abc123")
  repositoryPath: string   // absolute path on VPS: /home/agent/repos/<repo-name>

  // Task specification
  taskTitle: string        // short title shown in logs
  taskDescription: string  // full description — written to TASK.md for Claude
  taskType: TaskType       // "bug" | "feature" | "docs" | "refactor" | "chore"
  priority: TaskPriority   // "low" | "medium" | "high" | "urgent"

  // Execution config
  timeoutMinutes: number   // max execution time; default varies by taskType
  claudeMdPath: string     // path to CLAUDE.md in the repo (e.g. "CLAUDE.md")
}
```

**Timeout defaults by task type:**

| TaskType | Default timeout |
|---|---|
| `chore` | 15 min |
| `docs` | 20 min |
| `bug` | 30 min |
| `refactor` | 45 min |
| `feature` | 60 min |

---

## JobResult

Returned by `ClaudeRunner.run()` on success.

```typescript
type JobResult = {
  status: 'completed' | 'in_review' | 'blocked'

  // PR information (present when status = 'in_review')
  prUrl?: string           // https://github.com/org/repo/pull/123
  prNumber?: number

  // Commit information
  commitSha?: string       // last commit pushed by the agent
  commitBranch?: string    // branch the commit was pushed to

  // Execution metrics
  startedAt: string        // ISO timestamp
  completedAt: string      // ISO timestamp
  durationSeconds: number

  // Blocking reason (present when status = 'blocked')
  blockedReason?: string   // what question/ambiguity blocked the agent

  // Raw output (truncated to last 10k chars for storage)
  stdoutTail: string
}
```

---

## JobError

Thrown by `ClaudeRunner.run()` on failure. All `JobError` subclasses carry
a `retryable` flag that BullMQ uses to decide whether to retry.

```typescript
abstract class JobError extends Error {
  abstract readonly retryable: boolean
  abstract readonly code: string
  readonly phase?: string   // which phase the error occurred in
}

// Transient — will likely succeed on retry
class AgentTimeoutError extends JobError {
  readonly retryable = true
  readonly code = 'AGENT_TIMEOUT'
}

class APIRateLimitError extends JobError {
  readonly retryable = true
  readonly code = 'API_RATE_LIMIT'
}

class NetworkError extends JobError {
  readonly retryable = true
  readonly code = 'NETWORK_ERROR'
}

// Permanent — retry will not help
class AgentBlockedError extends JobError {
  readonly retryable = false
  readonly code = 'AGENT_BLOCKED'
  readonly question: string   // what the agent needs clarification on
}

class InsufficientSpecError extends JobError {
  readonly retryable = false
  readonly code = 'INSUFFICIENT_SPEC'
}

class RepositoryAccessError extends JobError {
  readonly retryable = false
  readonly code = 'REPO_ACCESS_ERROR'
}
```

---

## TASK.md

`ClaudeRunner` writes a `TASK.md` file at the repository root before launching
Claude Code. This file is the agent's "brief" — it reads it first.

```markdown
# Task: [taskTitle]

**Type:** [taskType]
**Priority:** [priority]
**Task ID:** [taskId]

## Description

[taskDescription]

## Acceptance Criteria

[Derived from taskDescription — ClaudeRunner extracts or Claude infers these]

## Notes

- Create a new branch named `feat/[taskId]` if not already on one
- Open a PR when the work is complete
- If blocked, write a `BLOCKED.md` file with your question and stop
```

---

## Agent State Machine

```
                    ┌─────────────────────────────────────────┐
                    │                                          │
                    ▼                                          │ (job completed)
              ┌──────────┐   job claimed   ┌────────────┐     │
              │   idle   │ ──────────────► │ claiming   │     │
              └──────────┘                 └────────────┘     │
                    ▲                            │             │
                    │                            │ repo ready  │
                    │                            ▼             │
                    │                     ┌────────────┐       │
              error │                     │ executing  │───────┘
              resolved                    └────────────┘
                    │                            │
                    │              ┌─────────────┼──────────────┐
                    │              │             │              │
                    │              ▼             ▼              ▼
                    │        ┌─────────┐  ┌──────────┐  ┌──────────┐
                    └────────│  error  │  │ blocked  │  │reporting │
                             └─────────┘  └──────────┘  └──────────┘
                                               │               │
                                               │ human input   │ PR opened
                                               ▼               ▼
                                          ┌─────────┐    ┌──────────┐
                                          │ claiming│    │  idle    │
                                          └─────────┘    └──────────┘
```

**State definitions:**

| State | Meaning | Supabase `agent_status.status` |
|---|---|---|
| `idle` | No active job, ready to receive | `idle` |
| `claiming` | Picked up a job, setting up repo | `busy` |
| `executing` | Claude Code is running | `busy` |
| `reporting` | Writing results, opening PR | `busy` |
| `blocked` | Claude stopped, needs human input | `busy` (task → `review_pending`) |
| `error` | Job failed, awaiting retry/reset | `error` |

**Valid transitions:**

```typescript
const VALID_AGENT_TRANSITIONS: Record<AgentState, AgentState[]> = {
  idle:      ['claiming'],
  claiming:  ['executing', 'error'],
  executing: ['reporting', 'blocked', 'error'],
  reporting: ['idle', 'error'],
  blocked:   ['claiming'],      // after human responds
  error:     ['idle'],          // after manual reset or retry
}
```

---

## Example: complete job flow

```
1. User creates task in gestionale (status: 'pending')
2. Poller detects it, calls taskQueue.addJob(payload), sets task.queued_at
3. Worker receives job, calls ClaudeRunner.run(payload)
4. ClaudeRunner:
   a. Writes TASK.md to repo
   b. Spawns: claude --dangerously-skip-permissions --output-format json
   c. Streams stdout — logs every chunk
   d. Claude Code works: reads codebase, writes code, commits, pushes, opens PR
   e. Claude Code exits with JSON result
   f. ClaudeRunner parses output, detects PR URL
   g. Returns JobResult { status: 'in_review', prUrl: '...', commitSha: '...' }
5. Worker updates task status → 'review_pending'
6. Worker inserts task_event { type: 'agent.pr.opened', payload: { prUrl } }
7. NotificationService sends Slack: "PR ready for review: [task title] → [prUrl]"
8. BullMQ marks job as COMPLETED
```

---

## File Reference

| File | Role |
|---|---|
| `packages/shared-types/src/index.ts` | `JobPayload`, `JobResult`, `JobError`, `AgentState` |
| `apps/orchestrator/src/agent/claude.runner.ts` | `ClaudeRunner` implementation |
| `apps/orchestrator/src/queues/task.queue.ts` | BullMQ Queue wrapper |
| `apps/orchestrator/src/workers/task.worker.ts` | BullMQ Worker + processor |
| `apps/orchestrator/src/config/bullmq.config.ts` | All BullMQ configuration constants |
