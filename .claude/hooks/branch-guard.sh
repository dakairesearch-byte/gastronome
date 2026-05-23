#!/usr/bin/env bash
# .claude/hooks/branch-guard.sh
# PreToolUse hook for Bash — blocks direct writes to main.
#
# Blocks:  git push targeting main, git commit while on the main branch.
# Allows:  everything else (read-only git, npm, general shell).

set -euo pipefail

INPUT=$(cat)

CMD=$(echo "$INPUT" | jq -r '.tool_input.command // ""' 2>/dev/null || echo "")

if [ -z "$CMD" ]; then
  exit 0
fi

# --- Block git push to main ---
# Catches: git push origin main, git push -u origin main,
#          git push origin HEAD:main, git push origin feature:main
if echo "$CMD" | grep -qE 'git\s+push\s+.*\bmain\b'; then
  echo "BLOCKED: Direct push to main is not allowed. Push to a feature branch and open a PR." >&2
  exit 1
fi

# --- Block git commit on main ---
# Only fires when the working tree is actually on the main branch.
if echo "$CMD" | grep -qE '\bgit\s+commit\b'; then
  CURRENT_BRANCH=$(git branch --show-current 2>/dev/null || echo "")
  if [ "$CURRENT_BRANCH" = "main" ]; then
    echo "BLOCKED: Committing directly on main is not allowed. Switch to a feature branch first." >&2
    exit 1
  fi
fi

exit 0
