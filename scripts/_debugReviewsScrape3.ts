/**
 * Debug v3: skip consent handling entirely, just wait longer.
 * Hypothesis: the consent click was redirecting us to a different panel.
 */
import { chromium } from 'playwright'

async function main() {
  const placeId = process.argv[2] || 'ChIJ-fR9ne2KwokRecD0LEllB74'
  const url = `https://www.google.com/maps/place/?q=place_id:${placeId}&hl=en`
  const browser = await chromium.launch({ headless: true, args: ['--disable-blink-features=AutomationControlled'] })
  const ctx = await browser.newContext({
    userAgent: 'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/132.0.0.0 Safari/537.36',
    locale: 'en-US',
    viewport: { width: 1280, height: 900 },
    extraHTTPHeaders: { 'accept-language': 'en-US,en;q=0.9' },
  })
  const page = await ctx.newPage()
  await page.goto(url, { waitUntil: 'domcontentloaded', timeout: 45_000 })
  console.log('url-now:', page.url())

  // WITHOUT consent click, just wait and check
  for (let t = 1; t <= 15; t++) {
    await page.waitForTimeout(1000)
    const n = await page.evaluate(() => document.querySelectorAll('[data-review-id]').length)
    const consentVisible = await page.evaluate(() => {
      const btns = document.querySelectorAll<HTMLElement>('button')
      return Array.from(btns).some((b) => /accept|reject/i.test(b.textContent || ''))
    })
    console.log(`  t=${t}s: data-review-id=${n}, consent-buttons-present=${consentVisible}, url=${page.url().slice(0, 80)}`)
    if (n > 0) break
  }

  // Try scrolling the feed now
  for (let pass = 0; pass < 8; pass++) {
    const res = await page.evaluate(() => {
      const feed = document.querySelector<HTMLElement>('div[role="feed"]')
      if (!feed) return { scrolled: false, n: document.querySelectorAll('[data-review-id]').length, reason: 'no-feed' }
      const before = feed.scrollTop
      feed.scrollBy({ top: 2400, behavior: 'instant' as ScrollBehavior })
      return { scrolled: feed.scrollTop !== before, n: document.querySelectorAll('[data-review-id]').length, reason: 'scrolled' }
    })
    console.log(`  scroll-pass ${pass}: ${res.reason} scrolled=${res.scrolled} n=${res.n}`)
    await page.waitForTimeout(1000)
  }

  // Expand "More"
  const moreClicks = await page.evaluate(() => {
    const btns = Array.from(document.querySelectorAll<HTMLElement>('button[aria-label="See more"], button.w8nwRe.kyuRq'))
    for (const b of btns) b.click()
    return btns.length
  })
  console.log('expanded More buttons:', moreClicks)
  await page.waitForTimeout(1000)

  // Sample one review
  const sample = await page.evaluate(() => {
    const cards = Array.from(document.querySelectorAll<HTMLElement>('[data-review-id]'))
    return {
      total: cards.length,
      samples: cards.slice(0, 3).map((c) => {
        const textEl = c.querySelector<HTMLElement>('.wiI7pd, .MyEned')
        return {
          id: c.getAttribute('data-review-id')?.slice(0, 20),
          textLen: (textEl?.textContent || '').length,
          text: (textEl?.textContent || '').slice(0, 200),
        }
      }),
    }
  })
  console.log('SAMPLE:', JSON.stringify(sample, null, 2))

  await browser.close()
}

main().catch((e) => { console.error(e); process.exit(1) })
