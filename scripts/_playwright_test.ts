import { chromium } from 'playwright'
;(async () => {
  const browser = await chromium.launch({ headless: true })
  const ctx = await browser.newContext()
  const page = await ctx.newPage()
  await page.goto('https://example.com', { timeout: 15000 })
  const title = await page.title()
  console.log('TITLE:', title)
  await browser.close()
})().catch((e) => { console.error('FAIL:', e.message); process.exit(1) })
