#!/bin/bash
# After file edits, remind the agent to run tests
INPUT=$(cat)
TOOL_NAME=$(echo "$INPUT" | jq -r '.tool_name // ""')

if [[ "$TOOL_NAME" == "Edit" || "$TOOL_NAME" == "Write" ]]; then
  echo '{"systemMessage":"File modified. Remember: run the project test suite to verify your changes did not introduce regressions."}'
else
  echo '{}'
fi
exit 0
