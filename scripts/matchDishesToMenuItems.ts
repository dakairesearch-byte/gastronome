/**
 * matchDishesToMenuItems.ts
 *
 * Upgrade generic dish names in `restaurant_highlighted_dishes` to specific
 * menu item names from `restaurant_menu_items`.
 *
 * Strategy
 * --------
 * 1. Load all highlighted dishes and all menu items per restaurant (only for
 *    restaurants that have menu data).
 * 2. Filter out obvious noise dishes (too short, stop phrases, English
 *    fragments like "i've" or "place for a while") before matching.
 * 3. For each (restaurant, dish) pair, score every menu item:
 *      - whole-phrase substring of dish in item_name -> strong (0.9 + bonus)
 *      - token-based: fraction of dish tokens that appear as item tokens,
 *        weighted by token importance (stop words discounted).
 *      - plural / singular collapse ("frie" <-> "fries").
 *      - prefer longer dish-token matches (chocolate cake beats cake).
 *      - prefer menu items whose section doesn't look like a drinks list.
 * 4. Keep the highest scorer; write back display_name, matched_menu_item_id,
 *    match_confidence, match_method, matched_at.
 * 5. Dry-run by default; pass --write to persist.
 *
 * Run:
 *   npx tsx scripts/matchDishesToMenuItems.ts            # dry-run, prints stats
 *   npx tsx scripts/matchDishesToMenuItems.ts --write    # persists matches
 *   npx tsx scripts/matchDishesToMenuItems.ts --sample 20
 */

import { createClient } from '@supabase/supabase-js'
import * as fs from 'fs'
import * as path from 'path'

const envPath = path.join(process.cwd(), '.env.local')
if (fs.existsSync(envPath)) {
  for (const line of fs.readFileSync(envPath, 'utf8').split('\n')) {
    const m = line.match(/^([A-Z0-9_]+)=(.*)$/)
    if (m && !process.env[m[1]]) process.env[m[1]] = m[2].replace(/^"|"$/g, '')
  }
}

const SUPABASE_URL = process.env.NEXT_PUBLIC_SUPABASE_URL || process.env.SUPABASE_URL
const SUPABASE_KEY =
  process.env.SUPABASE_SERVICE_ROLE_KEY ||
  process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY ||
  process.env.SUPABASE_ANON_KEY

if (!SUPABASE_URL || !SUPABASE_KEY) {
  console.error('Missing SUPABASE_URL or key env vars')
  process.exit(1)
}
const sb = createClient(SUPABASE_URL, SUPABASE_KEY, { auth: { persistSession: false } })

// --------- CLI ---------
const args = process.argv.slice(2)
const WRITE = args.includes('--write')
const SAMPLE = (() => {
  const i = args.indexOf('--sample')
  if (i === -1) return 0
  return parseInt(args[i + 1] || '0', 10) || 0
})()
const MIN_CONF = 0.5

// --------- Noise filtering ---------
const STOP_WORDS = new Set([
  'the', 'a', 'an', 'of', 'and', 'or', 'to', 'at', 'in', 'on', 'for', 'with',
  'by', 'from', 'as', 'is', 'it', 'be', 'very', 'just', 'more', 'too', 'so',
  'my', 'our', 'your', 'their', 'this', 'that', 'these', 'those', 'have',
  'had', 'was', 'were', 'been', 'being', 'am', 'are', 'will', 'would',
  'could', 'should', 'been', 'out', 'up', 'down', 'off', 'over', 'again',
  "i've", "i'm", "we've", "we're", 'blessed', 'complex', 'hard',
])

// Phrases / fragments that are clearly not dish names.
const NOISE_PATTERNS = [
  /\bi['\u2019]ve\b/i,
  /\bwe['\u2019]ve\b/i,
  /\bi['\u2019]m\b/i,
  /\bwe['\u2019]re\b/i,
  /\bfor a while\b/i,
  /\bduring rush hour\b/i,
  /\bdining experience/i,
  /\bcame out\b/i,
  /\blooking just\b/i,
  /^in [a-z\s]+$/i, // "in san francisco"
  /^the\b/i,
  /\b(restaurant|place|spot|joint|best|favorite|perfect|amazing)\b/i,
  /^(blessed|busy|more|too|very|just|warm|hot|cold|fresh|great|good|nice)$/i,
  /^(more|too|very) .+/i, // "more vegan food", "too hard"
  /\bsized\b.*\bfor\b/i,
  /\bi have\b/i,
]

// Generic-ingredient dishes we still want to match (don't drop as noise).
// Single-word or very short dishes are fine if they aren't stop words.

function isNoiseDish(name: string): boolean {
  const s = name.trim().toLowerCase()
  if (!s) return true
  if (s.length < 3) return true
  if (s.split(/\s+/).length > 5) return true // "too hard to be complex"
  for (const re of NOISE_PATTERNS) {
    if (re.test(s)) return true
  }
  // Reject dishes that are entirely stop words.
  const toks = s.split(/\s+/).filter((t) => !STOP_WORDS.has(t))
  if (toks.length === 0) return true
  return false
}

// --------- Normalization ---------
function normalize(text: string): string {
  return text
    .toLowerCase()
    .replace(/[\u2018\u2019]/g, "'")
    .replace(/[^a-z0-9'\s-]+/g, ' ')
    .replace(/\s+/g, ' ')
    .trim()
}

// Very small singular/plural collapse. We convert each token to a "stem"
// so "frie" and "fries" compare equal, "burger" and "burgers" compare equal.
function stem(tok: string): string {
  if (tok.length <= 3) return tok
  // Irregulars we care about
  const IRREG: Record<string, string> = {
    fries: 'fry', frie: 'fry',
    leaves: 'leaf',
    wings: 'wing', wing: 'wing',
    ribs: 'rib', rib: 'rib',
    oysters: 'oyster', oyster: 'oyster',
    clams: 'clam', clam: 'clam',
    potatoes: 'potato', potato: 'potato',
    tomatoes: 'tomato', tomato: 'tomato',
    anchovies: 'anchovy', anchovy: 'anchovy',
    berries: 'berry', berry: 'berry',
    hummus: 'hummu', hummu: 'hummu',
  }
  if (IRREG[tok]) return IRREG[tok]
  if (tok.endsWith('sses')) return tok // dresses -> keep
  if (tok.endsWith('ies') && tok.length > 4) return tok.slice(0, -3) + 'y'
  if (tok.endsWith('ses') || tok.endsWith('xes') || tok.endsWith('zes') || tok.endsWith('ches') || tok.endsWith('shes'))
    return tok.slice(0, -2)
  if (tok.endsWith('s') && !tok.endsWith('ss') && !tok.endsWith('us'))
    return tok.slice(0, -1)
  return tok
}

function tokens(text: string): string[] {
  return normalize(text)
    .split(/\s+/)
    .filter(Boolean)
    .filter((t) => !STOP_WORDS.has(t))
    .map(stem)
}

// --------- Scoring ---------
const DRINK_SECTIONS = /(drink|cocktail|wine|beer|spirit|whisk|vodka|gin|rum|tequila|mezcal|bar|beverage|aperitif|digestif|amaro|sake|liqueur)/i
const DESSERT_SECTIONS = /(dessert|sweet|pastr|gelato|sorbet|ice\s*cream|cake)/i

function scoreMatch(
  dishName: string,
  item: { item_name: string; section: string | null }
): number {
  const dishNorm = normalize(dishName)
  const itemNorm = normalize(item.item_name)
  if (!dishNorm || !itemNorm) return 0

  const dToks = tokens(dishName)
  const iToks = tokens(item.item_name)
  if (dToks.length === 0 || iToks.length === 0) return 0

  const iTokSet = new Set(iToks)

  // Full-phrase substring is a strong signal ("chicken" in "Roasted Chicken"),
  // but ONLY if word-aligned. Without word-alignment, "tart" matches "tartare",
  // "warm" matches "shawarma", "bun" matches "bundt". Fall through to token
  // overlap in those cases (which uses stems and will correctly give 0 here).
  const esc = dishNorm.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')
  const wordAligned = new RegExp(`(^|\\W)${esc}(\\W|$)`).test(itemNorm)
  let score = 0
  if (itemNorm.includes(dishNorm) && wordAligned) {
    score = 0.85
    // Bonus for longer dish phrase matches
    score += Math.min(dToks.length - 1, 3) * 0.03
  } else {
    // Token overlap fraction (intersection / dish size), weighted by length
    let hit = 0
    for (const t of dToks) if (iTokSet.has(t)) hit++
    const frac = hit / dToks.length
    if (hit === 0) return 0
    // For multi-token dishes, a single-token match is weak (e.g. "rice ball"
    // matching just "rice" in a rice dish). Require >=50% overlap for multi-
    // token dishes, otherwise fall back to a lower score.
    if (dToks.length >= 2 && hit === 1) {
      score = 0.3 + 0.15 * frac
    } else {
      score = 0.45 + 0.35 * frac
      if (hit >= 2) score += 0.05
    }
  }

  // Penalize menu items that are obviously drinks unless the dish itself is a drink.
  const dishIsDrinkLike = /(cocktail|wine|beer|whiskey|whisky|vodka|gin|sake|spritz)/i.test(dishName)
  if (!dishIsDrinkLike) {
    if (item.section && DRINK_SECTIONS.test(item.section)) {
      score -= 0.4
    }
    // Pattern-based wine/vintage detection on item name when section is unreliable:
    // 4-digit vintage year (1900-2099), or trailing N.V./NV, or ABV mention.
    if (/\b(19|20)\d{2}\b/.test(item.item_name) || /\bN\.?V\.?\b/.test(item.item_name) || /\b\d+(\.\d+)?\s?%\s?(abv|alc)/i.test(item.item_name)) {
      score -= 0.45
    }
  }

  // Prefer shorter item names when ties — "Burger" beats "Burger with 12 toppings and..."
  // but we still need a small discount for stupidly-long items (likely descriptions).
  const itemWordCount = iToks.length
  if (itemWordCount > 10) score -= 0.1

  // Small boost if the dish is a dessert word and the section is dessert.
  const dishIsDessert = /(cake|pie|tart|cookie|ice\s*cream|gelato|sorbet|cheesecake|brownie|donut|doughnut)/i.test(dishName)
  if (dishIsDessert && item.section && DESSERT_SECTIONS.test(item.section)) {
    score += 0.05
  }

  return Math.max(0, Math.min(1, score))
}

// --------- Display-name cleanup ---------
// Menu item names extracted from raw HTML/PDF often end with price fragments
// ("$18", "15.00"), bare dash separators (" — description"), or formatting
// junk (" * -", "(GF)"). Clean those up for display.
function cleanDisplayName(raw: string): string {
  let s = raw.trim()
  // Strip trailing bare dashes and asterisks.
  s = s.replace(/[\s*\-—–]+$/g, '').trim()
  // If there is a dash separator followed by a description, drop the description.
  // Keep the first clause.
  s = s.split(/\s+[—–-]\s+/)[0].trim()
  // Drop trailing " $18", " 18.00", " -- 18", " | 18".
  s = s.replace(/\s*[|]\s*\d[\d.,]*\s*$/g, '').trim()
  s = s.replace(/\s*\$?\s?\d{1,3}(\.\d{2})?\s*$/g, '').trim()
  // Drop trailing dietary markers.
  s = s.replace(/\s*\((?:gf|df|v|ve|vg|vegan|vegetarian|nf|gluten[-\s]?free|dairy[-\s]?free)\)\s*$/gi, '').trim()
  // Collapse internal whitespace.
  s = s.replace(/\s+/g, ' ').trim()
  // Capitalize consistently if the whole string is lowercase or uppercase.
  if (s && (s === s.toLowerCase() || s === s.toUpperCase())) {
    s = s
      .toLowerCase()
      .split(/(\s+)/)
      .map((w) =>
        /^[a-z]/.test(w) ? w.charAt(0).toUpperCase() + w.slice(1) : w
      )
      .join('')
  }
  // Bail out if we cleaned too aggressively.
  if (!s) return raw.trim()
  return s
}

// --------- Main ---------
type DishRow = {
  restaurant_id: string
  dish_name: string
  rank: number | null
  mention_count: number | null
}
type ItemRow = {
  id: string
  restaurant_id: string
  item_name: string
  section: string | null
}

async function loadAll<T>(
  table: string,
  select: string,
  orderBy?: string
): Promise<T[]> {
  const rows: T[] = []
  let from = 0
  const pageSize = 1000
  while (true) {
    let q: any = sb.from(table).select(select).range(from, from + pageSize - 1)
    if (orderBy) q = q.order(orderBy)
    const { data, error } = await q
    if (error) throw error
    if (!data || data.length === 0) break
    rows.push(...(data as T[]))
    if (data.length < pageSize) break
    from += pageSize
  }
  return rows
}

async function main() {
  console.log(`[match] mode=${WRITE ? 'WRITE' : 'DRY-RUN'} sample=${SAMPLE || 'all'}`)

  const dishes = await loadAll<DishRow>(
    'restaurant_highlighted_dishes',
    'restaurant_id,dish_name,rank,mention_count'
  )
  console.log(`[match] loaded ${dishes.length} highlighted dishes`)

  const items = await loadAll<ItemRow>(
    'restaurant_menu_items',
    'id,restaurant_id,item_name,section'
  )
  console.log(`[match] loaded ${items.length} menu items`)

  // Index items by restaurant
  const itemsByRest = new Map<string, ItemRow[]>()
  for (const it of items) {
    let arr = itemsByRest.get(it.restaurant_id)
    if (!arr) {
      arr = []
      itemsByRest.set(it.restaurant_id, arr)
    }
    arr.push(it)
  }
  console.log(`[match] ${itemsByRest.size} restaurants have menu items`)

  let considered = 0
  let noisy = 0
  let noMenu = 0
  let noMatch = 0
  let matched = 0
  const confBuckets = { '<.4': 0, '.4-.6': 0, '.6-.8': 0, '>.8': 0 }
  const methodCounts: Record<string, number> = {}

  type Update = {
    restaurant_id: string
    dish_name: string
    display_name: string
    matched_menu_item_id: string
    match_confidence: number
    match_method: string
  }
  const updates: Update[] = []
  const samples: {
    dish: string
    display: string
    conf: number
    method: string
  }[] = []

  for (const d of dishes) {
    considered++
    if (isNoiseDish(d.dish_name)) {
      noisy++
      continue
    }
    const menu = itemsByRest.get(d.restaurant_id)
    if (!menu || menu.length === 0) {
      noMenu++
      continue
    }
    let best: { item: ItemRow; score: number } | null = null
    for (const it of menu) {
      const s = scoreMatch(d.dish_name, it)
      if (!best || s > best.score) best = { item: it, score: s }
    }
    if (!best || best.score < MIN_CONF) {
      noMatch++
      continue
    }
    matched++
    const method = (() => {
      const dishNorm = normalize(d.dish_name)
      const itemNorm = normalize(best!.item.item_name)
      const esc = dishNorm.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')
      const wordAligned = new RegExp(`(^|\\W)${esc}(\\W|$)`).test(itemNorm)
      if (itemNorm.includes(dishNorm) && wordAligned) return 'substring'
      return 'token-overlap'
    })()
    methodCounts[method] = (methodCounts[method] || 0) + 1
    if (best.score < 0.4) confBuckets['<.4']++
    else if (best.score < 0.6) confBuckets['.4-.6']++
    else if (best.score < 0.8) confBuckets['.6-.8']++
    else confBuckets['>.8']++

    updates.push({
      restaurant_id: d.restaurant_id,
      dish_name: d.dish_name,
      display_name: cleanDisplayName(best.item.item_name),
      matched_menu_item_id: best.item.id,
      match_confidence: Number(best.score.toFixed(3)),
      match_method: method,
    })
    if (samples.length < 40) {
      samples.push({
        dish: d.dish_name,
        display: cleanDisplayName(best.item.item_name),
        conf: Number(best.score.toFixed(3)),
        method,
      })
    }
  }

  console.log('---')
  console.log(`[match] considered: ${considered}`)
  console.log(`[match] dropped noisy: ${noisy}`)
  console.log(`[match] no menu data: ${noMenu}`)
  console.log(`[match] no match ≥${MIN_CONF}: ${noMatch}`)
  console.log(`[match] matched: ${matched}`)
  console.log(`[match] confidence buckets:`, confBuckets)
  console.log(`[match] methods:`, methodCounts)
  console.log('---')
  console.log(`[match] sample of matches:`)
  for (const s of samples) {
    console.log(`  [${s.conf}|${s.method}] ${JSON.stringify(s.dish)} -> ${JSON.stringify(s.display)}`)
  }

  if (!WRITE) {
    console.log('[match] dry-run. re-run with --write to persist.')
    return
  }

  // Write in batches.
  const now = new Date().toISOString()
  const toWrite = SAMPLE > 0 ? updates.slice(0, SAMPLE) : updates
  console.log(`[match] writing ${toWrite.length} updates...`)
  let wrote = 0
  const BATCH = 200
  for (let i = 0; i < toWrite.length; i += BATCH) {
    const chunk = toWrite.slice(i, i + BATCH)
    // Update each row by composite key (restaurant_id, dish_name)
    // Supabase JS doesn't batch-update by composite keys, so we issue one per row.
    // For 8k rows this runs in ~30s.
    for (const u of chunk) {
      const { error } = await sb
        .from('restaurant_highlighted_dishes')
        .update({
          display_name: u.display_name,
          matched_menu_item_id: u.matched_menu_item_id,
          match_confidence: u.match_confidence,
          match_method: u.match_method,
          matched_at: now,
        })
        .eq('restaurant_id', u.restaurant_id)
        .eq('dish_name', u.dish_name)
      if (error) {
        console.error(`  update error [${u.restaurant_id}|${u.dish_name}]:`, error.message)
      } else {
        wrote++
      }
    }
    console.log(`  ...${Math.min(i + BATCH, toWrite.length)}/${toWrite.length}`)
  }
  console.log(`[match] wrote ${wrote}/${toWrite.length} rows`)
}

main().catch((e) => {
  console.error(e)
  process.exit(1)
})
