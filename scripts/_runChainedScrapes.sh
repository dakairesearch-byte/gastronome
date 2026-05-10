#!/bin/bash
# Sequential phase chain: chips after menus complete, full reviews after chips.
# Single-Playwright-at-a-time per memory project_scrape_burst_throughput.
# Each phase resume-safe; this just orchestrates the order.
set -u
cd "$(dirname "$0")/.."
mkdir -p logs

export TMPDIR=/sessions/amazing-compassionate-lovelace/tmp/chained
mkdir -p $TMPDIR

log() { echo "[$(date +%H:%M:%S)] chain: $*" | tee -a logs/chain.log; }

# Wait for Menus V100 watchdog process to finish
log "waiting for Menus V100 to finish..."
while pgrep -f "runMenusV100Watchdog.sh" > /dev/null; do
  sleep 30
done
log "Menus V100 done. Starting Phase 4: Google chips."

# Phase 4: Google Maps chips, single worker
nohup npx tsx scripts/scrapeGoogleReviewsBulk.ts --chips-only --idsFile=tmp/new-google-ids.txt --parallel=1 > logs/google-chips.log 2>&1
log "Phase 4 done. Starting Phase 5: full Google reviews."

# Phase 5: full Google reviews (extract dish mentions)
nohup npx tsx scripts/scrapeGoogleReviewsBulk.ts --idsFile=tmp/new-google-ids.txt --parallel=1 > logs/google-reviews.log 2>&1
log "Phase 5 done. Starting dish extraction from scraped reviews."

# Extract dishes from scraped reviews
nohup npx tsx scripts/extractFromScrapedReviews.ts > logs/dish-extract.log 2>&1
log "Dish extraction done."

log "All scraping phases complete. Run Phase 8 (SQL pivot) + Phase 9 (top dishes) manually:"
log "  npx tsx scripts/rebuildTopDishesV2.ts"
log "  npx tsx scripts/matchDishesToMenuItems.ts --write"
