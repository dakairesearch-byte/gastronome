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

# --- DROP TABLE / DROP SCHEMA / DROP COLUMN / DROP INDEX / DROP FUNCTION ---
# Extended from the original TABLE|SCHEMA list to cover the schema-mutating
# DROP variants that can silently delete data or break dependent objects.
if echo "$UPPER" | grep -qE '\bDROP\s+(TABLE|SCHEMA|COLUMN|INDEX|FUNCTION)\b'; then
  echo "BLOCKED: SQL contains DROP TABLE/SCHEMA/COLUMN/INDEX/FUNCTION — this is irreversible. Get explicit approval." >&2
  exit 1
fi

# --- DELETE FROM without WHERE ---
if echo "$UPPER" | grep -qE '\bDELETE\s+FROM\b'; then
  if ! echo "$UPPER" | grep -qE '\bDELETE\s+FROM\b.*\bWHERE\b'; then
    echo "BLOCKED: DELETE FROM without a WHERE clause would wipe the entire table. Add a WHERE clause." >&2
    exit 1
  fi
fi

# --- UPDATE … SET without WHERE ---
# Same shape as the DELETE rule: an UPDATE with no WHERE silently rewrites
# every row. `\w+` here matches the table name token after UPDATE.
if echo "$UPPER" | grep -qE '\bUPDATE\s+\w+\s+SET\b'; then
  if ! echo "$UPPER" | grep -qE '\bUPDATE\s+\w+\s+SET\b.*\bWHERE\b'; then
    echo "BLOCKED: UPDATE without a WHERE clause would rewrite every row in the table. Add a WHERE clause." >&2
    exit 1
  fi
fi

# --- ALTER TABLE — requires an answered-question ID in a SQL comment ---
# Schema mutations are gated by CLAUDE.md's Decision Gate ("Any schema
# change … ASK"). Calling agents must paste an answered question ID into
# the SQL as a comment, e.g.:
#
#   -- approved: Q-2026-05-23-001
#   ALTER TABLE restaurants ADD COLUMN flag boolean;
#
# A bare ALTER TABLE with no approval marker is blocked.
if echo "$UPPER" | grep -qE '\bALTER\s+TABLE\b'; then
  if ! echo "$SQL" | grep -qE 'approved:\s*Q[-_A-Za-z0-9]+'; then
    echo "BLOCKED: ALTER TABLE requires an answered-question ID. Add a SQL comment like '-- approved: Q-YYYY-MM-DD-NNN' citing the QUESTIONS.md entry that authorized this schema change." >&2
    exit 1
  fi
fi

exit 0
