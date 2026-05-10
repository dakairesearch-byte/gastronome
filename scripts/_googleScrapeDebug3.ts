/**
 * Debug v3: Google Maps in headless keeps showing Overview+About only.
 * Try:
 *  - networkidle wait
 *  - clicking the place heading to expand
 *  - scrolling the left panel to force lazy-loaded tabs
 */
import { chromium } from 'playwright'
import fs from 'node:fs'

async function main() {
  const placeId = 'ChIJCar0f49ZwokR6ozLV-dHNTE'
  const url = `https://www.google.com/maps/place/?q=place_id:${placeId}&hl=en`
  const browser = await chromium.launch({
    headless: true,
    args: ['--disable-blink-features=AutomationControlled'],
  })
  const ctx = await browser.newContext({
    userAgent:
      'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/132.0.0.0 Safari/537.36',
    locale: 'en-US',
    viewport: { width: 1440, height: 1200 },
    extraHTTPHeaders: { 'accept-language': 'en-US,en;q=0.9' },
  })
  const page = await ctx.newPage()
  await page.goto(url, { waitUntil: 'networkidle', timeout: 45_000 })
  await page.waitForTimeout(3000)

  // Dismiss consent
  for (const sel of ['button:has-text("Accept all")', 'button:has-text("Reject all")']) {
    try {
      const btn = page.locator(sel).first()
      if (await btn.isVisible({ timeout: 1000 })) {
        await btn.click({ timeout: 1500 })
        await page.waitForTimeout(1500)
        break
      }
    } catch {}
  }

  // Scroll within left panel
  try {
    await page.evaluate(() => {
      const panels = Array.from(document.querySelectorAll<HTMLElement>('[role="main"], .m6QErb, [aria-label^="Information for"]'))
      for (const p of panels) {
        p.scrollBy({ top: 400, behavior: 'instant' as ScrollBehavior })
      }
    })
    await page.waitForTimeout(1200)
  } catch {}

  // Click a "Reviews" button explicitly if present
  const reviewsBtns = await page.evaluate(() => {
    const all = Array.from(document.querySelectorAll<HTMLElement>('button, [role="tab"]'))
    return all
      .map((e) => ({
        text: (e.textContent || '').trim().slice(0, 30),
        aria: e.getAttribute('aria-label') || '',
        dataIdx: e.getAttribute('data-tab-index') || '',
      }))
      .filter((b) => /review/i.test(b.text) || /review/i.test(b.aria))
  })
  console.log('review-ish buttons:', reviewsBtns.slice(0, 20))

  // Raw page text around "reviews mention"
  const hasChipText = await page.evaluate(() => {
    const all = document.body.innerText
    return all.split('\n').filter((l) => /reviews mention/i.test(l)).slice(0, 10)
  })
  console.log('lines containing "reviews mention":', hasChipText)

  // Count data-tab-indexes found after scroll
  const tabs = await page.$$eval('[data-tab-index]', (els) =>
    els.map((e) => ({
      i: e.getAttribute('data-tab-index'),
      a: e.getAttribute('aria-label') || (e.textContent || '').trim().slice(0, 50),
    }))
  )
  console.log('tabs after scroll:', tabs)

  // Attempt to directly read if there's a tabpanel with role=listbox showing chips
  const listboxes = await page.evaluate(() => {
    return Array.from(document.querySelectorAll('[role="listbox"]')).map((l) => {
      return {
        label: l.getAttribute('aria-label'),
        children: l.children.length,
      }
    })
  })
  console.log('listboxes on page:', listboxes)

  await page.screenshot({ path: '/tmp/gmaps_v3.png', fullPage: true })
  fs.writeFileSync('/tmp/gmaps_v3.html', await page.content())
  console.log('screenshot + html saved')
  await browser.close()
}

main().catch((e) => { console.error(e); process.exit(1) })
