---
name: test-driven-fix
description: After root cause is confirmed, write a failing test BEFORE implementing the fix. Use for all bugfixes.
autoActivate: true
triggers:
  keywords: [test, fix, patch, resolve]
  intentPatterns: ["implement.*fix", "write.*patch", "apply.*fix"]
---

# Test-Driven Fix Skill

After confirming the root cause (via systematic-debugging), follow this workflow:

## Step 1: Write a Failing Test
- Create or update a test file that reproduces the exact bug
- The test MUST fail before your fix is applied
- Use the project's existing test framework (check package.json for vitest, jest, mocha, pytest, etc.)
- Name the test descriptively: `it("should not crash when X is null")` or `test("handles empty array in Y")`
- Run the test and confirm it fails: capture the output

## Step 2: Implement the Minimal Fix
- Apply ONLY the changes identified in systematic-debugging Step 5
- Do not refactor, do not clean up, do not "improve while you're at it"
- Keep the diff as small as possible

## Step 3: Verify the Fix
- Run the specific test you wrote — it MUST now pass
- Run the FULL test suite to check for regressions: use the project's test command
- If any existing tests break, your fix has a side effect — investigate before proceeding

## Step 4: Verify Build (if applicable)
- If the project has a build step, run it: `npm run build`, `npx tsc --noEmit`, etc.
- If the project has linting, run it: `npm run lint`
- Fix any type errors or lint issues introduced by your change

## RULES
- NEVER skip writing the failing test
- If you cannot write a test that reproduces the bug, state why and proceed with extra caution
- If the full test suite fails on tests unrelated to your change, note this but proceed
- All tests related to your fix MUST be green before committing
