/**
 * extractDishMentionsV2.ts
 *
 * Phase A: Rewrite dish-mention extraction over all existing
 * external_reviews with aspect-window VADER sentiment.
 *
 * For each restaurant × each external_review:
 *   1. If menu_items exist: closed-set match against item names.
 *   2. If no menu items: open-set match against the curated dish_dict +
 *      the legacy extractDishesFromCaption heuristic.
 *   3. For each match, score sentiment with ±8-token window (see
 *      src/lib/reviews/sentiment.ts).
 *   4. Persist per-mention row into external_review_dish_mentions with
 *      sentiment label + context quote.
 *
 * Upserts on (review_id, dish_name_normalized). Idempotent.
 *
 * Usage:
 *   npx tsx scripts/extractDishMentionsV2.ts --limit 20 --dry-run
 *   npx tsx scripts/extractDishMentionsV2.ts --restaurant <id>
 *   npx tsx scripts/extractDishMentionsV2.ts
 */

import { createClient } from '@supabase/supabase-js'
import fs from 'node:fs'
import path from 'node:path'
import { findDishMentions, extractSentenceAt } from '../src/lib/reviews/sentiment'
import { canonicalize } from '../src/lib/dishes/extract'

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
  source: string | null    // filter to one review source
  concurrency: number
  wipe: boolean            // delete existing mentions for this restaurant first
}
function parseArgs(): Args {
  const a: Args = { dryRun: false, limit: null, restaurantId: null, source: null, concurrency: 6, wipe: false }
  const argv = process.argv.slice(2)
  for (let i = 0; i < argv.length; i++) {
    if (argv[i] === '--dry-run') a.dryRun = true
    else if (argv[i] === '--limit') a.limit = parseInt(argv[++i], 10)
    else if (argv[i] === '--restaurant') a.restaurantId = argv[++i]
    else if (argv[i] === '--source') a.source = argv[++i]
    else if (argv[i] === '--concurrency') a.concurrency = parseInt(argv[++i], 10)
    else if (argv[i] === '--wipe') a.wipe = true
  }
  return a
}

// ---- Dish dictionary (global fallback) ----
let DISH_DICT_PHRASES: string[] = []
async function loadDishDict() {
  // Sort descending by phrase length so the longest match wins in findDishMentions
  const { data, error } = await supabase.from('dish_dict').select('phrase').order('confidence', { ascending: false }).limit(2000)
  if (error) throw error
  DISH_DICT_PHRASES = (data ?? []).map((r: any) => r.phrase).filter((s: string) => s && s.length >= 3)
  DISH_DICT_PHRASES.sort((a, b) => b.length - a.length)
  console.log(`[dict] loaded ${DISH_DICT_PHRASES.length} phrases`)
}

// ---- Types ----
type Restaurant = { id: string; name: string }
type MenuItem = { id: string; item_name: string; section: string | null }
type Review = { id: string; text: string; source: string; rating: number | null }

// Words that are on menus but are too generic to match ("food", "entrees", "specials")
const MENU_NOISE = new Set([
  'food', 'menu', 'entrees', 'appetizers', 'sides', 'desserts', 'drinks',
  'beverages', 'specials', 'bar', 'wine', 'beer', 'coffee', 'tea', 'water',
  'small', 'large', 'regular', 'extra', 'add', 'addon', 'on', 'of', 'the',
  'a', 'an', 'with', 'and', 'or', 'house', 'daily', 'choice', 'options',
])

function cleanMenuItemName(raw: string): string {
  // Strip price indicators like "$14" or "... · $14"
  let s = raw.replace(/\s*[·\-–—]\s*\$?\d+(\.\d+)?\s*$/i, '').trim()
  // Strip parenthetical add-ons
  s = s.replace(/\([^)]*\)/g, '').trim()
  // Collapse whitespace
  s = s.replace(/\s+/g, ' ').trim()
  // Smart-case ALL CAPS menu items: "CURRY LEAF CRAB" → "Curry Leaf Crab"
  // Many restaurants type menu items in caps in their web menu source.
  // Only transform if the item is >80% uppercase letters to avoid changing
  // intentional casing like "BLT" or proper names.
  const letters = s.match(/[A-Za-z]/g) ?? []
  const uppers = s.match(/[A-Z]/g) ?? []
  if (letters.length >= 5 && uppers.length / letters.length >= 0.8) {
    s = s.toLowerCase().replace(/\b([a-z])/g, (_, c) => c.toUpperCase())
  }
  return s
}

function isUsefulMenuItem(name: string): boolean {
  const clean = name.toLowerCase().trim()
  if (clean.length < 3 || clean.length > 60) return false
  if (MENU_NOISE.has(clean)) return false
  // Skip generic headers
  if (/^(breakfast|lunch|dinner|menu)$/i.test(clean)) return false
  return true
}

// ---- Data loading ----
async function loadEligibleRestaurants(args: Args): Promise<Restaurant[]> {
  // Any restaurant that has external_reviews rows is a candidate
  let q = supabase
    .from('external_reviews')
    .select('restaurant_id', { count: 'exact', head: false })
  if (args.source) q = q.eq('source', args.source)
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

async function loadMenuItems(restaurantId: string): Promise<string[]> {
  const { data, error } = await supabase
    .from('restaurant_menu_items')
    .select('item_name, section')
    .eq('restaurant_id', restaurantId)
  if (error) return []
  const items: string[] = []
  const seen = new Set<string>()
  for (const r of data ?? []) {
    const name = cleanMenuItemName((r as any).item_name ?? '')
    if (!isUsefulMenuItem(name)) continue
    const key = name.toLowerCase()
    if (seen.has(key)) continue
    seen.add(key)
    items.push(name)
  }
  // Longest first so "Dry-Aged Ribeye" beats "Ribeye"
  items.sort((a, b) => b.length - a.length)
  return items
}

async function loadReviews(restaurantId: string, source: string | null): Promise<Review[]> {
  let q = supabase
    .from('external_reviews')
    .select('id, text, source, rating')
    .eq('restaurant_id', restaurantId)
  if (source) q = q.eq('source', source)
  const { data, error } = await q
  if (error) throw error
  return (data ?? [])
    .filter((r: any) => r.text && r.text.trim().length >= 15)
    .map((r: any) => ({ id: r.id, text: r.text as string, source: r.source, rating: r.rating })) as Review[]
}

// ---- Extraction ----
interface MentionRow {
  review_id: string
  restaurant_id: string
  dish_name: string
  dish_name_normalized: string
  confidence: number
  sentiment: 'positive' | 'negative' | 'neutral'
  dish_context: string
}

function extractForReview(
  review: Review,
  restaurantId: string,
  menuItems: string[],
  dishDict: string[],
): MentionRow[] {
  // UNION strategy: always try the dish_dict too — even a 130-item menu
  // often misses the casual "burger" / "pasta" reviewers actually write.
  // Menu items carry higher confidence (0.95); dict-only matches get 0.7.
  const menuSet = new Set(menuItems.map((m) => m.toLowerCase()))
  const combined: string[] = []
  const seenLc = new Set<string>()
  for (const m of menuItems) {
    const k = m.toLowerCase()
    if (seenLc.has(k)) continue
    seenLc.add(k)
    combined.push(m)
  }
  for (const d of dishDict) {
    const k = d.toLowerCase()
    if (seenLc.has(k)) continue
    seenLc.add(k)
    combined.push(d)
  }
  // Longest first so specific menu items win over generic dict phrases
  // (e.g., "Prime Burger" beats "burger" when they overlap)
  combined.sort((a, b) => b.length - a.length)
  if (combined.length === 0) return []

  const matches = findDishMentions(review.text, combined)
  const out: MentionRow[] = []
  const seenNorm = new Set<string>()
  for (const m of matches) {
    const norm = canonicalize(m.dish)
    if (seenNorm.has(norm)) continue
    seenNorm.add(norm)
    // Confidence depends on whether the match came from the menu closed set
    const fromMenu = menuSet.has(m.dish.toLowerCase())
    const confidence = fromMenu ? 0.95 : 0.7
    const quote = extractSentenceAt(review.text, m.position).slice(0, 300)
    out.push({
      review_id: review.id,
      restaurant_id: restaurantId,
      dish_name: m.dish,
      dish_name_normalized: norm,
      confidence,
      sentiment: m.sentimentLabel,
      dish_context: quote,
    })
  }
  return out
}

// ---- Write ----
async function writeMentions(rows: MentionRow[]): Promise<number> {
  if (rows.length === 0) return 0
  // external_review_dish_mentions has no natural unique constraint in the
  // schema (id is the PK), so for idempotency we delete+insert per review
  // upstream, not here.
  const BATCH = 500
  let written = 0
  for (let i = 0; i < rows.length; i += BATCH) {
    const chunk = rows.slice(i, i + BATCH)
    const { error } = await supabase.from('external_review_dish_mentions').insert(chunk)
    if (error) {
      console.warn(`  [insert fail] ${error.message}`)
    } else {
      written += chunk.length
    }
  }
  return written
}

async function deleteExistingMentions(restaurantId: string): Promise<number> {
  const { error, count } = await supabase
    .from('external_review_dish_mentions')
    .delete({ count: 'exact' })
    .eq('restaurant_id', restaurantId)
  if (error) {
    console.warn(`  [delete fail] ${error.message}`)
    return 0
  }
  return count ?? 0
}

// ---- Main ----
async function processOne(r: Restaurant, args: Args): Promise<{ mentions: number; reviews: number } | null> {
  const [menuItems, reviews] = await Promise.all([
    loadMenuItems(r.id),
    loadReviews(r.id, args.source),
  ])
  if (reviews.length === 0) return null

  const rows: MentionRow[] = []
  for (const rev of reviews) {
    const mentions = extractForReview(rev, r.id, menuItems, DISH_DICT_PHRASES)
    rows.push(...mentions)
  }

  if (args.dryRun) {
    // Group by normalized key but display the longest/nicest original name.
    const byDish = new Map<string, { display: string; pos: number; neg: number; neu: number; fromMenu: boolean }>()
    for (const m of rows) {
      const key = m.dish_name_normalized
      const cur = byDish.get(key) ?? { display: m.dish_name, pos: 0, neg: 0, neu: 0, fromMenu: m.confidence >= 0.9 }
      // Prefer longer display names when possible (usually menu item)
      if (m.dish_name.length > cur.display.length) cur.display = m.dish_name
      if (m.confidence >= 0.9) cur.fromMenu = true
      if (m.sentiment === 'positive') cur.pos += 1
      else if (m.sentiment === 'negative') cur.neg += 1
      else cur.neu += 1
      byDish.set(key, cur)
    }
    const top = Array.from(byDish.values())
      .map((v) => ({ total: v.pos + v.neg + v.neu, ...v }))
      .sort((a, b) => b.total - a.total)
      .slice(0, 7)
    console.log(`— ${r.name} · ${reviews.length} reviews · ${rows.length} mentions · menu=${menuItems.length}`)
    for (const t of top) {
      const tag = t.fromMenu ? 'M' : 'D'
      console.log(`   [${tag}] ${t.display.padEnd(34)}  +${t.pos}  -${t.neg}  =${t.neu}`)
    }
    return { mentions: rows.length, reviews: reviews.length }
  }

  // Idempotent rewrite: wipe this restaurant's rows, insert fresh
  if (args.wipe || true) await deleteExistingMentions(r.id)
  const n = await writeMentions(rows)
  return { mentions: n, reviews: reviews.length }
}

async function main() {
  const args = parseArgs()
  console.log('Args:', JSON.stringify(args))
  await loadDishDict()
  const restaurants = await loadEligibleRestaurants(args)
  console.log(`Processing ${restaurants.length} restaurants with review data`)

  let touched = 0
  let totalMentions = 0
  let totalReviews = 0
  let cursor = 0
  const t0 = Date.now()

  async function worker() {
    while (cursor < restaurants.length) {
      const r = restaurants[cursor++]
      try {
        const res = await processOne(r, args)
        if (res) {
          touched += 1
          totalMentions += res.mentions
          totalReviews += res.reviews
        }
      } catch (err) {
        console.warn(`  [skip] ${r.name}: ${(err as Error).message}`)
      }
      if (cursor % 25 === 0) {
        const rate = cursor / ((Date.now() - t0) / 1000)
        console.log(`  …${cursor}/${restaurants.length}  ${rate.toFixed(1)} r/s  touched=${touched} mentions=${totalMentions}`)
      }
    }
  }
  await Promise.all(Array.from({ length: args.concurrency }, () => worker()))
  const mins = ((Date.now() - t0) / 1000 / 60).toFixed(1)
  console.log('')
  console.log(`Done in ${mins}m. restaurants=${touched}/${restaurants.length} reviews=${totalReviews} mentions=${totalMentions}`)
}

main().catch(e => { console.error(e); process.exit(1) })
