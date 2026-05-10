/**
 * Menu scraper v2.0 — accurate, fast, drink-aware.
 *
 * The v1 website scraper + v3 provider-fallback together captured menus for
 * 342 of 1,489 restaurants, but an audit found that 152 of those 342 (44%)
 * are booze-only scrapes (wine/cocktail lists, not food). This script fixes
 * both sides of that:
 *
 *   1. FOOD-QUALITY GATE. Every extraction runs through a food/drink
 *      classifier. A capture is only accepted when it passes the food gate
 *      (>=25% food-like items, food_ratio > drink_ratio, >=3 total).
 *
 *   2. JSON-LD + microdata first. Many sites publish schema.org/Menu
 *      structured data. When it exists, that's far cleaner than regex-ing
 *      plain text.
 *
 *   3. Multi-URL discovery. For each restaurant we enumerate candidate URLs
 *      (JSON-LD @id, rel=alternate menu links, anchor hrefs, common paths
 *      like /menu, /dinner, /food-menu, /menus/dinner, PDF links, provider
 *      hosts) and score them — food-menu paths outrank drink-menu paths.
 *
 *   4. Best-of-N. We visit up to N ranked URLs per restaurant and keep the
 *      capture with the best food-quality score.
 *
 *   5. Modes:
 *        --mode=missing       restaurants with zero menu rows (default)
 *        --mode=rescrape-bad  restaurants whose existing menu is drink-only
 *        --mode=all           the union of both
 *        --mode=ids           restrict to --ids=a,b,c
 *
 *   6. Quality reported. Every fetch writes a compact report to
 *      tmp/menu-v2-report.json so future audits can rank what still needs
 *      attention.
 *
 * Usage:
 *   npx tsx scripts/scrapeMenusV2.ts [--mode=missing] [--limit=100] [--dryRun=true]
 *     [--concurrency=4] [--urlBudget=6] [--ids=a,b,c]
 *
 * Design notes / non-goals:
 *   - No Chrome/Playwright. Everything is plain fetch + pdftotext. JS-only
 *     SPAs will still fail — but those are a separate beast, and the sandbox
 *     can't reliably run a headless browser at scale anyway (per memory).
 *   - Concurrency stays at 4 by default; parallel>4 crashes the sandbox.
 */

import { createClient } from '@supabase/supabase-js'
import * as fs from 'fs'
import * as path from 'path'
import { execFile } from 'child_process'
import { promisify } from 'util'

const execFileP = promisify(execFile)

// ---------- env bootstrap ----------

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
if (!SUPA_URL || !SUPA_KEY) {
  console.error('Missing Supabase env')
  process.exit(1)
}
const supabase = createClient(SUPA_URL, SUPA_KEY, { auth: { persistSession: false } })

// ---------- args ----------

const rawArgs = Object.fromEntries(
  process.argv.slice(2).map(a => {
    const [k, v] = a.replace(/^--/, '').split('=')
    return [k, v ?? 'true']
  }),
) as Record<string, string>

const MODE = (rawArgs.mode ?? 'missing') as 'missing' | 'rescrape-bad' | 'all' | 'ids'
const LIMIT = Number(rawArgs.limit ?? '100')
const CONCURRENCY = Number(rawArgs.concurrency ?? '4')
const URL_BUDGET = Number(rawArgs.urlBudget ?? '6')
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

const UA = 'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 Gastronome-Scraper/2.0 (+dakai.research@gmail.com)'

async function getHtml(url: string, timeoutMs = 15000, attempt = 0): Promise<{ html: string; finalUrl: string; contentType: string } | null> {
  let host = ''
  try { host = new URL(url).host } catch { return null }
  await politeWait(host)
  try {
    const ctl = new AbortController()
    const t = setTimeout(() => ctl.abort(), timeoutMs)
    const res = await fetch(url, {
      signal: ctl.signal,
      redirect: 'follow',
      headers: {
        'User-Agent': UA,
        'Accept': 'text/html,application/xhtml+xml,application/json,*/*;q=0.9',
        'Accept-Language': 'en-US,en;q=0.9',
      },
    })
    clearTimeout(t)
    if (res.status === 429 || res.status === 503) {
      const retryAfter = Number(res.headers.get('retry-after')) || 0
      const waitMs = Math.max(retryAfter * 1000, 4000 * Math.pow(2, attempt))
      if (attempt < 2) { await sleep(waitMs); return getHtml(url, timeoutMs, attempt + 1) }
      return null
    }
    if (res.status >= 500 && res.status < 600 && attempt < 1) {
      await sleep(2000 + Math.random() * 1000)
      return getHtml(url, timeoutMs, attempt + 1)
    }
    if (!res.ok) return null
    const contentType = (res.headers.get('content-type') ?? '').toLowerCase()
    return { html: await res.text(), finalUrl: res.url, contentType }
  } catch {
    return null
  }
}

async function getPdfText(url: string, timeoutMs = 20000): Promise<{ text: string; finalUrl: string } | null> {
  let host = ''
  try { host = new URL(url).host } catch { return null }
  await politeWait(host)
  let tmpPath: string | null = null
  try {
    const ctl = new AbortController()
    const t = setTimeout(() => ctl.abort(), timeoutMs)
    const res = await fetch(url, {
      signal: ctl.signal,
      redirect: 'follow',
      headers: { 'User-Agent': UA, 'Accept': 'application/pdf,*/*;q=0.9' },
    })
    clearTimeout(t)
    if (!res.ok) return null
    const buf = Buffer.from(await res.arrayBuffer())
    if (buf.length < 400 || buf.slice(0, 4).toString() !== '%PDF') return null
    tmpPath = path.join('/tmp', `v2-pdf-${process.pid}-${Date.now()}-${Math.random().toString(36).slice(2, 8)}.pdf`)
    fs.writeFileSync(tmpPath, buf)
    const { stdout } = await execFileP('pdftotext', ['-layout', tmpPath, '-'], {
      maxBuffer: 8 * 1024 * 1024, timeout: 15000,
    } as any)
    return { text: stdout.toString(), finalUrl: res.url }
  } catch {
    return null
  } finally {
    if (tmpPath) { try { fs.unlinkSync(tmpPath) } catch {} }
  }
}

// ---------- html → text ----------

const entities: Record<string, string> = {
  '&amp;': '&', '&lt;': '<', '&gt;': '>', '&quot;': '"', '&#39;': "'", '&apos;': "'",
  '&nbsp;': ' ', '&rsquo;': "'", '&lsquo;': "'", '&ldquo;': '"', '&rdquo;': '"',
  '&ndash;': '-', '&mdash;': '-', '&hellip;': '...',
}
function decodeEntities(s: string): string {
  return s.replace(/&(?:[a-zA-Z]+|#\d+|#x[0-9a-fA-F]+);/g, m => {
    if (entities[m]) return entities[m]
    const num = m.match(/^&#(\d+);$/); if (num) return String.fromCharCode(+num[1])
    const hex = m.match(/^&#x([0-9a-fA-F]+);$/); if (hex) return String.fromCharCode(parseInt(hex[1], 16))
    return m
  })
}
function htmlToText(html: string): string {
  return decodeEntities(
    html
      .replace(/<script[\s\S]*?<\/script>/gi, ' ')
      .replace(/<style[\s\S]*?<\/style>/gi, ' ')
      .replace(/<noscript[\s\S]*?<\/noscript>/gi, ' ')
      .replace(/<(br|hr)\s*\/?>/gi, '\n')
      .replace(/<\/(p|div|li|tr|h[1-6]|section|article|header|footer)>/gi, '\n')
      .replace(/<[^>]+>/g, ' '),
  ).replace(/\u00a0/g, ' ').replace(/[ \t]+/g, ' ').replace(/\n[ \t]+/g, '\n').replace(/\n{2,}/g, '\n').trim()
}

// ---------- food / drink classifier ----------

/**
 * Token sets tuned from the QA sweep across 342 restaurants. Goal: cheaply
 * distinguish a food menu from a wine/cocktail list. Not trying to label every
 * single item — just to get a food_ratio reliable enough to gate the capture.
 */
const FOOD_TOKENS = /\b(pizza|pasta|burger|steak|chicken|fish|salad|soup|taco|sushi|sandwich|salmon|tuna|shrimp|lobster|crab|pork|lamb|beef|duck|ribs|wings|egg|cheese|pie|cake|bread|fries|rice|noodle|ramen|dumpling|risotto|gnocchi|ravioli|lasagna|paella|tartare|carpaccio|oyster|mussel|scallop|octopus|squid|brisket|chop|cutlet|roast|confit|fried|grilled|smoked|braised|roasted|poached|bun|toast|wrap|roll|sausage|meatball|tart|cookie|croissant|ice cream|dessert|chocolate|vanilla|curry|kimchi|bibimbap|pho|banh mi|enchilada|quesadilla|burrito|guacamole|hummus|falafel|gyros|moussaka|tiramisu|tempura|nigiri|sashimi|maki|pot sticker|wonton|poke|poké|avocado|tomato|eggplant|mushroom|broccoli|asparagus|artichoke|beet|kale|spinach|lentil|bean|potato|yam|burrata|mozzarella|parmesan|souffle|soufflé|quiche|crepe|pancake|waffle|omelette|benedict|tartine|bisque|bouillabaisse|cassoulet|ratatouille|bourguignon|velouté|chowder|gumbo|jambalaya|pozole|ceviche|aguachile|tostada|tortilla|empanada|arepa|moqueca|churrasco|yakitori|okonomiyaki|takoyaki|katsu|udon|soba|unagi|toro|donburi|teppanyaki|bulgogi|galbi|tteokbokki|naengmyeon|banchan|pajeon|tom yum|pad thai|pad see ew|pad krapow|larb|massaman|panang|khao soi|nasi|satay|mie goreng|bolognese|carbonara|amatriciana|marinara|arancini|caprese|prosciutto|salumi|mortadella|speck|pancetta|guanciale|cacio|porchetta|cotoletta|vitello|ossobuco|ribollita|pappardelle|tagliatelle|orecchiette|bucatini|linguine|fettuccine|farfalle|penne|tortellini|agnolotti|cannelloni|manicotti|calzone|stromboli|pesto|carpaccio|branzino|orata|spigola|crudo|vongole|antipasti|insalata|primi|secondi|dolci|contorni|focaccia|schiacciata|panino|croque|nicoise|niçoise|bouillabaisse|daube|tarte|madeleine|pot de creme|profiterole|financier|macaron|canard|magret|boeuf|entrecote|filet mignon|chateaubriand|coquilles|moules|frites|raclette|fondue|choucroute|tartine|tajine|shawarma|kebab|kabob|souvla|spanakopita|dolma|baba ganoush|fattoush|tabouleh|labneh|zaatar|manti|doner|kofta|biryani|tikka|masala|tandoori|naan|samosa|pakora|dosa|idli|vindaloo|korma|butter chicken|dal|raita|mishima|wagyu|kobe|uni|ikura|tamago|anago|hamachi|kanpachi|hirame|sake nigiri|temaki|chirashi|shabu|pho|bun cha|com tam|ca kho|xiao long|jian bing|hot pot|dim sum|siu mai|har gow|cheung fun|char siu|peking duck|mapo|kung pao|general tso|moo shu|lo mein|chow mein|chow fun|egg foo|mongolian|sichuan|szechuan|cantonese|dan dan|zha jiang|wonton|xiaolongbao|shengjianbao|baozi)\b/i

const DRINK_TOKENS = /\b(whiskey|whisky|vodka|gin|tequila|mezcal|bourbon|rye|rum|scotch|cognac|armagnac|calvados|amaro|amari|vermouth|wine|champagne|prosecco|cava|sauvignon|chardonnay|pinot|cabernet|merlot|riesling|syrah|shiraz|malbec|zinfandel|grenache|nebbiolo|sangiovese|tempranillo|brunello|barolo|barbaresco|chianti|negroni|martini|manhattan|margarita|daiquiri|mojito|old fashioned|paloma|sazerac|spritz|beer|lager|ale|ipa|stout|pilsner|brut|grappa|sambuca|chartreuse|aperitif|digestif|sake|sochu|soju|makgeolli|cider|kombucha|highball|lowball|cocktail|mocktail|non-alcoholic|non alcoholic|zero proof|bottled|glass pour|by the glass|by the bottle|eau de vie|limoncello|vermut|liqueur|fernet|campari|aperol|cynar|mezcal|bourbon|patron|don julio|casamigos|johnnie walker|macallan|maker's mark|blanton|buffalo trace|ardbeg|balvenie|bushmills|glenfiddich|glenmorangie|glenrothes|lagavulin|laphroaig|oban|highland park|hibiki|hakushu|yamazaki|nikka|suntory|chivas|dewar|jack daniel|crown royal|jameson|tanqueray|hendrick|bombay|beefeater|ketel one|belvedere|grey goose|chopin|absolut|stoli|haku|roku|ki no bi|monkey 47|jagermeister|goldschlager|baileys|kahlua|frangelico|grand marnier|cointreau|triple sec|vermouth|dubonnet|lillet|punt e mes|galliano|chambord|st-germain|st germain|montenegro|meletti|nonino|ramazzotti|averna|braulio|lazzaroni|luxardo|maraschino|sambuca|anisette|ouzo|pastis|raki|arak|grappa|pisco|cachaca|cachaça|caipirinha|singani|aguardiente|mosto|chicha|pulque|sotol|bacanora|raicilla|malbec|torrontes|bonarda|valpolicella|ripasso|amarone|lambrusco|montepulciano|trebbiano|vermentino|gavi|verdicchio|falanghina|greco|fiano|aglianico|taurasi|primitivo|negroamaro|nero d'avola|chateauneuf|burgundy|bordeaux|rhone|rhône|languedoc|provence|loire|alsace|rioja|ribera|priorat|albarino|albariño|verdejo|godello|garnacha|tempranillo|mencia|monastrell|xarel-lo|macabeo|parellada|grüner|gruner|riesling|gewurztraminer|gewürztraminer|moscato|asti|franciacorta|trento|conegliano|bottles?$|glass?$)\b/i

/** Very tight wine-style detection: Producer, Vintage-like year with 4 digits. */
const WINE_VINTAGE_RE = /(20\d{2}|19\d{2})\b.*\b(brut|dry|sweet|demi|sec|reserve|reserva|riserva|cru|rouge|blanc|rose|rosé|vineyard|estate)\b/i

export type Item = {
  name: string
  section: string | null
  price_cents: number | null
  price_raw: string
  description: string | null
}

export type MenuQuality = {
  total: number
  food_like: number
  drink_like: number
  food_ratio: number
  drink_ratio: number
  verdict: 'food_menu' | 'drink_menu' | 'mixed' | 'unclear' | 'empty'
}

function classifyItem(name: string): 'food' | 'drink' | 'other' {
  const n = name.toLowerCase()
  const foodHit = FOOD_TOKENS.test(n)
  const drinkHit = DRINK_TOKENS.test(n) || WINE_VINTAGE_RE.test(n)
  // Prefer FOOD when both hit: a menu line like "chicken and wine jus" is food.
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

/** The final gate: did we capture something worth keeping? */
function passesFoodGate(q: MenuQuality): boolean {
  // Clear food menu: >= 25% food-like, >= 3 items, >= 2 food_like. Strict path.
  if (q.verdict === 'food_menu' && q.total >= 3 && q.food_like >= 2) return true
  // Mixed menu that's still food-dominant (e.g. dinner PDFs that include a short
  // wine pairings list at the bottom): accept if food_like >= 4 and food >= drink.
  if (q.verdict === 'mixed' && q.food_like >= 4 && q.food_ratio >= q.drink_ratio) return true
  return false
}

/** Compare two captures — higher is better. Used to pick best-of-N. */
function captureScore(q: MenuQuality): number {
  if (q.verdict === 'drink_menu') return -10
  if (q.verdict === 'empty') return -5
  // Reward food_like items, mildly penalize drink contamination.
  return q.food_like * 2 + q.total * 0.2 - q.drink_like * 0.5
}

// ---------- extractors ----------

/**
 * Pull @type:"Menu" / "MenuSection" / "MenuItem" nodes out of a page's JSON-LD
 * blocks. Many bentobox/wordpress/squarespace sites publish this.
 */
function extractJsonLdMenu(html: string): Item[] {
  const items: Item[] = []
  const re = /<script[^>]+type=["']application\/ld\+json["'][^>]*>([\s\S]*?)<\/script>/gi
  let m
  while ((m = re.exec(html))) {
    let parsed: any
    try { parsed = JSON.parse(m[1].trim()) } catch { continue }
    const roots = Array.isArray(parsed) ? parsed : [parsed]
    for (const root of roots) {
      walk(root, null)
    }
  }
  function walk(node: any, currentSection: string | null) {
    if (!node || typeof node !== 'object') return
    const types = node['@type']
    const typeStr = Array.isArray(types) ? types.join(',') : types
    if (typeof typeStr === 'string') {
      if (/MenuItem/i.test(typeStr)) {
        const name = String(node.name ?? '').trim()
        if (name && name.length <= 120) {
          let price_cents: number | null = null
          let price_raw = ''
          const offers = node.offers ?? node.offer
          if (offers) {
            const list = Array.isArray(offers) ? offers : [offers]
            for (const o of list) {
              const p = o?.price ?? o?.priceSpecification?.price
              if (p != null && !Number.isNaN(Number(p))) {
                price_cents = Math.round(Number(p) * 100)
                price_raw = String(p)
                break
              }
            }
          }
          const description = typeof node.description === 'string' && node.description.length <= 400
            ? node.description.trim() : null
          items.push({ name, section: currentSection, price_cents, price_raw, description })
        }
      }
      // SinglePlatform / schema.org/Offer pattern: the Offer node holds the price
      // and the MenuItem lives under itemOffered. Capture both in one place so we
      // don't lose the price.
      if (/(^|,)Offer(,|$)/i.test(typeStr) && node.itemOffered && typeof node.itemOffered === 'object') {
        const io = node.itemOffered
        const ioTypes = io['@type']
        const ioTypeStr = Array.isArray(ioTypes) ? ioTypes.join(',') : ioTypes
        if (typeof ioTypeStr === 'string' && /MenuItem/i.test(ioTypeStr)) {
          const name = String(io.name ?? '').trim()
          if (name && name.length <= 120) {
            const p = node.price ?? node.priceSpecification?.price
            const priceNum = p != null && !Number.isNaN(Number(p)) ? Number(p) : null
            const price_cents = priceNum != null ? Math.round(priceNum * 100) : null
            const price_raw = priceNum != null ? String(priceNum) : ''
            const description = typeof io.description === 'string' && io.description.length <= 400
              ? io.description.trim() : null
            items.push({ name, section: currentSection, price_cents, price_raw, description })
          }
        }
      }
      if (/MenuSection/i.test(typeStr)) {
        currentSection = String(node.name ?? currentSection ?? '').trim() || currentSection
      }
      // OfferCatalog is SinglePlatform's outer grouping — treat its name as a section hint.
      if (/OfferCatalog/i.test(typeStr) && typeof node.name === 'string' && node.name.trim()) {
        currentSection = node.name.trim()
      }
    }
    // recurse into hasMenuSection / hasMenuItem / itemListElement / nested arrays
    for (const key of Object.keys(node)) {
      const v = node[key]
      if (Array.isArray(v)) for (const child of v) walk(child, currentSection)
      else if (v && typeof v === 'object') walk(v, currentSection)
    }
  }
  // Dedupe by name, preferring the entry WITH a price if we saw the same name twice
  // (JSON-LD often lists the same item under both MenuItem and Offer→itemOffered).
  const byName = new Map<string, Item>()
  for (const it of items) {
    const k = it.name.toLowerCase()
    const prev = byName.get(k)
    if (!prev) { byName.set(k, it); continue }
    if (prev.price_cents == null && it.price_cents != null) byName.set(k, it)
  }
  return Array.from(byName.values())
}

/** Fallback: price-line regex extractor (v1/v3 style). */
const SECTION_RE = /^[A-Z][A-Z0-9 &\-'’]{2,40}$/
const ITEM_RE = /^(.+?)\s+\$?\s?(\d{1,3}(?:\.\d{2})?|M\.P\.|MP|market price)(?:\s*(?:\/|per\s+)?(?:lb|oz|pc|pcs|each|ea)\.?)?$/i
const NOISE_PREFIX = /^(add|sub|substitute|choice of|includes|served with|comes with|add-on|slide\s*\d)/i
const TRASH_NAME = /^(\d+\s*[•·]\s*)?$|^[•·\-–—\s]+$|^(slide|current slide)/i

function extractByPriceLines(text: string): Item[] {
  const lines = text.split('\n').map(l => l.trim()).filter(Boolean)
  const items: Item[] = []
  let section: string | null = null
  for (let i = 0; i < lines.length; i++) {
    const line = lines[i]
    if (SECTION_RE.test(line) && !ITEM_RE.test(line) && line.length <= 40) { section = line; continue }
    const m = line.match(ITEM_RE); if (!m) continue
    const name = m[1].trim(), priceRaw = m[2]
    if (NOISE_PREFIX.test(name) || TRASH_NAME.test(name)) continue
    if (name.length < 2 || name.length > 80) continue
    const letters = (name.match(/[A-Za-z]/g) || []).length
    if (letters < 3 || letters / name.length < 0.4) continue
    if (name.length > 40 && (name.match(/,/g) || []).length >= 3) continue
    if (/^\d+$/.test(name)) continue
    if (/^\d+\s*oz\.?$/i.test(line)) continue
    let cents: number | null = null
    if (/^\d/.test(priceRaw)) cents = Math.round(parseFloat(priceRaw) * 100)
    if (cents !== null && cents < 300) continue
    if (cents !== null && cents > 50000) continue
    const next = lines[i + 1]
    const desc = next && !ITEM_RE.test(next) && !SECTION_RE.test(next) && next.length <= 300 ? next : null
    items.push({ name, section, price_cents: cents, price_raw: priceRaw, description: desc })
  }
  const seen = new Set<string>(); const out: Item[] = []
  for (const it of items) { const k = it.name.toLowerCase(); if (seen.has(k)) continue; seen.add(k); out.push(it) }
  return out
}

/**
 * Microdata (itemtype="...schema.org/Menu") — much rarer than JSON-LD but a
 * few self-hosted sites use it.
 */
function extractMicrodataMenu(html: string): Item[] {
  const items: Item[] = []
  const blockRe = /<[^>]+itemtype=["'][^"']*schema\.org\/MenuItem[^"']*["'][^>]*>([\s\S]*?)<\/[^>]+>/gi
  let m
  while ((m = blockRe.exec(html))) {
    const block = m[0]
    const nameM = block.match(/itemprop=["']name["'][^>]*>([^<]{2,120})</i)
    if (!nameM) continue
    const priceM = block.match(/itemprop=["']price["'][^>]*content=["']([0-9.]+)["']/i)
                 || block.match(/itemprop=["']price["'][^>]*>\$?([0-9.]+)</i)
    const descM = block.match(/itemprop=["']description["'][^>]*>([^<]{3,400})</i)
    const cents = priceM ? Math.round(parseFloat(priceM[1]) * 100) : null
    items.push({
      name: decodeEntities(nameM[1]).trim(),
      section: null,
      price_cents: cents && cents >= 300 && cents <= 50000 ? cents : null,
      price_raw: priceM ? priceM[1] : '',
      description: descM ? decodeEntities(descM[1]).trim() : null,
    })
  }
  return items
}

/** Fetch + run all three extractors, return the best. */
function extractAny(html: string, finalUrl: string): Item[] {
  const jsonLd = extractJsonLdMenu(html)
  if (jsonLd.length >= 3) return jsonLd
  const microdata = extractMicrodataMenu(html)
  if (microdata.length >= 3) return microdata
  return extractByPriceLines(htmlToText(html))
}

// ---------- candidate URL discovery ----------

type Candidate = {
  url: string
  score: number
  via: 'root' | 'anchor' | 'pdf' | 'guessed-path' | 'provider' | 'jsonld' | 'rel-alternate'
  isPdf?: boolean
}

const COMMON_MENU_PATHS = [
  '/menu', '/menus', '/menus/', '/menu/', '/food', '/food-menu', '/food/menu',
  '/menu/food', '/menu/dinner', '/menu/lunch', '/menu/brunch',
  '/dinner-menu', '/lunch-menu', '/brunch-menu',
  '/dinner', '/lunch', '/brunch',
  '/eat', '/dine', '/dining', '/order-online', '/order', '/ordering',
  '/menus/dinner', '/menus/lunch', '/menus/brunch', '/menus/food',
]

const DRINK_PATH_PENALTY = /\/(wine-?list|drink-?menu|drinks|cocktails|bar-?menu|beverages?|spirits|sake|winelist)(\/|$)/i
const TASTING_PATH_PENALTY = /\/(tasting-?menu|chefs?-?table|prix-?fixe)/i

function scorePathForFood(url: string): number {
  const p = (() => { try { return new URL(url).pathname.toLowerCase() } catch { return url.toLowerCase() } })()
  let s = 0
  if (/\/(food|dinner|lunch|brunch|menu|menus|dining|eat|dine)(\/|$)/.test(p)) s += 6
  if (/\/(food-menu|dinner-menu|lunch-menu|brunch-menu|food\/menu|menu\/food)/.test(p)) s += 8
  if (DRINK_PATH_PENALTY.test(p)) s -= 8
  if (TASTING_PATH_PENALTY.test(p)) s -= 2
  if (/\.pdf(\?|$)/.test(p)) s += 2
  if (/(privacy|terms|gift|reservation|reserve|contact|about|career|event)/.test(p)) s -= 6
  return s
}

/** Pull anchor URLs whose href or link-text hints at menu/food. */
function findAnchorCandidates(html: string, base: string): Candidate[] {
  const out = new Map<string, Candidate>()
  const re = /<a[^>]+href=["']([^"']+)["'][^>]*>([\s\S]*?)<\/a>/gi
  let m
  while ((m = re.exec(html))) {
    const href = m[1]; const inner = m[2].replace(/<[^>]+>/g, ' ').trim().toLowerCase()
    const lh = href.toLowerCase()
    const urlHint = /(^|[\/\?#])(menu|menus|food|dinner|lunch|brunch|carte|dine|dining|eat)(s?)([\/\?#&=]|$)/.test(lh)
    const textHint = /\b(menu|menus|food menu|dinner menu|lunch menu|brunch menu|view menu|full menu|our menu|dinner|lunch|brunch|food)\b/.test(inner) && inner.length < 60
    if (!urlHint && !textHint) continue
    try {
      const u = new URL(href, base)
      if (!/^https?:/.test(u.protocol)) continue
      const key = u.href.split('#')[0]
      const via: Candidate['via'] = /\.pdf(\?|$)/i.test(key) ? 'pdf' : 'anchor'
      let score = scorePathForFood(key)
      // small bump when the link text specifically says "food" or "dinner"
      if (/food menu|dinner menu|lunch menu|brunch menu|food/i.test(inner)) score += 3
      // penalty when link text suggests drinks
      if (/\b(wine|drinks|cocktails?|bar menu|beverages?|spirits)\b/i.test(inner)) score -= 5
      const prev = out.get(key)
      if (!prev || score > prev.score) out.set(key, { url: key, score, via, isPdf: /\.pdf(\?|$)/i.test(key) })
    } catch {}
  }
  return Array.from(out.values())
}

/**
 * Detect third-party menu widgets/embeds on a page and convert them to the
 * provider's canonical public menu URL — those URLs are typically server-rendered
 * with full JSON-LD and are therefore scrapeable.
 *
 * Supports:
 *   - SinglePlatform  <script data-location="<slug>" ... src=".../widget"/>
 *   - BentoBox        iframe/script hosted on getbento.com or <restaurant>.bentobox.com
 *   - Popmenu         *.popmenu.com
 *   - Toast           onlineordering.toasttab.com or toasttab.com/<slug>/v3
 *   - Square          squareup.com/dashboard/...  or  <biz>.square.site/s/menu
 *   - ChowNow         chownow.com/order/<id>
 *   - OwnerOrder      order.online/store/<slug>
 *   - Resy widget     resy.com/cities/.../venues/<slug>
 *   - Tock            exploretock.com/<slug>/menu
 */
function findProviderCandidates(html: string): Candidate[] {
  const out: Candidate[] = []
  const seen = new Set<string>()
  const push = (url: string, score: number) => {
    if (!seen.has(url)) { seen.add(url); out.push({ url, score, via: 'provider' }) }
  }
  // SinglePlatform: <script data-location="..."> → places.singleplatform.com/<loc>/menu
  const sp = Array.from(html.matchAll(/data-location=["']([a-z0-9-]{2,80})["']/gi))
  for (const m of sp) push(`https://places.singleplatform.com/${m[1]}/menu`, 12)
  // BentoBox embed URLs are usually on the site origin as /<something>/menu served by
  // BentoBox; anchors to getbento.com/... may appear in nav — we let those slip through
  // findAnchorCandidates naturally.
  for (const m of Array.from(html.matchAll(/https?:\/\/(?:[a-z0-9-]+\.)?getbento\.com\/[^"'<>]{3,150}/gi))) {
    push(m[0].split('#')[0], 10)
  }
  // Popmenu
  for (const m of Array.from(html.matchAll(/https?:\/\/[a-z0-9-]+\.popmenu\.com\/[^"'<>]{0,150}/gi))) {
    push(m[0].split('#')[0], 10)
  }
  // Toast — two common patterns: www.toasttab.com/<slug>/v3 and onlineordering.toasttab.com
  for (const m of Array.from(html.matchAll(/https?:\/\/(?:www\.)?toasttab\.com\/[a-z0-9-]{2,80}(?:\/[a-z0-9-]+)?/gi))) {
    push(m[0].split('?')[0].split('#')[0], 10)
  }
  // Square ordering
  for (const m of Array.from(html.matchAll(/https?:\/\/[a-z0-9-]+\.square\.site\/[^"'<>]{0,150}/gi))) {
    push(m[0].split('#')[0], 8)
  }
  // ChowNow
  for (const m of Array.from(html.matchAll(/https?:\/\/(?:www\.)?chownow\.com\/order\/[a-z0-9-]+/gi))) {
    push(m[0].split('?')[0], 8)
  }
  // order.online (myguestaccount-backed)
  for (const m of Array.from(html.matchAll(/https?:\/\/(?:www\.)?order\.online\/store\/[a-z0-9-]+/gi))) {
    push(m[0].split('?')[0], 6)
  }
  // Resy venue page (no menu JSON but occasionally useful)
  for (const m of Array.from(html.matchAll(/https?:\/\/(?:www\.)?resy\.com\/cities\/[a-z-]+\/venues\/[a-z0-9-]+/gi))) {
    push(m[0].split('?')[0], 4)
  }
  // Tock (exploretock)
  for (const m of Array.from(html.matchAll(/https?:\/\/(?:www\.)?exploretock\.com\/[a-z0-9-]+(?:\/menu)?/gi))) {
    push(m[0].split('?')[0], 6)
  }
  return out
}

/** <link rel="alternate" type="text/html" href="..."> and similar. */
function findRelAlternateCandidates(html: string, base: string): Candidate[] {
  const out: Candidate[] = []
  const re = /<link[^>]+rel=["']alternate["'][^>]+href=["']([^"']+)["']/gi
  let m
  while ((m = re.exec(html))) {
    try {
      const u = new URL(m[1], base)
      if (!/^https?:/.test(u.protocol)) continue
      const key = u.href.split('#')[0]
      const score = scorePathForFood(key) + 1
      if (score > 0) out.push({ url: key, score, via: 'rel-alternate' })
    } catch {}
  }
  return out
}

/** Build ranked list of URLs to visit for one restaurant's website. */
async function discoverCandidates(website: string): Promise<{ base: string; rootHtml: string; candidates: Candidate[] } | null> {
  const start = website.startsWith('http') ? website : 'https://' + website
  const root = await getHtml(start)
  if (!root) return null
  const base = root.finalUrl
  const cands = new Map<string, Candidate>()
  const add = (c: Candidate) => {
    const prev = cands.get(c.url)
    if (!prev || c.score > prev.score) cands.set(c.url, c)
  }
  // 0. the root itself (some menus live on the home page)
  add({ url: base, score: scorePathForFood(base) + 1, via: 'root' })
  // 1. anchors, rel=alternate, and third-party menu widgets
  for (const c of findAnchorCandidates(root.html, base)) add(c)
  for (const c of findRelAlternateCandidates(root.html, base)) add(c)
  for (const c of findProviderCandidates(root.html)) add(c)
  // 2. guessed common paths
  let origin = ''
  try { origin = new URL(base).origin } catch {}
  if (origin) {
    for (const p of COMMON_MENU_PATHS) {
      const u = origin + p
      if (!cands.has(u)) add({ url: u, score: scorePathForFood(u), via: 'guessed-path' })
    }
  }
  // 3. provider URLs + JSON-LD @id hints (cheap bonus)
  const idMatches = Array.from(root.html.matchAll(/"@id":\s*"(https?:\/\/[^"]+)"/g))
  for (const m of idMatches) {
    try {
      const u = new URL(m[1])
      const s = scorePathForFood(u.href)
      if (s > 0) add({ url: u.href, score: s + 1, via: 'jsonld' })
    } catch {}
  }
  const ranked = Array.from(cands.values()).sort((a, b) => b.score - a.score)
  return { base, rootHtml: root.html, candidates: ranked }
}

// ---------- per-restaurant pipeline ----------

type Report = {
  id: string
  name: string
  website: string
  status: 'accepted' | 'rejected_quality' | 'no_content' | 'fetch_failed' | 'error'
  chosen_url: string | null
  items: number
  food_ratio: number | null
  drink_ratio: number | null
  verdict: MenuQuality['verdict'] | null
  attempts: Array<{ url: string; via: string; items: number; verdict: MenuQuality['verdict']; food_like: number; drink_like: number; score: number }>
  error?: string
  ms: number
}

async function scrapeOne(r: { id: string; name: string; website: string }): Promise<Report> {
  const t0 = Date.now()
  const rep: Report = {
    id: r.id, name: r.name, website: r.website,
    status: 'no_content', chosen_url: null, items: 0,
    food_ratio: null, drink_ratio: null, verdict: null,
    attempts: [], ms: 0,
  }

  const disc = await discoverCandidates(r.website)
  if (!disc) { rep.status = 'fetch_failed'; rep.ms = Date.now() - t0; return rep }

  // Always try root first as a free bonus even if score is low — it's already fetched.
  // Process candidates in rank order until we have a passing food menu OR exhaust budget.
  type Pick = { items: Item[]; q: MenuQuality; url: string; via: string }
  let best: Pick | null = null
  let visited = 0

  // Dynamic queue so hub pages can enqueue follow-up candidates.
  const queueMap = new Map<string, Candidate>()
  const enqueue = (c: Candidate) => {
    const prev = queueMap.get(c.url)
    if (!prev || c.score > prev.score) queueMap.set(c.url, c)
  }
  for (const c of disc.candidates) enqueue(c)
  const tried = new Set<string>()

  const tryUrl = async (cand: Candidate): Promise<{ pick: Pick | null; html?: string }> => {
    visited++
    tried.add(cand.url)
    if (cand.isPdf || /\.pdf(\?|$)/i.test(cand.url)) {
      const pdf = await getPdfText(cand.url)
      if (!pdf) return { pick: null }
      const items = extractByPriceLines(pdf.text)
      const q = scoreMenu(items)
      rep.attempts.push({ url: cand.url, via: cand.via + ':pdf', items: items.length, verdict: q.verdict, food_like: q.food_like, drink_like: q.drink_like, score: captureScore(q) })
      return { pick: { items, q, url: pdf.finalUrl, via: cand.via + ':pdf' } }
    }
    // re-use already-fetched root to avoid a double request
    let html: string, finalUrl: string
    if (cand.via === 'root') {
      html = disc.rootHtml; finalUrl = disc.base
    } else {
      const page = await getHtml(cand.url)
      if (!page) return { pick: null }
      if (/%PDF/.test(page.html.slice(0, 8)) || page.contentType.includes('pdf')) {
        const pdf = await getPdfText(cand.url)
        if (!pdf) return { pick: null }
        const items = extractByPriceLines(pdf.text)
        const q = scoreMenu(items)
        rep.attempts.push({ url: cand.url, via: cand.via + ':pdf', items: items.length, verdict: q.verdict, food_like: q.food_like, drink_like: q.drink_like, score: captureScore(q) })
        return { pick: { items, q, url: pdf.finalUrl, via: cand.via + ':pdf' } }
      }
      html = page.html; finalUrl = page.finalUrl
    }
    const items = extractAny(html, finalUrl)
    const q = scoreMenu(items)
    rep.attempts.push({ url: cand.url, via: cand.via, items: items.length, verdict: q.verdict, food_like: q.food_like, drink_like: q.drink_like, score: captureScore(q) })
    return { pick: { items, q, url: finalUrl, via: cand.via }, html }
  }

  // Order: non-guessed first, then by score desc.
  const reorder = () => Array.from(queueMap.values())
    .filter(c => !tried.has(c.url))
    .sort((a, b) => {
      const prio = (c: Candidate) => (c.via === 'guessed-path' ? 0 : 1)
      return (prio(b) - prio(a)) || (b.score - a.score)
    })

  while (visited < URL_BUDGET) {
    const pending = reorder()
    if (!pending.length) break
    const c = pending[0]
    const result = await tryUrl(c)
    const pick = result.pick
    if (!pick) continue
    // Hub-page hop: if this page yielded near-zero items but has menu-shaped
    // outgoing links (anchor or provider embeds we haven't seen), enqueue them
    // so we can follow ONE extra hop to reach the real food page.
    if (result.html && pick.items.length < 3) {
      for (const nc of findAnchorCandidates(result.html, pick.url)) {
        if (!queueMap.has(nc.url)) enqueue({ ...nc, via: 'anchor' })
      }
      for (const nc of findProviderCandidates(result.html)) {
        if (!queueMap.has(nc.url)) enqueue(nc)
      }
    }
    if (passesFoodGate(pick.q)) {
      if (!best || captureScore(pick.q) > captureScore(best.q)) best = pick
      if (pick.q.food_like >= 8 && pick.q.food_ratio >= 0.5) break
    } else if (!best || captureScore(pick.q) > captureScore(best.q)) {
      // Not passing gate — but track the best-so-far in case nothing passes
      // (we won't accept it, but it's useful for the report)
      best = pick
    }
  }

  if (best && passesFoodGate(best.q)) {
    rep.status = 'accepted'
    rep.chosen_url = best.url
    rep.items = best.items.length
    rep.food_ratio = best.q.food_ratio
    rep.drink_ratio = best.q.drink_ratio
    rep.verdict = best.q.verdict
    await persist(r, best.items, best.url, best.q)
  } else if (best) {
    rep.status = 'rejected_quality'
    rep.chosen_url = best.url
    rep.items = best.items.length
    rep.food_ratio = best.q.food_ratio
    rep.drink_ratio = best.q.drink_ratio
    rep.verdict = best.q.verdict
    // Log the fetch-attempt even though we didn't write items, so we know to
    // skip this restaurant on future missing-only runs.
    await logFetchOnly(r, best.url, best.q)
  } else {
    rep.status = 'no_content'
    await logFetchOnly(r, null, { total: 0, food_like: 0, drink_like: 0, food_ratio: 0, drink_ratio: 0, verdict: 'empty' })
  }
  rep.ms = Date.now() - t0
  return rep
}

async function persist(r: { id: string }, items: Item[], sourceUrl: string, q: MenuQuality): Promise<void> {
  if (DRY_RUN) return
  // If a prior scrape loaded drink-only rows for this restaurant from a different
  // source_url, wipe that source first — keep things clean.
  await supabase
    .from('restaurant_menu_items')
    .delete()
    .eq('restaurant_id', r.id)
    .eq('source', 'website')
  const rows = items.map(it => ({
    restaurant_id: r.id,
    item_name: it.name.slice(0, 120),
    section: it.section,
    price_cents: it.price_cents,
    price_raw: (it.price_raw || '').slice(0, 40),
    description: it.description,
    source: 'website',
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
    source: 'website-v2',
    source_url: sourceUrl,
    menu_url: sourceUrl,
    status: 'ok',
    items_found: items.length,
    error_message: `v2 food_ratio=${q.food_ratio.toFixed(2)} drink_ratio=${q.drink_ratio.toFixed(2)} verdict=${q.verdict}`,
  })
}

async function logFetchOnly(r: { id: string }, sourceUrl: string | null, q: MenuQuality): Promise<void> {
  if (DRY_RUN) return
  await supabase.from('restaurant_menu_fetches').insert({
    restaurant_id: r.id,
    source: 'website-v2',
    source_url: sourceUrl,
    menu_url: sourceUrl,
    status: q.verdict === 'drink_menu' ? 'rejected_drink' : q.verdict === 'empty' ? 'no_items' : 'rejected_unclear',
    items_found: q.total,
    error_message: `v2 food_ratio=${q.food_ratio.toFixed(2)} drink_ratio=${q.drink_ratio.toFixed(2)} verdict=${q.verdict}`,
  })
}

// ---------- target selection ----------

async function pickTargets(): Promise<Array<{ id: string; name: string; website: string }>> {
  // Always need website to scrape
  let q = supabase.from('restaurants').select('id, name, website').not('website', 'is', null)
  if (MODE === 'ids') {
    if (!ID_FILTER?.length) { console.error('--mode=ids requires --ids=a,b,c'); process.exit(1) }
    q = q.in('id', ID_FILTER)
  }
  const { data: rs, error } = await q.order('name').limit(5000)
  if (error) { console.error(error); process.exit(1) }
  const all = (rs ?? []) as Array<{ id: string; name: string; website: string }>

  // pull current menu-row counts and a cheap food-token probe per restaurant
  const { data: menuItems } = await supabase
    .from('restaurant_menu_items')
    .select('restaurant_id, item_name')
    .limit(100000)
  const byRestaurant = new Map<string, string[]>()
  for (const row of (menuItems ?? []) as Array<{ restaurant_id: string; item_name: string }>) {
    const arr = byRestaurant.get(row.restaurant_id) ?? []
    arr.push(row.item_name)
    byRestaurant.set(row.restaurant_id, arr)
  }

  const classifyExisting = (names: string[]): 'food_menu' | 'drink_menu' | 'unclear' | 'mixed' => {
    if (!names.length) return 'unclear'
    const items = names.map(n => ({ name: n, section: null, price_cents: null, price_raw: '', description: null }))
    const q = scoreMenu(items)
    return q.verdict === 'food_menu' ? 'food_menu'
      : q.verdict === 'drink_menu' ? 'drink_menu'
      : q.verdict === 'mixed' ? 'mixed' : 'unclear'
  }

  const missing = all.filter(r => !byRestaurant.has(r.id) || (byRestaurant.get(r.id) ?? []).length === 0)
  const drinkOnly = all.filter(r => {
    const names = byRestaurant.get(r.id) ?? []
    return names.length > 0 && classifyExisting(names) === 'drink_menu'
  })

  if (MODE === 'missing') return missing.slice(0, LIMIT)
  if (MODE === 'rescrape-bad') return drinkOnly.slice(0, LIMIT)
  if (MODE === 'all') {
    const seen = new Set<string>()
    const merged: typeof all = []
    for (const r of [...missing, ...drinkOnly]) {
      if (seen.has(r.id)) continue
      seen.add(r.id)
      merged.push(r)
      if (merged.length >= LIMIT) break
    }
    return merged
  }
  // ids mode: return all matching ids
  return all.slice(0, LIMIT)
}

// ---------- main ----------

async function main() {
  const targets = await pickTargets()
  console.log(`v2.0 scraper — mode=${MODE} targets=${targets.length} concurrency=${CONCURRENCY} urlBudget=${URL_BUDGET} dryRun=${DRY_RUN}`)

  const reports: Report[] = []
  for (let i = 0; i < targets.length; i += CONCURRENCY) {
    const batch = targets.slice(i, i + CONCURRENCY)
    const rs = await Promise.all(
      batch.map(r =>
        scrapeOne(r).catch((e): Report => ({
          id: r.id, name: r.name, website: r.website,
          status: 'error', chosen_url: null, items: 0,
          food_ratio: null, drink_ratio: null, verdict: null,
          attempts: [], ms: 0, error: String(e),
        })),
      ),
    )
    for (const rep of rs) {
      reports.push(rep)
      const tag = rep.status === 'accepted' ? 'OK' : rep.status.toUpperCase()
      const extra = rep.food_ratio != null ? ` food=${(rep.food_ratio * 100).toFixed(0)}% drink=${((rep.drink_ratio ?? 0) * 100).toFixed(0)}%` : ''
      console.log(`[${tag}] ${rep.name} — ${rep.items} items${extra} (${rep.attempts.length} URLs, ${rep.ms}ms)`)
    }
    if ((Math.floor(i / CONCURRENCY)) % 5 === 0) {
      const ok = reports.filter(r => r.status === 'accepted').length
      const bad = reports.filter(r => r.status === 'rejected_quality').length
      const fail = reports.filter(r => r.status === 'fetch_failed' || r.status === 'no_content').length
      console.log(`...progress ${reports.length}/${targets.length} — accepted=${ok} rejected=${bad} failed=${fail}`)
    }
  }

  const accepted = reports.filter(r => r.status === 'accepted')
  const rejectedQuality = reports.filter(r => r.status === 'rejected_quality')
  const fetchFailed = reports.filter(r => r.status === 'fetch_failed')
  const noContent = reports.filter(r => r.status === 'no_content')
  const errored = reports.filter(r => r.status === 'error')
  const itemsTotal = accepted.reduce((a, r) => a + r.items, 0)

  console.log('\n=== v2 scrape summary ===')
  console.log(`accepted:            ${accepted.length}  (${itemsTotal} items saved)`)
  console.log(`rejected (bad qual): ${rejectedQuality.length}`)
  console.log(`no_content:          ${noContent.length}`)
  console.log(`fetch_failed:        ${fetchFailed.length}`)
  console.log(`errored:             ${errored.length}`)

  fs.mkdirSync('tmp', { recursive: true })
  const reportPath = path.join('tmp', `menu-v2-report-${Date.now()}.json`)
  fs.writeFileSync(reportPath, JSON.stringify(reports, null, 2))
  console.log(`Wrote ${reportPath}`)
}

main().catch(e => { console.error(e); process.exit(1) })
