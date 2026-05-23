#!/usr/bin/env bash
# .claude/hooks/sql-guard.sh
# PreToolUse hook for mcp__*__execute_sql — blocks destructive SQL.
#
# Blocks:  TRUNCATE, DROP TABLE, DROP SCHEMA, DELETE FROM without WHERE.
# Allows:  SELECT, INSERT, UPDATE, DELETE … WHERE …, and everything else.

set -euo pipefail

INPUT=$(cat)

# Extract the SQL string from tool_input (try common key names).
SQL=$(echo "$INPUT" | jq -r '
  .tool_input.sql //
  .tool_input.query //
  .tool_input.statement //
  ""
' 2>/dev/null || echo "")

# If jq extraction failed, fall back to scanning the raw input.
if [ -z "$SQL" ]; then
  SQL="$INPUT"
fi

UPPER=$(echo "$SQL" | tr '[:lower:]' '[:upper:]')

# --- TRUNCATE ---
if echo "$UPPER" | grep -qE '\bTRUNCATE\b'; then
  echo "BLOCKED: SQL contains TRUNCATE — use DELETE with a WHERE clause, or get explicit approval." >&2
  exit 1
fi

# --- DROP TABLE / DROP SCHEMA ---
if echo "$UPPER" | grep -qE '\bDROP\s+(TABLE|SCHEMA)\b'; then
  echo "BLOCKED: SQL contains DROP TABLE or DROP SCHEMA — this is irreversible. Get explicit approval." >&2
  exit 1
fi

# --- DELETE FROM without WHERE ---
if echo "$UPPER" | grep -qE '\bDELETE\s+FROM\b'; then
  if ! echo "$UPPER" | grep -qE '\bDELETE\s+FROM\b.*\bWHERE\b'; then
    echo "BLOCKED: DELETE FROM without a WHERE clause would wipe the entire table. Add a WHERE clause." >&2
    exit 1
  fi
fi

exit 0
