#!/usr/bin/env bash
# .claude/hooks/gh-pr-guard.sh
# PreToolUse hook for Bash — blocks PR state-change commands.
#
# Marking a PR ready-for-review, merging, or closing are all human-only
# actions per the CLAUDE.md "Never auto-merge to main" rule. Read-only
# enumeration (`gh pr list/view/diff`) is already pre-allowed in settings;
# this guard only fires on the state-mutating subcommands.

set -euo pipefail

INPUT=$(cat)

CMD=$(echo "$INPUT" | jq -r '.tool_input.command // ""' 2>/dev/null || echo "")

if [ -z "$CMD" ]; then
  exit 0
fi

# --- Block gh pr ready ---
if echo "$CMD" | grep -qE '\bgh\s+pr\s+ready\b'; then
  echo "BLOCKED: 'gh pr ready' marks a draft PR ready-for-review — that's a human action. Leave the PR as a draft and ask the user to flip it." >&2
  exit 1
fi

# --- Block gh pr merge ---
if echo "$CMD" | grep -qE '\bgh\s+pr\s+merge\b'; then
  echo "BLOCKED: 'gh pr merge' merges a PR. Per CLAUDE.md, all merges require explicit user approval." >&2
  exit 1
fi

# --- Block gh pr close ---
if echo "$CMD" | grep -qE '\bgh\s+pr\s+close\b'; then
  echo "BLOCKED: 'gh pr close' closes a PR. Ask the user before closing — they may want to keep the branch open." >&2
  exit 1
fi

exit 0
