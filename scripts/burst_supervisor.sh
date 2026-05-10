#!/bin/bash
# Keeps the chip burst alive across silent Node/Chromium deaths.
# The scraper itself cache-skips already-chipped restaurants, so each
# restart just picks up from where the last one stopped. Exits cleanly
# only when the scraper finishes the full queue (exit code 0, no further
# work to do — indicated by the stats line at the end of its log output).

set -u
cd "$(dirname "$0")/.."

mkdir -p .burst_logs
STAMP=$(date +%Y%m%d_%H%M%S)
SUPERVISOR_LOG=".burst_logs/supervisor_${STAMP}.log"
RESTART_COUNT=0
MAX_RESTARTS=60

echo "[supervisor] starting at $(date)" | tee -a "$SUPERVISOR_LOG"

while [ $RESTART_COUNT -lt $MAX_RESTARTS ]; do
  WORKER_LOG=".burst_logs/burst_${STAMP}_r${RESTART_COUNT}.log"
  echo "[supervisor] launch attempt $RESTART_COUNT at $(date) -> $WORKER_LOG" | tee -a "$SUPERVISOR_LOG"

  PLAYWRIGHT_BROWSERS_PATH=/tmp/ms-playwright-mine \
    npx tsx scripts/scrapeGoogleReviewsBulk.ts --parallel 1 --chips-only \
    > "$WORKER_LOG" 2>&1

  EXIT=$?
  LAST_IDX=$(grep -oE '\[w1 [0-9]+/913\]' "$WORKER_LOG" | tail -1 | grep -oE '[0-9]+' | head -1 || echo "?")
  echo "[supervisor] worker exited code=$EXIT last_idx=$LAST_IDX at $(date)" | tee -a "$SUPERVISOR_LOG"

  # Check for completion marker (the scraper prints final stats line at end)
  if grep -q "\[scrapeBulk\] DONE\|scraped=.*skipped=.*errors=" "$WORKER_LOG"; then
    echo "[supervisor] detected clean completion, exiting" | tee -a "$SUPERVISOR_LOG"
    break
  fi

  RESTART_COUNT=$((RESTART_COUNT + 1))
  echo "[supervisor] restarting in 10s (restart $RESTART_COUNT/$MAX_RESTARTS)" | tee -a "$SUPERVISOR_LOG"

  # Defensive: kill any orphaned chromium from a dirty exit
  pkill -9 -f "headless_shell" 2>/dev/null
  sleep 10
done

echo "[supervisor] stopping at $(date) (restart_count=$RESTART_COUNT)" | tee -a "$SUPERVISOR_LOG"
