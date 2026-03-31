#!/bin/bash
# Reads JSON from stdin, blocks dangerous commands
INPUT=$(cat)
COMMAND=$(echo "$INPUT" | jq -r '.tool_input.command // ""')

BLOCKED_PATTERNS=(
  "rm -rf"
  "rm -r /"
  "sudo "
  "prisma migrate"
  "prisma db push"
  "DROP TABLE"
  "DROP DATABASE"
  "DELETE FROM"
  "TRUNCATE"
  "> /dev/"
  "curl.*| bash"
  "wget.*| bash"
  "chmod 777"
  "mkfs"
  "dd if="
  ":(){ :|:& };:"
  "npm publish"
  "npx prisma migrate"
  "git push --force"
  "git push -f"
  "git checkout main"
  "git checkout master"
  "git merge"
  "docker"
  "kubectl"
)

for pattern in "${BLOCKED_PATTERNS[@]}"; do
  if echo "$COMMAND" | grep -qi "$pattern"; then
    echo '{"hookSpecificOutput":{"hookEventName":"PreToolUse","permissionDecision":"deny","permissionDecisionReason":"BLOCKED: Command matches dangerous pattern: '"$pattern"'"}}'
    exit 2
  fi
done

# Allow the command
echo '{}'
exit 0
