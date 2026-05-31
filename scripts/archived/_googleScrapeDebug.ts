/**
 * Debug: launch Google Maps for Katz's and dump what's on the page so we can
 * figure out why the chip scraper returns 0.
 */
import { chromium } from 'playwright'

async function main() {
  const placeId = process.argv[2] || 'ChIJCar0f49ZwokR6ozLV-dHNTE'
  const url = `https://www.google.com/maps/place/?q=place_id:${placeId}`
  const browser = await chromium.launch({ headless: true })
  const ctx = await browser.newContext({
    userAgent:
      'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/124.0.0.0 Safari/537.36',
    locale: 'en-US',
    viewport: { width: 1280, height: 900 },
  })
  const page = await ctx.newPage()
  console.log('Goto:', url)
  await page.goto(url, { waitUntil: 'domcontentloaded', timeout: 30_000 })
  await page.waitForTimeout(3000)
  const title1 = await page.title()
  console.log('After domcontentloaded, title:', title1)

  // Try dismiss consent
  const candidates = [
    'button:has-text("Accept all")',
    'button:has-text("I agree")',
    'button:has-text("Accept")',
    'button[aria-label*="Accept"]',
    'button[aria-label*="Reject"]',
  ]
  for (const sel of candidates) {
    try {
      const btn = page.locator(sel).first()
      if (await btn.isVisible({ timeout: 1_000 })) {
        console.log('  clicking consent:', sel)
        await btn.click({ timeout: 2_000 })
        await page.waitForTimeout(1500)
        break
      }
    } catch {}
  }

  await page.waitForTimeout(2500)
  const title2 = await page.title()
  const urlNow = page.url()
  console.log('After consent, title:', title2, 'url:', urlNow)

  // Count all buttons with "Reviews" text
  const reviewsBtns = await page.$$eval('button, [role="tab"], [role="button"]', (els) =>
    els.filter((e) => (e.textContent || '').trim().toLowerCase().includes('review')).length
  )
  console.log('Review-related buttons:', reviewsBtns)

  // Look for tabs specifically
  const tabTexts = await page.$$eval('[role="tab"]', (els) =>
    els.map((e) => (e.getAttribute('aria-label') || e.textContent || '').trim().slice(0, 80))
  )
  console.log('Tabs on page:', tabTexts)

  // Save screenshot + html for offline inspection
  await page.screenshot({ path: '/tmp/gmaps_debug.png', fullPage: false })
  const html = await page.content()
  const fs = require('node:fs')
  fs.writeFileSync('/tmp/gmaps_debug.html', html)
  console.log('Screenshot → /tmp/gmaps_debug.png, HTML size:', html.length)

  await browser.close()
}

main().catch((e) => { console.error(e); process.exit(1) })
