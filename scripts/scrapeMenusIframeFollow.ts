/**
 * V2 scraper: iframe-aware fallback for restaurants whose home page returned
 * no menu items. Many restaurants embed Toast / BentoBox / Square / Popmenu
 * / Resy menus as iframes — these are server-rendered and fetchable via
 * plain fetch() if we follow the iframe src.
 *
 * Usage:
 *   npx tsx scripts/scrapeMenusIframeFollow.ts [--limit=200] [--dryRun=true]
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
const SUPA_URL = process.env.NEXT_PUBLIC_SUPABASE_URL!
const SUPA_ANON = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!
const supabase = createClient(SUPA_URL, SUPA_ANON, { auth: { persistSession: false } })

const args = Object.fromEntries(process.argv.slice(2).map(a => {
  const [k, v] = a.replace(/^--/, '').split('=')
  return [k, v ?? 'true']
})) as Record<string, string>
const limit = Number(args.limit ?? '500')
const dryRun = args.dryRun === 'true'

// --- shared helpers (copied & trimmed from v1) ---
const entities: Record<string,string> = { '&amp;':'&','&lt;':'<','&gt;':'>','&quot;':'"','&#39;':"'",'&apos;':"'",'&nbsp;':' ','&rsquo;':"'",'&lsquo;':"'",'&ldquo;':'"','&rdquo;':'"','&ndash;':'-','&mdash;':'-','&hellip;':'...' }
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
      .replace(/<(br|hr)\s*\/?>/gi, '\n')
      .replace(/<\/(p|div|li|tr|h[1-6]|section|article|header|footer)>/gi, '\n')
      .replace(/<[^>]+>/g, ' ')
  ).replace(/\u00a0/g, ' ').replace(/[ \t]+/g, ' ').replace(/\n[ \t]+/g, '\n').replace(/\n{2,}/g, '\n').trim()
}

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
async function getHtml(url: string, timeoutMs = 15000, attempt = 0): Promise<{html: string, finalUrl: string} | null> {
  let host = ''
  try { host = new URL(url).host } catch { return null }
  await politeWait(host)
  try {
    const ctl = new AbortController()
    const t = setTimeout(() => ctl.abort(), timeoutMs)
    const res = await fetch(url, { signal: ctl.signal, redirect: 'follow', headers: {
      'User-Agent': 'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 Gastronome-Pilot/0.1 (+dakai.research@gmail.com)',
      'Accept': 'text/html,*/*;q=0.9',
      'Accept-Language': 'en-US,en;q=0.9',
    } })
    clearTimeout(t)
    if (res.status === 429 || res.status === 503) {
      const retryAfter = Number(res.headers.get('retry-after')) || 0
      const waitMs = Math.max(retryAfter * 1000, 4000 * Math.pow(2, attempt))
      if (attempt < 2) { await sleep(waitMs); return getHtml(url, timeoutMs, attempt + 1) }
      return null
    }
    if (res.status >= 500 && res.status < 600 && attempt < 1) { await sleep(2000); return getHtml(url, timeoutMs, attempt + 1) }
    if (!res.ok) return null
    return { html: await res.text(), finalUrl: res.url }
  } catch { return null }
}

// --- iframe discovery: known menu-hosting providers ---
const IFRAME_MENU_HOSTS = [
  'toasttab.com', 'orders.toasttab.com', 'menu.toasttab.com',
  'getbento.com', 'bentobox.com',
  'square.site', 'squareup.com',
  'popmenu.com',
  'resy.com',
  'singleplatform.com', 'theoreo.com',
  'emenu.pro', 'orderopia.com',
  'chownow.com',
  'hotsauce.com',
  'touchbistro.com',
]
function findMenuIframes(html: string, base: string): string[] {
  const out = new Set<string>()
  const re = /<iframe[^>]+src=["']([^"']+)["']/gi
  let m
  while ((m = re.exec(html))) {
    try {
      const url = new URL(m[1], base).href
      const host = new URL(url).host.toLowerCase()
      if (IFRAME_MENU_HOSTS.some(h => host.endsWith(h))) out.add(url)
    } catch {}
  }
  return [...out].slice(0, 4)
}
function findMenuLinksOnSite(html: string, base: string): string[] {
  const out = new Set<string>()
  const re = /<a[^>]+href=["']([^"']+)["'][^>]*>([\s\S]*?)<\/a>/gi
  let m
  while ((m = re.exec(html))) {
    const href = m[1]; const inner = m[2].replace(/<[^>]+>/g, ' ').trim().toLowerCase()
    const lh = href.toLowerCase()
    const looksMenuUrl = /(^|[\/\?#])(menu|menus|food|dinner|lunch|brunch|carte)(s?)([\/\?#&=]|$)/.test(lh)
    const looksMenuText = /\b(menu|menus|dinner|lunch|brunch|food|view menu|full menu)\b/.test(inner) && inner.length < 40
    if (looksMenuUrl || looksMenuText) {
      try {
        const u = new URL(href, base)
        if (/^https?:/.test(u.protocol)) out.add(u.href.split('#')[0])
      } catch {}
    }
  }
  return [...out].slice(0, 6)
}

// --- menu extraction (same rules as v1) ---
type Item = { name: string; section: string | null; price_cents: number | null; price_raw: string; description: string | null }
const SECTION_RE = /^[A-Z][A-Z0-9 &\-'’]{2,40}$/
const ITEM_RE = /^(.+?)\s+\$?\s?(\d{1,3}(?:\.\d{2})?|M\.P\.|MP|market price)$/i
const NOISE_PREFIX = /^(add|sub|substitute|choice of|includes|served with|comes with|add-on|slide\s*\d)/i
const TRASH_NAME = /^(\d+\s*[•·]\s*)?$|^[•·\-–—\s]+$|^(slide|current slide)/i
function extractItems(text: string): Item[] {
  const lines = text.split('\n').map(l => l.trim()).filter(Boolean)
  const items: Item[] = []
  let section: string | null = null
  for (let i = 0; i < lines.length; i++) {
    const line = lines[i]
    if (SECTION_RE.test(line) && !ITEM_RE.test(line) && line.length <= 40) { section = line; continue }
    const m = line.match(ITEM_RE)
    if (!m) continue
    const name = m[1].trim()
    const priceRaw = m[2]
    if (NOISE_PREFIX.test(name)) continue
    if (TRASH_NAME.test(name)) continue
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

async function tryOne(r: { id: string; name: string; website: string }): Promise<{ ok: boolean; items: number; menuUrl: string | null; via: string }> {
  const start = r.website.startsWith('http') ? r.website : 'https://' + r.website
  const root = await getHtml(start)
  if (!root) return { ok: false, items: 0, menuUrl: null, via: 'fetch_failed' }
  const base = root.finalUrl

  // 1) iframes on root
  let candidates: { url: string; via: string }[] = findMenuIframes(root.html, base).map(u => ({ url: u, via: 'iframe' }))

  // 2) follow menu sub-links and look for iframes there (many sites put the menu iframe on /menu)
  if (candidates.length === 0) {
    const links = findMenuLinksOnSite(root.html, base)
    for (const link of links.slice(0, 4)) {
      const sub = await getHtml(link)
      if (!sub) continue
      const subIframes = findMenuIframes(sub.html, sub.finalUrl)
      for (const u of subIframes) candidates.push({ url: u, via: 'sublink-iframe' })
      // Also extract directly from sub page text (in case it wasn't picked up originally)
      const subItems = extractItems(htmlToText(sub.html))
      if (subItems.length >= 5 && candidates.length === 0) {
        return await writeItems(r, subItems, sub.finalUrl, 'sublink-text')
      }
      if (candidates.length) break
    }
  }

  // 3) try each candidate iframe src
  for (const c of candidates) {
    const page = await getHtml(c.url)
    if (!page) continue
    const items = extractItems(htmlToText(page.html))
    if (items.length >= 3) return await writeItems(r, items, page.finalUrl, c.via)
  }

  return { ok: false, items: 0, menuUrl: null, via: candidates.length ? 'iframe_no_items' : 'no_iframe' }
}

async function writeItems(r: { id: string }, items: Item[], menuUrl: string, via: string) {
  if (!dryRun && items.length) {
    const rows = items.map(it => ({
      restaurant_id: r.id, item_name: it.name.slice(0, 120), section: it.section,
      price_cents: it.price_cents, price_raw: it.price_raw.slice(0, 40), description: it.description,
      source: 'website', source_url: menuUrl,
    }))
    for (let i = 0; i < rows.length; i += 50) {
      const { error } = await supabase.from('restaurant_menu_items')
        .upsert(rows.slice(i, i + 50), { onConflict: 'restaurant_id,item_name,source', ignoreDuplicates: true })
      if (error) console.error('upsert err', error.message)
    }
    await supabase.from('restaurant_menu_fetches').insert({
      restaurant_id: r.id, source: 'website', source_url: menuUrl, menu_url: menuUrl,
      status: 'ok', items_found: items.length,
    })
  }
  return { ok: true, items: items.length, menuUrl, via }
}

async function main() {
  // Pick restaurants with website AND no successful website fetch yet
  const { data: fetched } = await supabase
    .from('restaurant_menu_fetches')
    .select('restaurant_id, status, items_found, source')
    .eq('source', 'website')
  const okIds = new Set((fetched ?? []).filter((f: any) => f.status === 'ok' && f.items_found > 0).map((f: any) => f.restaurant_id))
  const { data: rs } = await supabase.from('restaurants').select('id, name, website').not('website', 'is', null).order('name').limit(10000)
  const todo = (rs ?? []).filter((r: any) => !okIds.has(r.id)).slice(0, limit) as { id: string; name: string; website: string }[]
  console.log(`Iframe fallback: ${todo.length} restaurants to try (already ok: ${okIds.size})`)

  let ok = 0, iframeHit = 0, noIframe = 0, fetchFail = 0, totalItems = 0
  const parallel = 4
  for (let i = 0; i < todo.length; i += parallel) {
    const batch = todo.slice(i, i + parallel)
    const rs = await Promise.all(batch.map(async r => {
      try { return { r, ...(await tryOne(r)) } } catch (e) { return { r, ok: false, items: 0, menuUrl: null, via: 'error:' + String(e) } }
    }))
    for (const x of rs) {
      if (x.ok) { ok++; iframeHit += x.via.includes('iframe') ? 1 : 0; totalItems += x.items
        console.log(`[OK/${x.via}] ${x.r.name} — ${x.items} items`) }
      else if (x.via === 'fetch_failed') { fetchFail++ }
      else if (x.via === 'no_iframe') { noIframe++ }
      else console.log(`[FAIL/${x.via}] ${x.r.name}`)
    }
    if ((i / parallel) % 10 === 0) console.log(`...progress ${i + batch.length}/${todo.length} | ok=${ok} iframes=${iframeHit} no_iframe=${noIframe} fetch_fail=${fetchFail}`)
  }
  console.log(`\nDone. ok=${ok} (${iframeHit} via iframes), no_iframe=${noIframe}, fetch_fail=${fetchFail}, items=${totalItems}`)
}
main().catch(e => { console.error(e); process.exit(1) })
