/**
 * Menu scraper v2.3 — headless-browser rendered-HTML fetcher.
 *
 * v2.0 / v2.1 pipeline couldn't unlock popmenu / Toast / BentoBox sites because
 * their menu content is JS-hydrated after page load and absent from the raw
 * HTML that a plain fetch() sees. This script solves that by driving a real
 * Chromium via Playwright:
 *
 *   1. For each target restaurant, navigate to website.
 *   2. Find each menu tab / menu page by scanning anchors & tabs. Popmenu uses
 *      /menus/{slug}?location={loc}. BentoBox uses /menus/{slug}.html.
 *   3. For each menu page, wait for the ld+json script with @type=Menu to
 *      appear (popmenu always renders it post-hydration).
 *   4. Collect every MenuItem across all menu pages, dedupe, validate with
 *      food-quality gate, persist with source='website-browser'.
 *
 * Usage:
 *   npx tsx scripts/scrapeMenusBrowser.ts --ids=a,b,c [--limit=10]
 *     [--maxMenusPerSite=8] [--navTimeout=30000] [--dryRun=true]
 *
 * Concurrency=1 deliberately — starts a single browser, one tab, serial
 * navigation. Memory stays ~500MB.
 */

import { chromium, type Browser, type Page } from 'playwright'
import { createClient } from '@supabase/supabase-js'
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
if (!SUPA_URL || !SUPA_KEY) { console.error('Missing Supabase env'); process.exit(1) }
const supabase = createClient(SUPA_URL, SUPA_KEY, { auth: { persistSession: false } })

// ---------- args ----------

const rawArgs = Object.fromEntries(
  process.argv.slice(2).map(a => {
    const [k, v] = a.replace(/^--/, '').split('=')
    return [k, v ?? 'true']
  }),
) as Record<string, string>

const ID_FILTER = (rawArgs.ids ?? '').split(',').map(s => s.trim()).filter(Boolean)
const LIMIT = Number(rawArgs.limit ?? '50')
const MAX_MENUS = Number(rawArgs.maxMenusPerSite ?? '8')
const NAV_TIMEOUT = Number(rawArgs.navTimeout ?? '30000')
const DRY_RUN = rawArgs.dryRun === 'true'

// ---------- food / drink classifier (kept in sync) ----------

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

// Reject items with names that are obviously UI chrome rather than dishes.
const NOISE_NAME_RE = /^(slide\s+\d+(\s+of)?|slide|next|previous|prev|back|home|menu|close|search|order(\s+now)?|book|reserve|contact|about|login|signup|sign\s?in|sign\s?up|view\s+all|shop(\s+now)?|learn\s+more|read\s+more|see\s+menu|our\s+menu|reserve\s+now|book\s+now|view\s+menu|click\s+here|more|details|gallery|photos|images|loading|error|submit|send|subscribe|join|cart|checkout|bag|item|product|price|total|subtotal|tax|tip|gratuity|cash|credit|card|new|hot|best|popular|featured|recommended|special|today|tomorrow|yesterday|lunch|dinner|brunch|breakfast|dessert|drinks|cocktails|beer|wine|spirits|food|menu item|menu items|toggle|open|close|expand|collapse|show|hide|first|last|start|end|previous page|next page|page\s*\d+)$/i

function isNoiseName(name: string): boolean {
  const n = (name || '').trim()
  if (!n) return true
  if (NOISE_NAME_RE.test(n)) return true
  if (n.length < 3) return true
  // Numeric-only or mostly punctuation
  if (/^[\d\s\.\-\$]+$/.test(n)) return true
  // Single word, all-caps, <= 4 chars (likely UI label)
  if (/^[A-Z]{1,4}$/.test(n)) return true
  return false
}

// ---------- browser primitives ----------

type RawMenuItem = { menu: string; section: string; name: string; price: number | null; description: string | null }

/**
 * Extract menu items via in-page JSON-LD parsing. Popmenu + BentoBox + Toast
 * + any schema.org/Menu-compliant site emits a <script type="application/ld+json">
 * with @type: Menu (possibly nested in an array or inside @graph).
 */
async function extractJsonLdMenus(page: Page): Promise<RawMenuItem[]> {
  // Use evaluate with a pure function string — no tsx compilation of nested helpers
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
  return await page.evaluate(js) as RawMenuItem[]
}

/**
 * Fallback: extract dish/price lines from the rendered page's innerText.
 * Parses two patterns: "Name ... $25" on one line, or Name on line N and
 * "$25" on the next. Noisy by nature; food-quality gate downstream filters.
 */
async function extractTextMenuItems(page: Page): Promise<RawMenuItem[]> {
  const js = `(() => {
    const out = [];
    const body = document.body ? document.body.innerText : '';
    const lines = body.split('\\n').map(function(l){return l.trim();}).filter(Boolean);
    const seenNames = new Set();
    // Pattern A: name and price on same line
    const oneLine = /^([A-Z][A-Za-z0-9'&,()\\-\\/\\.\\s]{2,79}?)[\\s\\.\\u00a0]+\\$?\\s?(\\d{1,3}(?:\\.\\d{2})?)\\s*$/;
    // Pattern B: bare price line
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
      // Pattern B: current line is a price, previous is the name
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
  return await page.evaluate(js) as RawMenuItem[]
}

/**
 * Discover per-menu URLs on the current page. Returns absolute URLs on the
 * same host matching common menu-tab patterns.
 */
async function findMenuUrls(page: Page): Promise<string[]> {
  const js = `(() => {
    const base = new URL(window.location.href);
    const out = new Set();
    for (const a of document.querySelectorAll('a[href]')) {
      const href = a.getAttribute('href') || '';
      try {
        const abs = new URL(href, window.location.href);
        if (abs.host !== base.host) continue;
        const p = abs.pathname.toLowerCase();
        if (/^\\/menus?\\/[a-z0-9-]+/.test(p) || /^\\/(menus?|food|dinner|lunch|brunch)(\\.html?)?$/.test(p)) {
          out.add(abs.toString());
        }
      } catch (e) {}
    }
    return Array.from(out);
  })()`
  return await page.evaluate(js) as string[]
}

/**
 * Navigate + wait for menu JSON-LD; returns items found on this page.
 */
async function scrapeSinglePage(page: Page, url: string, waitMs = 2500): Promise<RawMenuItem[]> {
  try {
    await page.goto(url, { timeout: NAV_TIMEOUT, waitUntil: 'domcontentloaded' })
  } catch { return [] }
  // Wait for JSON-LD Menu to appear (popmenu injects it post-hydration)
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
    await page.waitForFunction(waitJs, { timeout: 8000 })
  } catch { /* no JSON-LD even after wait — continue */ }
  // Small additional hydration window
  await page.waitForTimeout(waitMs)
  const jsonLd = await extractJsonLdMenus(page).catch(() => [] as RawMenuItem[])
  if (jsonLd.length > 0) return jsonLd
  // Fallback: parse visible innerText for price-anchored dish lines
  return await extractTextMenuItems(page).catch(() => [] as RawMenuItem[])
}

// ---------- persistence ----------

async function persist(id: string, items: Item[], sourceUrl: string, q: MenuQuality): Promise<void> {
  if (DRY_RUN) return
  await supabase.from('restaurant_menu_items').delete().eq('restaurant_id', id).eq('source', 'website-browser')
  const rows = items.map(it => ({
    restaurant_id: id,
    item_name: it.name.slice(0, 120),
    section: it.section?.slice(0, 120) ?? null,
    price_cents: it.price_cents,
    price_raw: (it.price_raw || '').slice(0, 40),
    description: it.description?.slice(0, 500) ?? null,
    source: 'website-browser',
    source_url: sourceUrl,
  }))
  for (let i = 0; i < rows.length; i += 50) {
    const { error } = await supabase
      .from('restaurant_menu_items')
      .upsert(rows.slice(i, i + 50), { onConflict: 'restaurant_id,item_name,source', ignoreDuplicates: true })
    if (error) console.error('upsert err', error.message)
  }
  await supabase.from('restaurant_menu_fetches').insert({
    restaurant_id: id,
    source: 'website-browser',
    source_url: sourceUrl,
    menu_url: sourceUrl,
    status: 'ok',
    items_found: items.length,
    error_message: `browser food_ratio=${q.food_ratio.toFixed(2)} drink_ratio=${q.drink_ratio.toFixed(2)} verdict=${q.verdict}`,
  })
}

async function logFail(id: string, sourceUrl: string | null, reason: string): Promise<void> {
  if (DRY_RUN) return
  await supabase.from('restaurant_menu_fetches').insert({
    restaurant_id: id,
    source: 'website-browser',
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
  status: 'ok' | 'rejected' | 'no_menus' | 'errored'
  menus_visited: number; items: number
  verdict: MenuQuality['verdict'] | null
  food_ratio: number; drink_ratio: number
  ms: number
}

async function processOne(browser: Browser, r: { id: string; name: string; website: string }): Promise<Report> {
  const t0 = Date.now()
  const rep: Report = {
    id: r.id, name: r.name, status: 'errored', menus_visited: 0, items: 0,
    verdict: null, food_ratio: 0, drink_ratio: 0, ms: 0,
  }
  const ctx = await browser.newContext({
    userAgent: 'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 Gastronome-Scraper/2.3-Browser (+dakai.research@gmail.com)',
    viewport: { width: 1280, height: 900 },
    javaScriptEnabled: true,
  })
  // Block heavy assets we don't need
  await ctx.route('**/*.{png,jpg,jpeg,gif,webp,woff,woff2,ttf,mp4,webm}', (route) => route.abort())
  const page = await ctx.newPage()
  page.setDefaultNavigationTimeout(NAV_TIMEOUT)

  try {
    // Try homepage, /menu, /menus as entry points — some sites hide the menu anchors on home
    const home = new URL(r.website)
    const entryUrls: string[] = [r.website]
    for (const p of ['/menu', '/menus', '/food']) {
      const u = new URL(p, home.origin).toString()
      if (!entryUrls.includes(u)) entryUrls.push(u)
    }

    const allItems: RawMenuItem[] = []
    let discoveredMenuUrls: string[] = []
    for (const entry of entryUrls) {
      const got = await scrapeSinglePage(page, entry)
      for (const it of got) allItems.push(it)
      const urls = await findMenuUrls(page).catch(() => [])
      for (const u of urls) if (!discoveredMenuUrls.includes(u)) discoveredMenuUrls.push(u)
      // Break only once we either have menu-subpage links, or a meaningful
      // number of items on this page (meaning the page itself holds the menu)
      if (got.length >= 10 || discoveredMenuUrls.length > 0) break
    }

    // Visit discovered per-menu URLs (skipping ones already in entry)
    const visited = new Set(entryUrls)
    const queue = discoveredMenuUrls.filter(u => !visited.has(u)).slice(0, MAX_MENUS)
    for (const url of queue) {
      rep.menus_visited++
      const got = await scrapeSinglePage(page, url)
      for (const it of got) allItems.push(it)
      if (allItems.length > 500) break
    }

    // Dedupe by (name, section) preferring entries with price; filter chrome/noise
    const byKey = new Map<string, RawMenuItem>()
    for (const it of allItems) {
      if (isNoiseName(it.name)) continue
      const k = `${it.name.toLowerCase()}|${it.section.toLowerCase()}`
      const prev = byKey.get(k)
      if (!prev) byKey.set(k, it)
      else if (prev.price == null && it.price != null) byKey.set(k, it)
    }
    const merged = Array.from(byKey.values())

    if (!merged.length) {
      rep.status = 'no_menus'
      await logFail(r.id, r.website, 'no json-ld menus found on any page')
    } else {
      const items: Item[] = merged.map(it => ({
        name: it.name, section: it.section || null,
        price_cents: it.price != null ? Math.round(it.price * 100) : null,
        price_raw: it.price != null ? `$${it.price.toFixed(it.price % 1 ? 2 : 0)}` : '',
        description: it.description,
      }))
      const q = scoreMenu(items)
      rep.verdict = q.verdict
      rep.food_ratio = q.food_ratio
      rep.drink_ratio = q.drink_ratio
      rep.items = items.length
      if (passesFoodGate(q)) {
        await persist(r.id, items, r.website, q)
        rep.status = 'ok'
      } else {
        rep.status = 'rejected'
        await logFail(r.id, r.website, `rejected-quality verdict=${q.verdict} food=${(q.food_ratio*100).toFixed(0)}% drink=${(q.drink_ratio*100).toFixed(0)}%`)
      }
    }
  } catch (e) {
    rep.status = 'errored'
    const msg = (e as Error).message?.slice(0,400) || 'unknown'
    console.error(`  [${r.name}] ERROR: ${msg}`)
    await logFail(r.id, null, `err:${msg.slice(0,200)}`)
  } finally {
    await ctx.close().catch(() => {})
  }
  rep.ms = Date.now() - t0
  const badge = rep.status === 'ok' ? 'OK' : rep.status.toUpperCase()
  console.log(`[${badge}] ${r.name} — ${rep.items} items (${rep.menus_visited} menus, ${rep.ms}ms) food=${(rep.food_ratio*100).toFixed(0)}% verdict=${rep.verdict}`)
  return rep
}

// ---------- main ----------

async function main() {
  if (!ID_FILTER.length) {
    console.error('--ids=<csv> required')
    process.exit(1)
  }
  const { data, error } = await supabase
    .from('restaurants').select('id, name, website')
    .in('id', ID_FILTER).not('website', 'is', null)
  if (error) { console.error(error); process.exit(1) }
  const targets = (data ?? []).slice(0, LIMIT) as Array<{ id: string; name: string; website: string }>
  console.log(`v2.3 browser scraper — targets=${targets.length} dryRun=${DRY_RUN}`)

  const browser = await chromium.launch({
    headless: true,
    args: ['--no-sandbox', '--disable-dev-shm-usage', '--disable-gpu'],
  })

  const reports: Report[] = []
  const PER_RESTAURANT_TIMEOUT_MS = 90_000
  for (const r of targets) {
    try {
      const p = processOne(browser, r)
      const timeout = new Promise<Report>((_, rej) =>
        setTimeout(() => rej(new Error(`timeout_${PER_RESTAURANT_TIMEOUT_MS}ms`)), PER_RESTAURANT_TIMEOUT_MS),
      )
      reports.push(await Promise.race([p, timeout]))
    } catch (e) {
      const msg = (e as Error).message
      console.error(`[TIMEOUT/ERR] ${r.name}: ${msg}`)
      reports.push({ id: r.id, name: r.name, status: 'errored', menus_visited: 0, items: 0, verdict: null, food_ratio: 0, drink_ratio: 0, ms: PER_RESTAURANT_TIMEOUT_MS })
    }
  }

  await browser.close()

  const ok = reports.filter(r => r.status === 'ok')
  const itemsTotal = ok.reduce((s, r) => s + r.items, 0)
  console.log(`\n=== v2.3 browser summary ===`)
  console.log(`accepted:     ${ok.length} (${itemsTotal} items)`)
  console.log(`rejected:     ${reports.filter(r => r.status === 'rejected').length}`)
  console.log(`no_menus:     ${reports.filter(r => r.status === 'no_menus').length}`)
  console.log(`errored:      ${reports.filter(r => r.status === 'errored').length}`)

  const reportPath = path.join(process.cwd(), 'tmp', `menu-browser-report-${Date.now()}.json`)
  fs.mkdirSync(path.dirname(reportPath), { recursive: true })
  fs.writeFileSync(reportPath, JSON.stringify(reports, null, 2))
  console.log(`Wrote ${reportPath}`)
}

main().catch(e => { console.error(e); process.exit(1) })
