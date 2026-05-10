/**
 * Debug v2: try the review-dialog deep link.
 * URL: https://search.google.com/local/reviews?placeid=<ID>
 * This was the pre-2023 "reviews dialog" that exposed a scrollable pane
 * with ~5-reviews-at-a-time that paginates.
 *
 * Also try: headful mode.
 */
import { chromium } from 'playwright'
import fs from 'node:fs'

async function main() {
  const placeId = process.argv[2] || 'ChIJ-fR9ne2KwokRecD0LEllB74'
  const headless = process.argv.includes('--headed') ? false : true
  const urls = [
    `https://search.google.com/local/reviews?placeid=${placeId}&hl=en&gl=us`,
    `https://www.google.com/maps/place/?q=place_id:${placeId}&hl=en`,
  ]
  const browser = await chromium.launch({ headless, args: ['--disable-blink-features=AutomationControlled'] })
  const ctx = await browser.newContext({
    userAgent: 'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/132.0.0.0 Safari/537.36',
    locale: 'en-US',
    viewport: { width: 1280, height: 900 },
  })
  const page = await ctx.newPage()

  for (const url of urls) {
    console.log('--- URL:', url)
    await page.goto(url, { waitUntil: 'domcontentloaded', timeout: 45_000 })
    await page.waitForTimeout(3000)

    for (const sel of ['button:has-text("Accept all")', 'button:has-text("Reject all")', 'button:has-text("Accept")']) {
      try {
        const btn = page.locator(sel).first()
        if (await btn.isVisible({ timeout: 800 })) {
          await btn.click(); await page.waitForTimeout(1500); break
        }
      } catch {}
    }

    console.log('  url-now:', page.url().slice(0, 100))
    const counts = await page.evaluate(() => ({
      dataReviewId: document.querySelectorAll('[data-review-id]').length,
      jftiEf: document.querySelectorAll('.jftiEf').length,
      gws_rd: document.querySelectorAll('[data-async-context]').length,
      allDivs: document.querySelectorAll('div').length,
    }))
    console.log('  counts:', counts)

    // Dump sample of structure
    const sampleTexts = await page.evaluate(() => {
      const out: string[] = []
      const els = Array.from(document.querySelectorAll<HTMLElement>('[data-review-id], .jftiEf, .gws-localreviews__general-reviews-block')).slice(0, 3)
      for (const e of els) out.push((e.textContent || '').slice(0, 150))
      return out
    })
    console.log('  sample texts:', sampleTexts)

    fs.writeFileSync(`/tmp/review_try_${url.includes('local') ? 'local' : 'maps'}.html`, await page.content())
    await page.screenshot({ path: `/tmp/review_try_${url.includes('local') ? 'local' : 'maps'}.png`, fullPage: true })
  }

  await browser.close()
}

main().catch((e) => { console.error(e); process.exit(1) })
