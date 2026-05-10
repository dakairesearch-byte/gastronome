/**
 * Pull Google reviews via Places API v1 and fold them into
 * `restaurant_highlighted_dishes.google_mentions` + sample_quote.
 *
 * Why this instead of scraping the Maps "people often mention" chip row:
 *   - Headless Chrome gets served a lightweight Overview+About panel that
 *     never exposes the chip row. We could go non-headless in a real
 *     browser, but that requires ~30min × 913 restaurants of user-in-loop
 *     time through Chrome MCP.
 *   - Places API v1 `places.get` with `fields=reviews` returns up to 5 of
 *     the most-helpful reviews with full body text. Running our existing
 *     heuristic `extractDishesFromCaption` over those bodies gives us a
 *     signal that's directly comparable to the TikTok/IG extraction we
 *     already ran, and populates `google_mentions` without a browser at
 *     all.
 *   - Bonus: reviews contain full sentences, so the `sample_quote` is
 *     richer than a chip-adjacent snippet would have been.
 *
 * Usage:
 *   npx tsx scripts/runGoogleReviewsExtract.ts              # full run
 *   npx tsx scripts/runGoogleReviewsExtract.ts --limit 20   # smoke test
 *   npx tsx scripts/runGoogleReviewsExtract.ts --dry-run    # no DB writes
 *   npx tsx scripts/runGoogleReviewsExtract.ts --restaurant <id>
 */
import { createClient } from '@supabase/supabase-js'
import fs from 'node:fs'
import path from 'node:path'
import {
  extractDishesFromCaption,
  aggregateDishes,
  canonicalize,
} from '../src/lib/dishes/extract'

// Load .env.local
const envPath = path.join(process.cwd(), '.env.local')
for (const line of fs.readFileSync(envPath, 'utf-8').split('\n')) {
  const m = line.match(/^\s*([A-Z_][A-Z0-9_]*)\s*=\s*(.*)\s*$/)
  if (!m) continue
  if (!process.env[m[1]]) process.env[m[1]] = m[2]
}

const SUPA_URL = process.env.NEXT_PUBLIC_SUPABASE_URL!
const SUPA_ANON = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!
const PLACES_KEY = process.env.GOOGLE_PLACES_API_KEY!
if (!SUPA_URL || !SUPA_ANON || !PLACES_KEY) {
  console.error('Missing Supabase URL / anon key / Places key in .env.local')
  process.exit(1)
}
const supabase = createClient(SUPA_URL, SUPA_ANON, {
  auth: { persistSession: false },
})

interface Args {
  dryRun: boolean
  limit: number | null
  restaurantId: string | null
  concurrency: number
}
function parseArgs(): Args {
  const a: Args = { dryRun: false, limit: null, restaurantId: null, concurrency: 4 }
  const argv = process.argv.slice(2)
  for (let i = 0; i < argv.length; i++) {
    if (argv[i] === '--dry-run') a.dryRun = true
    else if (argv[i] === '--limit') a.limit = parseInt(argv[++i], 10)
    else if (argv[i] === '--restaurant') a.restaurantId = argv[++i]
    else if (argv[i] === '--concurrency') a.concurrency = parseInt(argv[++i], 10)
  }
  return a
}

type Restaurant = {
  id: string
  name: string
  google_place_id: string | null
}

type PlacesReview = {
  text?: { text?: string; languageCode?: string }
  originalText?: { text?: string; languageCode?: string }
  rating?: number
  relativePublishTimeDescription?: string
}

async function fetchRestaurants(args: Args): Promise<Restaurant[]> {
  let q = supabase
    .from('restaurants')
    .select('id, name, google_place_id')
    .not('google_place_id', 'is', null)
    .order('name')
  if (args.restaurantId) q = q.eq('id', args.restaurantId)
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

async function fetchReviews(placeId: string): Promise<string[]> {
  const url = `https://places.googleapis.com/v1/places/${encodeURIComponent(placeId)}?fields=reviews&key=${PLACES_KEY}`
  const res = await fetch(url, { headers: { 'X-Goog-FieldMask': 'reviews' } })
  if (!res.ok) {
    const body = await res.text().catch(() => '')
    throw new Error(`Places ${res.status}: ${body.slice(0, 200)}`)
  }
  const json = (await res.json()) as { reviews?: PlacesReview[] }
  const reviews = json.reviews ?? []
  const texts: string[] = []
  for (const r of reviews) {
    const t = r.text?.text ?? r.originalText?.text ?? ''
    const cleaned = t.trim()
    if (cleaned.length > 0) texts.push(cleaned)
  }
  return texts
}

type PerDish = {
  google: number
  tiktok: number
  instagram: number
  other: number
  sampleQuote: string | null
  sampleSource: string | null
}

async function fetchExistingDishes(
  restaurantId: string
): Promise<Map<string, PerDish>> {
  const { data, error } = await supabase
    .from('restaurant_highlighted_dishes')
    .select(
      'dish_name, google_mentions, tiktok_mentions, instagram_mentions, other_mentions, sample_quote, sample_quote_source'
    )
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

/**
 * Pick a short-enough sentence from a review that contains the given dish.
 * Keeps the sample_quote UX-friendly (under ~280 chars) where the full
 * review body would overflow.
 */
function pickQuoteFromReview(review: string, dishLower: string): string | null {
  // Rough sentence split. Reviews often mash things together with `.`, `!`,
  // `\n` — we just need a chunk where the dish shows up.
  const parts = review
    .split(/(?<=[.!?\n])\s+/)
    .map((s) => s.trim())
    .filter((s) => s.length > 0)
  for (const p of parts) {
    if (p.toLowerCase().includes(dishLower) && p.length <= 280 && p.length >= 30) {
      return p
    }
  }
  // Fallback: first 280 chars of the review if it mentions the dish.
  if (review.toLowerCase().includes(dishLower)) {
    return review.slice(0, 280).trim()
  }
  return null
}

async function refreshOne(r: Restaurant, args: Args): Promise<{ dishes: number; quotes: number } | null> {
  if (!r.google_place_id) return null

  let reviews: string[]
  try {
    reviews = await fetchReviews(r.google_place_id)
  } catch (err) {
    const msg = (err as Error).message
    // Quota/rate errors bubble so we can back off; other errors we skip.
    if (msg.includes(' 429') || msg.includes('RESOURCE_EXHAUSTED')) throw err
    console.warn(`   [places fail] ${r.name}: ${msg}`)
    return null
  }
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
      google: 0,
      tiktok: 0,
      instagram: 0,
      other: 0,
      sampleQuote: null,
      sampleSource: null,
    }

    // IMPORTANT: overwrite google_mentions (don't accumulate). Each run
    // re-reads the top-5 reviews from scratch, so the count IS the
    // current Google-review-derived count. Adding would inflate on re-run.
    if (cur.google !== d.mentions) cur.google = d.mentions

    // Fill sample_quote if empty — prefer a sentence mentioning this dish.
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

  // Also zero-out google_mentions for any existing rows where the dish
  // didn't show up in this pass — keeps counts truthful if a review got
  // removed upstream. We're a refresh, not an append.
  const aggKeys = new Set(agg.map((a) => canonicalize(a.dish)))
  for (const [key, v] of merged) {
    if (!aggKeys.has(key) && v.google > 0) {
      v.google = 0
    }
  }

  const entries = Array.from(merged.entries())
    .map(([dish, v]) => ({
      dish,
      total: v.google + v.tiktok + v.instagram + v.other,
      v,
    }))
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
    console.log(`— ${r.name} · ${rows.length} dishes (top 5):`)
    for (const row of rows.slice(0, 5)) {
      console.log(
        `   #${row.rank}  ${row.dish_name.padEnd(30)} g:${row.google_mentions} tt:${row.tiktok_mentions} ig:${row.instagram_mentions}`
      )
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
  console.log('Fetching restaurants with google_place_id…')
  const restaurants = await fetchRestaurants(args)
  console.log(`  ${restaurants.length} restaurants to process`)

  let touched = 0
  let totalDishes = 0
  let totalQuotes = 0
  let placesCalls = 0
  let cursor = 0
  const t0 = Date.now()

  async function worker() {
    while (cursor < restaurants.length) {
      const r = restaurants[cursor++]
      placesCalls += 1
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
      if (cursor % 25 === 0) {
        const rate = cursor / ((Date.now() - t0) / 1000)
        console.log(`  …${cursor}/${restaurants.length}   ${rate.toFixed(1)} req/s   touched ${touched}`)
      }
    }
  }

  await Promise.all(Array.from({ length: args.concurrency }, () => worker()))

  const mins = ((Date.now() - t0) / 1000 / 60).toFixed(1)
  console.log(
    `\n${args.dryRun ? 'DRY-RUN ' : ''}Done in ${mins}m. ${placesCalls} Places calls, ${touched} restaurants touched, ${totalDishes} dish rows upserted, ${totalQuotes} new sample_quotes.`
  )
}

run().catch((err) => {
  console.error(err)
  process.exit(1)
})
