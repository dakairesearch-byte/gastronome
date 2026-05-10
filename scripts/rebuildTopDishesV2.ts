/**
 * rebuildTopDishesV2.ts
 *
 * Phase A aggregator: rolls up per-mention rows in
 * external_review_dish_mentions into ranked rows in
 * restaurant_top_dishes.
 *
 * Scoring per dish per restaurant:
 *   1. Weight each mention by:
 *      - review rating (5★ = 1.0, 1★ = 0.5, unrated = 0.8)
 *      - review length / source (full google reviews 1.0, snippets 0.5)
 *      - extractor confidence (0.95 menu-closed, 0.7 dict fallback)
 *   2. Sentiment contribution:
 *      positive = +1.0, neutral = +0.2, negative = -0.6
 *   3. Raw dish score = Σ sentiment * weight.
 *   4. Frequency boost: * log(1 + total_mentions) — famous dishes rise.
 *   5. Specificity bonus: menu-closed matches (conf ≥ 0.9) get +0.5 flat
 *      and generic dict words ("soup", "salad", "pasta") are shaved 0.3
 *      so specific dishes rank above buckets.
 *
 * Sample quote: first positive sentence ≥ 40 chars from the dish_context
 * of a high-confidence, high-rating source review.
 *
 * Usage:
 *   npx tsx scripts/rebuildTopDishesV2.ts --limit 10 --dry-run
 *   npx tsx scripts/rebuildTopDishesV2.ts --restaurant <id>
 *   npx tsx scripts/rebuildTopDishesV2.ts
 */

import { createClient } from '@supabase/supabase-js'
import fs from 'node:fs'
import path from 'node:path'

// ---- env ----
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
  console.error('Missing SUPABASE env')
  process.exit(1)
}
const supabase = createClient(SUPA_URL, SUPA_KEY, { auth: { persistSession: false } })

// ---- CLI ----
interface Args {
  dryRun: boolean
  limit: number | null
  restaurantId: string | null
  concurrency: number
  topN: number
}
function parseArgs(): Args {
  const a: Args = { dryRun: false, limit: null, restaurantId: null, concurrency: 6, topN: 15 }
  const argv = process.argv.slice(2)
  for (let i = 0; i < argv.length; i++) {
    if (argv[i] === '--dry-run') a.dryRun = true
    else if (argv[i] === '--limit') a.limit = parseInt(argv[++i], 10)
    else if (argv[i] === '--restaurant') a.restaurantId = argv[++i]
    else if (argv[i] === '--concurrency') a.concurrency = parseInt(argv[++i], 10)
    else if (argv[i] === '--top') a.topN = parseInt(argv[++i], 10)
  }
  return a
}

// Dict-only words that are too generic to stand alone at the top of
// "top dishes" — they describe a category, not a signature dish. We
// still let them through but with a score haircut.
const GENERIC_BUCKETS = new Set([
  'soup', 'salad', 'sandwich', 'burger', 'pasta', 'pizza', 'steak',
  'chicken', 'fish', 'shrimp', 'noodle', 'noodles', 'taco', 'tacos',
  'rice', 'fries', 'wings', 'bread', 'cheese', 'pie', 'cake',
  'pastry', 'dessert', 'appetizer', 'starter', 'main', 'mains',
  'entree', 'entrees', 'side', 'sides', 'drink', 'cocktail', 'wine',
  'beer', 'coffee', 'tea', 'brunch', 'lunch', 'dinner', 'breakfast',
  'slices', 'slice', 'meal', 'lobster', 'crab', 'tuna', 'salmon',
  'shake', 'smoothie', 'juice', 'soda', 'burgers', 'salads',
  'sandwiches', 'steaks', 'wraps', 'bowl', 'bowls',
])

type Restaurant = { id: string; name: string }
type Mention = {
  id: string
  review_id: string
  restaurant_id: string
  dish_name: string
  dish_name_normalized: string
  confidence: number
  sentiment: 'positive' | 'negative' | 'neutral'
  dish_context: string | null
}
type Review = {
  id: string
  source: string
  rating: number | null
  text: string
}

async function loadEligibleRestaurants(args: Args): Promise<Restaurant[]> {
  let q = supabase
    .from('external_review_dish_mentions')
    .select('restaurant_id')
  if (args.restaurantId) q = q.eq('restaurant_id', args.restaurantId)
  const pageSize = 1000
  const ids = new Set<string>()
  for (let from = 0; ; from += pageSize) {
    const { data, error } = await q.range(from, from + pageSize - 1)
    if (error) throw error
    if (!data || data.length === 0) break
    for (const r of data) ids.add((r as any).restaurant_id)
    if (data.length < pageSize) break
  }
  const idList = Array.from(ids)
  if (idList.length === 0) return []
  const out: Restaurant[] = []
  const BATCH = 200  // keep URL under 16KB header limit
  for (let i = 0; i < idList.length; i += BATCH) {
    const chunk = idList.slice(i, i + BATCH)
    const { data, error } = await supabase.from('restaurants').select('id, name').in('id', chunk)
    if (error) throw error
    for (const r of data ?? []) out.push(r as Restaurant)
  }
  out.sort((a, b) => a.name.localeCompare(b.name))
  return args.limit ? out.slice(0, args.limit) : out
}

async function loadMentions(restaurantId: string): Promise<Mention[]> {
  const pageSize = 1000
  const out: Mention[] = []
  for (let from = 0; ; from += pageSize) {
    const { data, error } = await supabase
      .from('external_review_dish_mentions')
      .select('id, review_id, restaurant_id, dish_name, dish_name_normalized, confidence, sentiment, dish_context')
      .eq('restaurant_id', restaurantId)
      .range(from, from + pageSize - 1)
    if (error) throw error
    if (!data || data.length === 0) break
    out.push(...(data as Mention[]))
    if (data.length < pageSize) break
  }
  return out
}

async function loadReviews(restaurantId: string): Promise<Map<string, Review>> {
  const { data, error } = await supabase
    .from('external_reviews')
    .select('id, source, rating, text')
    .eq('restaurant_id', restaurantId)
  if (error) throw error
  const m = new Map<string, Review>()
  for (const r of data ?? []) m.set((r as any).id, r as Review)
  return m
}

async function loadMenuItems(restaurantId: string): Promise<Map<string, string>> {
  // Map lower(item_name) → menu_item_id for later join on ranked rows
  const { data, error } = await supabase
    .from('restaurant_menu_items')
    .select('id, item_name')
    .eq('restaurant_id', restaurantId)
  if (error) return new Map()
  const map = new Map<string, string>()
  for (const r of data ?? []) {
    const k = (r as any).item_name?.toLowerCase().trim()
    if (k) map.set(k, (r as any).id)
  }
  return map
}

// ---- Scoring ----
const SENT_WEIGHT = { positive: 1.0, neutral: 0.2, negative: -0.6 } as const

function sourceWeight(review: Review | undefined): number {
  if (!review) return 0.4
  // Short SERP snippets are less trustworthy than full reviews.
  // Google (Places API / scraped) reviews are the strongest signal
  // because they're real reviews with ratings. SERP snippets
  // (ecosia / startpage / mojeek) are teasers/descriptions — they
  // mention dishes but don't always express user sentiment. Halve
  // their weight.
  const len = review.text?.length ?? 0
  if (review.source === 'google') {
    if (len >= 150) return 1.0
    if (len >= 60) return 0.7
    return 0.4
  }
  if (review.source === 'tiktok' || review.source === 'instagram') return 0.9
  // SERP snippet sources
  if (review.source === 'ecosia' || review.source === 'startpage' || review.source === 'mojeek') {
    return len >= 120 ? 0.35 : 0.2
  }
  return 0.4
}

function ratingWeight(r: Review | undefined): number {
  if (!r || r.rating == null) return 0.8
  const rt = r.rating
  if (rt >= 4.5) return 1.0
  if (rt >= 3.5) return 0.85
  if (rt >= 2.5) return 0.7
  if (rt >= 1.5) return 0.55
  return 0.4
}

interface Scored {
  key: string                // normalized dish name
  display: string            // best display name
  score: number
  positive: number
  negative: number
  neutral: number
  google: number
  tiktok: number
  instagram: number
  other: number
  bestQuote: string | null
  bestQuoteSource: string | null
  bestQuoteScore: number
  fromMenu: boolean          // any mention with confidence >= 0.9
}

function scoreRestaurant(
  mentions: Mention[],
  reviews: Map<string, Review>,
): Scored[] {
  const buckets = new Map<string, Scored>()
  for (const m of mentions) {
    const review = reviews.get(m.review_id)
    const srcW = sourceWeight(review)
    const ratingW = ratingWeight(review)
    const confW = m.confidence
    const sent = SENT_WEIGHT[m.sentiment] ?? 0
    const contribution = sent * srcW * ratingW * confW

    const key = m.dish_name_normalized
    let b = buckets.get(key)
    if (!b) {
      b = {
        key,
        display: m.dish_name,
        score: 0,
        positive: 0, negative: 0, neutral: 0,
        google: 0, tiktok: 0, instagram: 0, other: 0,
        bestQuote: null, bestQuoteSource: null, bestQuoteScore: -Infinity,
        fromMenu: false,
      }
      buckets.set(key, b)
    }
    b.score += contribution
    if (m.sentiment === 'positive') b.positive += 1
    else if (m.sentiment === 'negative') b.negative += 1
    else b.neutral += 1

    const src = review?.source ?? 'other'
    if (src === 'google') b.google += 1
    else if (src === 'tiktok') b.tiktok += 1
    else if (src === 'instagram') b.instagram += 1
    else b.other += 1

    if (m.confidence >= 0.9) b.fromMenu = true
    // Prefer longer menu-style names for display
    if (m.dish_name.length > b.display.length) b.display = m.dish_name

    // Sample quote: pick highest-quality positive, full-sentence context
    if (m.sentiment === 'positive' && m.dish_context) {
      const q = m.dish_context.trim()
      if (q.length >= 40 && q.length <= 280) {
        const quoteScore = srcW * ratingW + (q.length >= 60 ? 0.2 : 0)
        if (quoteScore > b.bestQuoteScore) {
          b.bestQuote = q
          b.bestQuoteSource = src
          b.bestQuoteScore = quoteScore
        }
      }
    }
  }

  // Post-process: frequency boost, specificity bonus, haircut for
  // super-generic words
  const out: Scored[] = []
  for (const b of buckets.values()) {
    const total = b.positive + b.negative + b.neutral
    if (total === 0) continue
    const freqBoost = Math.log1p(total)     // 1 → 0.69, 10 → 2.4, 100 → 4.6
    let final = b.score * (1 + 0.35 * freqBoost)
    if (b.fromMenu) final += 0.5
    if (GENERIC_BUCKETS.has(b.key)) final -= 0.3
    // Floor: don't promote overwhelmingly-negative dishes
    if (b.negative > b.positive * 2 && b.negative >= 3) final -= 1.0
    b.score = final
    out.push(b)
  }
  out.sort((a, b) => b.score - a.score)
  return out
}

function pickFallbackQuote(
  mentions: Mention[],
  reviews: Map<string, Review>,
  key: string,
): { quote: string; source: string } | null {
  // Fallback if no positive sentence hit the 40-280 window.
  for (const m of mentions) {
    if (m.dish_name_normalized !== key) continue
    if (!m.dish_context) continue
    const q = m.dish_context.trim()
    if (q.length < 20 || q.length > 320) continue
    const src = reviews.get(m.review_id)?.source ?? 'other'
    return { quote: q.slice(0, 280), source: src }
  }
  return null
}

async function rebuildOne(r: Restaurant, args: Args) {
  const [mentions, reviews, menuMap] = await Promise.all([
    loadMentions(r.id),
    loadReviews(r.id),
    loadMenuItems(r.id),
  ])
  if (mentions.length === 0) return null

  const ranked = scoreRestaurant(mentions, reviews).slice(0, args.topN)
  if (ranked.length === 0) return null

  const rows = ranked.map((d, i) => {
    // Fallback quote if we didn't pick a positive one
    let quote = d.bestQuote
    let quoteSource = d.bestQuoteSource
    if (!quote) {
      const f = pickFallbackQuote(mentions, reviews, d.key)
      if (f) {
        quote = f.quote
        quoteSource = f.source
      }
    }
    const menuItemId = menuMap.get(d.display.toLowerCase()) ?? null
    const total = d.google + d.tiktok + d.instagram + d.other
    return {
      restaurant_id: r.id,
      menu_item_id: menuItemId,
      display_name: d.display,
      rank: i + 1,
      score: Math.round(d.score * 1000) / 1000,
      positive_count: d.positive,
      negative_count: d.negative,
      neutral_count: d.neutral,
      google_mentions: d.google,
      tiktok_mentions: d.tiktok,
      instagram_mentions: d.instagram,
      total_mentions: total,
      sample_quote: quote,
      sample_quote_source: quoteSource,
      tier: d.fromMenu ? 'menu_anchored' : 'rollup_fallback',
      price_cents: null,
      computed_at: new Date().toISOString(),
    }
  })

  if (args.dryRun) {
    console.log(`— ${r.name} · ${mentions.length} mentions · top ${rows.length}:`)
    for (const row of rows.slice(0, 10)) {
      const q = row.sample_quote ? row.sample_quote.slice(0, 60) + '…' : '(no quote)'
      console.log(`   #${row.rank} [${row.tier === 'menu_anchored' ? 'M' : 'D'}] ${row.display_name.padEnd(28)}  s=${row.score.toFixed(2).padStart(6)}  +${row.positive_count} -${row.negative_count} =${row.neutral_count}  ${q}`)
    }
    return { dishes: rows.length }
  }

  // Idempotent wipe-and-insert
  const { error: delErr } = await supabase
    .from('restaurant_top_dishes')
    .delete()
    .eq('restaurant_id', r.id)
  if (delErr) {
    console.warn(`   [delete fail] ${r.name}: ${delErr.message}`)
    return null
  }
  const { error: insErr } = await supabase
    .from('restaurant_top_dishes')
    .insert(rows)
  if (insErr) {
    console.warn(`   [insert fail] ${r.name}: ${insErr.message}`)
    return null
  }
  return { dishes: rows.length }
}

async function main() {
  const args = parseArgs()
  console.log('Args:', JSON.stringify(args))
  const restaurants = await loadEligibleRestaurants(args)
  console.log(`Processing ${restaurants.length} restaurants with mentions`)

  let touched = 0
  let totalDishes = 0
  let cursor = 0
  const t0 = Date.now()

  async function worker() {
    while (cursor < restaurants.length) {
      const r = restaurants[cursor++]
      try {
        const res = await rebuildOne(r, args)
        if (res) {
          touched += 1
          totalDishes += res.dishes
        }
      } catch (err) {
        console.warn(`  [skip] ${r.name}: ${(err as Error).message}`)
      }
      if (cursor % 25 === 0) {
        const rate = cursor / ((Date.now() - t0) / 1000)
        console.log(`  …${cursor}/${restaurants.length}  ${rate.toFixed(1)} r/s  touched=${touched}`)
      }
    }
  }
  await Promise.all(Array.from({ length: args.concurrency }, () => worker()))
  const mins = ((Date.now() - t0) / 1000 / 60).toFixed(1)
  console.log('')
  console.log(`Done in ${mins}m. restaurants=${touched}/${restaurants.length} dishRows=${totalDishes}`)
}

main().catch(e => { console.error(e); process.exit(1) })
