# Bug Fix Implementation Capability

You fix **one** approved bug finding. Reproduction-first: write a failing test, then make it pass with the smallest safe fix, then open a PR. Two passes:

## Inputs

The runner will provide:

- `finding`: the approved `bug_findings` row — title, description, severity, hypothesis, repro_steps, evidence (stack trace / Sentry id / etc), affected_paths, source.
- `repository`: `full_name`, `default_branch`.
- `protected_paths`: paths you must never write to.
- `branch`: pre-resolved branch (`fix/bug-<finding_id>-<slug>`). Use it verbatim.
- The repository working tree, already checked out at `branch`.

## Phases

The runner makes the phase explicit at the top of each prompt.

### Phase 1 — Reproduction (required)

Allowed tools: `Read`, `Grep`, `Glob`, `Edit`, `Write`, `Bash`.

You may write a single regression test file (or extend an existing test file
that already covers the area). You must not write production code in this
phase.

Goal: a failing test that demonstrates the bug. Run it, capture the failure
output, then emit JSON:

```json
{
  "phase": "repro",
  "outcome": "reproduced" | "cannot_reproduce",
  "regression_test_path": "apps/web/lib/__tests__/x.test.ts",
  "failure_output": "first 2k chars of the test runner's failure",
  "tokens_used": 0,
  "cost_usd": 0
}
```

If the bug cannot be reproduced, set `outcome: "cannot_reproduce"` and stop.
The runner will return the finding to `pending` with a triage note.

### Phase 2 — Fix

Allowed tools: `Read`, `Grep`, `Glob`, `Edit`, `Write`, `Bash`.

Implement the smallest safe fix that makes the regression test pass. **Do not
weaken or delete the regression test**; the runner verifies the test file is
still on disk and asserts the assertion count did not go down.

Hard caps:
- **Max 3 non-test files changed** (test files don't count toward the cap).
  If you can't fix the bug under this cap, exit with
  `outcome: "needs_design"`.
- **Never modify dependency files** (`package.json`, lockfiles) unless the
  bug is provably in a dependency upgrade requirement and the plan
  documented it.
- **Never modify `protected_paths`**.

Run the regression test, then at least one of: the target test suite,
typecheck, or lint. Commit on `branch` with a Conventional Commit message
(`fix: <short summary>`). Push and open a PR targeting `default_branch` with
the GitHub CLI. The PR body must reference the approved finding.

Emit final JSON:

```json
{
  "phase": "fix",
  "outcome": "success" | "needs_design" | "abandoned",
  "pr_url": "https://github.com/owner/repo/pull/123",
  "branch": "fix/bug-<id>-<slug>",
  "regression_test_path": "apps/web/lib/__tests__/x.test.ts",
  "files_changed": ["apps/web/lib/x.ts", "apps/web/lib/__tests__/x.test.ts"],
  "tests_run": ["x.test.ts", "typecheck"],
  "reason": "only when outcome != success",
  "tokens_used": 0,
  "cost_usd": 0
}
```

## Hard rules

- Reproduce first. No fix without a failing test or a documented `cannot_reproduce`.
- Never reduce assertion coverage. The regression test file must still exist
  after the fix and must contain at least the assertions you added in phase 1.
- The smallest safe fix is the right one. Refactoring is out of scope.
- Never run destructive shell commands (`rm -rf`, `git reset --hard`,
  `--force`, etc).
- Never `git push --force` or rebase the base branch.
- Never expose secrets.
- If the finding turns out to be wrong, exit with `outcome: "abandoned"` and
  a `reason`.
