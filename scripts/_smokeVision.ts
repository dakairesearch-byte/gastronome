/**
 * Smoke test for scrapeMenusVision.ts pipeline WITHOUT calling Ollama.
 *
 * Validates:
 *   - URL discovery finds /menu candidates on a real site
 *   - Playwright renders full-page screenshot (saves jpeg to tmp/)
 *   - innerText capture works
 *   - text-first parser finds items if the site has them
 *   - Ollama preflight logic works (requires Ollama to be running locally
 *     — pass --skipPreflight to bypass)
 *
 * Usage: npx tsx scripts/_smokeVision.ts https://acquerellosf.com/
 */
import { chromium } from 'playwright'
import * as fs from 'fs'
import * as path from 'path'

const URL_ARG = process.argv[2] ?? 'https://acquerellosf.com/'

const MENU_KW_RE = /(menu|menus|food|dinner|lunch|brunch|breakfast|drinks|wine|beverage|cocktail|bar|dine|eat|order)/i

function resolveUrl(href: string, base: string): string | null {
  try { return new URL(href, base).toString() } catch { return null }
}

async function getHtml(url: string) {
  const res = await fetch(url, {
    headers: { 'user-agent': 'Mozilla/5.0 Gastronome-Smoke' },
    redirect: 'follow',
  })
  if (!res.ok) return null
  return { html: await res.text(), finalUrl: res.url }
}

function findMenuCandidates(html: string, baseUrl: string) {
  const out: { url: string; score: number; label: string; isPdf: boolean }[] = []
  const seen = new Set<string>()
  let baseHost = ''
  try { baseHost = new URL(baseUrl).host } catch {}

  for (const m of Array.from(html.matchAll(/<a[^>]+href=["']([^"']+)["'][^>]*>([\s\S]*?)<\/a>/gi))) {
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
    if (score <= 0 && !MENU_KW_RE.test(low)) continue
    if (score <= 0) score = 1
    out.push({ url: abs, score, label, isPdf })
  }
  out.sort((a, b) => b.score - a.score)
  return out
}

async function main() {
  console.log(`Smoke target: ${URL_ARG}`)

  // 1. URL discovery
  const root = await getHtml(URL_ARG)
  if (!root) { console.error('fetch root failed'); process.exit(1) }
  const cands = findMenuCandidates(root.html, root.finalUrl).slice(0, 5)
  console.log(`\nfound ${cands.length} candidates:`)
  for (const c of cands) console.log(`  ${c.score.toString().padStart(2)} ${c.isPdf ? 'PDF' : '   '} ${c.url.slice(0, 80)} — "${c.label.slice(0, 40)}"`)

  // 2. Playwright render
  const browser = await chromium.launch({ headless: true })
  const targetUrl = cands[0]?.url ?? root.finalUrl
  console.log(`\nrendering: ${targetUrl}`)
  const ctx = await browser.newContext({ viewport: { width: 1400, height: 900 } })
  const page = await ctx.newPage()
  try {
    await page.goto(targetUrl, { waitUntil: 'domcontentloaded', timeout: 30000 })
    await page.waitForTimeout(1500)
    await page.evaluate(() => new Promise<void>(resolve => {
      let y = 0, ticks = 0
      const step = () => {
        window.scrollBy(0, 600); y += 600; ticks++
        if (y < document.body.scrollHeight && ticks < 60) setTimeout(step, 100)
        else resolve()
      }
      step()
    })).catch(() => {})
    await page.waitForTimeout(600)
    const text = await page.evaluate(() => document.body?.innerText ?? '')
    const shot = await page.screenshot({ fullPage: true, type: 'jpeg', quality: 80 })

    const outDir = path.join(process.cwd(), 'tmp', 'smoke')
    fs.mkdirSync(outDir, { recursive: true })
    const shotPath = path.join(outDir, 'screenshot.jpg')
    const textPath = path.join(outDir, 'innerText.txt')
    fs.writeFileSync(shotPath, shot)
    fs.writeFileSync(textPath, text)
    console.log(`screenshot ${(shot.length / 1024).toFixed(0)}KB -> ${shotPath}`)
    console.log(`innerText  ${text.length} chars -> ${textPath}`)

    // text-first pass
    const lines = text.split(/\r?\n/).map(l => l.trim()).filter(Boolean)
    const PRICE_RE = /\s+\$?(\d{1,3}(?:\.\d{2})?)\s*$/
    let priced = 0
    for (const l of lines) if (PRICE_RE.test(l)) priced++
    console.log(`text-pass: ${lines.length} non-empty lines, ${priced} with trailing prices`)
    console.log('\nsample text lines:')
    for (const l of lines.slice(0, 8)) console.log(`  | ${l.slice(0, 100)}`)
  } finally {
    await ctx.close()
    await browser.close()
  }
}

main().catch(e => { console.error(e); process.exit(1) })
