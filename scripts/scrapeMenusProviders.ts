/**
 * V3 scraper: provider-URL fallback.
 *
 * The V1 HTML pass and V2 iframe pass left ~475 restaurants with no items.
 * Probing the no_items set showed almost none embed iframes; they link out
 * to third-party menu systems (Toast, BentoBox, Popmenu, Square Online,
 * Resy, Tock) via <a href> or <script>/<link> references instead.
 *
 * V3 scans the HTML (and one /menu sub-page if needed) for ANY URL hosted
 * by a known menu provider, fetches it, and runs the same extractor.
 *
 * Usage:
 *   npx tsx scripts/scrapeMenusProviders.ts [--limit=500] [--dryRun=true]
 */
import { createClient } from '@supabase/supabase-js'
import * as fs from 'fs'
import * as path from 'path'
import { execFile } from 'child_process'
import { promisify } from 'util'
const execFileP = promisify(execFile)

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

// --- entity decode + html->text ---
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

// --- polite fetch with per-host throttle + 429/503 retry ---
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
/** Fetch a PDF and convert to plain text via poppler's pdftotext. Returns null on failure. */
async function getPdfText(url: string, timeoutMs = 20000): Promise<{text: string, finalUrl: string} | null> {
  let host = ''
  try { host = new URL(url).host } catch { return null }
  await politeWait(host)
  let tmpPath: string | null = null
  try {
    const ctl = new AbortController()
    const t = setTimeout(() => ctl.abort(), timeoutMs)
    const res = await fetch(url, { signal: ctl.signal, redirect: 'follow', headers: {
      'User-Agent': 'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 Gastronome-Pilot/0.1 (+dakai.research@gmail.com)',
      'Accept': 'application/pdf,*/*;q=0.9',
    } })
    clearTimeout(t)
    if (!res.ok) return null
    const buf = Buffer.from(await res.arrayBuffer())
    if (buf.length < 400 || buf.slice(0, 4).toString() !== '%PDF') return null
    // Write to temp file (stdin buffering via execFile hangs on large PDFs).
    tmpPath = path.join('/tmp', `v3-pdf-${process.pid}-${Date.now()}-${Math.random().toString(36).slice(2,8)}.pdf`)
    fs.writeFileSync(tmpPath, buf)
    const { stdout } = await execFileP('pdftotext', ['-layout', tmpPath, '-'], {
      maxBuffer: 8 * 1024 * 1024, timeout: 15000,
    } as any)
    return { text: stdout.toString(), finalUrl: res.url }
  } catch { return null }
  finally { if (tmpPath) { try { fs.unlinkSync(tmpPath) } catch {} } }
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

// --- provider URL detection (host suffix match) ---
// NOTE: Cloudflare-bot-protected providers (toast, popmenu, resy, tock) return
// 403 to plain fetch. We still detect them (useful for downstream analysis) but
// the ranker gives them very low scores so we don't waste time fetching them.
type Provider = 'toast' | 'bentobox' | 'popmenu' | 'square' | 'resy' | 'tock' | 'singleplatform' | 'chownow' | 'touchbistro'
const PROVIDER_HOST_RULES: { provider: Provider; test: (host: string) => boolean }[] = [
  { provider: 'toast', test: h => h.endsWith('toasttab.com') || h.endsWith('toast-hospitality.com') },
  { provider: 'bentobox', test: h => h.endsWith('getbento.com') || h.endsWith('bentobox.com') || h.endsWith('media-cdn.getbento.com') },
  { provider: 'popmenu', test: h => h.endsWith('popmenu.com') },
  { provider: 'square', test: h => h.endsWith('square.site') || h.endsWith('squareup.com') },
  { provider: 'resy', test: h => h.endsWith('resy.com') },
  { provider: 'tock', test: h => h.endsWith('exploretock.com') || h.endsWith('tock.com') },
  { provider: 'singleplatform', test: h => h.endsWith('singleplatform.com') },
  { provider: 'chownow', test: h => h.endsWith('chownow.com') },
  { provider: 'touchbistro', test: h => h.endsWith('touchbistro.com') },
]
const CF_PROTECTED: Set<Provider> = new Set(['toast','popmenu','resy','tock'])
function classifyHost(host: string): Provider | null {
  host = host.toLowerCase()
  for (const r of PROVIDER_HOST_RULES) if (r.test(host)) return r.provider
  return null
}

/**
 * Scan entire HTML for any URL matching a known menu provider host.
 * Includes links, iframes, script srcs, and raw URL references in JSON/data-attrs.
 */
function findProviderUrls(html: string, base: string): { url: string; provider: Provider; via: string }[] {
  const seen = new Set<string>()
  const out: { url: string; provider: Provider; via: string }[] = []
  // 1. href, src, data-*="URL"
  const attrRe = /\b(?:href|src|data-[a-z-]+|content)\s*=\s*["']([^"']+)["']/gi
  let m
  while ((m = attrRe.exec(html))) {
    try {
      const u = new URL(m[1], base)
      const prov = classifyHost(u.host)
      if (prov && !seen.has(u.href)) { seen.add(u.href); out.push({ url: u.href, provider: prov, via: 'attr' }) }
    } catch {}
  }
  // 2. plain URL text inside JSON/inline script
  const urlRe = /https?:\/\/[a-zA-Z0-9.-]+(?:\/[^\s"'<>)]*)?/g
  while ((m = urlRe.exec(html))) {
    try {
      const u = new URL(m[0])
      const prov = classifyHost(u.host)
      if (prov && !seen.has(u.href)) { seen.add(u.href); out.push({ url: u.href, provider: prov, via: 'text' }) }
    } catch {}
  }
  return out
}

/**
 * From a list of detected provider URLs, score and pick the best ones to fetch.
 * Prefer URLs whose path suggests a menu rather than a logo, pixel, or JS bundle.
 */
function rankProviderUrls(urls: { url: string; provider: Provider; via: string }[]): { url: string; provider: Provider; via: string }[] {
  const scored = urls.map(u => {
    const path = u.url.split('?')[0].toLowerCase()
    let score = 0
    // negative: asset/tracking URLs
    if (/\.(png|jpe?g|gif|svg|webp|ico)(\?|$)/.test(path)) score -= 100
    if (/\.(js|css|map|woff2?)(\?|$)/.test(path)) score -= 100
    if (/\/pixel|\/tracker|\/analytics|googletagmanager/.test(path)) score -= 100
    if (/\/giftcards?\b/.test(path)) score -= 50   // gift cards, not menus
    if (/\/reservations?|\/reserve|\/book/.test(path)) score -= 20 // reservations
    // Penalize drinks-only menus so we pick food menus when both are linked.
    // Items from a drinks menu (bottles, glasses, vintages) won't match food
    // dishes and just add noise.
    if (/\/(wine-?list|drinks?-?menu?|cocktails?|beverages?|bar-?menu|spirits|sake)(\/|$)/.test(path)) score -= 40
    // Tasting-menu-tier PDFs are mostly just "3-COURSES / 4-COURSES" with no
    // individual dishes — deprioritize vs. the a-la-carte menu.
    if (/\/tasting-?menu|\/chefs?-?table/.test(path)) score -= 15
    // negative: Cloudflare-protected hosts will 403 anyway
    if (CF_PROTECTED.has(u.provider)) score -= 80
    // positive signals
    if (/\.pdf(\?|$)/.test(path)) score += 10            // PDF menu — pdftotext works
    if (/\/menu/.test(path)) score += 5
    if (/\/online-?order|orderonline|order-online|ordering/.test(path)) score += 4
    if (u.provider === 'bentobox' && /\.pdf(\?|$)/.test(path)) score += 6
    if (u.provider === 'bentobox' && /media-cdn\.getbento\.com/.test(u.url.toLowerCase())) score += 2
    if (u.provider === 'square' && /\/s\/[^/]+/.test(path)) score += 2
    if (u.provider === 'singleplatform') score += 3
    return { ...u, score }
  })
  // de-dup by provider+path-prefix, keep highest scorer
  scored.sort((a, b) => b.score - a.score)
  const pickedByKey = new Set<string>()
  const picked: typeof scored = []
  for (const u of scored) {
    if (u.score <= -50) continue
    // key by provider + first two path segments
    const p = u.url.split('?')[0]
    let segKey = p
    try { const up = new URL(p); segKey = up.host + '|' + up.pathname.split('/').slice(0, 4).join('/') } catch {}
    const key = u.provider + '|' + segKey
    if (pickedByKey.has(key)) continue
    pickedByKey.add(key)
    picked.push(u)
    if (picked.length >= 4) break
  }
  return picked
}

// --- menu extraction (same rules as v1 / v2) ---
type Item = { name: string; section: string | null; price_cents: number | null; price_raw: string; description: string | null }
const SECTION_RE = /^[A-Z][A-Z0-9 &\-'’]{2,40}$/
// Accept optional trailing unit like "per lb" / "/lb" / "each" — common on PDF menus.
const ITEM_RE = /^(.+?)\s+\$?\s?(\d{1,3}(?:\.\d{2})?|M\.P\.|MP|market price)(?:\s*(?:\/|per\s+)?(?:lb|oz|pc|pcs|each|ea)\.?)?$/i
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

// --- find any PDF link on the page that looks menu-ish ---
function findMenuPdfs(html: string, base: string): string[] {
  const out = new Set<string>()
  const re = /<a[^>]+href=["']([^"']+\.pdf[^"']*)["'][^>]*>([\s\S]*?)<\/a>/gi
  let m
  while ((m = re.exec(html))) {
    const href = m[1]; const inner = m[2].replace(/<[^>]+>/g,' ').trim().toLowerCase()
    // also accept a link whose URL contains 'menu'
    if (/menu|carte|food|drink|cocktail|wine|dinner|lunch|brunch/i.test(inner) || /menu|carte/i.test(href)) {
      try {
        const u = new URL(href, base)
        if (/^https?:/.test(u.protocol)) out.add(u.href.split('#')[0])
      } catch {}
    }
  }
  return [...out].slice(0, 3)
}

// --- menu-link heuristic for walking to /menu sub-page ---
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
  return [...out].slice(0, 3)
}

const PER_RESTAURANT_TIMEOUT_MS = 45000
function withTimeout<T>(p: Promise<T>, ms: number, fallback: T): Promise<T> {
  return new Promise(resolve => {
    const t = setTimeout(() => resolve(fallback), ms)
    p.then(v => { clearTimeout(t); resolve(v) }).catch(() => { clearTimeout(t); resolve(fallback) })
  })
}

async function tryOneInner(r: { id: string; name: string; website: string }): Promise<{ ok: boolean; items: number; menuUrl: string | null; via: string }> {
  const start = r.website.startsWith('http') ? r.website : 'https://' + r.website
  const root = await getHtml(start)
  if (!root) return { ok: false, items: 0, menuUrl: null, via: 'fetch_failed' }
  const base = root.finalUrl

  // 1a. PDFs linked on root page (often /s/menu.pdf on Squarespace, etc.)
  const rootPdfs = findMenuPdfs(root.html, base)
  for (const p of rootPdfs) {
    const pdf = await getPdfText(p)
    if (!pdf) continue
    const items = extractItems(pdf.text)
    if (items.length >= 3) return await writeItems(r, items, pdf.finalUrl, 'site-pdf')
  }

  // 1. Scan root HTML for provider URLs
  let candidates = rankProviderUrls(findProviderUrls(root.html, base))

  // 2. If none, walk /menu-ish sub-pages and scan those too
  let subScanned = false
  if (candidates.length === 0) {
    const links = findMenuLinksOnSite(root.html, base)
    for (const link of links) {
      // If the link itself points to a PDF, try it directly
      if (/\.pdf($|\?)/i.test(link)) {
        const pdf = await getPdfText(link)
        if (pdf) {
          const items = extractItems(pdf.text)
          if (items.length >= 3) return await writeItems(r, items, pdf.finalUrl, 'menulink-pdf')
        }
        continue
      }
      const sub = await getHtml(link)
      if (!sub) continue
      subScanned = true
      // PDFs linked from this sub-page
      const subPdfs = findMenuPdfs(sub.html, sub.finalUrl)
      for (const p of subPdfs) {
        const pdf = await getPdfText(p)
        if (!pdf) continue
        const items = extractItems(pdf.text)
        if (items.length >= 3) return await writeItems(r, items, pdf.finalUrl, 'sublink-pdf')
      }
      const more = rankProviderUrls(findProviderUrls(sub.html, sub.finalUrl))
      if (more.length) { candidates = more; break }
      // attempt direct text extract from this sub-page
      const subItems = extractItems(htmlToText(sub.html))
      if (subItems.length >= 5) return await writeItems(r, subItems, sub.finalUrl, 'sublink-text')
    }
  }

  if (candidates.length === 0) {
    return { ok: false, items: 0, menuUrl: null, via: subScanned ? 'no_provider_sub' : 'no_provider' }
  }

  // 3. Fetch each candidate, try to extract items. Skip CF-protected hosts.
  for (const c of candidates) {
    if (CF_PROTECTED.has(c.provider)) continue
    const isPdf = /\.pdf(\?|$)/i.test(c.url)
    if (isPdf) {
      const pdf = await getPdfText(c.url)
      if (!pdf) continue
      const items = extractItems(pdf.text)
      if (items.length >= 3) return await writeItems(r, items, pdf.finalUrl, `${c.provider}:pdf`)
      continue
    }
    const page = await getHtml(c.url)
    if (!page) continue
    const items = extractItems(htmlToText(page.html))
    if (items.length >= 3) return await writeItems(r, items, page.finalUrl, `${c.provider}:${c.via}`)
  }

  return { ok: false, items: 0, menuUrl: null, via: 'provider_no_items' }
}

async function tryOne(r: { id: string; name: string; website: string }): Promise<{ ok: boolean; items: number; menuUrl: string | null; via: string }> {
  return withTimeout(tryOneInner(r), PER_RESTAURANT_TIMEOUT_MS, { ok: false, items: 0, menuUrl: null, via: 'timeout' })
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
  const { data: fetched } = await supabase
    .from('restaurant_menu_fetches')
    .select('restaurant_id, status, items_found, source')
    .eq('source', 'website')
  const okIds = new Set((fetched ?? []).filter((f: any) => f.status === 'ok' && f.items_found > 0).map((f: any) => f.restaurant_id))
  const { data: rs } = await supabase.from('restaurants').select('id, name, website').not('website', 'is', null).order('name').limit(10000)
  const todo = (rs ?? []).filter((r: any) => !okIds.has(r.id)).slice(0, limit) as { id: string; name: string; website: string }[]
  console.log(`Provider fallback: ${todo.length} restaurants to try (already ok: ${okIds.size})`)

  let ok = 0, providerHit = 0, noProvider = 0, fetchFail = 0, totalItems = 0
  const byProvider: Record<string, number> = {}
  const parallel = 4
  for (let i = 0; i < todo.length; i += parallel) {
    const batch = todo.slice(i, i + parallel)
    const rs = await Promise.all(batch.map(async r => {
      try { return { r, ...(await tryOne(r)) } } catch (e) { return { r, ok: false, items: 0, menuUrl: null, via: 'error:' + String(e) } }
    }))
    for (const x of rs) {
      if (x.ok) {
        ok++; totalItems += x.items
        const prov = x.via.split(':')[0]
        byProvider[prov] = (byProvider[prov] ?? 0) + 1
        if (!/sublink-text/.test(x.via)) providerHit++
        console.log(`[OK/${x.via}] ${x.r.name} — ${x.items} items`)
      } else if (x.via === 'fetch_failed') { fetchFail++ }
      else if (x.via === 'no_provider' || x.via === 'no_provider_sub') { noProvider++ }
      else console.log(`[FAIL/${x.via}] ${x.r.name}`)
    }
    if ((Math.floor(i / parallel)) % 5 === 0) {
      console.log(`...progress ${i + batch.length}/${todo.length} | ok=${ok} provider_hit=${providerHit} no_provider=${noProvider} fetch_fail=${fetchFail}`)
    }
  }
  console.log(`\nDone. ok=${ok} (provider=${providerHit}), no_provider=${noProvider}, fetch_fail=${fetchFail}, items=${totalItems}`)
  console.log('By provider:', byProvider)
}
main().catch(e => { console.error(e); process.exit(1) })
