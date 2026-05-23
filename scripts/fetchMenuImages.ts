/**
 * Menu scraper v2.2 — image fetcher for direct-vision transcription.
 *
 * Distilled from scrapeMenusOCR.ts: does the discovery + download steps only,
 * leaves transcription to Claude's direct vision (Read tool on JPG/PNG).
 *
 * Input:  --ids=a,b,c[,...]   (restaurant UUIDs; required)
 *         --imageBudget=4     (max images per restaurant, default 4)
 *         --outDir=/tmp/vision (where per-restaurant folders get written)
 *
 * Output: one JSON manifest on stdout describing what was downloaded per
 * restaurant, AND files at ${outDir}/<restaurant_id>/img-{n}.jpg.
 *
 * Manifest shape:
 *   [{
 *     id, name, website,
 *     pages_visited: number,
 *     images: [{ path, url, score, reason, w, h, alt }],
 *     status: 'ok' | 'no_images' | 'fetch_failed',
 *   }, ...]
 */

import { createClient } from '@supabase/supabase-js'
import type { Database } from '../src/types/database'
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
const supabase = createClient<Database>(SUPA_URL, SUPA_KEY, { auth: { persistSession: false } })

// ---------- args ----------

const rawArgs = Object.fromEntries(
  process.argv.slice(2).map(a => {
    const [k, v] = a.replace(/^--/, '').split('=')
    return [k, v ?? 'true']
  }),
) as Record<string, string>

const IDS = (rawArgs.ids ?? '').split(',').map(s => s.trim()).filter(Boolean)
const IMAGE_BUDGET = Number(rawArgs.imageBudget ?? '4')
const OUT_DIR = rawArgs.outDir ?? '/tmp/vision'

if (!IDS.length) { console.error('--ids=<csv> required'); process.exit(1) }

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

const UA = 'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 Gastronome-Scraper/2.2-Vision (+dakai.research@gmail.com)'

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

async function downloadImage(url: string, outPath: string, timeoutMs = 20000, maxBytes = 5_000_000): Promise<{ ok: boolean; bytes: number; ct: string | null }> {
  let host = ''
  try { host = new URL(url).host } catch { return { ok: false, bytes: 0, ct: null } }
  await politeWait(host)
  try {
    const ctl = new AbortController()
    const t = setTimeout(() => ctl.abort(), timeoutMs)
    const res = await fetch(url, { signal: ctl.signal, headers: { 'user-agent': UA }, redirect: 'follow' })
    clearTimeout(t)
    if (!res.ok) return { ok: false, bytes: 0, ct: null }
    const ct = res.headers.get('content-type') ?? ''
    if (!/image\//i.test(ct)) return { ok: false, bytes: 0, ct }
    const buf = Buffer.from(await res.arrayBuffer())
    if (buf.length > maxBytes) return { ok: false, bytes: buf.length, ct }
    fs.writeFileSync(outPath, buf)
    return { ok: true, bytes: buf.length, ct }
  } catch { return { ok: false, bytes: 0, ct: null } }
}

// ---------- image discovery (copied from scrapeMenusOCR) ----------

type ImageCandidate = { url: string; score: number; w: number | null; h: number | null; alt: string; reason: string }

function resolveUrl(href: string, base: string): string | null {
  try { return new URL(href, base).toString() } catch { return null }
}

function findImageCandidates(html: string, baseUrl: string): ImageCandidate[] {
  const out: ImageCandidate[] = []
  const seen = new Set<string>()
  for (const m of html.matchAll(/<img[^>]+>/gi)) {
    const tag = m[0]
    const srcM = /(?:data-src|data-image|srcset|src)=["']([^"']+)["']/i.exec(tag)
    if (!srcM) continue
    let src = srcM[1]
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
    if (/\.(svg|gif)(\?|$)/i.test(abs)) { score -= 5; reasons.push('non-static') }

    if (score <= 0) continue
    out.push({ url: abs, score, w, h, alt, reason: reasons.join('+') })
  }
  out.sort((a, b) => b.score - a.score)
  return out
}

function prepDownloadUrl(url: string): string {
  // Upgrade Squarespace-cdn URL to a large render
  if (/images\.squarespace-cdn\.com/i.test(url)) {
    const u = new URL(url)
    u.searchParams.set('format', '1500w')
    return u.toString()
  }
  // Upgrade Wix static URLs (strip the small fill/fit params at the end)
  if (/static\.wixstatic\.com.*\/w_\d+/i.test(url)) {
    return url.replace(/\/w_\d+,h_\d+[^/]*\//, '/')
  }
  return url
}

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

// ---------- main ----------

type Manifest = {
  id: string
  name: string
  website: string
  pages_visited: number
  images: Array<{ path: string; url: string; score: number; reason: string; w: number | null; h: number | null; alt: string; bytes: number }>
  status: 'ok' | 'no_images' | 'fetch_failed' | 'no_website'
}

async function fetchFor(r: { id: string; name: string; website: string | null }): Promise<Manifest> {
  const manifest: Manifest = { id: r.id, name: r.name, website: r.website ?? '', pages_visited: 0, images: [], status: 'no_website' }
  if (!r.website) return manifest

  const pages = await discoverMenuPages(r.website)
  manifest.pages_visited = pages.length

  const allCands: ImageCandidate[] = []
  for (const p of pages) {
    const page = await getHtml(p)
    if (!page) continue
    for (const c of findImageCandidates(page.html, page.finalUrl)) {
      if (!allCands.find(x => x.url === c.url)) allCands.push(c)
    }
  }
  allCands.sort((a, b) => b.score - a.score)

  if (allCands.length === 0) { manifest.status = 'no_images'; return manifest }

  const outDir = path.join(OUT_DIR, r.id)
  fs.mkdirSync(outDir, { recursive: true })

  let n = 0
  for (const cand of allCands.slice(0, IMAGE_BUDGET * 2)) { // try 2x budget, keep first N successful
    if (manifest.images.length >= IMAGE_BUDGET) break
    n++
    const outPath = path.join(outDir, `img-${n}.jpg`)
    const res = await downloadImage(prepDownloadUrl(cand.url), outPath)
    if (!res.ok) continue
    manifest.images.push({
      path: outPath, url: cand.url, score: cand.score, reason: cand.reason,
      w: cand.w, h: cand.h, alt: cand.alt, bytes: res.bytes,
    })
  }

  manifest.status = manifest.images.length > 0 ? 'ok' : 'fetch_failed'
  return manifest
}

async function main() {
  const { data, error } = await supabase
    .from('restaurants')
    .select('id, name, website')
    .in('id', IDS)
  if (error) { console.error(error); process.exit(1) }
  const restaurants = data!

  fs.mkdirSync(OUT_DIR, { recursive: true })
  const manifests: Manifest[] = []
  for (const r of restaurants) {
    try {
      process.stderr.write(`Fetching ${r.name}...\n`)
      const m = await fetchFor(r)
      manifests.push(m)
      process.stderr.write(`  ${m.status} — ${m.images.length}/${IMAGE_BUDGET} images, ${m.pages_visited} pages\n`)
    } catch (err) {
      process.stderr.write(`  FAILED: ${err instanceof Error ? err.message : err}\n`)
    }
  }

  console.log(JSON.stringify(manifests, null, 2))
}

main().catch(e => { console.error(e); process.exit(1) })
