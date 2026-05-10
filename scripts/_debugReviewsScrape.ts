/**
 * Debug script for the Google Maps reviews scraper. Takes screenshots
 * and dumps the DOM state at key checkpoints so we can see why selectors
 * are missing reviews.
 */
import { chromium } from 'playwright'
import fs from 'node:fs'
import path from 'node:path'

const OUT = '/tmp/gmaps_debug'
fs.mkdirSync(OUT, { recursive: true })

async function main() {
  const placeId = process.argv[2] || 'ChIJdd0-QaFmwokRaNmZsPtCZ5M' // Tony's Beechhurst
  const url = `https://www.google.com/maps/place/?q=place_id:${placeId}&hl=en`
  console.log('url:', url)

  const browser = await chromium.launch({
    headless: true,
    args: ['--disable-blink-features=AutomationControlled'],
  })
  const ctx = await browser.newContext({
    userAgent:
      'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/132.0.0.0 Safari/537.36',
    locale: 'en-US',
    viewport: { width: 1280, height: 900 },
    extraHTTPHeaders: { 'accept-language': 'en-US,en;q=0.9' },
  })
  const page = await ctx.newPage()
  page.setDefaultTimeout(45_000)
  await page.goto(url, { waitUntil: 'domcontentloaded' })
  await page.waitForTimeout(3000)

  // Dismiss consent
  for (const sel of [
    'button:has-text("Accept all")',
    'button:has-text("Reject all")',
    'button:has-text("Accept")',
    'form[action*="consent"] button',
  ]) {
    try {
      const btn = page.locator(sel).first()
      if (await btn.isVisible({ timeout: 1500 })) {
        await btn.click()
        console.log('[consent] clicked', sel)
        await page.waitForTimeout(2000)
        break
      }
    } catch {}
  }

  await page.screenshot({ path: path.join(OUT, '01_landed.png'), fullPage: true })
  console.log('[url-after-landed]', page.url())

  // Try to click "Reviews" tab. Enumerate candidates and pick one visible.
  const candidates = await page.evaluate(() => {
    const all = Array.from(document.querySelectorAll<HTMLElement>('button, [role="tab"]'))
    return all
      .map((e, i) => ({
        i,
        text: (e.textContent || '').trim().slice(0, 60),
        aria: e.getAttribute('aria-label') || '',
        tabIdx: e.getAttribute('data-tab-index') || '',
      }))
      .filter((x) => /review/i.test(x.text) || /review/i.test(x.aria))
      .slice(0, 20)
  })
  console.log('[review-ish buttons]:', candidates)

  // Click the first button matching "Reviews"
  const rSel = 'button[aria-label^="Reviews for"], button[role="tab"]:has-text("Reviews"), [role="tab"]:has-text("Reviews"), button:has-text("Reviews")'
  try {
    const r = page.locator(rSel).first()
    if (await r.isVisible({ timeout: 3000 })) {
      await r.click()
      console.log('[reviews-tab] clicked')
    } else {
      console.log('[reviews-tab] not visible')
    }
  } catch (e) {
    console.log('[reviews-tab] err', (e as Error).message)
  }
  await page.waitForTimeout(3000)
  await page.screenshot({ path: path.join(OUT, '02_reviews_tab.png'), fullPage: true })

  // Dump review-element counts via several selectors
  const counts = await page.evaluate(() => {
    return {
      dataReviewId: document.querySelectorAll('[data-review-id]').length,
      feed: document.querySelectorAll('div[role="feed"]').length,
      wiI7pd: document.querySelectorAll('.wiI7pd').length,
      MyEned: document.querySelectorAll('.MyEned').length,
      jftiEf: document.querySelectorAll('.jftiEf').length,
      m6QErb: document.querySelectorAll('.m6QErb').length,
      jANrlb: document.querySelectorAll('.jANrlb').length,
      stars: document.querySelectorAll('[aria-label*="star" i]').length,
    }
  })
  console.log('[pre-scroll counts]:', counts)

  // Scroll attempts — try several scroll targets
  const scrollTargets = [
    'div[role="feed"]',
    '.m6QErb.DxyBCb.kA9KIf.dS8AEf',
    '.m6QErb[role="main"]',
    '[aria-label*="Reviews" i]',
  ]
  for (let pass = 0; pass < 8; pass++) {
    const scrolled = await page.evaluate((targets) => {
      for (const sel of targets) {
        const el = document.querySelector<HTMLElement>(sel)
        if (el) {
          const before = el.scrollTop
          el.scrollBy({ top: 2400, behavior: 'instant' as ScrollBehavior })
          if (el.scrollTop !== before) return sel
        }
      }
      return null
    }, scrollTargets)
    const n = await page.evaluate(() => document.querySelectorAll('[data-review-id]').length)
    console.log(`  pass ${pass}: scrolled via=${scrolled || '<none>'}, data-review-id=${n}`)
    await page.waitForTimeout(1000)
  }
  await page.screenshot({ path: path.join(OUT, '03_after_scroll.png'), fullPage: true })

  // Final inspection: dump first 3 review-ish blocks' HTML
  const sample = await page.evaluate(() => {
    const els = Array.from(document.querySelectorAll<HTMLElement>('[data-review-id]')).slice(0, 3)
    return els.map((e) => ({
      id: e.getAttribute('data-review-id'),
      textLen: (e.textContent || '').length,
      first200: (e.textContent || '').trim().slice(0, 200),
      outerHTML: e.outerHTML.slice(0, 1000),
    }))
  })
  console.log('[sample]', JSON.stringify(sample, null, 2))

  // Save page HTML for offline inspection
  fs.writeFileSync(path.join(OUT, 'page.html'), await page.content())
  console.log('[saved]', OUT)

  await browser.close()
}

main().catch((e) => { console.error(e); process.exit(1) })
