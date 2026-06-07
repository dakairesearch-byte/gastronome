/**
 * computeTopDishesFromChips.ts
 *
 * Chip-indexed dish scorer v2. Google Maps already aggregates the most
 * mentioned keywords per place into "people often mention" chips with
 * counts — those chips are our candidate index. Reviews and TikTok/IG
 * captions corroborate. Menu anchoring promotes generic chip keywords
 * ("burger") to specific menu items ("Prime Dry-Aged Burger") when a
 * match exists.
 *
 * Score per chip:
 *   score =
 *       log10(google_count + 1) * 10       // Google's own aggregate signal
 *     + menu_anchor_boost                   // +4 exact / +2 fuzzy / +1 cuisine / 0 none
 *     + log10(review_mentions + 1) * 2      // scraped review body corroboration
 *     + log10(tiktok_mentions + 1) * 3      // video caption corroboration (higher weight
 *     + log10(instagram_mentions + 1) * 3   //   — smaller corpus, each hit is costlier
 *                                           //   to fake, so it's higher-quality signal)
 *
 * Source-of-truth: the scorer does NOT re-scrape Google. It reads chip
 * rows already written by scrapeGoogleReviewsBulk.ts
 * (scrapeReviewsAndChipsOnce persists chips on the same page load that
 * scrapes reviews — zero extra Google traffic). Review-body mentions
 * come from external_reviews.text, caption mentions come from
 * restaurant_videos.caption.
 *
 * Output: writes to restaurant_top_dishes (same table computeTopDishes
 * uses). Per restaurant, up to MAX_TOP chip-derived dishes ordered by
 * score. tier = 'menu_anchored' when anchored, 'rollup_fallback' when
 * chip stands on its own.
 *
 * Usage:
 *   npx tsx scripts/computeTopDishesFromChips.ts                # dry-run
 *   npx tsx scripts/computeTopDishesFromChips.ts --write        # persist
 *   npx tsx scripts/computeTopDishesFromChips.ts --sample=10 --verbose
 *   npx tsx scripts/computeTopDishesFromChips.ts --restaurant <id>
 */
import { createClient } from '@supabase/supabase-js'
import * as fs from 'fs'
import * as path from 'path'

// ---------------- Env loading ----------------
const envPath = path.join(process.cwd(), '.env.local')
if (fs.existsSync(envPath)) {
  for (const line of fs.readFileSync(envPath, 'utf8').split('\n')) {
    const m = line.match(/^([A-Z0-9_]+)=(.*)$/)
    if (m && !process.env[m[1]]) process.env[m[1]] = m[2].replace(/^"|"$/g, '')
  }
}
const SUPA_URL = process.env.NEXT_PUBLIC_SUPABASE_URL!
const SUPA_KEY =
  process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!
if (!SUPA_URL || !SUPA_KEY) {
  console.error('Missing NEXT_PUBLIC_SUPABASE_URL / SUPABASE_SERVICE_ROLE_KEY in .env.local')
  process.exit(1)
}
const sb = createClient(SUPA_URL, SUPA_KEY, { auth: { persistSession: false } })

// ---------------- CLI ----------------
const argMap = Object.fromEntries(
  process.argv.slice(2).map((a) => {
    const [k, v] = a.replace(/^--/, '').split('=')
    return [k, v ?? 'true']
  })
) as Record<string, string>
const WRITE = argMap.write === 'true'
const SAMPLE = parseInt(argMap.sample || '0', 10) || 0
const VERBOSE = argMap.verbose === 'true'
const MAX_TOP = parseInt(argMap.topN || '8', 10)
const RESTAURANT_ID = argMap.restaurant || null

// ---------------- Normalization (mirrors computeTopDishes.ts) ----------------
const STOP_WORDS = new Set([
  'the','a','an','of','and','or','to','at','in','on','for','with','by','from',
  'as','is','it','be','very','just','more','too','so','my','our','your','their',
  'this','that','these','those','have','had','was','were','been','being','am',
  'are','will','would','could','should','out','up','down','off','over','again',
  'de','la','le','du','des','el','los','las',
])
const IRREG: Record<string, string> = {
  fries: 'fry', frie: 'fry', leaves: 'leaf',
  wings: 'wing', wing: 'wing', ribs: 'rib', rib: 'rib',
  oysters: 'oyster', oyster: 'oyster', clams: 'clam', clam: 'clam',
  potatoes: 'potato', potato: 'potato', tomatoes: 'tomato', tomato: 'tomato',
  anchovies: 'anchovy', anchovy: 'anchovy', berries: 'berry', berry: 'berry',
  hummus: 'hummu', hummu: 'hummu', dumplings: 'dumpling', dumpling: 'dumpling',
  noodles: 'noodle', noodle: 'noodle', tacos: 'taco', taco: 'taco',
  buns: 'bun', bun: 'bun', ravioli: 'raviolo', raviolo: 'raviolo',
}
function normalize(text: string): string {
  return text
    .toLowerCase()
    .replace(/[\u2018\u2019]/g, "'")
    .replace(/[\u2013\u2014]/g, '-')
    .replace(/[^a-z0-9'\s-]+/g, ' ')
    .replace(/\s+/g, ' ')
    .trim()
}
function stem(tok: string): string {
  if (tok.length <= 3) return tok
  if (IRREG[tok]) return IRREG[tok]
  if (tok.endsWith('sses')) return tok
  if (tok.endsWith('ies') && tok.length > 4) return tok.slice(0, -3) + 'y'
  if (tok.endsWith('ses') || tok.endsWith('xes') || tok.endsWith('zes') ||
      tok.endsWith('ches') || tok.endsWith('shes')) return tok.slice(0, -2)
  if (tok.endsWith('s') && !tok.endsWith('ss') && !tok.endsWith('us')) return tok.slice(0, -1)
  return tok
}
function tokensOf(text: string): string[] {
  return normalize(text).split(/\s+/).filter(Boolean)
    .filter((t) => !STOP_WORDS.has(t))
    .map(stem)
}
function contentTokens(text: string): string[] {
  const toks = tokensOf(text)
  const out: string[] = []
  for (const t of toks) {
    if (out.length === 0 || out[out.length - 1] !== t) out.push(t)
  }
  return out
}
function titleCase(s: string): string {
  if (!s) return s
  return s.toLowerCase().split(/(\s+|-)/).map((w) =>
    /^[a-z]/.test(w) ? w.charAt(0).toUpperCase() + w.slice(1) : w
  ).join('')
}

// Post-chip-filter guard: filterToDishes already catches the big
// non-dish chips ("service", "atmosphere", …), but Google still surfaces
// some review-meta / vibe chips that aren't food. Reject them here.
const CHIP_NON_DISH = new Set([
  'happy hour','happy hours','lunch special','dinner special','specials',
  'great service','friendly staff','great food','amazing food','bad service',
  'cash only','outdoor seating','indoor seating','open kitchen','small portions',
  'large portions','reasonable prices','fair prices','worth the wait',
  'worth the price','worth the money','date night','good for kids','kid friendly',
  'group dining','private room','cozy atmosphere','nice atmosphere',
])
function isFoodChip(keyword: string): boolean {
  const k = keyword.toLowerCase().trim()
  if (!k) return false
  if (CHIP_NON_DISH.has(k)) return false
  // Leading adjective-only noise ("great ___", "amazing ___")
  if (/^(great|amazing|best|good|bad|terrible|awesome|excellent|nice|lovely|delicious)\s+/.test(k)) {
    // Allow if what follows is clearly a dish noun — otherwise drop.
    const tail = k.replace(/^\S+\s+/, '')
    if (!/^(burger|pizza|taco|sushi|ramen|pho|wings?|pasta|steak|oyster|curry|noodle|sandwich|salad|roll|bao|dumpling|pastry|cake|coffee|latte)s?$/.test(tail)) {
      return false
    }
  }
  // Reject pure adjectives standing alone.
  const adjOnly = /^(amazing|delicious|great|good|bad|awesome|excellent|nice|friendly|attentive|rude|slow|fast|quick|fresh|stale|cozy|noisy|loud|quiet)$/
  if (adjOnly.test(k)) return false
  return true
}

// ---------------- Types ----------------
type Chip = {
  id: string
  restaurant_id: string
  keyword: string           // canonicalized already
  raw_keyword: string
  google_count: number
  sample_quote: string | null
}
type MenuItem = {
  id: string
  restaurant_id: string
  item_name: string
}
type Restaurant = {
  id: string
  name: string
  cuisine: string | null
}
type ReviewRow = {
  restaurant_id: string
  text: string | null
}
type VideoRow = {
  restaurant_id: string
  caption: string | null
  platform: string
  like_count: number | null
}

// Cuisine signatures: when a chip matches a cuisine's canonical dish
// list, we grant the "cuisine_signature" anchor tier even if no actual
// menu item matches. Keys/values copied from computeTopDishes.ts —
// deliberately not imported so this script can evolve independently.
const CUISINE_SIGNATURES: Record<string, string[]> = {
  'Pizza':        ['pizza','margherita','pepperoni pizza','pie','slice'],
  'Steak':        ['steak','ribeye','filet mignon','new york strip','porterhouse','tomahawk','wagyu'],
  'Burger':       ['burger','cheeseburger','smash burger'],
  'Sushi':        ['sushi','nigiri','sashimi','maki','roll','omakase','chirashi'],
  'Japanese':     ['sushi','nigiri','ramen','udon','tempura','yakitori','gyoza','donburi'],
  'Mexican':      ['tacos','burrito','quesadilla','nachos','ceviche','guacamole','enchilada'],
  'Chinese':      ['dumplings','noodles','dim sum','xiao long bao','bao','peking duck'],
  'Italian':      ['pasta','pizza','lasagna','carbonara','risotto','gnocchi','tiramisu','burrata'],
  'Thai':         ['pad thai','curry','tom yum','larb','som tum','drunken noodle','massaman'],
  'French':       ['steak frites','coq au vin','duck confit','cassoulet','escargot'],
  'Korean':       ['kbbq','bibimbap','bulgogi','galbi','kimchi','tteokbokki','japchae','mandu'],
  'Indian':       ['curry','tikka masala','naan','biryani','dosa','samosa','vindaloo'],
  'Seafood':      ['oysters','lobster','crab','scallops','shrimp'],
  'American':     ['burger','steak','wings','mac and cheese','fried chicken','brisket'],
  'Bakery':       ['croissant','bagel','cookie','cake','pastry','danish','muffin','scone'],
  'Cafe':         ['latte','cappuccino','croissant','avocado toast','sandwich'],
  'Mediterranean':['hummus','falafel','kebab','shawarma','tzatziki','pita','labneh'],
  'Ramen':        ['ramen','tonkotsu','miso ramen','shoyu ramen','gyoza'],
  'BBQ':          ['brisket','ribs','pulled pork','burnt ends','mac and cheese','coleslaw'],
  'Vietnamese':   ['pho','banh mi','spring rolls','bun','vermicelli'],
  'Greek':        ['gyro','spanakopita','moussaka','souvlaki','tzatziki','greek salad'],
  'Middle Eastern':['shawarma','falafel','hummus','kebab','pita'],
  'Spanish':      ['paella','tapas','jamon','patatas bravas','churros'],
  'Barbecue':     ['brisket','ribs','pulled pork','burnt ends','mac and cheese','coleslaw'],
  'New American': ['burger','steak','pasta','roast chicken','mac and cheese'],
  'Asian':        ['dumplings','noodles','rice bowl','fried rice'],
  'Taiwanese':    ['beef noodle soup','xiao long bao','bao','bubble tea','scallion pancake'],
  'Filipino':     ['adobo','sisig','lumpia','pancit','halo halo'],
  'Caribbean':    ['jerk chicken','oxtail','curry goat','rice and peas','plantains'],
  'Cuban':        ['cuban sandwich','ropa vieja','mojo pork','black beans and rice','plantains'],
  'Cantonese':    ['dim sum','roast duck','char siu','wonton','congee'],
  'Brunch':       ['eggs benedict','pancakes','french toast','avocado toast','omelette'],
  'Southern':     ['fried chicken','biscuits','shrimp and grits','mac and cheese','cornbread'],
  'Pub':          ['burger','fish and chips','wings','shepherd\'s pie'],
  'Gastropub':    ['burger','fish and chips','wings'],
  'Peruvian':     ['ceviche','lomo saltado','aji de gallina','anticuchos'],
}

// ---------------- Menu anchoring ----------------
/**
 * Anchor a chip keyword to a menu item if possible. Returns the most
 * specific match we can find.
 *
 * Tiers:
 *   1. exact:   all chip tokens (stemmed) appear as consecutive tokens
 *               inside the menu item name — boost +4, confidence 1.0
 *   2. fuzzy:   all chip tokens appear (any order) within the menu item
 *               name — boost +2, confidence 0.6
 *   3. cuisine_signature: chip matches a known cuisine dish for this
 *               restaurant's cuisine — boost +1, confidence 0.4
 *   4. none:    no match — chip stands on its own as display name
 */
type AnchorResult = {
  menuItemId: string | null
  displayName: string
  boost: number
  confidence: number
  method: 'exact' | 'fuzzy' | 'cuisine_signature' | 'none'
}

function anchorChip(
  chip: Chip,
  menuItems: MenuItem[],
  cuisine: string | null
): AnchorResult {
  const chipToks = contentTokens(chip.keyword)
  if (chipToks.length === 0) {
    return { menuItemId: null, displayName: titleCase(chip.raw_keyword), boost: 0, confidence: 0, method: 'none' }
  }
  const chipJoined = chipToks.join(' ')

  // Pass 1: exact (chip token sequence appears contiguously in menu item).
  // Prefer the shortest menu item name that matches — less verbose display.
  let exactMatch: MenuItem | null = null
  let exactLen = Infinity
  for (const mi of menuItems) {
    const miToks = contentTokens(mi.item_name)
    if (miToks.length === 0) continue
    const miJoined = miToks.join(' ')
    // Contiguous substring at word boundaries
    if (miJoined === chipJoined || miJoined.startsWith(chipJoined + ' ') ||
        miJoined.endsWith(' ' + chipJoined) ||
        miJoined.includes(' ' + chipJoined + ' ')) {
      if (mi.item_name.length < exactLen) {
        exactMatch = mi
        exactLen = mi.item_name.length
      }
    }
  }
  if (exactMatch) {
    return {
      menuItemId: exactMatch.id,
      displayName: displayNameFromMenuItem(exactMatch.item_name),
      boost: 4,
      confidence: 1.0,
      method: 'exact',
    }
  }

  // Pass 2: fuzzy (all chip tokens appear in menu item, any order).
  let fuzzyMatch: MenuItem | null = null
  let fuzzyLen = Infinity
  const chipSet = new Set(chipToks)
  for (const mi of menuItems) {
    const miToks = new Set(contentTokens(mi.item_name))
    if (miToks.size === 0) continue
    let allPresent = true
    for (const t of chipSet) {
      if (!miToks.has(t)) { allPresent = false; break }
    }
    if (allPresent) {
      if (mi.item_name.length < fuzzyLen) {
        fuzzyMatch = mi
        fuzzyLen = mi.item_name.length
      }
    }
  }
  if (fuzzyMatch) {
    return {
      menuItemId: fuzzyMatch.id,
      displayName: displayNameFromMenuItem(fuzzyMatch.item_name),
      boost: 2,
      confidence: 0.6,
      method: 'fuzzy',
    }
  }

  // Pass 3: cuisine signature.
  if (cuisine && CUISINE_SIGNATURES[cuisine]) {
    for (const sig of CUISINE_SIGNATURES[cuisine]) {
      const sigToks = new Set(contentTokens(sig))
      let matches = true
      for (const t of chipSet) {
        if (!sigToks.has(t)) { matches = false; break }
      }
      if (matches && sigToks.size === chipSet.size) {
        return {
          menuItemId: null,
          displayName: titleCase(sig),
          boost: 1,
          confidence: 0.4,
          method: 'cuisine_signature',
        }
      }
    }
  }

  return {
    menuItemId: null,
    displayName: titleCase(chip.raw_keyword),
    boost: 0,
    confidence: 0,
    method: 'none',
  }
}

/**
 * Clean up a menu item name for display. Light touch — most of the
 * heavy cleanup (allergen markers, pricing tails) is applied upstream
 * in the menu-item ingestion pipeline. Here we just trim, cap length,
 * and title-case.
 */
function displayNameFromMenuItem(raw: string): string {
  let s = raw.trim()
  // Strip trailing price residue ("Prime Burger $26").
  s = s.replace(/\s*\$?\s?\d{1,3}(\.\d{2})?\s*$/g, '').trim()
  // Strip allergen markers (gf, df, etc.) in parens.
  s = s.replace(/\s*\([^)]*\)\s*$/g, '').trim()
  // Truncate at 4 words if longer.
  const ws = s.split(/\s+/)
  if (ws.length > 5) s = ws.slice(0, 4).join(' ')
  return titleCase(s) || titleCase(raw.trim())
}

// ---------------- Corroboration counting ----------------
/**
 * Count review-body mentions of a chip keyword. Uses word-aligned
 * regex on the chip's token sequence. Single-token keywords need >=4
 * chars (drops noise like "tea", "pie"… wait, those are real dishes).
 * On reflection: chips already passed filterToDishes upstream, so they
 * ARE dishes. No length minimum — every chip token sequence is allowed.
 */
function countMentions(text: string | null, chipKeyword: string): number {
  if (!text) return 0
  const chipToks = contentTokens(chipKeyword)
  if (chipToks.length === 0) return 0
  const textToks = contentTokens(text)
  if (textToks.length === 0) return 0
  const chipJoined = chipToks.join(' ')
  const textJoined = textToks.join(' ')
  // Count non-overlapping contiguous matches.
  let count = 0
  let idx = 0
  const needle = chipJoined
  while (idx <= textJoined.length) {
    const found = textJoined.indexOf(needle, idx)
    if (found < 0) break
    // Word boundary check: preceded by start/space and followed by
    // end/space (contentTokens joined by spaces guarantees this).
    const before = found === 0 || textJoined[found - 1] === ' '
    const afterIdx = found + needle.length
    const after = afterIdx === textJoined.length || textJoined[afterIdx] === ' '
    if (before && after) count++
    idx = found + needle.length
  }
  return count
}

// ---------------- Data loading ----------------
async function loadAll<T>(
  table: string,
  select: string,
  filter?: (q: ReturnType<typeof sb.from>) => ReturnType<typeof sb.from>
): Promise<T[]> {
  const out: T[] = []
  let from = 0
  const PAGE = 1000
  while (true) {
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    let q: any = sb.from(table).select(select)
    if (filter) q = filter(q)
    const { data, error } = await q.range(from, from + PAGE - 1)
    if (error) throw error
    if (!data || data.length === 0) break
    out.push(...(data as T[]))
    if (data.length < PAGE) break
    from += PAGE
  }
  return out
}

// ---------------- Scoring ----------------
type DishScore = {
  menu_item_id: string | null
  display_name: string
  score: number
  google_count: number
  review_mentions: number
  tiktok_mentions: number
  instagram_mentions: number
  sample_quote: string | null
  sample_quote_source: string | null
  tier: 'menu_anchored' | 'rollup_fallback'
  match_method: AnchorResult['method']
  match_confidence: number
  source_breakdown: Record<string, number>
}

function scoreRestaurantChips(
  chips: Chip[],
  menuItems: MenuItem[],
  cuisine: string | null,
  reviewTexts: string[],
  videos: VideoRow[]
): DishScore[] {
  const results: DishScore[] = []
  const seenMenuIds = new Set<string>()
  const seenDisplay = new Set<string>()

  for (const chip of chips) {
    if (!isFoodChip(chip.keyword)) continue
    const anchor = anchorChip(chip, menuItems, cuisine)

    // Count corroborating mentions.
    let reviewHits = 0
    for (const txt of reviewTexts) {
      reviewHits += countMentions(txt, chip.keyword)
    }
    let tiktokHits = 0, instaHits = 0
    for (const v of videos) {
      const hits = countMentions(v.caption, chip.keyword)
      if (hits === 0) continue
      // Like-weight: viral videos count more, but cap so a 10M-like
      // monster doesn't swamp quieter corroboration.
      const likeWeight = Math.min(2, 1 + Math.log10((v.like_count ?? 0) + 10) / 5)
      if (v.platform === 'tiktok') tiktokHits += hits * likeWeight
      else if (v.platform === 'instagram') instaHits += hits * likeWeight
    }

    // Score.
    const gTerm = Math.log10(chip.google_count + 1) * 10
    const rTerm = Math.log10(reviewHits + 1) * 2
    const tTerm = Math.log10(tiktokHits + 1) * 3
    const iTerm = Math.log10(instaHits + 1) * 3
    const score = gTerm + anchor.boost + rTerm + tTerm + iTerm

    const tier: DishScore['tier'] =
      anchor.method === 'exact' || anchor.method === 'fuzzy'
        ? 'menu_anchored'
        : 'rollup_fallback'

    // Per-restaurant de-dup — a chip and a menu-anchored version of
    // that chip shouldn't both make the list.
    if (anchor.menuItemId && seenMenuIds.has(anchor.menuItemId)) continue
    const displayKey = normalize(anchor.displayName)
    if (seenDisplay.has(displayKey)) continue
    seenDisplay.add(displayKey)
    if (anchor.menuItemId) seenMenuIds.add(anchor.menuItemId)

    results.push({
      menu_item_id: anchor.menuItemId,
      display_name: anchor.displayName,
      score: Number(score.toFixed(3)),
      google_count: chip.google_count,
      review_mentions: reviewHits,
      tiktok_mentions: Math.round(tiktokHits),
      instagram_mentions: Math.round(instaHits),
      sample_quote: chip.sample_quote,
      sample_quote_source: chip.sample_quote ? 'google' : null,
      tier,
      match_method: anchor.method,
      match_confidence: anchor.confidence,
      source_breakdown: {
        google_aggregate: Number(gTerm.toFixed(2)),
        anchor_boost: anchor.boost,
        reviews: Number(rTerm.toFixed(2)),
        tiktok: Number(tTerm.toFixed(2)),
        instagram: Number(iTerm.toFixed(2)),
      },
    })
  }

  results.sort((a, b) => b.score - a.score)
  return results.slice(0, MAX_TOP)
}

// ---------------- Main ----------------
async function main() {
  console.log(`[topDishesFromChips] mode=${WRITE ? 'WRITE' : 'DRY-RUN'} topN=${MAX_TOP} ` +
    `${RESTAURANT_ID ? `restaurant=${RESTAURANT_ID}` : ''}`)

  console.log('[topDishesFromChips] loading chips...')
  const chipRows = RESTAURANT_ID
    ? await loadAll<Chip>('restaurant_google_chips',
        'id,restaurant_id,keyword,raw_keyword,google_count,sample_quote',
        (q) => q.eq('restaurant_id', RESTAURANT_ID))
    : await loadAll<Chip>('restaurant_google_chips',
        'id,restaurant_id,keyword,raw_keyword,google_count,sample_quote')
  console.log(`  ${chipRows.length} chips loaded`)

  const uniqueRestIds = Array.from(new Set(chipRows.map((c) => c.restaurant_id)))
  console.log(`  across ${uniqueRestIds.length} restaurants with chip data`)
  if (uniqueRestIds.length === 0) {
    console.log('[topDishesFromChips] no chips to score. scrape first.')
    return
  }

  console.log('[topDishesFromChips] loading menu items, reviews, videos, restaurants...')
  // Pull data scoped to restaurants-that-have-chips. This keeps memory
  // bounded as the chip table grows.
  // NOTE: load full tables and filter in-memory. A .in(restaurant_id, [~1700 uuids])
  // filter overflows PostgREST's URL length limit (414 / empty error) at full scale.
  const restaurants = await loadAll<Restaurant>('restaurants', 'id,name,cuisine',
    (q) => q)
  const menuItems = await loadAll<MenuItem>('restaurant_menu_items',
    'id,restaurant_id,item_name',
    (q) => q)
  const reviews = await loadAll<ReviewRow>('external_reviews',
    'restaurant_id,text',
    (q) => q.eq('source', 'google'))
  const videos = await loadAll<VideoRow>('restaurant_videos',
    'restaurant_id,caption,platform,like_count',
    (q) => q)
  console.log(`  menu=${menuItems.length} reviews=${reviews.length} videos=${videos.length} restaurants=${restaurants.length}`)

  // Group by restaurant for per-restaurant scoring passes.
  const chipByRest = new Map<string, Chip[]>()
  for (const c of chipRows) {
    const arr = chipByRest.get(c.restaurant_id) || []
    arr.push(c)
    chipByRest.set(c.restaurant_id, arr)
  }
  // Sort each restaurant's chips by google_count desc so ties in
  // anchoring prefer the higher-aggregate chip.
  for (const arr of chipByRest.values()) {
    arr.sort((a, b) => b.google_count - a.google_count)
  }

  const menuByRest = new Map<string, MenuItem[]>()
  for (const m of menuItems) {
    const arr = menuByRest.get(m.restaurant_id) || []
    arr.push(m)
    menuByRest.set(m.restaurant_id, arr)
  }
  const reviewsByRest = new Map<string, string[]>()
  for (const r of reviews) {
    if (!r.text) continue
    const arr = reviewsByRest.get(r.restaurant_id) || []
    arr.push(r.text)
    reviewsByRest.set(r.restaurant_id, arr)
  }
  const videosByRest = new Map<string, VideoRow[]>()
  for (const v of videos) {
    const arr = videosByRest.get(v.restaurant_id) || []
    arr.push(v)
    videosByRest.set(v.restaurant_id, arr)
  }
  const restMap = new Map<string, Restaurant>()
  for (const r of restaurants) restMap.set(r.id, r)

  const stats = { restaurants: 0, rowsTotal: 0, tier1: 0, tier2: 0, none: 0 }
  type ScoredRow = DishScore & { restaurant_id: string; restaurant_name: string; rank: number }
  const outputRows: ScoredRow[] = []
  const chipUpdates: Array<{
    id: string
    menu_item_id: string | null
    match_confidence: number
    match_method: string
    review_mentions: number
    tiktok_mentions: number
    instagram_mentions: number
    score: number
    source_breakdown: Record<string, number>
    scored_at: string
  }> = []

  const nowIso = new Date().toISOString()
  const sampleRestaurants: { name: string; rows: DishScore[] }[] = []

  for (const restId of uniqueRestIds) {
    const rest = restMap.get(restId)
    if (!rest) continue
    const rc = chipByRest.get(restId) || []
    const mi = menuByRest.get(restId) || []
    const rv = reviewsByRest.get(restId) || []
    const vd = videosByRest.get(restId) || []
    const scored = scoreRestaurantChips(rc, mi, rest.cuisine, rv, vd)
    if (scored.length === 0) { stats.none++; continue }

    stats.restaurants++
    const hasAnchored = scored.some((s) => s.tier === 'menu_anchored')
    if (hasAnchored) stats.tier1++
    else stats.tier2++

    scored.forEach((s, idx) => {
      outputRows.push({ ...s, restaurant_id: restId, restaurant_name: rest.name, rank: idx + 1 })
    })
    stats.rowsTotal += scored.length

    // Track chip-row updates (score + corroboration, written back to
    // the chip table so Vercel / UI can read one row per chip and know
    // exactly how it scored).
    for (const s of scored) {
      // Find the chip id that produced this score — match on keyword.
      // Display name is post-anchor, so search by chip keyword not by
      // display name.
      const produced = rc.find((c) => titleCase(c.raw_keyword) === s.display_name ||
        anchorChip(c, mi, rest.cuisine).displayName === s.display_name)
      if (!produced) continue
      chipUpdates.push({
        id: produced.id,
        menu_item_id: s.menu_item_id,
        match_confidence: s.match_confidence,
        match_method: s.match_method,
        review_mentions: s.review_mentions,
        tiktok_mentions: s.tiktok_mentions,
        instagram_mentions: s.instagram_mentions,
        score: s.score,
        source_breakdown: s.source_breakdown,
        scored_at: nowIso,
      })
    }

    if (SAMPLE > 0 && sampleRestaurants.length < SAMPLE) {
      sampleRestaurants.push({ name: rest.name, rows: scored })
    } else if (RESTAURANT_ID && sampleRestaurants.length === 0) {
      // Single-restaurant mode — always collect for verbose printout.
      sampleRestaurants.push({ name: rest.name, rows: scored })
    } else if (VERBOSE && SAMPLE === 0 && !RESTAURANT_ID && sampleRestaurants.length < 5) {
      // --verbose with no --sample and no --restaurant: show a handful.
      sampleRestaurants.push({ name: rest.name, rows: scored })
    }
  }

  console.log('---')
  console.log(`[topDishesFromChips] results:`)
  console.log(`  with anchored dishes:      ${stats.tier1} restaurants`)
  console.log(`  rollup-only (no anchor):   ${stats.tier2} restaurants`)
  console.log(`  no scorable chips:         ${stats.none} restaurants`)
  console.log(`  total dish rows:           ${stats.rowsTotal} (avg ${stats.restaurants ? (stats.rowsTotal / stats.restaurants).toFixed(1) : '0'}/rest)`)

  if (VERBOSE || SAMPLE > 0) {
    console.log('---')
    for (const s of sampleRestaurants) {
      console.log(`\n  ${s.name}:`)
      for (const r of s.rows.slice(0, 6)) {
        console.log(`    ${r.score.toFixed(2)} | ${r.display_name}  [${r.tier}/${r.match_method}] ` +
          `g:${r.google_count} rv:${r.review_mentions} tt:${r.tiktok_mentions} ig:${r.instagram_mentions}` +
          (r.sample_quote ? `\n      "${r.sample_quote.slice(0, 120).replace(/\n/g, ' ')}"` : ''))
      }
    }
  }

  if (!WRITE) {
    console.log('\n[topDishesFromChips] dry-run. re-run with --write to persist.')
    return
  }

  // Persist scored chip rows back (update, do not insert).
  console.log(`\n[topDishesFromChips] updating ${chipUpdates.length} chip rows with scores...`)
  const CHIP_BATCH = 200
  let chipWrote = 0
  for (let i = 0; i < chipUpdates.length; i += CHIP_BATCH) {
    const chunk = chipUpdates.slice(i, i + CHIP_BATCH)
    // No multi-row UPDATE in PostgREST — iterate in parallel batches.
    const res = await Promise.allSettled(chunk.map((u) =>
      sb.from('restaurant_google_chips').update({
        menu_item_id: u.menu_item_id,
        match_confidence: u.match_confidence,
        match_method: u.match_method,
        review_mentions: u.review_mentions,
        tiktok_mentions: u.tiktok_mentions,
        instagram_mentions: u.instagram_mentions,
        score: u.score,
        source_breakdown: u.source_breakdown,
        scored_at: u.scored_at,
      }).eq('id', u.id)
    ))
    for (const r of res) {
      if (r.status === 'fulfilled' && !(r.value as { error?: unknown }).error) chipWrote++
    }
  }
  console.log(`  updated ${chipWrote}/${chipUpdates.length} chip rows`)

  // Write restaurant_top_dishes rows — scoped to restaurants this run
  // updated (so we don't blow away tier-1 results from computeTopDishes
  // for restaurants with no chip data yet).
  console.log(`[topDishesFromChips] writing ${outputRows.length} top-dish rows...`)
  const restaurantIds = Array.from(new Set(outputRows.map((r) => r.restaurant_id)))
  // Chunk the delete: .in() with ~1700 ids overflows PostgREST's URL limit,
  // which silently fails the delete and makes every insert collide on
  // uq_rtd_restaurant_displayname (the "wrote 0" bug).
  for (let i = 0; i < restaurantIds.length; i += 100) {
    const chunk = restaurantIds.slice(i, i + 100)
    const { error: delErr } = await sb.from('restaurant_top_dishes')
      .delete()
      .in('restaurant_id', chunk)
    if (delErr) console.warn(`  delete err [${i}]: ${delErr.message}`)
  }

  const insertRows = outputRows.map((r) => ({
    restaurant_id: r.restaurant_id,
    menu_item_id: r.menu_item_id,
    display_name: r.display_name.slice(0, 160),
    rank: r.rank,
    score: r.score,
    positive_count: 0,
    negative_count: 0,
    neutral_count: 0,
    google_mentions: r.google_count,
    tiktok_mentions: r.tiktok_mentions,
    instagram_mentions: r.instagram_mentions,
    total_mentions: r.google_count + r.review_mentions + r.tiktok_mentions + r.instagram_mentions,
    sample_quote: r.sample_quote,
    sample_quote_source: r.sample_quote_source,
    tier: r.tier,
    price_cents: null,
    computed_at: nowIso,
  }))

  const BATCH = 500
  let wrote = 0
  for (let i = 0; i < insertRows.length; i += BATCH) {
    const chunk = insertRows.slice(i, i + BATCH)
    const { error } = await sb.from('restaurant_top_dishes').insert(chunk)
    if (error) {
      console.error(`  insert err [${i}]:`, error.message)
    } else {
      wrote += chunk.length
    }
  }
  console.log(`[topDishesFromChips] wrote ${wrote}/${insertRows.length} top-dish rows`)
}

main().catch((e) => { console.error(e); process.exit(1) })
