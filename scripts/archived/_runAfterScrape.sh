#!/usr/bin/env bash
# _runAfterScrape.sh
#
# Watches the bulk scrape log; when it prints "[scrapeBulk] done", chain:
#   extractFromScrapedReviews  →  matchDishesToMenuItems  →  computeTopDishes --write
# Launch in background to auto-finalize the pipeline.
set -euo pipefail
LOG="${1:-/sessions/amazing-compassionate-lovelace/scrape_bulk.log}"
cd "$(dirname "$0")/.."
echo "[chain] watching $LOG"
while true; do
  if [ -f "$LOG" ] && grep -q "^\[scrapeBulk\] done" "$LOG"; then
    echo "[chain] scrape finished, running extract…"
    break
  fi
  sleep 60
done
npx tsx scripts/extractFromScrapedReviews.ts 2>&1 | tee /sessions/amazing-compassionate-lovelace/chain_extract.log
echo "[chain] extract done, running match…"
npx tsx scripts/matchDishesToMenuItems.ts --write 2>&1 | tee /sessions/amazing-compassionate-lovelace/chain_match.log
echo "[chain] match done, computing top dishes…"
npx tsx scripts/computeTopDishes.ts --write 2>&1 | tee /sessions/amazing-compassionate-lovelace/chain_top.log
echo "[chain] ALL DONE"
