#!/usr/bin/env bash
# backfillDishesForGap.sh
#
# One-shot orchestrator for the dish pipeline targeted ONLY at restaurants
# missing dish data. Replaces the earlier chained scripts (_runChainedScrapes,
# _runAfterScrape) which were tied to specific list files in tmp/. This one
# computes the gap from Supabase first, writes it to tmp/dish-gap-ids.txt,
# then runs the same 6-phase chain we ran during the original 533-restaurant
# backfill (task #80) — restricted to the gap.
#
# Phases (resume-safe — each phase no-ops on rows it's already covered):
#   1. Menu scrape via V100 watchdog (Playwright, fetch + browser, ~2min/row)
#   2. Google Maps "people mention" chips (Playwright, ~10s/row)
#   3. Google Maps full reviews (Playwright, ~15s/row)
#   4. Extract dish mentions from scraped reviews (no network, ~5min total)
#   5. Match generic dish names to real menu items (no network, ~2min)
#   6. Compute top dishes → restaurant_top_dishes (no network, ~2min)
#
# Run: bash scripts/backfillDishesForGap.sh
#
# Background, with watchdog (recommended for the menu phase since it takes
# hours on a 500-row gap and the V100 stall-defense already runs):
#   nohup bash scripts/backfillDishesForGap.sh > logs/backfill-dishes.log 2>&1 &
#   tail -f logs/backfill-dishes.log
#
# Resume-safe — if you kill mid-run, re-running picks up where it left off
# (V100 progress file, scrapeGoogleReviewsBulk skipExisting, dish-extractor
# is idempotent).

set -u
cd "$(dirname "$0")/.."
mkdir -p logs tmp

GAP_FILE="tmp/dish-gap-ids.txt"

log() { echo "[$(date +%H:%M:%S)] backfill: $*" | tee -a logs/backfill-dishes.log; }

# ---------------------------------------------------------------------------
# Phase 0 — compute the gap.
# Restaurants needing the dish pipeline = top_dishes count of zero. We don't
# gate on menu_items or reviews separately because the chain produces them
# en route; the top_dishes table is the canonical "does this restaurant have
# usable dish data" signal.
# ---------------------------------------------------------------------------
log "computing gap from Supabase..."
npx tsx -e "
import { createClient } from '@supabase/supabase-js'
const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!,
)
async function main() {
  const ids: string[] = []
  let from = 0
  for (;;) {
    const { data, error } = await supabase
      .from('restaurants')
      .select('id')
      .order('id')
      .range(from, from + 999)
    if (error) throw new Error(error.message)
    if (!data || data.length === 0) break
    for (const r of data) ids.push(r.id)
    if (data.length < 1000) break
    from += 1000
  }
  // Pull the set of restaurant_ids that DO have top_dishes
  const have = new Set<string>()
  let from2 = 0
  for (;;) {
    const { data, error } = await supabase
      .from('restaurant_top_dishes')
      .select('restaurant_id')
      .order('restaurant_id')
      .range(from2, from2 + 999)
    if (error) throw new Error(error.message)
    if (!data || data.length === 0) break
    for (const r of data) have.add(r.restaurant_id as string)
    if (data.length < 1000) break
    from2 += 1000
  }
  const gap = ids.filter((id) => !have.has(id))
  process.stdout.write(gap.join('\n') + '\n')
  process.stderr.write('gap count: ' + gap.length + '\n')
}
main().catch(e => { console.error(e); process.exit(1) })
" > "$GAP_FILE" 2> >(tee -a logs/backfill-dishes.log >&2)

GAP_COUNT=$(wc -l < "$GAP_FILE" | tr -d ' ')
log "gap = $GAP_COUNT restaurants → $GAP_FILE"
if [ "$GAP_COUNT" -eq 0 ]; then
  log "nothing to do, exiting"
  exit 0
fi

# ---------------------------------------------------------------------------
# Phase 1 — menus via V100 watchdog. Only runs against restaurants that
# don't already have menu items via website-v100 source — V100's internal
# skipExisting handles that, so passing the full gap list is safe.
# ---------------------------------------------------------------------------
log "phase 1/6: menu scrape (V100 watchdog)"
bash scripts/runMenusV100Watchdog.sh --idsFile="$GAP_FILE" \
  >> logs/backfill-dishes.log 2>&1 || log "phase 1 exited non-zero (continuing)"

# ---------------------------------------------------------------------------
# Phase 2 — Google Maps chips (people-mention pills).
# ---------------------------------------------------------------------------
log "phase 2/6: Google Maps chips"
npx tsx scripts/scrapeGoogleReviewsBulk.ts --chips-only --idsFile="$GAP_FILE" --parallel=1 \
  >> logs/backfill-dishes.log 2>&1 || log "phase 2 exited non-zero (continuing)"

# ---------------------------------------------------------------------------
# Phase 3 — Google Maps full review text.
# ---------------------------------------------------------------------------
log "phase 3/6: Google Maps full reviews"
npx tsx scripts/scrapeGoogleReviewsBulk.ts --idsFile="$GAP_FILE" --parallel=1 \
  >> logs/backfill-dishes.log 2>&1 || log "phase 3 exited non-zero (continuing)"

# ---------------------------------------------------------------------------
# Phase 4 — extract dish mentions from review text using the menu dictionary
# + VADER sentiment. Operates over external_reviews populated by phase 3.
# ---------------------------------------------------------------------------
log "phase 4/6: extract dish mentions from reviews"
npx tsx scripts/extractFromScrapedReviews.ts \
  >> logs/backfill-dishes.log 2>&1 || log "phase 4 exited non-zero (continuing)"

# ---------------------------------------------------------------------------
# Phase 5 — match generic dish names ("burger") to specific menu items
# ("Prime Burger") on the same restaurant. No-op for restaurants without
# menu_items rows.
# ---------------------------------------------------------------------------
log "phase 5/6: match dishes to menu items"
npx tsx scripts/matchDishesToMenuItems.ts --write \
  >> logs/backfill-dishes.log 2>&1 || log "phase 5 exited non-zero (continuing)"

# ---------------------------------------------------------------------------
# Phase 6 — aggregate everything into restaurant_top_dishes.
# ---------------------------------------------------------------------------
log "phase 6/6: compute top dishes"
npx tsx scripts/computeTopDishes.ts --write \
  >> logs/backfill-dishes.log 2>&1 || log "phase 6 exited non-zero (continuing)"

log "ALL PHASES COMPLETE"
log "verify with:"
log "  psql … -c \"SELECT COUNT(*) FROM restaurants r WHERE NOT EXISTS (SELECT 1 FROM restaurant_top_dishes td WHERE td.restaurant_id = r.id)\""
log "  (count should drop from $GAP_COUNT to near zero — some restaurants legitimately have no public dish signal)"
