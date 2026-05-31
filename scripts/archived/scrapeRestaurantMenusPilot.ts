/**
 * Pilot restaurant menu + hero photo scraper.
 * Fetches each restaurant's website, finds hero OG image, extracts menu items
 * (name + price from plain text), follows "menu" sub-links if home page is bare,
 * and writes to restaurant_menu_items / restaurant_photos / restaurant_menu_fetches.
 *
 * Token-efficient: emits compact per-restaurant summary only.
 *
 * Usage:
 *   npx tsx scripts/scrapeRestaurantMenusPilot.ts [--limit=20] [--ids=a,b,c]
 */

import { createClient } from '@supabase/supabase-js'
import * as fs from 'fs'
import * as path from 'path'

// --- env bootstrap ---
const envPath = path.join(process.cwd(), '.env.local')
if (fs.existsSync(envPath)) {
  for (const line of fs.readFileSync(envPath, 'utf8').split('\n')) {
    const m = line.match(/^([A-Z0-9_]+)=(.*)$/)
    if (m && !process.env[m[1]]) process.env[m[1]] = m[2].replace(/^"|"$/g, '')
  }
}

const SUPA_URL = process.env.NEXT_PUBLIC_SUPABASE_URL!
const SUPA_ANON = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!
if (!SUPA_URL || !SUPA_ANON) {
  console.error('Missing Supabase env'); process.exit(1)
}
const supabase = createClient(SUPA_URL, SUPA_ANON, { auth: { persistSession: false } })

// --- args ---
const args = Object.fromEntries(process.argv.slice(2).map(a => {
  const [k, v] = a.replace(/^--/, '').split('=')
  return [k, v ?? 'true']
})) as Record<string, string>
const limit = Number(args.limit ?? '20')
const idFilter = args.ids?.split(',').map(s => s.trim()).filter(Boolean)

// --- html → text ---
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
      .replace(/<noscript[\s\S]*?<\/noscript>/gi, ' ')
      .replace(/<(br|hr)\s*\/?>/gi, '\n')
      .replace(/<\/(p|div|li|tr|h[1-6]|section|article|header|footer)>/gi, '\n')
      .replace(/<[^>]+>/g, ' ')
  ).replace(/\u00a0/g, ' ').replace(/[ \t]+/g, ' ').replace(/\n[ \t]+/g, '\n').replace(/\n{2,}/g, '\n').trim()
}

// --- politeness: per-host throttle + 429/5xx backoff ---
const HOST_MIN_GAP_MS = 1500 // at least 1.5s between requests to same host
const lastHitByHost = new Map<string, number>()
const hostLocks = new Map<string, Promise<void>>()
function sleep(ms: number): Promise<void> { return new Promise(r => setTimeout(r, ms)) }
async function politeWait(host: string): Promise<void> {
  // serialize per-host to enforce min gap even under parallelism
  const prev = hostLocks.get(host) ?? Promise.resolve()
  let release!: () => void
  const p = new Promise<void>(r => { release = r })
  hostLocks.set(host, prev.then(() => p))
  await prev
  const last = lastHitByHost.get(host) ?? 0
  const wait = Math.max(0, HOST_MIN_GAP_MS - (Date.now() - last))
  if (wait > 0) await sleep(wait + Math.random() * 250) // jitter
  lastHitByHost.set(host, Date.now())
  // release after a tick so next waiter picks up Date.now
  queueMicrotask(release)
}

async function getHtml(url: string, timeoutMs = 15000, attempt = 0): Promise<{html: string, finalUrl: string} | null> {
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
        'User-Agent': 'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 Gastronome-Pilot/0.1 (+dakai.research@gmail.com)',
        'Accept': 'text/html,*/*;q=0.9',
        'Accept-Language': 'en-US,en;q=0.9',
      },
    })
    clearTimeout(t)
    if (res.status === 429 || res.status === 503) {
      const retryAfter = Number(res.headers.get('retry-after')) || 0
      const waitMs = Math.max(retryAfter * 1000, 4000 * Math.pow(2, attempt))
      if (attempt < 2) { await sleep(waitMs); return getHtml(url, timeoutMs, attempt + 1) }
      console.warn(`[rate-limit] giving up on ${host} after ${attempt + 1} tries`)
      return null
    }
    if (res.status >= 500 && res.status < 600 && attempt < 1) {
      await sleep(2000 + Math.random() * 1000)
      return getHtml(url, timeoutMs, attempt + 1)
    }
    if (!res.ok) return null
    const html = await res.text()
    return { html, finalUrl: res.url }
  } catch { return null }
}

// --- hero + menu-link extraction ---
function extractHero(html: string, base: string): string | null {
  const m1 = html.match(/<meta[^>]+property=["']og:image["'][^>]+content=["']([^"']+)["']/i)
    || html.match(/<meta[^>]+content=["']([^"']+)["'][^>]+property=["']og:image["']/i)
  if (m1) return absUrl(m1[1], base)
  const m2 = html.match(/<meta[^>]+name=["']twitter:image["'][^>]+content=["']([^"']+)["']/i)
  if (m2) return absUrl(m2[1], base)
  return null
}
function absUrl(href: string, base: string): string {
  try { return new URL(href, base).href } catch { return href }
}
function findMenuLinks(html: string, base: string): string[] {
  const out = new Set<string>()
  const re = /<a[^>]+href=["']([^"']+)["'][^>]*>([\s\S]*?)<\/a>/gi
  let m
  while ((m = re.exec(html))) {
    const href = m[1]; const inner = m[2].replace(/<[^>]+>/g, ' ').trim().toLowerCase()
    if (!href) continue
    const lh = href.toLowerCase()
    const looksMenuUrl = /(^|[\/\?#])(menu|menus|food|dinner|lunch|brunch|carte)(s?)([\/\?#&=]|$)/.test(lh)
    const looksMenuText = /\b(menu|menus|dinner|lunch|brunch|food)\b/.test(inner) && inner.length < 40
    if (looksMenuUrl || looksMenuText) {
      try {
        const u = new URL(href, base)
        if (/^https?:/.test(u.protocol)) out.add(u.href.split('#')[0])
      } catch {}
    }
  }
  return [...out].slice(0, 8)
}

// --- menu item extraction from text ---
type Item = { name: string; section: string | null; price_cents: number | null; price_raw: string; description: string | null }
const SECTION_RE = /^[A-Z][A-Z0-9 &\-'’]{2,40}$/
const ITEM_RE = /^(.+?)\s+\$?\s?(\d{1,3}(?:\.\d{2})?|M\.P\.|MP|market price)$/i
const NOISE_PREFIX = /^(add|sub|substitute|choice of|includes|served with|comes with|add-on|slide\s*\d)/i
// "25 •" style broken price-as-name tokens, bullets-only, numeric-only
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
    // letters must dominate the name (reject tasting-note lines with tons of punctuation)
    const letters = (name.match(/[A-Za-z]/g) || []).length
    if (letters < 3 || letters / name.length < 0.4) continue
    // skip long names with 3+ commas (wine tasting notes)
    if (name.length > 45 && (name.match(/,/g) || []).length >= 3) continue
    if (/^\d+$/.test(name)) continue
    // price cannot be "ounce" e.g. 13oz, 8oz
    if (/^\d+\s*oz\.?$/i.test(line)) continue
    let cents: number | null = null
    if (/^\d/.test(priceRaw)) cents = Math.round(parseFloat(priceRaw) * 100)
    if (cents !== null && cents < 300) continue // likely side/add-on price misfire
    if (cents !== null && cents > 50000) continue
    const next = lines[i + 1]
    const desc = next && !ITEM_RE.test(next) && !SECTION_RE.test(next) && next.length <= 300 ? next : null
    items.push({ name, section, price_cents: cents, price_raw: priceRaw, description: desc })
  }
  const seen = new Set<string>(); const out: Item[] = []
  for (const it of items) { const k = it.name.toLowerCase(); if (seen.has(k)) continue; seen.add(k); out.push(it) }
  return out
}

// --- per-restaurant pipeline ---
type Result = { id: string; name: string; website: string; status: string; items: number; photo: string | null; menu_url: string | null; error?: string }

async function scrapeOne(r: { id: string; name: string; website: string }): Promise<Result> {
  const start = r.website.startsWith('http') ? r.website : 'https://' + r.website
  const root = await getHtml(start)
  if (!root) return { id: r.id, name: r.name, website: r.website, status: 'fetch_failed', items: 0, photo: null, menu_url: null, error: 'root fetch failed' }
  const base = root.finalUrl
  const hero = extractHero(root.html, base)
  const rootText = htmlToText(root.html)
  let items = extractItems(rootText)
  let menuUrl: string | null = items.length >= 3 ? base : null

  // fallback: follow up to 3 menu sublinks
  if (items.length < 3) {
    const sublinks = findMenuLinks(root.html, base)
    for (const link of sublinks.slice(0, 3)) {
      const sub = await getHtml(link)
      if (!sub) continue
      const subItems = extractItems(htmlToText(sub.html))
      if (subItems.length > items.length) {
        items = subItems; menuUrl = sub.finalUrl
        if (subItems.length >= 8) break
      }
    }
  }

  // write photos
  if (hero) {
    await supabase.from('restaurants').update({ website_photo_url: hero, updated_at: new Date().toISOString() }).eq('id', r.id)
    await supabase.from('restaurant_photos').upsert(
      { restaurant_id: r.id, photo_url: hero, source: 'website', source_url: base, is_primary: true, sort_order: 0 },
      { onConflict: 'restaurant_id,photo_url' },
    )
  }
  // write items
  if (items.length) {
    const rows = items.map(it => ({
      restaurant_id: r.id,
      item_name: it.name.slice(0, 120),
      section: it.section,
      price_cents: it.price_cents,
      price_raw: it.price_raw.slice(0, 40),
      description: it.description,
      source: 'website',
      source_url: menuUrl,
    }))
    // chunked insert (conflict-ignore via delete+insert not available; use ignoreDuplicates)
    for (let i = 0; i < rows.length; i += 50) {
      const slice = rows.slice(i, i + 50)
      const { error } = await supabase.from('restaurant_menu_items').upsert(slice, { onConflict: 'restaurant_id,item_name,source', ignoreDuplicates: true })
      if (error) console.error('upsert items', r.name, error.message)
    }
  }
  // log fetch
  await supabase.from('restaurant_menu_fetches').insert({
    restaurant_id: r.id,
    source: 'website',
    source_url: base,
    menu_url: menuUrl,
    status: items.length > 0 ? 'ok' : 'no_items',
    items_found: items.length,
  })

  return { id: r.id, name: r.name, website: r.website, status: items.length > 0 ? 'ok' : 'no_items', items: items.length, photo: hero, menu_url: menuUrl }
}

// --- main ---
async function main() {
  let q = supabase.from('restaurants').select('id, name, website').not('website', 'is', null).order('name')
  if (idFilter?.length) q = q.in('id', idFilter)
  else q = q.limit(limit)
  const { data, error } = await q
  if (error) { console.error(error); process.exit(1) }
  const rows = (data ?? []) as { id: string; name: string; website: string }[]
  console.log(`Scraping ${rows.length} restaurants...`)

  const results: Result[] = []
  // small parallelism
  const parallel = 4
  for (let i = 0; i < rows.length; i += parallel) {
    const batch = rows.slice(i, i + parallel)
    const rs = await Promise.all(batch.map(r => scrapeOne(r).catch(e => ({ id: r.id, name: r.name, website: r.website, status: 'error', items: 0, photo: null, menu_url: null, error: String(e) }))))
    for (const r of rs) {
      const tag = r.status === 'ok' ? 'OK' : r.status.toUpperCase()
      console.log(`[${tag}] ${r.name} — ${r.items} items${r.photo ? ' + photo' : ''}${r.error ? ' — ' + r.error : ''}`)
      results.push(r)
    }
  }
  const ok = results.filter(r => r.status === 'ok').length
  const noItems = results.filter(r => r.status === 'no_items').length
  const failed = results.length - ok - noItems
  const withPhoto = results.filter(r => r.photo).length
  console.log(`\nSummary: ${ok} ok, ${noItems} no_items, ${failed} failed | ${withPhoto}/${results.length} with hero photo`)
  console.log(`Total items: ${results.reduce((a, r) => a + r.items, 0)}`)
  // write compact json for inspection
  fs.mkdirSync('tmp', { recursive: true })
  fs.writeFileSync('tmp/menu-pilot-results.json', JSON.stringify(results, null, 2))
  console.log('Wrote tmp/menu-pilot-results.json')
}
main().catch(e => { console.error(e); process.exit(1) })
