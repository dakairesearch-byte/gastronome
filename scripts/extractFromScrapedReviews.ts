/**
 * extractFromScrapedReviews.ts
 *
 * Fold dish mentions from SCRAPED Google Maps reviews (written to
 * external_reviews by scrapeGoogleReviewsBulk.ts) into
 * restaurant_highlighted_dishes.google_mentions + sample_quote.
 *
 * Sibling of runGoogleReviewsExtract.ts — same logic, different source.
 * Places API v1 caps at 5 reviews per restaurant, so `google_mentions`
 * was capped at 5 even for places with 1000s of reviews. The Playwright
 * scraper gives us ~80 reviews/place, producing much richer mention
 * counts for popular dishes.
 *
 * Usage:
 *   npx tsx scripts/extractFromScrapedReviews.ts                # full
 *   npx tsx scripts/extractFromScrapedReviews.ts --limit 10     # smoke
 *   npx tsx scripts/extractFromScrapedReviews.ts --dry-run
 *   npx tsx scripts/extractFromScrapedReviews.ts --restaurant <id>
 */
import { createClient } from '@supabase/supabase-js'
import fs from 'node:fs'
import path from 'node:path'
import {
  extractDishesFromCaption,
  aggregateDishes,
  canonicalize,
} from '../src/lib/dishes/extract'

// --- env ---
const envPath = path.join(process.cwd(), '.env.local')
if (fs.existsSync(envPath)) {
  for (const line of fs.readFileSync(envPath, 'utf-8').split('\n')) {
    const m = line.match(/^\s*([A-Z_][A-Z0-9_]*)\s*=\s*(.*)\s*$/)
    if (m && !process.env[m[1]]) process.env[m[1]] = m[2].replace(/^"|"$/g, '')
  }
}
const SUPA_URL = process.env.NEXT_PUBLIC_SUPABASE_URL!
const SUPA_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!
if (!SUPA_URL || !SUPA_KEY) {
  console.error('Missing Supabase URL / key in .env.local')
  process.exit(1)
}
const supabase = createClient(SUPA_URL, SUPA_KEY, { auth: { persistSession: false } })

interface Args {
  dryRun: boolean
  limit: number | null
  restaurantId: string | null
  concurrency: number
}
function parseArgs(): Args {
  const a: Args = { dryRun: false, limit: null, restaurantId: null, concurrency: 6 }
  const argv = process.argv.slice(2)
  for (let i = 0; i < argv.length; i++) {
    if (argv[i] === '--dry-run') a.dryRun = true
    else if (argv[i] === '--limit') a.limit = parseInt(argv[++i], 10)
    else if (argv[i] === '--restaurant') a.restaurantId = argv[++i]
    else if (argv[i] === '--concurrency') a.concurrency = parseInt(argv[++i], 10)
  }
  return a
}

type Restaurant = { id: string; name: string }

type PerDish = {
  google: number
  tiktok: number
  instagram: number
  other: number
  sampleQuote: string | null
  sampleSource: string | null
}

async function fetchRestaurantsWithScrapedReviews(args: Args): Promise<Restaurant[]> {
  // Only restaurants that actually have scraped google_maps rows to
  // process — skip anyone who was excluded from the scrape or returned
  // empty. Pull distinct restaurant_ids from external_reviews, then
  // join back to names for logging.
  let q = supabase
    .from('external_reviews')
    .select('restaurant_id')
    .eq('source', 'google')
  if (args.restaurantId) q = q.eq('restaurant_id', args.restaurantId)
  const pageSize = 1000
  const ids = new Set<string>()
  for (let from = 0; ; from += pageSize) {
    const { data, error } = await q.range(from, from + pageSize - 1)
    if (error) throw new Error(`fetchRestaurants: ${error.message}`)
    if (!data || data.length === 0) break
    for (const r of data) ids.add((r as { restaurant_id: string }).restaurant_id)
    if (data.length < pageSize) break
  }
  if (ids.size === 0) return []
  // Resolve names
  const idList = Array.from(ids)
  const out: Restaurant[] = []
  const NAME_BATCH = 500
  for (let i = 0; i < idList.length; i += NAME_BATCH) {
    const chunk = idList.slice(i, i + NAME_BATCH)
    const { data, error } = await supabase
      .from('restaurants')
      .select('id, name')
      .in('id', chunk)
    if (error) throw new Error(`fetchRestaurants names: ${error.message}`)
    for (const r of data ?? []) out.push(r as Restaurant)
  }
  out.sort((a, b) => a.name.localeCompare(b.name))
  return args.limit ? out.slice(0, args.limit) : out
}

async function fetchScrapedReviewBodies(restaurantId: string): Promise<string[]> {
  const { data, error } = await supabase
    .from('external_reviews')
    .select('text')
    .eq('restaurant_id', restaurantId)
    .eq('source', 'google')
  if (error) throw new Error(`fetchScrapedReviewBodies: ${error.message}`)
  const out: string[] = []
  for (const r of data ?? []) {
    const t = (r as { text: string | null }).text?.trim() || ''
    if (t.length > 10) out.push(t)
  }
  return out
}

async function fetchExistingDishes(restaurantId: string): Promise<Map<string, PerDish>> {
  const { data, error } = await supabase
    .from('restaurant_highlighted_dishes')
    .select('dish_name, google_mentions, tiktok_mentions, instagram_mentions, other_mentions, sample_quote, sample_quote_source')
    .eq('restaurant_id', restaurantId)
  if (error) throw new Error(`fetchExistingDishes: ${error.message}`)
  const out = new Map<string, PerDish>()
  for (const r of data ?? []) {
    out.set(r.dish_name, {
      google: r.google_mentions ?? 0,
      tiktok: r.tiktok_mentions ?? 0,
      instagram: r.instagram_mentions ?? 0,
      other: r.other_mentions ?? 0,
      sampleQuote: r.sample_quote,
      sampleSource: r.sample_quote_source,
    })
  }
  return out
}

function pickQuoteFromReview(review: string, dishLower: string): string | null {
  const parts = review
    .split(/(?<=[.!?\n])\s+/)
    .map((s) => s.trim())
    .filter((s) => s.length > 0)
  for (const p of parts) {
    if (p.toLowerCase().includes(dishLower) && p.length <= 280 && p.length >= 30) return p
  }
  if (review.toLowerCase().includes(dishLower)) return review.slice(0, 280).trim()
  return null
}

async function refreshOne(r: Restaurant, args: Args): Promise<{ dishes: number; quotes: number } | null> {
  const reviews = await fetchScrapedReviewBodies(r.id)
  if (reviews.length === 0) return null

  const perCap: Array<{ caption: string; dishes: ReturnType<typeof extractDishesFromCaption> }> = []
  for (const rev of reviews) {
    const dishes = extractDishesFromCaption(rev)
    if (dishes.length > 0) perCap.push({ caption: rev, dishes })
  }
  if (perCap.length === 0) return null
  const agg = aggregateDishes(perCap)

  const merged = await fetchExistingDishes(r.id)
  let addedDishes = 0
  let addedQuotes = 0

  for (const d of agg) {
    const key = canonicalize(d.dish)
    const cur = merged.get(key) ?? {
      google: 0, tiktok: 0, instagram: 0, other: 0,
      sampleQuote: null, sampleSource: null,
    }
    // Overwrite google_mentions — this run IS the current truth. Same
    // reasoning as runGoogleReviewsExtract.ts: counts should reflect
    // what the corpus shows now, not accumulate across runs.
    if (cur.google !== d.mentions) cur.google = d.mentions
    // Fill sample_quote if empty.
    if (!cur.sampleQuote) {
      let quote: string | null = null
      for (const rev of reviews) {
        quote = pickQuoteFromReview(rev, d.dish.toLowerCase())
        if (quote) break
      }
      if (quote) {
        cur.sampleQuote = quote
        cur.sampleSource = 'google'
        addedQuotes += 1
      }
    }
    if (!merged.has(key)) addedDishes += 1
    merged.set(key, cur)
  }

  // Zero out google_mentions for rows that didn't resurface this run.
  const aggKeys = new Set(agg.map((a) => canonicalize(a.dish)))
  for (const [key, v] of merged) {
    if (!aggKeys.has(key) && v.google > 0) v.google = 0
  }

  const entries = Array.from(merged.entries())
    .map(([dish, v]) => ({ dish, total: v.google + v.tiktok + v.instagram + v.other, v }))
    .filter((e) => e.total > 0)
    .sort((a, b) => b.total - a.total)

  if (entries.length === 0) return null

  const rows = entries.map((e, i) => ({
    restaurant_id: r.id,
    dish_name: e.dish,
    google_mentions: e.v.google,
    tiktok_mentions: e.v.tiktok,
    instagram_mentions: e.v.instagram,
    other_mentions: e.v.other,
    mention_count: e.total,
    rank: i + 1,
    sample_quote: e.v.sampleQuote,
    sample_quote_source: e.v.sampleSource,
    updated_at: new Date().toISOString(),
  }))

  if (args.dryRun) {
    console.log(`— ${r.name} · ${reviews.length} reviews · ${rows.length} dishes (top 5):`)
    for (const row of rows.slice(0, 5)) {
      console.log(`   #${row.rank}  ${row.dish_name.padEnd(30)} g:${row.google_mentions} tt:${row.tiktok_mentions} ig:${row.instagram_mentions}`)
    }
    return { dishes: rows.length, quotes: addedQuotes }
  }

  const { error } = await supabase
    .from('restaurant_highlighted_dishes')
    .upsert(rows, { onConflict: 'restaurant_id,dish_name' })
  if (error) {
    console.warn(`   [db fail] ${r.name}: ${error.message}`)
    return null
  }
  return { dishes: rows.length, quotes: addedQuotes }
}

async function run() {
  const args = parseArgs()
  console.log('[extract-scraped] fetching restaurants with scraped reviews…')
  const restaurants = await fetchRestaurantsWithScrapedReviews(args)
  console.log(`  ${restaurants.length} restaurants to process`)

  let touched = 0
  let totalDishes = 0
  let totalQuotes = 0
  let cursor = 0
  const t0 = Date.now()

  async function worker() {
    while (cursor < restaurants.length) {
      const r = restaurants[cursor++]
      try {
        const res = await refreshOne(r, args)
        if (res) {
          touched += 1
          totalDishes += res.dishes
          totalQuotes += res.quotes
        }
      } catch (err) {
        console.warn(`   [skip] ${r.name}: ${(err as Error).message}`)
      }
      if (cursor % 50 === 0) {
        const rate = cursor / ((Date.now() - t0) / 1000)
        console.log(`  …${cursor}/${restaurants.length}  ${rate.toFixed(1)} req/s  touched ${touched}`)
      }
    }
  }
  await Promise.all(Array.from({ length: args.concurrency }, () => worker()))

  const mins = ((Date.now() - t0) / 1000 / 60).toFixed(1)
  console.log(`\n${args.dryRun ? 'DRY-RUN ' : ''}Done in ${mins}m. touched=${touched} dishRows=${totalDishes} newQuotes=${totalQuotes}`)
}

run().catch((err) => { console.error(err); process.exit(1) })
