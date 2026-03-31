---
name: systematic-debugging
description: Use when encountering any bug, test failure, error message, or unexpected behavior. Activates BEFORE proposing any fix.
autoActivate: true
triggers:
  keywords: [bug, error, fix, fail, crash, broken, exception, traceback, stack trace, unexpected]
  intentPatterns: ["fix.*bug", "debug.*issue", "resolve.*error", "investigate.*failure"]
---

# Systematic Debugging Skill

You MUST follow this structured debugging workflow. Do NOT skip steps or jump to conclusions.

## Step 1: Reproduce & Observe
- Read the bug description / error message carefully
- Identify the exact file(s), line(s), and function(s) involved
- If a stack trace is provided, trace it from top to bottom
- Search the codebase for the relevant code: `grep -rn` or `find` for the key terms

## Step 2: Form Hypotheses
- List 2-3 possible root causes based on what you observed
- Rank them by likelihood
- State what evidence would confirm or deny each hypothesis

## Step 3: Investigate Top Hypothesis
- Read the relevant source files completely (not just the error line)
- Check imports, types, function signatures, and data flow
- Look for: null/undefined access, off-by-one, race conditions, missing await, wrong variable scope, stale closures, incorrect type coercion
- Check recent git history on the affected files: `git log --oneline -10 -- <file>`

## Step 4: Confirm Root Cause
- Before writing ANY fix, state the root cause in one sentence
- Explain WHY the bug happens, not just WHERE
- If you cannot confidently explain the root cause, go back to Step 2

## Step 5: Plan the Fix
- Describe the minimal change needed
- List every file that needs to change
- Identify potential side effects of your fix
- If the fix touches shared code, check all callers/consumers

## RULES
- NEVER apply a fix without completing Steps 1-4
- NEVER make speculative changes to "see if it helps"
- NEVER change more code than necessary
- If you're unsure, read more code before acting
