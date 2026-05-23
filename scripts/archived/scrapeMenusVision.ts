/**
 * Menu scraper vision — Ollama-backed, runs locally on the user's Mac.
 *
 * Why this exists: tesseract OCR on homepage images tops out at ~8% yield.
 * NO_IMAGES dominates (50%+) because restaurants hide menus behind /menu
 * subpages, PDFs, or Toast/Squarespace widgets; OCR_EMPTY kills the rest
 * because tesseract can't read stylized menu fonts. Vision-capable LLMs
 * read any page layout natively — multi-column, handwritten, colored
 * backgrounds, stylized fonts. By rendering the full /menu* page with
 * Playwright and handing a single screenshot to a local Ollama model, we
 * eliminate both failure modes at once.
 *
 * Pipeline per restaurant:
 *   1. Fetch homepage HTML → extract candidate /menu* URLs + PDF links.
 *   2. For each candidate page (max 3), render with Playwright.
 *   3. Try text-first pass: innerText + price regex. If 10+ priced items,
 *      skip vision and parse directly.
 *   4. Otherwise: take a full-page screenshot, resize to max 2048px long
 *      edge, JPEG q80, send to Ollama /api/generate with a strict-JSON
 *      prompt. Parse JSON response into items.
 *   5. Run food-quality gate (same classifier as v2/v101/OCR).
 *   6. Persist with source='website-ollama'.
 *
 * For PDFs: download, render each of the first 3 pages to PNG via Playwright
 * (navigate to the PDF URL with a PDF.js-capable Chromium), send each page
 * screenshot through the same vision path.
 *
 * Resume: --mode=missing skips any restaurant that already has any menu
 * items (idempotent). Crash → rerun.
 *
 * Usage:
 *   # 1) install Ollama from https://ollama.com/download (Mac .dmg)
 *   # 2) ollama pull llama3.2-vision:11b
 *   # 3) npx playwright install chromium
 *   # 4) npx tsx scripts/scrapeMenusVision.ts --mode=missing --limit=30
 *
 * Flags:
 *   --mode=missing|ids    default missing
 *   --ids=a,b,c           when mode=ids
 *   --limit=N             default 50
 *   --concurrency=N       default 3 (tune per Mac; 4-6 on M2 Pro/Max is fine)
 *   --model=NAME          default 'llama3.2-vision:11b'
 *   --ollamaUrl=URL       default 'http://localhost:11434'
 *   --pagesPerSite=N      default 3 (max /menu* pages per restaurant)
 *   --dryRun              don't persist
 *   --debug               extra logging
 */

import { createClient } from '@supabase/supabase-js'
import { chromium, Browser, Page } from 'playwright'
import * as fs from 'fs'
import * as path from 'path'

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
if (!SUPA_URL || !SUPA_KEY) { console.error('Missing Supabase env — expected .env.local with NEXT_PUBLIC_SUPABASE_URL + SUPABASE_SERVICE_ROLE_KEY'); process.exit(1) }
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
const CONCURRENCY = Number(rawArgs.concurrency ?? '3')
const MODEL = rawArgs.model ?? 'llama3.2-vision:11b'
const OLLAMA_URL = rawArgs.ollamaUrl ?? 'http://localhost:11434'
const PAGES_PER_SITE = Number(rawArgs.pagesPerSite ?? '3')
const DRY_RUN = rawArgs.dryRun === 'true'
const DEBUG = rawArgs.debug === 'true'
const ID_FILTER = rawArgs.ids?.split(',').map(s => s.trim()).filter(Boolean)

const SOURCE = 'website-ollama'

// ---------- food / drink classifier (synced with OCR v2.1) ----------
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

// ---------- url discovery ----------
const MENU_KW_RE = /(menu|menus|food|dinner|lunch|brunch|breakfast|drinks|wine|beverage|cocktail|bar|dine|eat|order)/i

function resolveUrl(href: string, base: string): string | null {
  try { return new URL(href, base).toString() } catch { return null }
}

async function getHtml(url: string, timeoutMs = 15000): Promise<{ html: string; finalUrl: string } | null> {
  try {
    const ctl = new AbortController()
    const t = setTimeout(() => ctl.abort(), timeoutMs)
    const res = await fetch(url, {
      signal: ctl.signal,
      headers: {
        'user-agent': 'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 Gastronome-Scraper/vision (+dakai.research@gmail.com)',
        accept: 'text/html,application/xhtml+xml',
      },
      redirect: 'follow',
    })
    clearTimeout(t)
    if (!res.ok) return null
    return { html: await res.text(), finalUrl: res.url }
  } catch { return null }
}

type Candidate = { url: string; score: number; label: string; isPdf: boolean }

function findMenuCandidates(html: string, baseUrl: string): Candidate[] {
  const out: Candidate[] = []
  const seen = new Set<string>()
  let baseHost = ''
  try { baseHost = new URL(baseUrl).host } catch {}

  for (const m of html.matchAll(/<a[^>]+href=["']([^"']+)["'][^>]*>([\s\S]*?)<\/a>/gi)) {
    const href = m[1]
    const label = m[2].replace(/<[^>]+>/g, '').replace(/\s+/g, ' ').trim()
    const abs = resolveUrl(href, baseUrl)
    if (!abs) continue
    try { if (new URL(abs).host !== baseHost) continue } catch { continue }
    if (seen.has(abs)) continue
    seen.add(abs)
    const low = (abs + ' ' + label).toLowerCase()
    const isPdf = /\.pdf(\?|$)/i.test(abs)

    let score = 0
    if (/\bmenu\b/.test(low)) score += 4
    if (/(food|dinner|lunch|brunch)/.test(low)) score += 2
    if (/(wine|cocktail|drinks?|beverage|bar only)/.test(low)) score -= 1
    if (/(catering|private|events?|gift|faq|reservation|contact|jobs|careers|press|blog|about)/.test(low)) score -= 3
    if (isPdf) score += 1
    // Drink-only pages net to negative; skip them entirely instead of
    // promoting back to 1. This prevents bar/wine-only pages from being
    // the top candidate when no proper food menu link exists.
    if (score < 0) continue
    if (score === 0 && !MENU_KW_RE.test(low)) continue
    if (score === 0) score = 1
    out.push({ url: abs, score, label, isPdf })
  }

  // Synthetic common paths if nothing found
  if (!out.length) {
    for (const p of ['/menu', '/menus', '/food', '/dinner-menu']) {
      const abs = resolveUrl(p, baseUrl)
      if (abs && !seen.has(abs)) { out.push({ url: abs, score: 1, label: p, isPdf: false }); seen.add(abs) }
    }
  }

  out.sort((a, b) => b.score - a.score)
  return out
}

// ---------- text-first pass ----------
function tryParseTextPage(text: string): Item[] {
  // Lines that end with a price: "Something $12" or "... 12."
  const items: Item[] = []
  let section: string | null = null
  const lines = text.split(/\r?\n/).map(l => l.trim()).filter(Boolean)
  const HEAD = /^[A-Z][A-Z '&\-\/]{2,40}$/
  const PRICE_RE = /\s+\$?(\d{1,3}(?:\.\d{2})?)\s*$/

  for (const rawLine of lines) {
    if (HEAD.test(rawLine) && rawLine.length < 40) { section = rawLine; continue }
    const pm = rawLine.match(PRICE_RE)
    if (!pm) continue
    const cents = Math.round(Number(pm[1]) * 100)
    if (!Number.isFinite(cents) || cents < 200 || cents > 50000) continue
    const name = rawLine.replace(PRICE_RE, '').replace(/[\s.\u2026·•:;=_\-]{2,}.*$/, '').trim()
    if (name.length < 3 || name.length > 80) continue
    if (!/[a-z]/.test(name)) continue
    items.push({ name, section, price_cents: cents, price_raw: pm[1], description: null })
  }
  // dedupe by name
  const byName = new Map<string, Item>()
  for (const it of items) {
    const k = it.name.toLowerCase()
    if (!byName.has(k)) byName.set(k, it)
  }
  return Array.from(byName.values())
}

// ---------- vision call ----------
type VisionItem = { name: string; price?: string | null; description?: string | null; section?: string | null; is_food?: boolean }

const VISION_PROMPT = `You are extracting menu items from a restaurant webpage screenshot.

Return ONLY a valid JSON object with a single field "items". No prose, no markdown, no \`\`\` fences. If the image is not a menu or contains no menu items, return {"items": []}.

Shape:
{"items": [
  {"name": string, "price": string|null, "description": string|null, "section": string|null, "is_food": boolean},
  ...
]}

Field definitions:
- "name": the dish or item name, exactly as shown (required)
- "price": price text as it appears, e.g. "$18" or "18.50" (null if no price)
- "description": the item description if present (null otherwise)
- "section": the section heading the item appears under, e.g. "Appetizers", "Entrees" (null if none)
- "is_food": true for food items; false for drinks, cocktails, wine, beer, or any beverage

Rules:
- Extract both food AND drinks, and tag each with is_food.
- Do NOT invent items. If unsure, omit.
- Preserve original capitalization and punctuation in names.
- Include every clearly-listed menu item on the page.
- Return valid JSON only. No trailing commas, no comments.`

async function callOllamaVision(imageBase64: string): Promise<VisionItem[]> {
  const body = {
    model: MODEL,
    prompt: VISION_PROMPT,
    images: [imageBase64],
    stream: false,
    format: 'json',
    options: { temperature: 0, num_predict: 8192 },
  }
  const ctl = new AbortController()
  const t = setTimeout(() => ctl.abort(), 180_000)
  try {
    const res = await fetch(`${OLLAMA_URL}/api/generate`, {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify(body),
      signal: ctl.signal,
    })
    clearTimeout(t)
    if (!res.ok) {
      if (DEBUG) console.error(`  ollama HTTP ${res.status}: ${(await res.text()).slice(0, 200)}`)
      return []
    }
    const data = await res.json() as { response?: string }
    const raw = data.response ?? ''
    // Ollama with format:'json' returns a JSON object. Many vision models
    // return { items: [...] } or a bare array stringified. Try both.
    let parsed: any
    try { parsed = JSON.parse(raw) } catch {
      // strip markdown fences and retry
      const stripped = raw.replace(/^```(?:json)?/i, '').replace(/```$/i, '').trim()
      try { parsed = JSON.parse(stripped) } catch { return [] }
    }
    if (Array.isArray(parsed)) return parsed as VisionItem[]
    if (parsed && typeof parsed === 'object') {
      for (const key of ['items', 'menu', 'menu_items', 'data']) {
        if (Array.isArray(parsed[key])) return parsed[key] as VisionItem[]
      }
    }
    return []
  } catch (e) {
    if (DEBUG) console.error(`  ollama err: ${(e as Error).message}`)
    return []
  } finally { clearTimeout(t) }
}

function visionToItems(vItems: VisionItem[]): Item[] {
  const out: Item[] = []
  for (const v of vItems) {
    if (!v || typeof v.name !== 'string') continue
    const name = v.name.trim().replace(/\s+/g, ' ')
    if (name.length < 2 || name.length > 120) continue
    let cents: number | null = null
    let priceRaw = ''
    if (v.price) {
      priceRaw = String(v.price).slice(0, 40)
      const m = priceRaw.match(/(\d{1,4}(?:\.\d{1,2})?)/)
      if (m) {
        const n = Math.round(Number(m[1]) * 100)
        if (Number.isFinite(n) && n >= 100 && n <= 100000) cents = n
      }
    }
    out.push({
      name,
      section: (v.section ?? null) ? String(v.section).slice(0, 80) : null,
      price_cents: cents,
      price_raw: priceRaw,
      description: v.description ? String(v.description).slice(0, 500) : null,
    })
  }
  // dedupe
  const byName = new Map<string, Item>()
  for (const it of out) {
    const k = it.name.toLowerCase()
    const prev = byName.get(k)
    if (!prev || (prev.price_cents == null && it.price_cents != null)) byName.set(k, it)
  }
  return Array.from(byName.values())
}

// ---------- Playwright rendering ----------
async function renderAndScreenshot(
  browser: Browser,
  url: string,
  onText?: (text: string) => void,
): Promise<Buffer | null> {
  const ctx = await browser.newContext({
    viewport: { width: 1400, height: 900 },
    userAgent: 'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 Gastronome/vision',
  })
  const page = await ctx.newPage()
  try {
    await page.goto(url, { waitUntil: 'domcontentloaded', timeout: 30_000 })
    // Let lazy content populate
    await page.waitForTimeout(1500)
    // Scroll to bottom to trigger lazy-load, capped at 60 ticks (~36KB scroll)
    // to avoid infinite-scroll traps.
    await page.evaluate(() => {
      return new Promise<void>(resolve => {
        let y = 0, ticks = 0
        const step = () => {
          window.scrollBy(0, 600)
          y += 600
          ticks++
          if (y < document.body.scrollHeight && ticks < 60) setTimeout(step, 100)
          else resolve()
        }
        step()
      })
    }).catch(() => {})
    await page.waitForTimeout(600)
    if (onText) {
      try {
        const text = await page.evaluate(() => document.body?.innerText ?? '')
        onText(text)
      } catch {}
    }
    const buf = await page.screenshot({ fullPage: true, type: 'jpeg', quality: 80 })
    return buf
  } catch (e) {
    if (DEBUG) console.error(`  render err ${url}: ${(e as Error).message}`)
    return null
  } finally {
    try { await ctx.close() } catch {}
  }
}

// ---------- persistence ----------
async function persist(r: { id: string }, items: Item[], sourceUrl: string, q: MenuQuality, stage: string): Promise<void> {
  if (DRY_RUN) return
  await supabase
    .from('restaurant_menu_items')
    .delete()
    .eq('restaurant_id', r.id)
    .eq('source', SOURCE)
  const rows = items.map(it => ({
    restaurant_id: r.id,
    item_name: it.name.slice(0, 120),
    section: it.section,
    price_cents: it.price_cents,
    price_raw: (it.price_raw || '').slice(0, 40),
    description: it.description?.slice(0, 500) ?? null,
    source: SOURCE,
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
    source: SOURCE,
    source_url: sourceUrl,
    menu_url: sourceUrl,
    status: 'ok',
    items_found: items.length,
    error_message: `${stage} food_ratio=${q.food_ratio.toFixed(2)} drink_ratio=${q.drink_ratio.toFixed(2)} verdict=${q.verdict} model=${MODEL}`,
  })
}

async function logFail(r: { id: string }, sourceUrl: string | null, reason: string): Promise<void> {
  if (DRY_RUN) return
  await supabase.from('restaurant_menu_fetches').insert({
    restaurant_id: r.id,
    source: SOURCE,
    source_url: sourceUrl,
    menu_url: null,
    status: reason.startsWith('rejected') ? 'rejected' : 'no_content',
    items_found: 0,
    error_message: reason,
  })
}

// ---------- per-restaurant ----------
type Report = {
  id: string; name: string
  status: 'ok' | 'rejected' | 'no_candidates' | 'vision_empty' | 'errored'
  accepted_url: string | null
  items: number
  food_ratio: number
  drink_ratio: number
  stage: 'text' | 'vision' | 'none'
  ms: number
}

async function processOne(browser: Browser, r: { id: string; name: string; website: string }): Promise<Report> {
  const t0 = Date.now()
  const rep: Report = {
    id: r.id, name: r.name, status: 'errored', accepted_url: null,
    items: 0, food_ratio: 0, drink_ratio: 0, stage: 'none', ms: 0,
  }
  try {
    // Discover /menu candidates
    const root = await getHtml(r.website)
    if (!root) {
      rep.status = 'errored'
      await logFail(r, r.website, 'fetch_failed')
      rep.ms = Date.now() - t0
      console.log(`[FETCH_FAIL] ${r.name} (${rep.ms}ms)`)
      return rep
    }
    const cands = findMenuCandidates(root.html, root.finalUrl).slice(0, PAGES_PER_SITE)
    // Always include the homepage as a fallback candidate at the end
    if (!cands.find(c => c.url === root.finalUrl)) cands.push({ url: root.finalUrl, score: 0, label: 'homepage', isPdf: false })

    if (DEBUG) console.log(`  [${r.name}] ${cands.length} candidates: ${cands.map(c => c.url.slice(-50)).join(' | ')}`)

    const aggregate: Item[] = []
    let firstOkUrl: string | null = null
    let visionUsed = false

    for (const cand of cands) {
      let capturedText = ''
      const shot = await renderAndScreenshot(browser, cand.url, t => { capturedText = t })
      if (!shot) continue

      // Try text-first
      if (capturedText) {
        const fromText = tryParseTextPage(capturedText)
        if (fromText.length >= 10) {
          if (DEBUG) console.log(`  [${r.name}] text-pass yielded ${fromText.length} from ${cand.url.slice(-40)}`)
          for (const it of fromText) aggregate.push(it)
          if (!firstOkUrl) firstOkUrl = cand.url
          continue
        }
      }

      // Vision
      const b64 = shot.toString('base64')
      const vItems = await callOllamaVision(b64)
      visionUsed = true
      if (!vItems.length) {
        if (DEBUG) console.log(`  [${r.name}] vision yielded 0 from ${cand.url.slice(-40)}`)
        continue
      }
      // Drop beverages at vision level; retain as Item list tagged nothing
      const kept = vItems.filter(v => v && typeof v.name === 'string')
      const asItems = visionToItems(kept)
      if (DEBUG) console.log(`  [${r.name}] vision yielded ${asItems.length} from ${cand.url.slice(-40)}`)
      if (asItems.length) {
        for (const it of asItems) aggregate.push(it)
        if (!firstOkUrl) firstOkUrl = cand.url
      }
    }

    if (!aggregate.length) {
      rep.status = visionUsed ? 'vision_empty' : 'no_candidates'
      await logFail(r, firstOkUrl, rep.status)
      rep.ms = Date.now() - t0
      console.log(`[${rep.status.toUpperCase()}] ${r.name} (${rep.ms}ms)`)
      return rep
    }

    // Dedupe aggregate by name
    const byName = new Map<string, Item>()
    for (const it of aggregate) {
      const k = it.name.toLowerCase()
      const prev = byName.get(k)
      if (!prev || (prev.price_cents == null && it.price_cents != null)) byName.set(k, it)
    }
    const items = Array.from(byName.values())

    const q = scoreMenu(items)
    rep.items = items.length
    rep.food_ratio = q.food_ratio
    rep.drink_ratio = q.drink_ratio
    rep.stage = visionUsed ? 'vision' : 'text'

    if (passesFoodGate(q)) {
      await persist(r, items, firstOkUrl || r.website, q, rep.stage)
      rep.accepted_url = firstOkUrl
      rep.status = 'ok'
    } else {
      rep.status = 'rejected'
      await logFail(r, firstOkUrl, `rejected-quality verdict=${q.verdict} food=${(q.food_ratio * 100).toFixed(0)}% drink=${(q.drink_ratio * 100).toFixed(0)}%`)
    }
  } catch (e) {
    rep.status = 'errored'
    await logFail(r, null, `err:${(e as Error).message?.slice(0, 200)}`)
  }
  rep.ms = Date.now() - t0
  const tag = rep.status === 'ok'
    ? `[OK] ${r.name} — ${rep.items} items food=${(rep.food_ratio * 100).toFixed(0)}% drink=${(rep.drink_ratio * 100).toFixed(0)}% via=${rep.stage} (${rep.ms}ms)`
    : `[${rep.status.toUpperCase()}] ${r.name} — ${rep.items} items (${rep.ms}ms)`
  console.log(tag)
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

  const { data: menuItems } = await supabase.from('restaurant_menu_items').select('restaurant_id').limit(100000)
  const have = new Set<string>((menuItems ?? []).map((m: any) => m.restaurant_id))
  return all.filter(r => !have.has(r.id)).slice(0, LIMIT)
}

// ---------- ollama preflight ----------
async function preflightOllama(): Promise<void> {
  try {
    const res = await fetch(`${OLLAMA_URL}/api/tags`)
    if (!res.ok) throw new Error(`HTTP ${res.status}`)
    const j = await res.json() as { models?: Array<{ name: string }> }
    const names = (j.models ?? []).map(m => m.name)
    const hasModel = names.some(n => n === MODEL || n.startsWith(MODEL.split(':')[0] + ':'))
    if (!hasModel) {
      console.error(`Ollama is running but model '${MODEL}' is not installed.`)
      console.error(`Available: ${names.join(', ') || '(none)'}`)
      console.error(`Run:  ollama pull ${MODEL}`)
      process.exit(1)
    }
    console.log(`Ollama OK at ${OLLAMA_URL}; models: ${names.join(', ')}`)
  } catch (e) {
    console.error(`Cannot reach Ollama at ${OLLAMA_URL}: ${(e as Error).message}`)
    console.error(`Install: https://ollama.com/download   then:  ollama serve`)
    process.exit(1)
  }
}

// ---------- main ----------
async function main() {
  await preflightOllama()
  const targets = await pickTargets()
  console.log(`vision scraper — mode=${MODE} targets=${targets.length} conc=${CONCURRENCY} model=${MODEL} pagesPerSite=${PAGES_PER_SITE} dryRun=${DRY_RUN}`)
  if (!targets.length) { console.log('Nothing to do.'); return }

  const browser = await chromium.launch({ headless: true })
  const reports: Report[] = []

  for (let i = 0; i < targets.length; i += CONCURRENCY) {
    const batch = targets.slice(i, i + CONCURRENCY)
    const res = await Promise.all(batch.map(r => processOne(browser, r).catch(e => {
      console.error(`  ERROR ${r.name}:`, e?.message || e)
      return {
        id: r.id, name: r.name, status: 'errored' as const, accepted_url: null,
        items: 0, food_ratio: 0, drink_ratio: 0, stage: 'none' as const, ms: 0,
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

  await browser.close()

  const ok = reports.filter(r => r.status === 'ok')
  const itemsTotal = ok.reduce((s, r) => s + r.items, 0)
  console.log(`\n=== vision summary ===`)
  console.log(`accepted:        ${ok.length}  (${itemsTotal} items saved)`)
  console.log(`  via text-pass: ${ok.filter(r => r.stage === 'text').length}`)
  console.log(`  via vision:    ${ok.filter(r => r.stage === 'vision').length}`)
  console.log(`rejected:        ${reports.filter(r => r.status === 'rejected').length}`)
  console.log(`vision_empty:    ${reports.filter(r => r.status === 'vision_empty').length}`)
  console.log(`no_candidates:   ${reports.filter(r => r.status === 'no_candidates').length}`)
  console.log(`errored:         ${reports.filter(r => r.status === 'errored').length}`)

  const reportPath = path.join(process.cwd(), 'tmp', `menu-vision-report-${Date.now()}.json`)
  fs.mkdirSync(path.dirname(reportPath), { recursive: true })
  fs.writeFileSync(reportPath, JSON.stringify(reports, null, 2))
  console.log(`Wrote ${reportPath}`)
}

main().catch(e => { console.error(e); process.exit(1) })
