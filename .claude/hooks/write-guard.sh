#!/usr/bin/env bash
# .claude/hooks/write-guard.sh
# PreToolUse hook for Write/Edit — protects coordination files from
# accidental rewrites by agents (and from absent-minded edits in any
# session).
#
# Blocks writes targeting:
#   - CLAUDE.md                  (project doc — only the user / a turn the
#                                 user has explicitly approved should
#                                 mutate it)
#   - .claude/agents/*.md        (agents must not rewrite themselves or
#                                 each other)
#   - .claude/settings.json      (permissions + hooks; agents must not
#                                 silently broaden their own permissions)
#
# Escape hatch: export CLAUDE_PROTECTED_WRITE_OK=1 in the shell before
# the edit when you, the user, are intentionally updating one of these
# files. Subagents spawned without that env var still get blocked.

set -euo pipefail

INPUT=$(cat)

# Tool name lets us differentiate Write vs Edit if needed later. For now
# both go through the same guard — we only care about the target path.
FILE=$(echo "$INPUT" | jq -r '.tool_input.file_path // ""' 2>/dev/null || echo "")

if [ -z "$FILE" ]; then
  exit 0
fi

# Escape hatch — user-acknowledged edits.
if [ "${CLAUDE_PROTECTED_WRITE_OK:-}" = "1" ]; then
  exit 0
fi

# --- CLAUDE.md (anywhere in the repo; usually at the root) ---
if echo "$FILE" | grep -qE '(^|/)CLAUDE\.md$'; then
  echo "BLOCKED: Writes to CLAUDE.md require a user-approved edit. Set CLAUDE_PROTECTED_WRITE_OK=1 in this shell session if the user explicitly asked for this change." >&2
  exit 1
fi

# --- .claude/agents/*.md ---
if echo "$FILE" | grep -qE '(^|/)\.claude/agents/[^/]+\.md$'; then
  echo "BLOCKED: Agents must not rewrite themselves or each other. Edits to .claude/agents/*.md are user-only. Set CLAUDE_PROTECTED_WRITE_OK=1 if the user explicitly asked for this change." >&2
  exit 1
fi

# --- .claude/settings.json ---
if echo "$FILE" | grep -qE '(^|/)\.claude/settings\.json$'; then
  echo "BLOCKED: Agents must not silently rewrite their own permissions/hooks. Edits to .claude/settings.json are user-only. Set CLAUDE_PROTECTED_WRITE_OK=1 if the user explicitly asked for this change." >&2
  exit 1
fi

exit 0
