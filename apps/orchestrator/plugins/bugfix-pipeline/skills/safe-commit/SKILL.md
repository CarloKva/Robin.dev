---
name: safe-commit
description: Use when the fix is verified and tests pass. Handles git branch, commit, and push safely.
autoActivate: false
---

# Safe Commit Skill

After your fix passes all tests, follow this commit workflow:

## Step 1: Review Your Changes
- Run `git diff` and review every changed line
- Ensure no debug code, console.logs, or commented-out code remains
- Ensure no unrelated changes are included

## Step 2: Branch & Commit
- Create a branch if not already on one: `git checkout -b fix/<short-description>`
- Stage only the files relevant to the fix: `git add <specific-files>`
- Do NOT use `git add .` or `git add -A` — be explicit
- Write a commit message following conventional commits:
  ```
  fix: <concise description of what was fixed>

  Root cause: <one sentence explaining why the bug happened>
  Fix: <one sentence explaining what the change does>

  Closes #<issue-number-if-available>
  ```

## Step 3: Push
- Push the branch: `git push origin fix/<short-description>`
- If the push fails due to auth or permissions, STOP and report the error

## RULES
- NEVER commit to `main` or `master` directly
- NEVER force push
- NEVER commit files that weren't part of the fix
- NEVER commit secrets, env files, or lock files unless they were already tracked
