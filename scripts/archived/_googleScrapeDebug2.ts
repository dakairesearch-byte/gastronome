/**
 * Debug v2: try different URL patterns and interactions to get the Reviews
 * tab + chip row to render.
 */
import { chromium } from 'playwright'

async function tryOne(url: string, label: string) {
  const browser = await chromium.launch({ headless: true })
  const ctx = await browser.newContext({
    userAgent:
      'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/124.0.0.0 Safari/537.36',
    locale: 'en-US',
    viewport: { width: 1440, height: 1200 },
  })
  const page = await ctx.newPage()
  console.log(`\n=== ${label} ===`)
  console.log('Goto:', url)
  try {
    await page.goto(url, { waitUntil: 'domcontentloaded', timeout: 30_000 })
  } catch (e) {
    console.log('NAV FAIL:', (e as Error).message)
    await browser.close()
    return
  }

  // Dismiss consent
  for (const sel of [
    'button:has-text("Accept all")',
    'button:has-text("I agree")',
    'button:has-text("Accept")',
    'form[action*="consent"] button',
  ]) {
    try {
      const btn = page.locator(sel).first()
      if (await btn.isVisible({ timeout: 800 })) {
        await btn.click({ timeout: 1500 })
        await page.waitForTimeout(1200)
        break
      }
    } catch {}
  }
  await page.waitForTimeout(2500)

  // Try to click Reviews tab with many candidates
  const reviewsSelectors = [
    'button[aria-label^="Reviews for"]',
    'button[data-tab-index="1"]',
    '[role="tab"][aria-label*="Reviews"]',
    'button:has-text("Reviews")',
  ]
  let clickedReviews = false
  for (const sel of reviewsSelectors) {
    try {
      const loc = page.locator(sel).first()
      if (await loc.isVisible({ timeout: 1500 })) {
        console.log('  clicking reviews selector:', sel)
        await loc.click({ timeout: 2000 })
        clickedReviews = true
        await page.waitForTimeout(2500)
        break
      }
    } catch {}
  }
  console.log('  clickedReviews:', clickedReviews)

  // Count chips
  const chipCount = await page.evaluate(() => {
    return document.querySelectorAll('[aria-label*="reviews mention"], [aria-label*="review mention"]').length
  })
  console.log('  chip elements in DOM:', chipCount)

  // Dump all aria-labels containing "review"
  const labels = await page.evaluate(() => {
    return Array.from(document.querySelectorAll('[aria-label]'))
      .map((e) => e.getAttribute('aria-label') || '')
      .filter((l) => /review/i.test(l))
      .slice(0, 20)
  })
  console.log('  review-labels sample:', labels)

  // Look at data-tab-index values present
  const tabIndices = await page.evaluate(() => {
    return Array.from(document.querySelectorAll('[data-tab-index]'))
      .map((e) => ({ idx: e.getAttribute('data-tab-index'), label: e.getAttribute('aria-label') || (e.textContent || '').trim().slice(0, 50) }))
  })
  console.log('  tab indices found:', tabIndices)

  await page.screenshot({ path: `/tmp/gmaps_${label}.png`, fullPage: false })
  await browser.close()
}

async function main() {
  const placeId = 'ChIJCar0f49ZwokR6ozLV-dHNTE' // Katz's
  await tryOne(`https://www.google.com/maps/place/?q=place_id:${placeId}`, 'v1-place-q')
  await tryOne(`https://www.google.com/maps/search/?api=1&query=Katz%27s+Delicatessen&query_place_id=${placeId}`, 'v2-search')
  await tryOne(`https://www.google.com/maps?cid=3545819340560108778`, 'v3-cid')
}

main().catch((e) => { console.error(e); process.exit(1) })
