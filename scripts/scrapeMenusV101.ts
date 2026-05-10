/**
 * Menu scraper v101 — sharded, broader-anchor, everything v100 has.
 *
 * Built from everything learned across v1 → v100:
 *   - v1 (fetch)          got 342/1489 but 44% were drink-only
 *   - v2 (fetch + gate)   adds food-quality gate; 0% on JS-rendered sites
 *   - v2.3 (browser)      Playwright; ~13-20% yield, but prone to stalls
 *   - v100                 atomic heartbeat writes, watchdog-proof, JSON-LD Menu wait
 *
 * What v101 adds on top of v100:
 *   1. SHARDING. --shardIndex=0..K-1 --shardCount=K splits INPUT_IDS by
 *      modulo so you can run K processes in parallel, each with its own
 *      Chromium instance. Empirically 1 Chromium ≈ 5 restaurants/min; the
 *      sandbox can hold ~3-5 processes before memory pressure bites, so
 *      shardCount=5 cuts a 900-restaurant sweep from ~3h to ~40m.
 *   2. BROADER findMenuUrls. v100's regex /^\/menus?\/[a-z0-9-]+/ missed
 *      trailing-slash anchors like <a href="/menus/">. v101 also follows
 *      /eat /dine /our-menu /menu-pdf and .pdf files whose path contains
 *      "menu", and matches by link TEXT ("See our menu", "Dinner menu")
 *      not just href.
 *
 * Everything else — JSON-LD extractor, food-quality gate, heartbeat
 * protocol, atomic writes, per-op timeouts, resume, Chromium recycle — is
 * unchanged from v100.
 *
 * ========================================================================
 * PIPELINE (per restaurant)
 * ========================================================================
 *   1. Skip if already has website / website-browser / website-v100 /
 *      website-v101 items.
 *   2. STAGE 1 — fetch path: raw HTML + JSON-LD parse. ~2s per site. If it
 *      yields a food-quality pass, persist and stop.
 *   3. STAGE 2 — browser path: Playwright renders JS, waits for JSON-LD
 *      Menu, follows /menus/* anchors via the broadened finder. ~10-25s
 *      per site.
 *   4. Persist items as source='website-v101', tag stage in price_raw.
 *   5. Log result to restaurant_menu_fetches.
 *
 * ========================================================================
 * STALL DEFENSES
 * ========================================================================
 *   - Per-operation timeouts wrap *every* awaited call.
 *   - Per-restaurant hard ceiling (120s) races the whole pipeline.
 *   - Heartbeat file `tmp/v101-heartbeat{-shard-N-of-K}.json` is rewritten
 *     atomically every 2s (write to .tmp → rename). Watchdog polls it.
 *   - Chromium is recycled every `--browserRecycle` restaurants (default 20).
 *   - Graceful SIGTERM/SIGINT: flushes progress, closes browser, exits 130.
 *
 * ========================================================================
 * IDEMPOTENT RESUME
 * ========================================================================
 *   - tmp/v101-progress{-shard-N-of-K}.json holds per-ID status. IDs with
 *     status ok/rejected/no_menus are skipped. errored is retried.
 *   - IDs chunked <=40 per Supabase .in() call (16KB header limit).
 *
 * ========================================================================
 * USAGE
 * ========================================================================
 *   # Single process:
 *   npx tsx scripts/scrapeMenusV101.ts --idsFile=tmp/no-menu-priority-ids.txt
 *
 *   # 5 parallel shards (each its own watchdog):
 *   bash scripts/runMenusV101Sharded.sh --shardCount=5 \
 *        --idsFile=tmp/no-menu-priority-ids.txt
 *
 * Flags:
 *   --ids=csv             comma-separated restaurant ids
 *   --idsFile=path        file with one id per line OR comma-separated
 *   --limit=N             max restaurants from input list (default: all)
 *   --skipExisting=true   skip ids already persisted (default true)
 *   --stages=fetch|browser|both  default 'both'
 *   --shardIndex=0        0-based shard index (default 0)
 *   --shardCount=1        total shards (default 1 = no sharding)
 *   --perRestaurantMs=120000
 *   --navTimeoutMs=22000
 *   --fetchTimeoutMs=15000
 *   --dbTimeoutMs=30000
 *   --browserRecycle=20   recreate Chromium every N restaurants
 *   --heartbeatMs=2000
 *   --heartbeatPath=tmp/v101-heartbeat<shardSuffix>.json
 *   --progressPath=tmp/v101-progress<shardSuffix>.json
 *   --reportPath=tmp/v101-report<shardSuffix>-<ts>.json
 *   --maxMenusPerSite=8
 *   --dryRun=true         skip DB writes
 */

import { chromium, type Browser, type BrowserContext, type Page } from 'playwright'
import { createClient } from '@supabase/supabase-js'
import * as fs from 'fs'
import * as path from 'path'

// =====================================================================
// env bootstrap
// =====================================================================

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

// =====================================================================
// args
// =====================================================================

const rawArgs = Object.fromEntries(
  process.argv.slice(2).map(a => {
    const [k, v] = a.replace(/^--/, '').split('=')
    return [k, v ?? 'true']
  }),
) as Record<string, string>

function argStr(k: string, d = ''): string { return rawArgs[k] ?? d }
function argNum(k: string, d: number): number { return Number(rawArgs[k] ?? String(d)) }
function argBool(k: string, d: boolean): boolean { return (rawArgs[k] ?? (d ? 'true' : 'false')) === 'true' }

// Shard identity is computed first so default file paths can include the
// shard suffix (without it, K parallel shards would clobber each other's
// heartbeat / progress files). shardCount=1 produces no suffix at all, so
// a single-process run looks exactly like v100.
const SHARD_INDEX = argNum('shardIndex', 0)
const SHARD_COUNT = Math.max(1, argNum('shardCount', 1))
const SHARD_SUFFIX = SHARD_COUNT > 1 ? `-shard-${SHARD_INDEX}-of-${SHARD_COUNT}` : ''

const CFG = {
  stages: (argStr('stages', 'both') as 'fetch' | 'browser' | 'both'),
  shardIndex: SHARD_INDEX,
  shardCount: SHARD_COUNT,
  shardSuffix: SHARD_SUFFIX,
  perRestaurantMs: argNum('perRestaurantMs', 120_000),
  navTimeoutMs: argNum('navTimeoutMs', 22_000),
  fetchTimeoutMs: argNum('fetchTimeoutMs', 15_000),
  dbTimeoutMs: argNum('dbTimeoutMs', 30_000),
  browserRecycle: argNum('browserRecycle', 20),
  heartbeatMs: argNum('heartbeatMs', 2000),
  heartbeatPath: argStr('heartbeatPath', `tmp/v101-heartbeat${SHARD_SUFFIX}.json`),
  progressPath: argStr('progressPath', `tmp/v101-progress${SHARD_SUFFIX}.json`),
  reportPath: argStr('reportPath', `tmp/v101-report${SHARD_SUFFIX}-${Date.now()}.json`),
  maxMenusPerSite: argNum('maxMenusPerSite', 8),
  limit: argNum('limit', Number.POSITIVE_INFINITY),
  skipExisting: argBool('skipExisting', true),
  dryRun: argBool('dryRun', false),
}

// Parse IDs from --ids or --idsFile
function loadIds(): string[] {
  let ids: string[] = []
  if (rawArgs.ids) ids = rawArgs.ids.split(',').map(s => s.trim()).filter(Boolean)
  if (rawArgs.idsFile && fs.existsSync(rawArgs.idsFile)) {
    const txt = fs.readFileSync(rawArgs.idsFile, 'utf8')
    for (const chunk of txt.split(/[\s,\n]+/)) {
      const c = chunk.trim()
      if (c && !ids.includes(c)) ids.push(c)
    }
  }
  return ids
}

const INPUT_IDS_RAW = loadIds()
if (!INPUT_IDS_RAW.length) {
  console.error('v101: either --ids=csv or --idsFile=path required')
  process.exit(1)
}

// Apply sharding BEFORE any DB work so each shard has its own stable slice.
// Using modulo (not contiguous chunks) keeps each shard's restaurant mix
// roughly equivalent: no single shard gets stuck on a run of unusually slow
// or fast restaurants. Deterministic per input order.
const INPUT_IDS = SHARD_COUNT > 1
  ? INPUT_IDS_RAW.filter((_, i) => i % SHARD_COUNT === SHARD_INDEX)
  : INPUT_IDS_RAW
if (SHARD_COUNT > 1) {
  console.log(`[v101] shard ${SHARD_INDEX}/${SHARD_COUNT} — ${INPUT_IDS.length} of ${INPUT_IDS_RAW.length} ids`)
}

// =====================================================================
// food / drink classifier (kept in sync with v2/v2.3)
// =====================================================================

const FOOD_TOKENS = /\b(pizza|pasta|burger|steak|chicken|fish|salad|soup|taco|sushi|sandwich|salmon|tuna|shrimp|lobster|crab|pork|lamb|beef|duck|ribs|wings|egg|cheese|pie|cake|bread|fries|rice|noodle|ramen|dumpling|risotto|gnocchi|ravioli|lasagna|paella|tartare|carpaccio|oyster|mussel|scallop|octopus|squid|brisket|chop|cutlet|roast|confit|fried|grilled|smoked|braised|roasted|poached|bun|toast|wrap|roll|sausage|meatball|tart|cookie|croissant|ice cream|dessert|chocolate|vanilla|curry|kimchi|bibimbap|pho|banh mi|enchilada|quesadilla|burrito|guacamole|hummus|falafel|gyros|moussaka|tiramisu|tempura|nigiri|sashimi|maki|pot sticker|wonton|poke|poké|avocado|tomato|eggplant|mushroom|broccoli|asparagus|artichoke|beet|kale|spinach|lentil|bean|potato|yam|burrata|mozzarella|parmesan|souffle|soufflé|quiche|crepe|pancake|waffle|omelette|benedict|tartine|bisque|bouillabaisse|cassoulet|ratatouille|bourguignon|chowder|gumbo|jambalaya|pozole|ceviche|aguachile|tostada|tortilla|empanada|arepa|moqueca|churrasco|yakitori|okonomiyaki|takoyaki|katsu|udon|soba|unagi|toro|donburi|teppanyaki|bulgogi|galbi|tteokbokki|banchan|pajeon|tom yum|pad thai|pad see ew|pad krapow|larb|massaman|panang|khao soi|nasi|satay|mie goreng|bolognese|carbonara|amatriciana|marinara|arancini|caprese|prosciutto|salumi|mortadella|speck|pancetta|guanciale|cacio|porchetta|cotoletta|vitello|ossobuco|ribollita|pappardelle|tagliatelle|orecchiette|bucatini|linguine|fettuccine|farfalle|penne|tortellini|agnolotti|cannelloni|manicotti|calzone|stromboli|pesto|branzino|orata|spigola|crudo|vongole|antipasti|insalata|primi|secondi|dolci|contorni|focaccia|schiacciata|panino|croque|nicoise|niçoise|daube|tarte|madeleine|profiterole|financier|macaron|canard|magret|boeuf|entrecote|filet mignon|chateaubriand|coquilles|moules|frites|raclette|fondue|choucroute|tajine|shawarma|kebab|kabob|souvla|spanakopita|dolma|fattoush|tabouleh|labneh|zaatar|manti|doner|kofta|biryani|tikka|masala|tandoori|naan|samosa|pakora|dosa|idli|vindaloo|korma|dal|raita|wagyu|kobe|uni|ikura|tamago|hamachi|kanpachi|hirame|temaki|chirashi|shabu|bun cha|com tam|ca kho|xiao long|jian bing|hot pot|dim sum|siu mai|har gow|char siu|peking duck|mapo|kung pao|lo mein|chow mein|chow fun|mongolian|sichuan|szechuan|cantonese|dan dan|wonton|xiaolongbao|baozi|clam|tot|hash|bacon|ham|turkey|goose|foie|liver|tongue|heart|belly|loin|rib|shank|short rib|skirt|flank|hanger|filet|ribeye|strip|porterhouse|tomahawk|t-bone|sirloin|tenderloin|prime rib|cheeseburger|hamburger|slider|hot dog|corn dog|reuben|philly cheesesteak|pastrami|corned beef|french dip|po boy|muffuletta|banh|pork belly|kalbi|mezze|flatbread|mushroom|vegan|vegetarian)\b/i
const DRINK_TOKENS = /\b(whiskey|whisky|vodka|gin|tequila|mezcal|bourbon|rye|rum|scotch|cognac|armagnac|amaro|amari|vermouth|wine|champagne|prosecco|cava|sauvignon|chardonnay|pinot|cabernet|merlot|riesling|syrah|shiraz|malbec|zinfandel|grenache|nebbiolo|sangiovese|tempranillo|brunello|barolo|barbaresco|chianti|negroni|martini|manhattan|margarita|daiquiri|mojito|old fashioned|paloma|sazerac|spritz|beer|lager|ale|ipa|stout|pilsner|brut|grappa|sambuca|chartreuse|aperitif|digestif|sake|soju|cider|kombucha|highball|cocktail|mocktail|non-alcoholic|non alcoholic|zero proof|by the glass|by the bottle|liqueur|fernet|campari|aperol|cynar|limoncello|vermut|glera|chenin blanc)\b/i

type Item = { name: string; section: string | null; price_cents: number | null; price_raw: string; description: string | null }
type MenuQuality = { total: number; food_like: number; drink_like: number; food_ratio: number; drink_ratio: number; verdict: 'food_menu' | 'drink_menu' | 'mixed' | 'unclear' | 'empty' }

function classifyItem(name: string, desc: string | null): 'food' | 'drink' | 'other' {
  const n = (name + ' ' + (desc || '')).toLowerCase()
  const foodHit = FOOD_TOKENS.test(n)
  const drinkHit = DRINK_TOKENS.test(n)
  if (foodHit && !drinkHit) return 'food'
  if (!foodHit && drinkHit) return 'drink'
  if (foodHit && drinkHit) return 'food'
  return 'other'
}

function scoreMenu(items: Item[]): MenuQuality {
  const total = items.length
  let food_like = 0, drink_like = 0
  for (const it of items) {
    const c = classifyItem(it.name, it.description)
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

const NOISE_NAME_RE = /^(slide\s+\d+(\s+of)?|slide|next|previous|prev|back|home|menu|close|search|order(\s+now)?|book|reserve|contact|about|login|signup|sign\s?in|sign\s?up|view\s+all|shop(\s+now)?|learn\s+more|read\s+more|see\s+menu|our\s+menu|reserve\s+now|book\s+now|view\s+menu|click\s+here|more|details|gallery|photos|images|loading|error|submit|send|subscribe|join|cart|checkout|bag|item|product|price|total|subtotal|tax|tip|gratuity|cash|credit|card|new|hot|best|popular|featured|recommended|special|today|tomorrow|yesterday|lunch|dinner|brunch|breakfast|dessert|drinks|cocktails|beer|wine|spirits|food|menu item|menu items|toggle|open|close|expand|collapse|show|hide|first|last|start|end|previous page|next page|page\s*\d+)$/i
function isNoiseName(name: string): boolean {
  const n = (name || '').trim()
  if (!n) return true
  if (NOISE_NAME_RE.test(n)) return true
  if (n.length < 3) return true
  if (/^[\d\s\.\-\$]+$/.test(n)) return true
  if (/^[A-Z]{1,4}$/.test(n)) return true
  return false
}

// =====================================================================
// timeouts: every awaited call passes through withTimeout
// =====================================================================

function withTimeout<T>(p: Promise<T>, ms: number, label: string): Promise<T> {
  return new Promise<T>((resolve, reject) => {
    const t = setTimeout(() => reject(new Error(`timeout_${label}_${ms}ms`)), ms)
    p.then(v => { clearTimeout(t); resolve(v) }, e => { clearTimeout(t); reject(e) })
  })
}

// =====================================================================
// heartbeat + progress + signals
// =====================================================================

type HeartbeatState = {
  pid: number
  started_at: string
  last_beat: string
  phase: 'init' | 'fetch' | 'browser' | 'persist' | 'idle' | 'finalize'
  idx: number
  total: number
  current_id: string | null
  current_name: string | null
  ok: number
  rejected: number
  no_menus: number
  errored: number
  skipped: number
}

type Report = {
  id: string; name: string; website: string | null
  status: 'ok' | 'rejected' | 'no_menus' | 'errored' | 'skipped'
  stage: 'fetch' | 'browser' | null
  menus_visited: number; items: number
  verdict: MenuQuality['verdict'] | null
  food_ratio: number; drink_ratio: number
  ms: number
  error: string | null
}

const hb: HeartbeatState = {
  pid: process.pid,
  started_at: new Date().toISOString(),
  last_beat: new Date().toISOString(),
  phase: 'init',
  idx: 0, total: 0,
  current_id: null, current_name: null,
  ok: 0, rejected: 0, no_menus: 0, errored: 0, skipped: 0,
}

const progress: Record<string, Report> = (() => {
  try {
    if (fs.existsSync(CFG.progressPath)) return JSON.parse(fs.readFileSync(CFG.progressPath, 'utf8'))
  } catch {}
  return {}
})()

// Atomic write: write to .tmp then rename. rename(2) is atomic on POSIX, so
// a concurrent reader never sees a truncated/partial file. Plain writeFileSync
// opens with O_TRUNC and has a brief 0-byte window that can trick the watchdog
// into thinking the heartbeat is missing (heartbeat_age_seconds → 9999) and
// trigger a false-positive kill. Observed once on 2026-04-23 run.
function atomicWriteSync(target: string, data: string): void {
  const dir = path.dirname(target)
  fs.mkdirSync(dir, { recursive: true })
  const tmp = `${target}.tmp-${process.pid}`
  fs.writeFileSync(tmp, data)
  fs.renameSync(tmp, target)
}

function flushHeartbeat(): void {
  hb.last_beat = new Date().toISOString()
  try {
    atomicWriteSync(CFG.heartbeatPath, JSON.stringify(hb, null, 2))
  } catch {}
}

function flushProgress(): void {
  try {
    atomicWriteSync(CFG.progressPath, JSON.stringify(progress, null, 2))
  } catch {}
}

const hbTimer = setInterval(flushHeartbeat, CFG.heartbeatMs)

let exiting = false
function gracefulExit(code: number, reason: string) {
  if (exiting) return
  exiting = true
  console.log(`\n[v101] graceful exit: ${reason}`)
  clearInterval(hbTimer)
  hb.phase = 'finalize'
  flushHeartbeat()
  flushProgress()
  try {
    fs.mkdirSync(path.dirname(CFG.reportPath), { recursive: true })
    fs.writeFileSync(CFG.reportPath, JSON.stringify({ hb, reports: Object.values(progress) }, null, 2))
  } catch {}
  setTimeout(() => process.exit(code), 200).unref()
}

process.on('SIGTERM', () => gracefulExit(130, 'SIGTERM'))
process.on('SIGINT', () => gracefulExit(130, 'SIGINT'))
process.on('uncaughtException', e => { console.error('uncaught:', e); gracefulExit(1, `uncaught:${e.message}`) })
process.on('unhandledRejection', e => { console.error('unhandled:', e); gracefulExit(1, `unhandled:${String(e)}`) })

// =====================================================================
// polite fetch (stage 1)
// =====================================================================

const HOST_MIN_GAP_MS = 1500
const lastHitByHost = new Map<string, number>()
const sleep = (ms: number) => new Promise(r => setTimeout(r, ms))

async function politeWait(host: string): Promise<void> {
  const last = lastHitByHost.get(host) ?? 0
  const wait = Math.max(0, HOST_MIN_GAP_MS - (Date.now() - last))
  if (wait > 0) await sleep(wait + Math.random() * 250)
  lastHitByHost.set(host, Date.now())
}

const UA_FETCH = 'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 Gastronome-Scraper/100.0-Fetch (+dakai.research@gmail.com)'
const UA_BROWSER = 'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 Gastronome-Scraper/100.0-Browser (+dakai.research@gmail.com)'

async function fetchHtml(url: string): Promise<string | null> {
  let host = ''
  try { host = new URL(url).host } catch { return null }
  await politeWait(host)
  try {
    const ctl = new AbortController()
    const t = setTimeout(() => ctl.abort(), CFG.fetchTimeoutMs)
    const res = await fetch(url, {
      signal: ctl.signal,
      redirect: 'follow',
      headers: { 'User-Agent': UA_FETCH, 'Accept': 'text/html,application/xhtml+xml,application/json,*/*;q=0.9' },
    })
    clearTimeout(t)
    if (!res.ok) return null
    return await res.text()
  } catch { return null }
}

type RawMenuItem = { menu: string; section: string; name: string; price: number | null; description: string | null }

/** Parse schema.org/Menu JSON-LD out of raw HTML string. */
function parseJsonLdMenus(html: string): RawMenuItem[] {
  const out: RawMenuItem[] = []
  const re = /<script\s+type=["']application\/ld\+json["'][^>]*>([\s\S]*?)<\/script>/gi
  const blobs: unknown[] = []
  let m: RegExpExecArray | null
  while ((m = re.exec(html))) {
    try { blobs.push(JSON.parse(m[1])) } catch {}
  }
  const arr = (v: unknown): unknown[] => Array.isArray(v) ? v : (v ? [v] : [])
  const pushItems = (menuName: string, secName: string, items: unknown[]) => {
    for (const it of items) {
      if (!it || typeof it !== 'object') continue
      const o = it as Record<string, unknown>
      if (!o.name) continue
      const offers = o.offers as Record<string, unknown> | undefined
      const priceRaw = (offers && offers.price != null ? offers.price : o.price) as unknown
      const p = priceRaw != null ? Number(priceRaw) : null
      out.push({
        menu: menuName, section: secName,
        name: String(o.name).trim(),
        price: Number.isFinite(p) ? p : null,
        description: o.description ? String(o.description).trim() : null,
      })
    }
  }
  const stack: unknown[] = [...blobs]
  while (stack.length) {
    const node = stack.pop()
    if (!node) continue
    if (Array.isArray(node)) { for (const n of node) stack.push(n); continue }
    if (typeof node !== 'object') continue
    const o = node as Record<string, unknown>
    if (o['@graph']) stack.push(o['@graph'])
    if (o['@type'] === 'Menu') {
      const menuName = (o.name as string) || ''
      for (const sec of arr(o.hasMenuSection)) {
        if (!sec || typeof sec !== 'object') continue
        const s = sec as Record<string, unknown>
        const secName = (s.name as string) || ''
        pushItems(menuName, secName, arr(s.hasMenuItem))
        for (const sub of arr(s.hasMenuSection)) {
          if (!sub || typeof sub !== 'object') continue
          const su = sub as Record<string, unknown>
          const subName = (secName + ' — ' + ((su.name as string) || '')).trim()
          pushItems(menuName, subName, arr(su.hasMenuItem))
        }
      }
    }
  }
  return out
}

// =====================================================================
// browser (stage 2)
// =====================================================================

let browser: Browser | null = null
let browserUsesSince = 0

async function ensureBrowser(): Promise<Browser> {
  if (browser && browserUsesSince < CFG.browserRecycle) return browser
  if (browser) {
    hb.phase = 'init'; flushHeartbeat()
    try { await withTimeout(browser.close(), 15_000, 'browser_close') } catch {}
    browser = null
  }
  browser = await withTimeout(
    chromium.launch({ headless: true, args: ['--no-sandbox', '--disable-dev-shm-usage', '--disable-gpu'] }),
    30_000, 'browser_launch',
  )
  browserUsesSince = 0
  return browser
}

async function extractJsonLdMenusInPage(page: Page): Promise<RawMenuItem[]> {
  const js = `(() => {
    const out = [];
    const stack = [];
    for (const s of document.querySelectorAll('script[type="application/ld+json"]')) {
      try { stack.push(JSON.parse(s.textContent || '')); } catch (e) {}
    }
    var arr = function(v) { return Array.isArray(v) ? v : (v ? [v] : []); };
    var pushItems = function(menuName, secName, items) {
      for (var i = 0; i < items.length; i++) {
        var it = items[i];
        if (it && it.name) {
          var priceRaw = (it.offers && it.offers.price) || it.price || null;
          var p = priceRaw != null ? Number(priceRaw) : null;
          out.push({
            menu: menuName, section: secName,
            name: String(it.name).trim(),
            price: Number.isFinite(p) ? p : null,
            description: it.description ? String(it.description).trim() : null,
          });
        }
      }
    };
    while (stack.length) {
      const node = stack.pop();
      if (!node) continue;
      if (Array.isArray(node)) { for (const n of node) stack.push(n); continue; }
      if (typeof node !== 'object') continue;
      if (node['@graph']) stack.push(node['@graph']);
      if (node['@type'] === 'Menu') {
        const menuName = node.name || '';
        const sections = arr(node.hasMenuSection);
        for (const sec of sections) {
          if (!sec || typeof sec !== 'object') continue;
          const secName = sec.name || '';
          pushItems(menuName, secName, arr(sec.hasMenuItem));
          const subs = arr(sec.hasMenuSection);
          for (const sub of subs) {
            if (!sub || typeof sub !== 'object') continue;
            const subName = (secName + ' — ' + (sub.name || '')).trim();
            pushItems(menuName, subName, arr(sub.hasMenuItem));
          }
        }
      }
    }
    return out;
  })()`
  return await withTimeout(page.evaluate(js) as Promise<RawMenuItem[]>, 8_000, 'extract_jsonld')
}

async function findMenuUrls(page: Page): Promise<string[]> {
  // v101 broadening vs v100:
  //   - Accepts trailing-slash paths: /menus/ (v100 required content after).
  //   - Adds /eat /dine /our-menu /menu-pdf and nested slugs.
  //   - Accepts PDF files whose path contains "menu" (many restaurants just
  //     post a Squarespace-hosted menu.pdf and nothing else).
  //   - Also matches by LINK TEXT: "See our menu", "Dinner menu", etc.,
  //     regardless of href shape. Many Wix / Wordpress templates use anchors
  //     like <a href="#section" onclick="scrollTo(...)">Menu</a> where the
  //     href tells us nothing but the text is dispositive.
  const js = `(() => {
    const base = new URL(window.location.href);
    const out = new Set();
    const PATH_OK = /^\\/(menus?|food|dinner|lunch|brunch|breakfast|eat|dine|dining|our-menu|our_menu|dine-in|menu-pdf)(\\/|\\.html?|$)/i;
    const PDF_MENU = /\\/[^\\/?#]*menu[^\\/?#]*\\.pdf$/i;
    const TEXT_HINTS = /\\b(menu|food|dinner|lunch|brunch|breakfast|dining|dine[- ]in|our\\s+menu|see\\s+menu|full\\s+menu|view\\s+menu|food\\s+menu)\\b/i;
    // Suppress noise that contains the word "menu" but isn't a menu link:
    // navigation toggles, newsletter CTAs, etc.
    const TEXT_DENY = /(main\\s+menu|toggle|close\\s+menu|open\\s+menu|mobile\\s+menu|subscribe|newsletter|sign\\s?up|sign\\s?in|login|cart|checkout|search|account|profile|contact|instagram|facebook|twitter|social|gallery)/i;
    for (const a of document.querySelectorAll('a[href]')) {
      const href = a.getAttribute('href') || '';
      if (!href || href.startsWith('#') || href.startsWith('javascript:') || href.startsWith('mailto:') || href.startsWith('tel:')) continue;
      try {
        const abs = new URL(href, window.location.href);
        if (abs.host !== base.host) continue;
        const lp = abs.pathname.toLowerCase();
        const pathHit = PATH_OK.test(lp) || PDF_MENU.test(lp);
        const text = (a.textContent || '').replace(/\\s+/g, ' ').trim();
        const shortText = text.length > 0 && text.length < 40;
        const textHit = shortText && TEXT_HINTS.test(text) && !TEXT_DENY.test(text);
        if (pathHit || textHit) {
          out.add(abs.toString());
        }
      } catch (e) {}
    }
    return Array.from(out);
  })()`
  return await withTimeout(page.evaluate(js) as Promise<string[]>, 5_000, 'find_menu_urls')
}

async function extractTextMenuItemsInPage(page: Page): Promise<RawMenuItem[]> {
  const js = `(() => {
    const out = [];
    const body = document.body ? document.body.innerText : '';
    const lines = body.split('\\n').map(function(l){return l.trim();}).filter(Boolean);
    const seenNames = new Set();
    const oneLine = /^([A-Z][A-Za-z0-9'&,()\\-\\/\\.\\s]{2,79}?)[\\s\\.\\u00a0]+\\$?\\s?(\\d{1,3}(?:\\.\\d{2})?)\\s*$/;
    const priceOnly = /^\\$?\\s?(\\d{1,3}(?:\\.\\d{2})?)\\s*$/;
    for (let i = 0; i < lines.length; i++) {
      const line = lines[i];
      let m = line.match(oneLine);
      if (m) {
        const rawName = m[1].replace(/\\.{2,}/g, ' ').replace(/\\s+/g, ' ').trim();
        const price = parseFloat(m[2]);
        if (rawName.length >= 3 && rawName.length <= 80 && price >= 1 && price <= 500) {
          const key = rawName.toLowerCase();
          if (!seenNames.has(key)) {
            seenNames.add(key);
            out.push({ menu: 'text', section: '', name: rawName, price: price, description: null });
          }
        }
        continue;
      }
      if (i > 0) {
        const pm = line.match(priceOnly);
        if (pm) {
          const prev = lines[i-1];
          if (prev && prev.length >= 3 && prev.length <= 80 && /^[A-Z]/.test(prev) && !/^\\$?\\s?\\d/.test(prev)) {
            const price = parseFloat(pm[1]);
            if (price >= 1 && price <= 500) {
              const key = prev.toLowerCase();
              if (!seenNames.has(key)) {
                seenNames.add(key);
                out.push({ menu: 'text', section: '', name: prev, price: price, description: null });
              }
            }
          }
        }
      }
    }
    return out;
  })()`
  return await withTimeout(page.evaluate(js) as Promise<RawMenuItem[]>, 6_000, 'extract_text')
}

async function scrapeBrowserPage(page: Page, url: string): Promise<RawMenuItem[]> {
  try {
    await withTimeout(page.goto(url, { timeout: CFG.navTimeoutMs, waitUntil: 'domcontentloaded' }), CFG.navTimeoutMs + 2000, `goto_${url.slice(0, 40)}`)
  } catch { return [] }
  // Wait up to 8s for JSON-LD Menu (popmenu + schema.org sites hydrate post-load)
  try {
    const waitJs = `() => {
      const stack = [];
      for (const s of document.querySelectorAll('script[type="application/ld+json"]')) {
        try { stack.push(JSON.parse(s.textContent || '')); } catch (e) {}
      }
      while (stack.length) {
        const n = stack.pop();
        if (!n) continue;
        if (Array.isArray(n)) { for (const x of n) stack.push(x); continue; }
        if (typeof n !== 'object') continue;
        if (n['@type'] === 'Menu') return true;
        if (n['@graph']) stack.push(n['@graph']);
      }
      return false;
    }`
    await withTimeout(page.waitForFunction(waitJs, { timeout: 8_000 }), 9_000, 'waitJsonLd')
  } catch {}
  // Extra hydration window — many providers finish rendering items 1-2.5s after
  // JSON-LD first appears
  await page.waitForTimeout(2500).catch(() => {})
  try {
    const lds = await extractJsonLdMenusInPage(page)
    if (lds.length > 0) return lds
  } catch {}
  // Fallback: parse visible page text for price-anchored dish lines. Noisy
  // but saved by the food-quality gate downstream.
  try { return await extractTextMenuItemsInPage(page) } catch { return [] }
}

// =====================================================================
// persistence — all DB calls timeout-wrapped
// =====================================================================

async function fetchTargets(ids: string[]): Promise<Array<{ id: string; name: string; website: string | null }>> {
  const out: Array<{ id: string; name: string; website: string | null }> = []
  for (let i = 0; i < ids.length; i += 40) {
    const slice = ids.slice(i, i + 40)
    const r = await withTimeout(
      supabase.from('restaurants').select('id, name, website').in('id', slice),
      CFG.dbTimeoutMs, `select_restaurants_${i}`,
    )
    if (r.error) throw new Error(`select restaurants: ${r.error.message}`)
    for (const row of r.data || []) out.push(row as any)
  }
  return out
}

async function fetchExistingIds(ids: string[]): Promise<Set<string>> {
  const out = new Set<string>()
  if (!CFG.skipExisting) return out
  for (let i = 0; i < ids.length; i += 40) {
    const slice = ids.slice(i, i + 40)
    const r = await withTimeout(
      supabase.from('restaurant_menu_items')
        .select('restaurant_id')
        .in('restaurant_id', slice)
        .in('source', ['website', 'website-browser', 'website-v100', 'website-v101', 'website-vision']),
      CFG.dbTimeoutMs, `select_existing_${i}`,
    )
    if (r.error) throw new Error(`select existing: ${r.error.message}`)
    for (const row of (r.data || []) as Array<{ restaurant_id: string }>) out.add(row.restaurant_id)
  }
  return out
}

async function persistItems(id: string, items: Item[], sourceUrl: string, stage: 'fetch' | 'browser', q: MenuQuality): Promise<void> {
  if (CFG.dryRun) return
  await withTimeout(
    supabase.from('restaurant_menu_items').delete().eq('restaurant_id', id).eq('source', 'website-v101'),
    CFG.dbTimeoutMs, 'delete_prior_v101',
  )
  const rows = items.map(it => ({
    restaurant_id: id,
    item_name: it.name.slice(0, 120),
    section: it.section?.slice(0, 120) ?? null,
    price_cents: it.price_cents,
    price_raw: (it.price_raw || '').slice(0, 40),
    description: it.description?.slice(0, 500) ?? null,
    source: 'website-v101',
    source_url: sourceUrl,
  }))
  for (let i = 0; i < rows.length; i += 50) {
    const r = await withTimeout(
      supabase.from('restaurant_menu_items')
        .upsert(rows.slice(i, i + 50), { onConflict: 'restaurant_id,item_name,source', ignoreDuplicates: true }),
      CFG.dbTimeoutMs, `upsert_items_${i}`,
    )
    if (r.error) console.error('upsert err', r.error.message)
  }
  await withTimeout(
    supabase.from('restaurant_menu_fetches').insert({
      restaurant_id: id,
      source: 'website-v101',
      source_url: sourceUrl,
      menu_url: sourceUrl,
      status: 'ok',
      items_found: items.length,
      error_message: `v101 ${stage} food_ratio=${q.food_ratio.toFixed(2)} drink_ratio=${q.drink_ratio.toFixed(2)} verdict=${q.verdict}`,
    }),
    CFG.dbTimeoutMs, 'insert_fetch_ok',
  )
}

async function logFail(id: string, sourceUrl: string | null, reason: string): Promise<void> {
  if (CFG.dryRun) return
  try {
    await withTimeout(
      supabase.from('restaurant_menu_fetches').insert({
        restaurant_id: id,
        source: 'website-v101',
        source_url: sourceUrl,
        menu_url: null,
        status: reason.startsWith('rejected') ? 'rejected' : (reason.startsWith('err') ? 'errored' : 'no_content'),
        items_found: 0,
        error_message: reason.slice(0, 400),
      }),
      CFG.dbTimeoutMs, 'insert_fetch_fail',
    )
  } catch {}
}

// =====================================================================
// per-restaurant pipeline
// =====================================================================

function dedupe(items: RawMenuItem[]): Item[] {
  const byKey = new Map<string, RawMenuItem>()
  for (const it of items) {
    if (isNoiseName(it.name)) continue
    const k = `${it.name.toLowerCase()}|${(it.section || '').toLowerCase()}`
    const prev = byKey.get(k)
    if (!prev) byKey.set(k, it)
    else if (prev.price == null && it.price != null) byKey.set(k, it)
  }
  return Array.from(byKey.values()).map(it => ({
    name: it.name, section: it.section || null,
    price_cents: it.price != null ? Math.round(it.price * 100) : null,
    price_raw: it.price != null ? `$${it.price.toFixed(it.price % 1 ? 2 : 0)}` : '',
    description: it.description,
  }))
}

async function runFetchStage(website: string): Promise<RawMenuItem[]> {
  const home = new URL(website)
  const urls = [website]
  for (const p of ['/menu', '/menus', '/food']) {
    const u = new URL(p, home.origin).toString()
    if (!urls.includes(u)) urls.push(u)
  }
  const all: RawMenuItem[] = []
  for (const url of urls) {
    const html = await fetchHtml(url)
    if (!html) continue
    const lds = parseJsonLdMenus(html)
    for (const it of lds) all.push(it)
    if (all.length >= 10) break
  }
  return all
}

async function runBrowserStage(r: { id: string; name: string; website: string }): Promise<{ items: RawMenuItem[]; menusVisited: number }> {
  const b = await ensureBrowser()
  browserUsesSince++
  const ctx: BrowserContext = await withTimeout(b.newContext({
    userAgent: UA_BROWSER,
    viewport: { width: 1280, height: 900 },
    javaScriptEnabled: true,
  }), 15_000, 'newContext')
  try {
    await ctx.route('**/*.{png,jpg,jpeg,gif,webp,woff,woff2,ttf,mp4,webm}', route => route.abort())
    const page = await withTimeout(ctx.newPage(), 10_000, 'newPage')
    page.setDefaultNavigationTimeout(CFG.navTimeoutMs)
    const home = new URL(r.website)
    const entryUrls: string[] = [r.website]
    for (const p of ['/menu', '/menus', '/food']) {
      const u = new URL(p, home.origin).toString()
      if (!entryUrls.includes(u)) entryUrls.push(u)
    }
    const all: RawMenuItem[] = []
    let discovered: string[] = []
    for (const entry of entryUrls) {
      const got = await scrapeBrowserPage(page, entry)
      for (const it of got) all.push(it)
      const urls = await findMenuUrls(page).catch(() => [] as string[])
      for (const u of urls) if (!discovered.includes(u)) discovered.push(u)
      if (got.length >= 10 || discovered.length > 0) break
    }
    const visited = new Set(entryUrls)
    const queue = discovered.filter(u => !visited.has(u)).slice(0, CFG.maxMenusPerSite)
    let menusVisited = 0
    for (const url of queue) {
      menusVisited++
      const got = await scrapeBrowserPage(page, url)
      for (const it of got) all.push(it)
      if (all.length > 500) break
    }
    return { items: all, menusVisited }
  } finally {
    await ctx.close().catch(() => {})
  }
}

async function processOne(r: { id: string; name: string; website: string }): Promise<Report> {
  const t0 = Date.now()
  const rep: Report = {
    id: r.id, name: r.name, website: r.website,
    status: 'errored', stage: null, menus_visited: 0, items: 0,
    verdict: null, food_ratio: 0, drink_ratio: 0, ms: 0, error: null,
  }
  try {
    let raw: RawMenuItem[] = []
    let stage: 'fetch' | 'browser' | null = null
    if (CFG.stages !== 'browser') {
      hb.phase = 'fetch'; flushHeartbeat()
      raw = await runFetchStage(r.website)
      stage = 'fetch'
    }
    let menusVisited = 0
    // Promote to browser if fetch was weak
    let items = dedupe(raw)
    let q = scoreMenu(items)
    const fetchOk = passesFoodGate(q)
    if (!fetchOk && CFG.stages !== 'fetch') {
      hb.phase = 'browser'; flushHeartbeat()
      const br = await runBrowserStage(r)
      menusVisited = br.menusVisited
      // Merge fetch + browser raws
      raw = [...raw, ...br.items]
      items = dedupe(raw)
      q = scoreMenu(items)
      stage = 'browser'
    }
    rep.stage = stage
    rep.menus_visited = menusVisited
    rep.items = items.length
    rep.verdict = q.verdict
    rep.food_ratio = q.food_ratio
    rep.drink_ratio = q.drink_ratio
    if (!items.length) {
      rep.status = 'no_menus'
      await logFail(r.id, r.website, 'no menus found via fetch or browser')
    } else if (passesFoodGate(q)) {
      hb.phase = 'persist'; flushHeartbeat()
      await persistItems(r.id, items, r.website, stage!, q)
      rep.status = 'ok'
    } else {
      rep.status = 'rejected'
      await logFail(r.id, r.website, `rejected-quality verdict=${q.verdict} food=${(q.food_ratio*100).toFixed(0)}%`)
    }
  } catch (e) {
    rep.status = 'errored'
    rep.error = (e as Error).message?.slice(0, 200) || 'unknown'
    await logFail(r.id, r.website, `err:${rep.error}`)
  }
  rep.ms = Date.now() - t0
  return rep
}

// =====================================================================
// main
// =====================================================================

async function main() {
  console.log(`[v101] pid=${process.pid} stages=${CFG.stages} total_ids=${INPUT_IDS.length} shard=${CFG.shardIndex}/${CFG.shardCount}`)
  flushHeartbeat()
  // Fetch restaurants + existing-items mask
  const targets = await fetchTargets(INPUT_IDS)
  const withSite = targets.filter(t => t.website && /^https?:\/\//.test(t.website)) as Array<{id:string;name:string;website:string}>
  const existing = await fetchExistingIds(withSite.map(t => t.id))
  // Apply skip-existing + progress-file filter + limit
  const todo: typeof withSite = []
  for (const t of withSite) {
    if (existing.has(t.id)) {
      progress[t.id] = progress[t.id] ?? {
        id: t.id, name: t.name, website: t.website, status: 'skipped', stage: null,
        menus_visited: 0, items: 0, verdict: null, food_ratio: 0, drink_ratio: 0, ms: 0, error: 'already has items',
      }
      continue
    }
    const prev = progress[t.id]
    if (prev && ['ok', 'rejected', 'no_menus'].includes(prev.status)) continue
    todo.push(t)
    if (todo.length >= CFG.limit) break
  }
  hb.total = todo.length
  hb.skipped = Object.values(progress).filter(r => r.status === 'skipped').length
  flushHeartbeat(); flushProgress()
  console.log(`[v101] todo=${todo.length} already-persisted=${existing.size} input=${INPUT_IDS.length}`)

  for (let i = 0; i < todo.length; i++) {
    if (exiting) break
    const r = todo[i]
    hb.idx = i + 1
    hb.current_id = r.id
    hb.current_name = r.name
    flushHeartbeat()
    const rep = await Promise.race<Report>([
      processOne(r),
      new Promise<Report>(res => setTimeout(
        () => res({ id: r.id, name: r.name, website: r.website, status: 'errored', stage: null, menus_visited: 0, items: 0, verdict: null, food_ratio: 0, drink_ratio: 0, ms: CFG.perRestaurantMs, error: `per_restaurant_timeout_${CFG.perRestaurantMs}ms` }),
        CFG.perRestaurantMs,
      )),
    ])
    progress[r.id] = rep
    hb[rep.status === 'ok' ? 'ok' : rep.status === 'rejected' ? 'rejected' : rep.status === 'no_menus' ? 'no_menus' : 'errored']++
    flushProgress(); flushHeartbeat()
    const badge = rep.status.toUpperCase()
    const stage = rep.stage ? `[${rep.stage}]` : ''
    console.log(`[${badge}]${stage} ${r.name} — ${rep.items} items (${rep.menus_visited} menus, ${rep.ms}ms) food=${(rep.food_ratio*100).toFixed(0)}% verdict=${rep.verdict}${rep.error ? ' err='+rep.error : ''}`)
  }

  if (browser) { try { await withTimeout(browser.close(), 15_000, 'final_browser_close') } catch {} }
  hb.phase = 'idle'; flushHeartbeat(); flushProgress()
  const vals = Object.values(progress)
  console.log(`\n=== v101 summary ${CFG.shardCount > 1 ? `(shard ${CFG.shardIndex}/${CFG.shardCount})` : ''} ===`)
  console.log(`accepted:  ${vals.filter(r=>r.status==='ok').length} (${vals.filter(r=>r.status==='ok').reduce((s,r)=>s+r.items,0)} items)`)
  console.log(`rejected:  ${vals.filter(r=>r.status==='rejected').length}`)
  console.log(`no_menus:  ${vals.filter(r=>r.status==='no_menus').length}`)
  console.log(`errored:   ${vals.filter(r=>r.status==='errored').length}`)
  console.log(`skipped:   ${vals.filter(r=>r.status==='skipped').length}`)
  fs.mkdirSync(path.dirname(CFG.reportPath), { recursive: true })
  fs.writeFileSync(CFG.reportPath, JSON.stringify({ hb, reports: vals }, null, 2))
  console.log(`wrote ${CFG.reportPath}`)
  gracefulExit(0, 'done')
}

main().catch(e => { console.error(e); gracefulExit(1, `main:${(e as Error).message}`) })
