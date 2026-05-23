/**
 * Menu scraper v2.1 — OCR fallback for image-only menus.
 *
 * v2.0 unlocked 138 new restaurants but hit a wall on ~200–300 sites that
 * publish menus exclusively as JPG/PNG (Squarespace galleries, Wix image
 * blocks, WordPress uploads). This script closes that gap:
 *
 *   1. Discovers menu-like <img> tags on the homepage + /menu pages —
 *      portrait aspect ratio, filename/alt matches /menu|food|dinner/, large
 *      enough to be legible (>= 900 px on long side).
 *   2. Downloads top candidates (up to 5 per restaurant, ~5MB cap each).
 *   3. Runs tesseract OCR (already in sandbox, 4.1.1).
 *   4. Parses OCR text into (dish, price, section) tuples using a trailing-
 *      price regex and ALL-CAPS heading detection.
 *   5. Feeds the parsed items through the same food-quality gate as v2.
 *   6. Writes with source='website-ocr' so provenance is distinguishable.
 *
 * Usage:
 *   npx tsx scripts/scrapeMenusOCR.ts [--mode=missing|ids] [--ids=a,b,c]
 *     [--limit=50] [--concurrency=2] [--imageBudget=5] [--dryRun=true]
 *
 * Concurrency defaults to 2 because OCR is CPU-heavy; 4+ can spike sandbox
 * memory. Restrict pilot runs with --ids=<csv>.
 */

import { createClient } from '@supabase/supabase-js'
import * as fs from 'fs'
import * as os from 'os'
import * as path from 'path'
import { execFile } from 'child_process'
import { promisify } from 'util'

const execFileP = promisify(execFile)

// ---------- env ----------

const envPath = path.join(process.cwd(), '.env.local')
if (fs.existsSync(envPath)) {
  for (const line of fs.readFileSync(envPath, 'utf8').split('\n')) {
    const m = line.match(/^([A-Z0-9_]+)=(.*)$/)
    if (m && !process.env[m[1]]) process.env[m[1]] = m[2].replace(/^"|"$/g, '')
  }
}
const SUPA_URL = process.env.NEXT_PUBLIC_SUPABASE_URL!
const SUPA_KEY =
  process.env.SUPABASE_SERVICE_ROLE_KEY ||
  process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!
if (!SUPA_URL || !SUPA_KEY) { console.error('Missing Supabase env'); process.exit(1) }
const supabase = createClient(SUPA_URL, SUPA_KEY, { auth: { persistSession: false } })

// ---------- args ----------

const rawArgs = Object.fromEntries(
  process.argv.slice(2).map(a => {
    const [k, v] = a.replace(/^--/, '').split('=')
    return [k, v ?? 'true']
  }),
) as Record<string, string>

const MODE = (rawArgs.mode ?? 'missing') as 'missing' | 'ids'
const LIMIT = Number(rawArgs.limit ?? '50')
const CONCURRENCY = Number(rawArgs.concurrency ?? '2')
const IMAGE_BUDGET = Number(rawArgs.imageBudget ?? '5')
const DRY_RUN = rawArgs.dryRun === 'true'
const ID_FILTER = rawArgs.ids?.split(',').map(s => s.trim()).filter(Boolean)

// ---------- polite fetch ----------

const HOST_MIN_GAP_MS = 1500
const lastHitByHost = new Map<string, number>()
const hostLocks = new Map<string, Promise<void>>()
const sleep = (ms: number) => new Promise(r => setTimeout(r, ms))

async function politeWait(host: string): Promise<void> {
  const prev = hostLocks.get(host) ?? Promise.resolve()
  let release!: () => void
  const p = new Promise<void>(r => { release = r })
  hostLocks.set(host, prev.then(() => p))
  await prev
  const last = lastHitByHost.get(host) ?? 0
  const wait = Math.max(0, HOST_MIN_GAP_MS - (Date.now() - last))
  if (wait > 0) await sleep(wait + Math.random() * 250)
  lastHitByHost.set(host, Date.now())
  queueMicrotask(release)
}

const UA = 'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 Gastronome-Scraper/2.1-OCR (+dakai.research@gmail.com)'

async function getHtml(url: string, timeoutMs = 15000): Promise<{ html: string; finalUrl: string } | null> {
  let host = ''
  try { host = new URL(url).host } catch { return null }
  await politeWait(host)
  try {
    const ctl = new AbortController()
    const t = setTimeout(() => ctl.abort(), timeoutMs)
    const res = await fetch(url, { signal: ctl.signal, headers: { 'user-agent': UA, accept: 'text/html,application/xhtml+xml' }, redirect: 'follow' })
    clearTimeout(t)
    if (!res.ok) return null
    const html = await res.text()
    return { html, finalUrl: res.url }
  } catch { return null }
}

async function downloadImage(url: string, outPath: string, timeoutMs = 20000, maxBytes = 5_000_000): Promise<boolean> {
  let host = ''
  try { host = new URL(url).host } catch { return false }
  await politeWait(host)
  try {
    const ctl = new AbortController()
    const t = setTimeout(() => ctl.abort(), timeoutMs)
    const res = await fetch(url, { signal: ctl.signal, headers: { 'user-agent': UA }, redirect: 'follow' })
    clearTimeout(t)
    if (!res.ok) return false
    const ct = res.headers.get('content-type') ?? ''
    if (!/image\//i.test(ct)) return false
    const buf = Buffer.from(await res.arrayBuffer())
    if (buf.length > maxBytes) return false
    fs.writeFileSync(outPath, buf)
    return true
  } catch { return false }
}

// ---------- food / drink classifier (kept in sync with v2) ----------

const FOOD_TOKENS = /\b(pizza|pasta|burger|steak|chicken|fish|salad|soup|taco|sushi|sandwich|salmon|tuna|shrimp|lobster|crab|pork|lamb|beef|duck|ribs|wings|egg|cheese|pie|cake|bread|fries|rice|noodle|ramen|dumpling|risotto|gnocchi|ravioli|lasagna|paella|tartare|carpaccio|oyster|mussel|scallop|octopus|squid|brisket|chop|cutlet|roast|confit|fried|grilled|smoked|braised|roasted|poached|bun|toast|wrap|roll|sausage|meatball|tart|cookie|croissant|ice cream|dessert|chocolate|vanilla|curry|kimchi|bibimbap|pho|banh mi|enchilada|quesadilla|burrito|guacamole|hummus|falafel|gyros|moussaka|tiramisu|tempura|nigiri|sashimi|maki|pot sticker|wonton|poke|poké|avocado|tomato|eggplant|mushroom|broccoli|asparagus|artichoke|beet|kale|spinach|lentil|bean|potato|yam|burrata|mozzarella|parmesan|souffle|soufflé|quiche|crepe|pancake|waffle|omelette|benedict|tartine|bisque|bouillabaisse|cassoulet|ratatouille|bourguignon|chowder|gumbo|jambalaya|pozole|ceviche|aguachile|tostada|tortilla|empanada|arepa|moqueca|churrasco|yakitori|okonomiyaki|takoyaki|katsu|udon|soba|unagi|toro|donburi|teppanyaki|bulgogi|galbi|tteokbokki|banchan|pajeon|tom yum|pad thai|pad see ew|pad krapow|larb|massaman|panang|khao soi|nasi|satay|mie goreng|bolognese|carbonara|amatriciana|marinara|arancini|caprese|prosciutto|salumi|mortadella|speck|pancetta|guanciale|cacio|porchetta|cotoletta|vitello|ossobuco|ribollita|pappardelle|tagliatelle|orecchiette|bucatini|linguine|fettuccine|farfalle|penne|tortellini|agnolotti|cannelloni|manicotti|calzone|stromboli|pesto|branzino|orata|spigola|crudo|vongole|antipasti|insalata|primi|secondi|dolci|contorni|focaccia|schiacciata|panino|croque|nicoise|niçoise|daube|tarte|madeleine|profiterole|financier|macaron|canard|magret|boeuf|entrecote|filet mignon|chateaubriand|coquilles|moules|frites|raclette|fondue|choucroute|tajine|shawarma|kebab|kabob|souvla|spanakopita|dolma|fattoush|tabouleh|labneh|zaatar|manti|doner|kofta|biryani|tikka|masala|tandoori|naan|samosa|pakora|dosa|idli|vindaloo|korma|dal|raita|wagyu|kobe|uni|ikura|tamago|hamachi|kanpachi|hirame|temaki|chirashi|shabu|bun cha|com tam|ca kho|xiao long|jian bing|hot pot|dim sum|siu mai|har gow|char siu|peking duck|mapo|kung pao|lo mein|chow mein|chow fun|mongolian|sichuan|szechuan|cantonese|dan dan|wonton|xiaolongbao|baozi|clam|tot|hash|bacon|ham|turkey|goose|foie|liver|tongue|heart|belly|loin|rib|shank|short rib|skirt|flank|hanger|filet|ribeye|strip|porterhouse|tomahawk|t-bone|sirloin|tenderloin|prime rib|cheeseburger|hamburger|slider|hot dog|corn dog|reuben|philly cheesesteak|pastrami|corned beef|french dip|po boy|muffuletta|banh|pork belly|kalbi|bulgogi)\b/i

const DRINK_TOKENS = /\b(whiskey|whisky|vodka|gin|tequila|mezcal|bourbon|rye|rum|scotch|cognac|armagnac|amaro|amari|vermouth|wine|champagne|prosecco|cava|sauvignon|chardonnay|pinot|cabernet|merlot|riesling|syrah|shiraz|malbec|zinfandel|grenache|nebbiolo|sangiovese|tempranillo|brunello|barolo|barbaresco|chianti|negroni|martini|manhattan|margarita|daiquiri|mojito|old fashioned|paloma|sazerac|spritz|beer|lager|ale|ipa|stout|pilsner|brut|grappa|sambuca|chartreuse|aperitif|digestif|sake|soju|cider|kombucha|highball|cocktail|mocktail|non-alcoholic|non alcoholic|zero proof|by the glass|by the bottle|liqueur|fernet|campari|aperol|cynar|limoncello|vermut|bottles?$|glass?$)\b/i

const WINE_VINTAGE_RE = /(20\d{2}|19\d{2})\b.*\b(brut|dry|sweet|demi|sec|reserve|reserva|riserva|cru|rouge|blanc|rose|rosé|vineyard|estate)\b/i

type Item = { name: string; section: string | null; price_cents: number | null; price_raw: string; description: string | null }

type MenuQuality = { total: number; food_like: number; drink_like: number; food_ratio: number; drink_ratio: number; verdict: 'food_menu' | 'drink_menu' | 'mixed' | 'unclear' | 'empty' }

function classifyItem(name: string): 'food' | 'drink' | 'other' {
  const n = name.toLowerCase()
  const foodHit = FOOD_TOKENS.test(n)
  const drinkHit = DRINK_TOKENS.test(n) || WINE_VINTAGE_RE.test(n)
  if (foodHit && !drinkHit) return 'food'
  if (!foodHit && drinkHit) return 'drink'
  if (foodHit && drinkHit) return 'food'
  return 'other'
}

function scoreMenu(items: Item[]): MenuQuality {
  const total = items.length
  let food_like = 0, drink_like = 0
  for (const it of items) {
    const c = classifyItem(it.name)
    if (c === 'food') food_like++
    else if (c === 'drink') drink_like++
  }
  const food_ratio = total ? food_like / total : 0
  const drink_ratio = total ? drink_like / total : 0
  let verdict: MenuQuality['verdict']
  if (total === 0) verdict = 'empty'
  else if (drink_ratio > 0.7 && food_ratio < 0.15) verdict = 'drink_menu'
  else if (food_ratio >= 0.25 && food_ratio >= drink_ratio) verdict = 'food_menu'
  else if (food_ratio > 0 && food_ratio > drink_ratio) verdict = 'mixed'
  else if (food_ratio === 0 && drink_ratio === 0) verdict = 'unclear'
  else verdict = 'mixed'
  return { total, food_like, drink_like, food_ratio, drink_ratio, verdict }
}

function passesFoodGate(q: MenuQuality): boolean {
  if (q.verdict === 'food_menu' && q.total >= 3 && q.food_like >= 2) return true
  if (q.verdict === 'mixed' && q.food_like >= 4 && q.food_ratio >= q.drink_ratio) return true
  return false
}

// ---------- image discovery ----------

type ImageCandidate = { url: string; score: number; w: number | null; h: number | null; alt: string; reason: string }

function resolveUrl(href: string, base: string): string | null {
  try { return new URL(href, base).toString() } catch { return null }
}

/**
 * Rank <img> tags on a page for menu-likeness.
 *   +4 filename/alt contains 'menu'
 *   +3 filename/alt contains 'food|dinner|lunch|brunch'
 *   +3 portrait aspect (height >= 1.3 * width)
 *   +2 long side >= 1500
 *   +1 long side >= 900
 *   -5 logo/icon hints (dimensions <= 400, filename has 'logo'|'icon'|'favicon')
 */
function findImageCandidates(html: string, baseUrl: string): ImageCandidate[] {
  const out: ImageCandidate[] = []
  const seen = new Set<string>()
  for (const m of html.matchAll(/<img[^>]+>/gi)) {
    const tag = m[0]
    const srcM = /(?:data-src|data-image|srcset|src)=["']([^"']+)["']/i.exec(tag)
    if (!srcM) continue
    let src = srcM[1]
    // If matched srcset, take first URL
    if (/\s/.test(src) && /,/.test(src)) src = src.split(',')[0].trim().split(/\s+/)[0]
    const abs = resolveUrl(src, baseUrl)
    if (!abs) continue
    if (!/^https?:/i.test(abs)) continue
    if (seen.has(abs)) continue
    seen.add(abs)

    const altM = /\balt=["']([^"']*)["']/i.exec(tag)
    const alt = altM?.[1] ?? ''
    const dimM = /data-image-dimensions=["'](\d+)x(\d+)["']/i.exec(tag)
    const w = dimM ? Number(dimM[1]) : null
    const h = dimM ? Number(dimM[2]) : null
    const low = (abs + ' ' + alt).toLowerCase()

    let score = 0
    const reasons: string[] = []
    if (/\bmenu\b/.test(low)) { score += 4; reasons.push('menu-kw') }
    if (/(food|dinner|lunch|brunch)/.test(low)) { score += 3; reasons.push('food-kw') }
    if (w && h) {
      if (h >= 1.3 * w) { score += 3; reasons.push('portrait') }
      const longSide = Math.max(w, h)
      if (longSide >= 1500) { score += 2; reasons.push('>=1500') }
      else if (longSide >= 900) { score += 1; reasons.push('>=900') }
      if (w <= 400 && h <= 400) { score -= 5; reasons.push('too-small') }
    }
    if (/(logo|icon|favicon|avatar|thumbnail)/.test(low)) { score -= 5; reasons.push('logo-like') }
    // Squarespace thumbnails (usually ?format=500w or smaller) tend to lose OCR fidelity
    // Prefer originals or ?format=1500w — we'll upscale the query string later.
    if (/\.(svg|gif)(\?|$)/i.test(abs)) { score -= 5; reasons.push('non-static') }

    if (score <= 0) continue
    out.push({ url: abs, score, w, h, alt, reason: reasons.join('+') })
  }
  out.sort((a, b) => b.score - a.score)
  return out
}

/** Upgrade a Squarespace-cdn URL to a large render. */
function prepDownloadUrl(url: string): string {
  if (!/images\.squarespace-cdn\.com/i.test(url)) return url
  const u = new URL(url)
  u.searchParams.set('format', '1500w')
  return u.toString()
}

// ---------- OCR + parsing ----------

/**
 * OCR a single image file. Returns raw multiline text or empty string on failure.
 */
/** Extract text from a PDF using pdftotext (cheaper & higher-quality than tesseract). */
async function extractPdfText(pdfPath: string): Promise<string> {
  try {
    const { stdout } = await execFileP('pdftotext', ['-layout', '-nopgbrk', pdfPath, '-'], { timeout: 30_000, maxBuffer: 8_000_000 })
    return stdout.trim()
  } catch { return '' }
}

/** Find same-host .pdf links with menu-ish anchor text or URL. */
type PdfCandidate = { url: string; score: number; label: string }
function findPdfCandidates(html: string, baseUrl: string): PdfCandidate[] {
  const out: PdfCandidate[] = []
  const seen = new Set<string>()
  for (const m of html.matchAll(/<a[^>]+href=["']([^"']+\.pdf[^"']*)["'][^>]*>([\s\S]*?)<\/a>/gi)) {
    const abs = resolveUrl(m[1], baseUrl)
    if (!abs || seen.has(abs)) continue
    seen.add(abs)
    const label = m[2].replace(/<[^>]+>/g, '').replace(/\s+/g, ' ').trim().toLowerCase()
    const low = (abs + ' ' + label).toLowerCase()
    let score = 0
    if (/\bmenu\b/.test(low)) score += 4
    if (/(food|dinner|lunch|brunch|dessert|prix|a-la-carte|tasting)/.test(low)) score += 2
    if (/(wine|cocktail|drinks?|beverage|bar)/.test(low)) score -= 1
    if (/(catering|private|events?|gift|faq|reservation|contract)/.test(low)) score -= 3
    if (score <= 0) continue
    out.push({ url: abs, score, label })
  }
  out.sort((a, b) => b.score - a.score)
  return out
}

async function ocrImage(imgPath: string): Promise<string> {
  try {
    const { stdout } = await execFileP('tesseract', [imgPath, '-', '-l', 'eng', '--psm', '6'], { timeout: 25_000, maxBuffer: 4_000_000 })
    return stdout
  } catch { return '' }
}

/**
 * Parse OCR text into menu items.
 *
 * Tesseract on stylized menus (4 Charles, Au Cheval) mangles dot-leaders
 * into noise like "cocktail sauce, dijonmaise...ss.ssssssessseensenseeenn D9?"
 * where "$59" reads as "D9?". We can't reliably recover the price, but the
 * dish name at the START of the line is usually legible. So this parser is
 * price-optional:
 *
 *   - ALL-CAPS lines (>= 3 chars, no lowercase) become section headings.
 *   - Any remaining line is CANDIDATE if:
 *       * strips to a plausible dish name (3-80 chars, at least 1 lowercase
 *         word, starts with a letter, not mostly punctuation)
 *       * AND either: (a) contains a food-token OR (b) ends with a plausible
 *         price OR (c) the previous line was a section header on a known
 *         food section ("ENTREES", "SIDES", "PASTAS", "MAINS", ...).
 *   - Price extraction is best-effort: "... 59" or "... $18.50" — if the
 *     trailing number is garbled (OCR noise letters mixed in), we keep the
 *     name and null the price.
 *   - Clean noise: strip trailing garbage tokens matching [OCR_JUNK_RE].
 */
function parseMenuFromOCR(text: string): Item[] {
  const items: Item[] = []
  let section: string | null = null

  // OCR artifacts to prune from a candidate dish name's tail
  const OCR_JUNK_RE = /[\s.\u2026·•:;=_\-]*(?:[a-zA-Z0-9%]{0,2})?(?:\.{2,}|\s{2,}.*)?\s*$/

  const lines = text.split(/\r?\n/).map(l =>
    l.replace(/[·•]+/g, '')
     .replace(/\|+/g, ' ')
     .replace(/\s+/g, ' ')
     .trim()
  ).filter(Boolean)

  const JUST_HEADING = /^[A-Z0-9 '&\-\/]{3,40}$/
  const FOOD_SECTION = /\b(APPETIZER|APPETIZERS|STARTER|STARTERS|SALAD|SALADS|SOUP|SOUPS|ENTREE|ENTREES|ENTRÉE|ENTRÉES|MAIN|MAINS|PLATES|SIDES|SIDE|PASTA|PASTAS|PIZZA|PIZZAS|SUSHI|SASHIMI|NIGIRI|DESSERT|DESSERTS|DOLCI|PRIMI|SECONDI|ANTIPASTI|RAW|SHELLFISH|OYSTER|BURGER|BURGERS|SANDWICH|SANDWICHES|SMALL PLATE|SMALL PLATES|LARGE PLATE|SHARED|TO SHARE|FOR THE TABLE|TACOS|HOUSE SPECIAL|SIGNATURE|BRUNCH|BREAKFAST|LUNCH|DINNER|KIDS|CHILDREN|VEGAN|VEGETARIAN|GRILL|GRILLED|FROM THE|FROM OUR|CHEF)/
  const LOWER_OR_MIXED = /[a-z]/

  const cleanName = (s: string): string => {
    let n = s
      .replace(/®©™°/g, '')
      .replace(/["""`]/g, '')
      .replace(/\s{2,}/g, ' ')
      .trim()
    // strip leading numbering like "1. " or "2)"
    n = n.replace(/^\d+[.)]\s*/, '')
    // strip trailing OCR dot-leaders and junk
    n = n.replace(/[\s.\u2026·•:;=_\-]{2,}.*$/, '').trim()
    // drop everything after first run of 3+ repeated non-alphanumerics (OCR noise)
    n = n.replace(/([^A-Za-z0-9])\1{2,}.*$/, '').trim()
    return n
  }

  const looksLikeDishName = (s: string): boolean => {
    if (s.length < 3 || s.length > 100) return false
    if (!/[A-Za-z]/.test(s)) return false
    if (!LOWER_OR_MIXED.test(s)) return false  // pure upper-case is a heading
    // must start with a letter (drop lines that start with numerics or junk)
    if (!/^[A-Z][A-Za-z]/.test(s) && !/^[A-Za-z]/.test(s)) return false
    // reject if too many consecutive repeated chars (OCR sludge)
    if (/([A-Za-z])\1{4,}/.test(s)) return false
    // reject if > 40% of chars are non-letters
    const letters = s.replace(/[^A-Za-z]/g, '').length
    if (letters / s.length < 0.55) return false
    // reject obvious non-dishes
    if (/^(please|thank|welcome|served|available|contact|reservation|hours|open|closed|phone|address|website|copyright|all rights|menu|follow|instagram|tel\.?|facebook|tip|gratuity|service charge|tax|price|substitutions|allergy|sorry|happy|celebrate)/i.test(s)) return false
    return true
  }

  const extractTrailingPrice = (s: string): { price_cents: number | null; price_raw: string } => {
    // Look for a trailing number 5-500. Tolerate OCR mangles like "D9" -> treat as garbage.
    const m = /\b\$?(\d{2,3})(?:[.,](\d{1,2}))?\s*[A-Za-z%?!]{0,3}\s*$/.exec(s)
    if (!m) return { price_cents: null, price_raw: '' }
    const whole = Number(m[1])
    const frac = m[2] ? Number(m[2]) : 0
    if (whole < 5 || whole > 500) return { price_cents: null, price_raw: '' }
    const priceNum = whole + (frac ? frac / (frac > 9 ? 100 : 10) : 0)
    return { price_cents: Math.round(priceNum * 100), price_raw: `$${priceNum.toFixed(priceNum % 1 ? 2 : 0)}` }
  }

  for (const raw of lines) {
    const line = raw.replace(/[®©™°]/g, '').replace(/["""`]/g, '').trim()
    if (!line) continue
    if (/^\d+$/.test(line)) continue
    if (/^(gluten|vegetarian|vegan|consumer advisory|an?\s*\d+%|gratuity|service charge|tax|subtotal|total|cash only|no substitutions|all prices|prices subject)/i.test(line)) continue

    // Section heading?
    if (JUST_HEADING.test(line) && !LOWER_OR_MIXED.test(line)) {
      section = line.replace(/\s{2,}/g, ' ').trim()
      continue
    }

    const priceInfo = extractTrailingPrice(line)
    // strip trailing price (if any) before name cleanup
    const stripped = line.replace(/\s*[\s.\u2026·•:;=_\-]{0,}\$?\d{2,3}(?:[.,]\d{1,2})?\s*[A-Za-z%?!]{0,3}\s*$/, '').trim()
    const name = cleanName(stripped || line)

    if (!looksLikeDishName(name)) continue

    // accept if: priced OR food-token OR section is food-like
    const foodTok = FOOD_TOKENS.test(name.toLowerCase())
    const drinkTok = DRINK_TOKENS.test(name.toLowerCase())
    const sectionHint = section && FOOD_SECTION.test(section)
    if (!priceInfo.price_cents && !foodTok && !sectionHint) continue
    // reject pure drink lines in absence of food signal
    if (drinkTok && !foodTok && !sectionHint) continue

    items.push({
      name,
      section,
      price_cents: priceInfo.price_cents,
      price_raw: priceInfo.price_raw,
      description: null,
    })
  }

  // De-dupe within this batch (preferring priced entries)
  const byName = new Map<string, Item>()
  for (const it of items) {
    const k = it.name.toLowerCase()
    const prev = byName.get(k)
    if (!prev) { byName.set(k, it); continue }
    if (prev.price_cents == null && it.price_cents != null) byName.set(k, it)
  }
  return Array.from(byName.values())
}

// ---------- menu page discovery ----------

/** Find candidate HTML pages on the same host that likely host menu images. */
async function discoverMenuPages(website: string): Promise<string[]> {
  const out: string[] = [website]
  const root = await getHtml(website)
  if (!root) return out
  const base = root.finalUrl
  const anchors = Array.from(root.html.matchAll(/<a[^>]+href=["']([^"']+)["'][^>]*>([\s\S]*?)<\/a>/gi))
  const added = new Set<string>([website])
  for (const a of anchors) {
    const href = a[1]
    const label = a[2].replace(/<[^>]+>/g, '').toLowerCase()
    const abs = resolveUrl(href, base)
    if (!abs) continue
    try { if (new URL(abs).host !== new URL(base).host) continue } catch { continue }
    const low = (abs + ' ' + label).toLowerCase()
    if (/(menu|food|dinner|lunch|brunch|drinks|dessert)/i.test(low) && !added.has(abs)) {
      out.push(abs); added.add(abs)
      if (out.length >= 5) break
    }
  }
  return out
}

// ---------- persistence ----------

async function persist(r: { id: string }, items: Item[], sourceUrl: string, q: MenuQuality): Promise<void> {
  if (DRY_RUN) return
  // keep separate from website source so we can distinguish OCR vs parsed
  await supabase
    .from('restaurant_menu_items')
    .delete()
    .eq('restaurant_id', r.id)
    .eq('source', 'website-ocr')
  const rows = items.map(it => ({
    restaurant_id: r.id,
    item_name: it.name.slice(0, 120),
    section: it.section,
    price_cents: it.price_cents,
    price_raw: (it.price_raw || '').slice(0, 40),
    description: it.description?.slice(0, 500) ?? null,
    source: 'website-ocr',
    source_url: sourceUrl,
  }))
  for (let i = 0; i < rows.length; i += 50) {
    const { error } = await supabase
      .from('restaurant_menu_items')
      .upsert(rows.slice(i, i + 50), { onConflict: 'restaurant_id,item_name,source', ignoreDuplicates: true })
    if (error) console.error('upsert err', error.message)
  }
  await supabase.from('restaurant_menu_fetches').insert({
    restaurant_id: r.id,
    source: 'website-ocr',
    source_url: sourceUrl,
    menu_url: sourceUrl,
    status: 'ok',
    items_found: items.length,
    error_message: `ocr food_ratio=${q.food_ratio.toFixed(2)} drink_ratio=${q.drink_ratio.toFixed(2)} verdict=${q.verdict}`,
  })
}

async function logFail(r: { id: string }, sourceUrl: string | null, reason: string): Promise<void> {
  if (DRY_RUN) return
  await supabase.from('restaurant_menu_fetches').insert({
    restaurant_id: r.id,
    source: 'website-ocr',
    source_url: sourceUrl,
    menu_url: null,
    status: reason.startsWith('rejected') ? 'rejected' : 'no_content',
    items_found: 0,
    error_message: reason,
  })
}

// ---------- main per-restaurant ----------

type Report = {
  id: string
  name: string
  status: 'ok' | 'rejected' | 'no_images' | 'fetch_failed' | 'ocr_empty' | 'errored'
  accepted_url: string | null
  pages_visited: number
  images_tried: number
  items: number
  verdict: MenuQuality['verdict'] | null
  food_ratio: number
  drink_ratio: number
  ms: number
}

async function processOne(r: { id: string; name: string; website: string }): Promise<Report> {
  const t0 = Date.now()
  const rep: Report = {
    id: r.id, name: r.name, status: 'fetch_failed', accepted_url: null,
    pages_visited: 0, images_tried: 0, items: 0, verdict: null, food_ratio: 0, drink_ratio: 0, ms: 0,
  }

  const pages = await discoverMenuPages(r.website)
  rep.pages_visited = pages.length
  const tmpDir = fs.mkdtempSync(path.join(os.tmpdir(), 'ocr-'))
  let best: { items: Item[]; q: MenuQuality; url: string } | null = null

  try {
    // --- PDF path: free text extraction via pdftotext ---
    const allPdfs: PdfCandidate[] = []
    const allCands: ImageCandidate[] = []
    for (const pageUrl of pages) {
      const page = await getHtml(pageUrl)
      if (!page) continue
      for (const p of findPdfCandidates(page.html, page.finalUrl)) {
        if (!allPdfs.find(x => x.url === p.url)) allPdfs.push(p)
      }
      const cands = findImageCandidates(page.html, page.finalUrl)
      for (const c of cands) {
        if (!allCands.find(x => x.url === c.url)) allCands.push(c)
      }
    }
    allPdfs.sort((a, b) => b.score - a.score)
    allCands.sort((a, b) => b.score - a.score)

    const DEBUG = process.env.OCR_DEBUG === '1'
    if (DEBUG) console.log(`  [${r.name}] ${allPdfs.length} pdf candidates, ${allCands.length} image candidates`)

    const pdfItems: Item[] = []
    let firstPdfUrl: string | null = null
    for (const pdf of allPdfs.slice(0, 3)) {
      const pdfPath = path.join(tmpDir, `menu-${Math.random().toString(36).slice(2, 8)}.pdf`)
      const ok = await downloadImage(pdf.url, pdfPath, 25_000, 15_000_000)
      if (DEBUG) console.log(`  [${r.name}] pdf dl ${ok ? 'OK' : 'FAIL'} score=${pdf.score} url=${pdf.url.slice(0, 80)}`)
      if (!ok) continue
      const text = await extractPdfText(pdfPath)
      if (DEBUG) console.log(`  [${r.name}] pdf text len=${text.length}`)
      if (!text || text.length < 100) continue
      const parsed = parseMenuFromOCR(text)
      if (DEBUG) console.log(`  [${r.name}] pdf items=${parsed.length}`)
      if (!parsed.length) continue
      for (const it of parsed) pdfItems.push(it)
      if (!firstPdfUrl) firstPdfUrl = pdf.url
    }
    if (pdfItems.length) {
      const byName = new Map<string, Item>()
      for (const it of pdfItems) {
        const k = it.name.toLowerCase()
        const prev = byName.get(k)
        if (!prev || (prev.price_cents == null && it.price_cents != null)) byName.set(k, it)
      }
      const items = Array.from(byName.values())
      const q = scoreMenu(items)
      rep.verdict = q.verdict
      rep.food_ratio = q.food_ratio
      rep.drink_ratio = q.drink_ratio
      rep.items = items.length
      if (passesFoodGate(q)) {
        await persist(r, items, firstPdfUrl || r.website, q)
        rep.accepted_url = firstPdfUrl
        rep.status = 'ok'
        best = { items, q, url: firstPdfUrl! }
        rep.ms = Date.now() - t0
        const short = `[OK-PDF] ${r.name} — ${rep.items} items food=${(rep.food_ratio * 100).toFixed(0)}% (${allPdfs.length} pdfs, ${rep.ms}ms)`
        console.log(short)
        try { fs.rmSync(tmpDir, { recursive: true, force: true }) } catch {}
        return rep
      }
      // PDF parsed but didn't pass gate — continue to image path
    }
    // --- image path (existing) ---

    const aggregateItems: Item[] = []
    let firstAcceptedUrl: string | null = null
    if (DEBUG) console.log(`  [${r.name}] image path: ${allCands.length} candidates`)
    for (const cand of allCands.slice(0, IMAGE_BUDGET)) {
      rep.images_tried++
      const imgPath = path.join(tmpDir, `img-${rep.images_tried}.jpg`)
      const ok = await downloadImage(prepDownloadUrl(cand.url), imgPath)
      if (DEBUG) console.log(`  [${r.name}] dl#${rep.images_tried} ${ok ? 'OK' : 'FAIL'} score=${cand.score} url=${cand.url.slice(0, 80)}`)
      if (!ok) continue
      const text = await ocrImage(imgPath)
      if (DEBUG) console.log(`  [${r.name}] ocr#${rep.images_tried} len=${text.length}`)
      if (!text || text.length < 50) continue
      const parsed = parseMenuFromOCR(text)
      if (DEBUG) console.log(`  [${r.name}] parse#${rep.images_tried} items=${parsed.length}`)
      if (!parsed.length) continue
      for (const it of parsed) aggregateItems.push(it)
      if (!firstAcceptedUrl) firstAcceptedUrl = cand.url
    }

    // Dedupe aggregate by name
    const byName = new Map<string, Item>()
    for (const it of aggregateItems) {
      const k = it.name.toLowerCase()
      const prev = byName.get(k)
      if (!prev) byName.set(k, it)
      else if (prev.price_cents == null && it.price_cents != null) byName.set(k, it)
    }
    const items = Array.from(byName.values())

    if (!items.length) {
      rep.status = allCands.length === 0 ? 'no_images' : 'ocr_empty'
      await logFail(r, firstAcceptedUrl, rep.status)
    } else {
      const q = scoreMenu(items)
      rep.verdict = q.verdict
      rep.food_ratio = q.food_ratio
      rep.drink_ratio = q.drink_ratio
      rep.items = items.length
      if (passesFoodGate(q)) {
        await persist(r, items, firstAcceptedUrl || r.website, q)
        rep.accepted_url = firstAcceptedUrl
        rep.status = 'ok'
        best = { items, q, url: firstAcceptedUrl! }
      } else {
        rep.status = 'rejected'
        await logFail(r, firstAcceptedUrl, `rejected-quality verdict=${q.verdict} food=${(q.food_ratio * 100).toFixed(0)}% drink=${(q.drink_ratio * 100).toFixed(0)}%`)
      }
    }
  } catch (e) {
    rep.status = 'errored'
    await logFail(r, null, `err:${(e as Error).message?.slice(0, 200)}`)
  } finally {
    try { fs.rmSync(tmpDir, { recursive: true, force: true }) } catch {}
  }
  rep.ms = Date.now() - t0
  const short = best
    ? `[OK] ${r.name} — ${rep.items} items food=${(rep.food_ratio * 100).toFixed(0)}% drink=${(rep.drink_ratio * 100).toFixed(0)}% (${rep.images_tried} imgs, ${rep.ms}ms)`
    : `[${rep.status.toUpperCase()}] ${r.name} — ${rep.items} items (${rep.images_tried} imgs, ${rep.ms}ms)`
  console.log(short)
  return rep
}

// ---------- target selection ----------

async function pickTargets(): Promise<Array<{ id: string; name: string; website: string }>> {
  let q = supabase.from('restaurants').select('id, name, website').not('website', 'is', null).neq('website', '')
  if (MODE === 'ids') {
    if (!ID_FILTER?.length) { console.error('--mode=ids requires --ids=csv'); process.exit(1) }
    q = q.in('id', ID_FILTER)
  }
  const { data: rs, error } = await q.order('name').limit(5000)
  if (error) { console.error(error); process.exit(1) }
  const all = (rs ?? []) as Array<{ id: string; name: string; website: string }>
  if (MODE === 'ids') return all.slice(0, LIMIT)

  // missing: restaurants with no menu items at all (website or website-ocr)
  const { data: menuItems } = await supabase.from('restaurant_menu_items').select('restaurant_id').limit(100000)
  const have = new Set<string>((menuItems ?? []).map((m: any) => m.restaurant_id))
  return all.filter(r => !have.has(r.id)).slice(0, LIMIT)
}

// ---------- main ----------

async function main() {
  const targets = await pickTargets()
  console.log(`v2.1 OCR scraper — mode=${MODE} targets=${targets.length} concurrency=${CONCURRENCY} imageBudget=${IMAGE_BUDGET} dryRun=${DRY_RUN}`)

  const reports: Report[] = []
  for (let i = 0; i < targets.length; i += CONCURRENCY) {
    const batch = targets.slice(i, i + CONCURRENCY)
    const res = await Promise.all(batch.map(r => processOne(r).catch(e => {
      console.error(`  ERROR ${r.name}:`, e?.message || e, e?.stack?.split('\n').slice(0, 3).join(' | '))
      return {
        id: r.id, name: r.name, status: 'errored' as const, accepted_url: null, pages_visited: 0,
        images_tried: 0, items: 0, verdict: null, food_ratio: 0, drink_ratio: 0, ms: 0,
      }
    })))
    reports.push(...res)
    if (i % (CONCURRENCY * 5) === 0) {
      const ok = reports.filter(r => r.status === 'ok').length
      const rej = reports.filter(r => r.status === 'rejected').length
      const fail = reports.filter(r => r.status !== 'ok' && r.status !== 'rejected').length
      console.log(`...progress ${reports.length}/${targets.length} — accepted=${ok} rejected=${rej} failed=${fail}`)
    }
  }

  const ok = reports.filter(r => r.status === 'ok')
  const itemsTotal = ok.reduce((s, r) => s + r.items, 0)
  console.log(`\n=== v2.1 OCR summary ===`)
  console.log(`accepted:           ${ok.length}  (${itemsTotal} items saved)`)
  console.log(`rejected:           ${reports.filter(r => r.status === 'rejected').length}`)
  console.log(`no_images:          ${reports.filter(r => r.status === 'no_images').length}`)
  console.log(`ocr_empty:          ${reports.filter(r => r.status === 'ocr_empty').length}`)
  console.log(`fetch_failed:       ${reports.filter(r => r.status === 'fetch_failed').length}`)
  console.log(`errored:            ${reports.filter(r => r.status === 'errored').length}`)

  const reportPath = path.join(process.cwd(), 'tmp', `menu-ocr-report-${Date.now()}.json`)
  fs.mkdirSync(path.dirname(reportPath), { recursive: true })
  fs.writeFileSync(reportPath, JSON.stringify(reports, null, 2))
  console.log(`Wrote ${reportPath}`)
}

main().catch(e => { console.error(e); process.exit(1) })
