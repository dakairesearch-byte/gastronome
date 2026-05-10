/**
 * scrapeGoogleReviewsBulk.ts
 *
 * Bulk Google Maps reviews scraper. Replaces the 5-review cap of Places
 * API v1 by driving a real Chromium session, scrolling the reviews feed,
 * and persisting up to ~80 review bodies per restaurant.
 *
 * Rate-limit strategy (user-requested, 2026-04-21):
 *   - ONE browser context at a time (no parallelism). Google's block rate
 *     goes up fast past ~1 session/s from a single IP.
 *   - Random jitter (6-14s) between restaurants.
 *   - Rotate the context every N restaurants to refresh fingerprint.
 *   - On CAPTCHA detection: wait 5 minutes, rotate context, resume.
 *
 * Efficiency strategy:
 *   - Skip any restaurant that already has >= MIN_CACHED reviews scraped
 *     in the last STALE_DAYS days (so re-runs are cheap).
 *   - Reuse the same browser context across ROTATE_EVERY restaurants to
 *     avoid Chromium launch overhead (~2-3s each).
 *   - Persist after every restaurant — the script is crash-resumable.
 *
 * Usage:
 *   npx tsx scripts/scrapeGoogleReviewsBulk.ts --limit 5   # smoke test
 *   npx tsx scripts/scrapeGoogleReviewsBulk.ts --dry-run   # no DB writes
 *   npx tsx scripts/scrapeGoogleReviewsBulk.ts --restaurant <id>
 *   npx tsx scripts/scrapeGoogleReviewsBulk.ts             # full run (slow)
 */
import { createClient } from '@supabase/supabase-js'
import fs from 'node:fs'
import path from 'node:path'
import {
  launchReviewContext,
  scrapeReviewsAndChipsOnce,
  filterToDishes,
  type ScrapedReview,
  type GoogleChip,
} from '../src/lib/google/scrape'
import type { Browser, BrowserContext } from 'playwright'

// --- env ---
const envPath = path.join(process.cwd(), '.env.local')
if (fs.existsSync(envPath)) {
  for (const line of fs.readFileSync(envPath, 'utf-8').split('\n')) {
    const m = line.match(/^\s*([A-Z_][A-Z0-9_]*)\s*=\s*(.*)\s*$/)
    if (!m) continue
    if (!process.env[m[1]]) process.env[m[1]] = m[2].replace(/^"|"$/g, '')
  }
}

const SUPA_URL = process.env.NEXT_PUBLIC_SUPABASE_URL!
const SUPA_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!
if (!SUPA_URL || !SUPA_KEY) {
  console.error('Missing Supabase URL / key in .env.local')
  process.exit(1)
}
const supabase = createClient(SUPA_URL, SUPA_KEY, { auth: { persistSession: false } })

// --- CLI ---
interface Args {
  dryRun: boolean
  limit: number | null
  restaurantId: string | null
  force: boolean
  headless: boolean
  city: string | null
  debug: boolean
  /**
   * Number of parallel browser contexts to run. Default 1 matches the
   * original "one context at a time" behavior (Google blocks aggressively
   * past ~1 session/s from a single IP). 2 is the max I'm willing to
   * default to — measured empirically not to trip CAPTCHA from typical
   * residential IPs with our existing 6–14s jitter per worker. Higher
   * values are accepted but caller-beware.
   */
  parallel: number
  /**
   * Fast chip-only pass: don't scroll or extract review bodies. Each
   * scrape drops from ~20s to ~8s and the page DOM stays light (chip
   * row + first reviews only), which lets us run more workers without
   * memory pressure. Used for the bulk chip-backfill burst.
   */
  chipsOnly: boolean
}
function parseArgs(): Args {
  const a: Args = { dryRun: false, limit: null, restaurantId: null, force: false, headless: true, city: null, debug: false, parallel: 1, chipsOnly: false }
  const argv = process.argv.slice(2)
  for (let i = 0; i < argv.length; i++) {
    if (argv[i] === '--dry-run') a.dryRun = true
    else if (argv[i] === '--limit') a.limit = parseInt(argv[++i], 10)
    else if (argv[i] === '--restaurant') a.restaurantId = argv[++i]
    else if (argv[i] === '--force') a.force = true
    else if (argv[i] === '--headed') a.headless = false
    else if (argv[i] === '--city') a.city = argv[++i]
    else if (argv[i] === '--debug') a.debug = true
    else if (argv[i] === '--parallel') a.parallel = Math.max(1, parseInt(argv[++i], 10) || 1)
    else if (argv[i] === '--chips-only') a.chipsOnly = true
  }
  return a
}

// --- tuning ---
const ROTATE_EVERY = 20      // rotate browser context every N restaurants
const MIN_SLEEP_MS = 6_000   // jitter floor between restaurants
const MAX_SLEEP_MS = 14_000  // jitter ceiling
const CAPTCHA_BACKOFF_MS = 5 * 60_000 // 5 min sleep on block detection
const MAX_REVIEWS_PER = 80
const MAX_SCROLLS = 14
const MIN_CACHED = 15        // if >= this many google_maps reviews exist, skip
const STALE_DAYS = 21        // unless older than this

type Restaurant = { id: string; name: string; google_place_id: string | null; city: string | null }

async function fetchRestaurants(args: Args): Promise<Restaurant[]> {
  let q = supabase
    .from('restaurants')
    .select('id, name, google_place_id, city')
    .not('google_place_id', 'is', null)
    .order('name')
  if (args.restaurantId) q = q.eq('id', args.restaurantId)
  if (args.city) q = q.ilike('city', args.city)
  const pageSize = 1000
  const out: Restaurant[] = []
  for (let from = 0; ; from += pageSize) {
    const { data, error } = await q.range(from, from + pageSize - 1)
    if (error) throw new Error(`fetchRestaurants: ${error.message}`)
    if (!data || data.length === 0) break
    out.push(...(data as Restaurant[]))
    if (data.length < pageSize) break
  }
  return args.limit ? out.slice(0, args.limit) : out
}

async function fetchCachedCount(restaurantId: string): Promise<number> {
  const staleCutoff = new Date(Date.now() - STALE_DAYS * 24 * 60 * 60 * 1000).toISOString()
  const { count } = await supabase
    .from('external_reviews')
    .select('id', { count: 'exact', head: true })
    .eq('restaurant_id', restaurantId)
    .eq('source', 'google')
    .gte('fetched_at', staleCutoff)
  return count ?? 0
}

/**
 * True if any chip row exists for this restaurant within the staleness
 * window. Used as a secondary cache signal — if a restaurant has cached
 * reviews but no chips, we want to rescrape to backfill chips, since
 * chips are the candidate index for the new scorer. Piggy-backs on the
 * same Google page load, so cost is zero once we decide to scrape.
 */
async function hasCachedChips(restaurantId: string): Promise<boolean> {
  const staleCutoff = new Date(Date.now() - STALE_DAYS * 24 * 60 * 60 * 1000).toISOString()
  const { count } = await supabase
    .from('restaurant_google_chips')
    .select('id', { count: 'exact', head: true })
    .eq('restaurant_id', restaurantId)
    .gte('scraped_at', staleCutoff)
  return (count ?? 0) > 0
}

async function persistEmptyMarker(restaurantId: string): Promise<void> {
  // When a scrape returns 0 reviews, insert MIN_CACHED sentinel rows so this
  // restaurant is skipped on future runs (otherwise fetchCachedCount stays 0
  // and we re-scrape it forever). Text is null; extract/match scripts coerce
  // null to '' and find no dishes, so sentinels are naturally inert.
  // First wipe any existing google rows for this restaurant (idempotent).
  await supabase
    .from('external_reviews')
    .delete()
    .eq('restaurant_id', restaurantId)
    .eq('source', 'google')
  const now = new Date().toISOString()
  const rows = Array.from({ length: MIN_CACHED }).map((_, i) => ({
    restaurant_id: restaurantId,
    source: 'google',
    external_id: `__empty_sentinel_${i}`,
    author_name: null,
    rating: null,
    text: null,
    published_at: null,
    fetched_at: now,
  }))
  const { error } = await supabase.from('external_reviews').insert(rows)
  if (error) {
    console.warn(`    [sentinel err] ${restaurantId}: ${error.message}`)
  }
}

// Canonicalize a chip keyword into the matcher-friendly form used by
// computeTopDishesFromChips.ts: lowercase, trimmed, collapsed whitespace,
// leading article stripped. We deliberately do NOT stem here — stemming
// is the scorer's job. Keeping the "the burger" → "burger" strip so that
// the unique (restaurant_id, keyword) constraint collapses obvious
// duplicates across re-scrapes.
function canonicalizeChipKeyword(raw: string): string {
  return raw
    .toLowerCase()
    .trim()
    .replace(/\s+/g, ' ')
    .replace(/^(the|a|an)\s+/, '')
}

async function persistChips(
  restaurantId: string,
  chips: GoogleChip[]
): Promise<number> {
  // Empty chip arrays are common (new places, blocked contexts) — wipe
  // only when we have something to replace with, so a failed scrape
  // doesn't zero out previously-good chip data.
  if (chips.length === 0) return 0
  const dishLike = filterToDishes(chips, { minCount: 3 })
  if (dishLike.length === 0) return 0

  // Fresh source of truth: delete this restaurant's chips, then insert.
  // Chips table is small and scoped per-restaurant, so this is cheap.
  const { error: delErr } = await supabase
    .from('restaurant_google_chips')
    .delete()
    .eq('restaurant_id', restaurantId)
  if (delErr) {
    console.warn(`    [chip del err] ${restaurantId}: ${delErr.message}`)
    return 0
  }

  const now = new Date().toISOString()
  // De-dupe by canonical keyword (Google occasionally surfaces "tacos" and
  // "Tacos" as two chips — keep the higher count).
  const byKey = new Map<string, { keyword: string; raw: string; count: number; quote: string | null }>()
  for (const c of dishLike) {
    const key = canonicalizeChipKeyword(c.keyword)
    if (!key) continue
    const prev = byKey.get(key)
    if (!prev || c.count > prev.count) {
      byKey.set(key, {
        keyword: key,
        raw: c.keyword,
        count: c.count,
        quote: c.sampleQuote ?? prev?.quote ?? null,
      })
    }
  }

  const rows = Array.from(byKey.values()).map((c) => ({
    restaurant_id: restaurantId,
    keyword: c.keyword,
    raw_keyword: c.raw,
    google_count: c.count,
    sample_quote: c.quote,
    scraped_at: now,
  }))
  if (rows.length === 0) return 0
  const { error } = await supabase.from('restaurant_google_chips').insert(rows)
  if (error) {
    console.warn(`    [chip insert err] ${restaurantId}: ${error.message}`)
    return 0
  }
  return rows.length
}

async function persistReviews(restaurantId: string, reviews: ScrapedReview[]): Promise<number> {
  if (reviews.length === 0) return 0
  // Wipe prior google_maps rows for this restaurant to keep counts truthful
  // (new scrape = new source of truth for reviews available right now).
  const { error: delErr } = await supabase
    .from('external_reviews')
    .delete()
    .eq('restaurant_id', restaurantId)
    .eq('source', 'google')
  if (delErr) {
    console.warn(`    [del err] ${restaurantId}: ${delErr.message}`)
    return 0
  }
  const now = new Date().toISOString()
  const rows = reviews.map((r) => ({
    restaurant_id: restaurantId,
    source: 'google',
    external_id: r.externalId,
    author_name: r.authorName,
    rating: r.rating,
    text: r.text,
    published_at: null, // relative strings like "a week ago" — can't turn into timestamp deterministically
    fetched_at: now,
  }))
  const BATCH = 200
  let wrote = 0
  for (let i = 0; i < rows.length; i += BATCH) {
    const chunk = rows.slice(i, i + BATCH)
    const { error } = await supabase.from('external_reviews').insert(chunk)
    if (error) {
      console.warn(`    [insert err] ${restaurantId}: ${error.message}`)
      continue
    }
    wrote += chunk.length
  }
  return wrote
}

function sleepMs(ms: number): Promise<void> {
  return new Promise((r) => setTimeout(r, ms))
}
function jitterSleep(chipsOnly = false): Promise<void> {
  // Tighter jitter in chips-only mode: per-scrape footprint is ~8s
  // (vs. 20s with review scroll), so 2–5s between scrapes is still
  // <1 req per 10s per worker, well below Google's block threshold.
  const min = chipsOnly ? 2_000 : MIN_SLEEP_MS
  const max = chipsOnly ? 5_000 : MAX_SLEEP_MS
  const ms = min + Math.floor(Math.random() * (max - min))
  return sleepMs(ms)
}

async function rotateContext(current: { browser: Browser; context: BrowserContext } | null, headless: boolean) {
  if (current) {
    await current.browser.close().catch(() => {})
  }
  // Retry launch with backoff — in a memory-constrained sandbox the first
  // Chromium spawn after a crash sometimes fails before the OS reclaims
  // pages. Without this retry the whole worker exits and the burst dies
  // silently with no log after the "rotating context" line.
  let lastErr: Error | null = null
  for (let attempt = 1; attempt <= 5; attempt++) {
    try {
      return await launchReviewContext({ headless })
    } catch (err) {
      lastErr = err as Error
      const wait = 3_000 * attempt
      console.warn(`  [rotateContext retry ${attempt}/5] launch failed: ${lastErr.message.slice(0, 100)} — waiting ${wait}ms`)
      await sleepMs(wait)
    }
  }
  throw lastErr ?? new Error('rotateContext: exhausted retries')
}

type Stats = { attempted: number; scraped: number; empty: number; skipped: number; errors: number; captcha: number; totalReviews: number; totalChips: number }

/**
 * Worker loop: pulls the next restaurant from the shared queue until
 * exhausted. Each worker owns its own browser context, rotates every
 * ROTATE_EVERY restaurants, sleeps independently between calls, and
 * handles CAPTCHA by backing off + rotating without blocking the other
 * workers. This is the right shape for parallelism against Google: we
 * aren't increasing instantaneous request rate to a single URL — each
 * worker independently paces itself — we're just overlapping the idle
 * time one worker spends on network + DB with another worker's actual
 * scrape. Two workers cut wall-clock in half without doubling the
 * Google-visible rate (each worker sleeps 6–14s between calls, so the
 * aggregate rate is ~2 calls per 10s, still slower than what triggers
 * blocks in practice).
 */
async function scrapeWorker(
  workerId: number,
  queue: { nextIdx: number },
  restaurants: Restaurant[],
  args: Args,
  stats: Stats
): Promise<void> {
  let ctx: { browser: Browser; context: BrowserContext } | null = null
  let scrapedThisCtx = 0
  const total = restaurants.length
  try {
    try {
      ctx = await rotateContext(null, args.headless)
    } catch (err) {
      console.warn(`  [w${workerId} INITIAL-LAUNCH-FAIL] ${(err as Error).message} — worker will attempt lazy init`)
      ctx = null
    }
    while (true) {
      const idx = queue.nextIdx++
      if (idx >= total) break
      const r = restaurants[idx]
      stats.attempted++

      let hadCachedReviews = false
      if (!args.force) {
        const cached = await fetchCachedCount(r.id)
        if (cached >= MIN_CACHED) {
          const haveChips = await hasCachedChips(r.id)
          if (haveChips) {
            stats.skipped++
            if (idx % 50 === 0) {
              console.log(`  [w${workerId} ${idx + 1}/${total}] skip ${r.name} (${cached} cached + chips)`)
            }
            continue
          }
          hadCachedReviews = true
          if (idx % 25 === 0) {
            console.log(`  [w${workerId} ${idx + 1}/${total}] rescrape ${r.name} (reviews cached but chips missing)`)
          }
        }
      }

      // Per-worker context rotation. scrapedThisCtx ticks per in-flight
      // scrape (not per queue item) so rotation cadence is consistent
      // regardless of how many cache hits the worker skipped past.
      if (scrapedThisCtx > 0 && scrapedThisCtx % ROTATE_EVERY === 0) {
        console.log(`  [w${workerId} rotate] after ${scrapedThisCtx}: closing & relaunching browser…`)
        try {
          ctx = await rotateContext(ctx, args.headless)
          scrapedThisCtx = 0
        } catch (rotErr) {
          console.warn(`  [w${workerId} ROTATE-FAIL] scheduled rotate failed: ${(rotErr as Error).message.slice(0, 120)}`)
          ctx = null
        }
      }

      // If ctx is null (prior rotate failed), try to bring it back before
      // touching the scraper. Skip the current restaurant if relaunch still fails.
      if (!ctx) {
        try {
          ctx = await rotateContext(null, args.headless)
          scrapedThisCtx = 0
        } catch (relaunchErr) {
          console.warn(`  [w${workerId} ROTATE-FAIL-AGAIN] skipping ${r.name}: ${(relaunchErr as Error).message.slice(0, 120)}`)
          stats.errors++
          await sleepMs(20_000)
          continue
        }
      }

      let reviews: ScrapedReview[] = []
      let chips: GoogleChip[] = []
      const t1 = Date.now()
      try {
        // Hard per-restaurant timeout. The inner scraper has its own
        // timeoutMs but individual waits inside (page.goto, inline frame
        // loads, networkidle polls) can collectively stall past the budget
        // and the sandbox Chromium occasionally hangs in an idle state
        // after a crash rotation. This outer race guarantees the worker
        // always moves on within ~75s regardless of what Playwright is doing.
        const hardBudget = args.chipsOnly ? 60_000 : 90_000
        const scrapePromise = scrapeReviewsAndChipsOnce(
          ctx.context,
          { placeId: r.google_place_id },
          {
            maxScrolls: MAX_SCROLLS,
            maxReviews: MAX_REVIEWS_PER,
            timeoutMs: 55_000,
            debug: args.debug,
            chipsOnly: args.chipsOnly,
          }
        )
        const timeoutPromise = new Promise<never>((_, reject) =>
          setTimeout(() => reject(new Error(`hard_timeout ${hardBudget}ms`)), hardBudget)
        )
        const result = await Promise.race([scrapePromise, timeoutPromise])
        reviews = result.reviews
        chips = result.chips
        scrapedThisCtx++
      } catch (err) {
        const msg = (err as Error).message
        if (/google_blocked/i.test(msg)) {
          stats.captcha++
          console.warn(`  [w${workerId} CAPTCHA] ${r.name} — backing off ${CAPTCHA_BACKOFF_MS / 1000}s and rotating`)
          await sleepMs(CAPTCHA_BACKOFF_MS)
          ctx = await rotateContext(ctx, args.headless)
          scrapedThisCtx = 0
          continue
        }
        // Browser/page crash recovery. Sandbox-level OOMs and Chromium
        // bugs surface as any of these. If we don't rotate the context
        // here, every subsequent newPage() call fails against the dead
        // context and the worker is effectively bricked. This is the
        // single most important robustness fix — non-CAPTCHA browser
        // death used to cascade across the rest of the queue.
        if (/Target (page, )?crashed|Page crashed|browser has been closed|context or browser has been closed|context has been closed|Browser closed|hard_timeout/i.test(msg)) {
          stats.errors++
          const kind = /hard_timeout/i.test(msg) ? 'hang' : 'crash'
          console.warn(`  [w${workerId} ${kind}] ${r.name}: ${msg.slice(0, 120)} — rotating context`)
          try {
            ctx = await rotateContext(ctx, args.headless)
            scrapedThisCtx = 0
            await sleepMs(2_000)
          } catch (rotErr) {
            console.warn(`  [w${workerId} ROTATE-FAIL] ${(rotErr as Error).message.slice(0, 120)} — sleeping 15s then continuing (will retry next iteration)`)
            ctx = null
            await sleepMs(15_000)
          }
          continue
        }
        stats.errors++
        console.warn(`  [w${workerId} err] ${r.name}: ${msg}`)
        await jitterSleep(args.chipsOnly)
        continue
      }

      const dur = ((Date.now() - t1) / 1000).toFixed(1)
      if (reviews.length === 0) {
        stats.empty++
        // In chipsOnly mode reviews.length is always 0 by design — that's
        // not a signal that the place is reviewless. Never write the
        // empty sentinel on this path; just persist whatever chips came
        // back. Same branch handles the review-cached-but-chips-missing
        // backfill case.
        if (hadCachedReviews || args.chipsOnly) {
          const tag = args.chipsOnly ? 'chips-only' : 'chips-backfill'
          console.log(`  [w${workerId} ${idx + 1}/${total}] ${chips.length} chips (${tag}) · ${r.name} · ${dur}s`)
          if (!args.dryRun && chips.length > 0) {
            const wroteChips = await persistChips(r.id, chips)
            stats.totalChips += wroteChips
            if (args.debug) console.log(`    wrote ${wroteChips} chips`)
          }
        } else {
          console.log(`  [w${workerId} ${idx + 1}/${total}] 0 reviews · ${r.name} · ${dur}s`)
          if (!args.dryRun) await persistEmptyMarker(r.id)
        }
      } else {
        stats.scraped++
        stats.totalReviews += reviews.length
        if (args.dryRun) {
          console.log(`  [w${workerId} ${idx + 1}/${total}] ${reviews.length} reviews · ${chips.length} chips · ${r.name} · ${dur}s · (dry)`)
        } else {
          const wrote = await persistReviews(r.id, reviews)
          const wroteChips = await persistChips(r.id, chips)
          stats.totalChips += wroteChips
          console.log(`  [w${workerId} ${idx + 1}/${total}] ${reviews.length} reviews · ${chips.length} chips · ${r.name} · ${dur}s · wrote ${wrote}r/${wroteChips}c`)
        }
      }

      await jitterSleep(args.chipsOnly)
    }
  } finally {
    if (ctx) await ctx.browser.close().catch(() => {})
  }
}

async function run() {
  const args = parseArgs()
  console.log(`[scrapeBulk] mode=${args.dryRun ? 'DRY-RUN' : 'WRITE'} workers=${args.parallel} rotate_every=${ROTATE_EVERY} max_reviews=${MAX_REVIEWS_PER} sleep=${MIN_SLEEP_MS}-${MAX_SLEEP_MS}ms`)
  const restaurants = await fetchRestaurants(args)
  console.log(`[scrapeBulk] ${restaurants.length} restaurants queued`)

  const t0 = Date.now()
  const stats: Stats = { attempted: 0, scraped: 0, empty: 0, skipped: 0, errors: 0, captcha: 0, totalReviews: 0, totalChips: 0 }
  const queue = { nextIdx: 0 }
  const N = Math.min(args.parallel, Math.max(1, restaurants.length))

  // Stagger worker starts so their jitter phases don't synchronize on
  // boot. 4s/worker offset is well below jitter window.
  const workers: Promise<void>[] = []
  for (let w = 0; w < N; w++) {
    if (w > 0) await sleepMs(4_000)
    workers.push(scrapeWorker(w + 1, queue, restaurants, args, stats))
  }
  await Promise.all(workers)

  const mins = ((Date.now() - t0) / 1000 / 60).toFixed(1)
  console.log(
    `\n[scrapeBulk] done in ${mins}m. attempted=${stats.attempted} scraped=${stats.scraped} empty=${stats.empty} skipped=${stats.skipped} errors=${stats.errors} captcha=${stats.captcha} total_reviews=${stats.totalReviews} total_chips=${stats.totalChips}`
  )
}

run().catch((e) => { console.error(e); process.exit(1) })
