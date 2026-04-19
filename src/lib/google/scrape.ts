/**
 * Playwright-based scraper for Google Maps' pre-aggregated
 * "people often mention" chips on a restaurant's place page.
 *
 * Why scrape: Google already extracts and counts the keywords
 * reviewers mention (e.g. "pastrami (4,012)", "smoked meat (312)").
 * Piggybacking on their aggregation lets us populate
 * `restaurant_highlighted_dishes.google_mentions` with zero LLM
 * tokens and zero Places API calls.
 *
 * What we extract per chip:
 *   - keyword: the lowercased keyword/phrase
 *   - count:   Google's mention count
 *   - sampleQuote: one review snippet from the chip's filtered view
 *                  (optional — enabled with includeSamples: true)
 */
import { chromium, type Browser, type Page } from 'playwright'

export interface GoogleChip {
  keyword: string
  count: number
  sampleQuote: string | null
}

/**
 * Keywords Google surfaces in its "people often mention" row that are
 * clearly not dishes. We strip these out before writing to the dish
 * table. Err on the side of keeping things — we'd rather surface a
 * borderline word than miss a real dish.
 */
const NON_DISH_STOPWORDS = new Set([
  // service / vibe
  'service', 'atmosphere', 'experience', 'staff', 'waiter', 'waitress',
  'server', 'bartender', 'wait', 'waits', 'wait time', 'ambiance',
  'ambience', 'decor', 'vibe', 'vibes', 'music', 'view', 'views',
  'outdoor seating', 'patio', 'seating', 'sidewalk', 'noise',
  'crowded', 'busy', 'line', 'lines',
  // transactional
  'price', 'prices', 'bill', 'check', 'tip', 'cost', 'value', 'worth',
  'money', 'cash', 'card', 'reservation', 'reservations', 'parking',
  'location', 'neighborhood', 'area', 'spot', 'place', 'restaurant',
  'bar', 'establishment', 'joint', 'hole',
  // occasions
  'birthday', 'anniversary', 'date night', 'group', 'party', 'date',
  'family', 'friends', 'kids', 'children', 'tourists', 'locals',
  // meals / times
  'night', 'evening', 'afternoon', 'morning', 'weekend',
  'breakfast', 'brunch', 'lunch', 'dinner',
  // generic food words (too broad to be a dish)
  'food', 'menu', 'meal', 'portion', 'portions', 'dish', 'dishes',
  'cuisine', 'flavor', 'flavors', 'taste', 'quality',
])

/**
 * Extract place_id from various Google Maps URL shapes.
 *   - https://maps.google.com/?cid=3545819340560108778 → can't — it's a cid, not place_id
 *   - https://www.google.com/maps/place/.../!1s0x...:0xabc... → no
 *   - We fall back on the raw URL if we can't extract an ID.
 */
export function buildMapsUrl(opts: { placeId?: string | null; mapsUrl?: string | null }): string | null {
  const { placeId, mapsUrl } = opts
  if (placeId) {
    // Canonical form — Google will resolve and redirect
    return `https://www.google.com/maps/place/?q=place_id:${placeId}`
  }
  return mapsUrl ?? null
}

/**
 * Accept-cookies dismissal is locale- and A/B-dependent. We try a few
 * button labels and shrug off failure.
 */
async function dismissConsent(page: Page): Promise<void> {
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
        await btn.click({ timeout: 2_000 })
        await page.waitForTimeout(500)
        return
      }
    } catch {
      // no-op
    }
  }
}

/**
 * Open the Reviews tab. Google surfaces it as a tab with text "Reviews"
 * or aria-label "Reviews for X". Once active, the chip row renders in
 * the same left panel.
 */
async function openReviewsTab(page: Page): Promise<void> {
  const candidates = [
    'button[aria-label^="Reviews for"]',
    'button[role="tab"]:has-text("Reviews")',
    '[role="tab"]:has-text("Reviews")',
    'button:has-text("Reviews")',
  ]
  for (const sel of candidates) {
    try {
      const tab = page.locator(sel).first()
      if (await tab.isVisible({ timeout: 3_000 })) {
        await tab.click({ timeout: 3_000 })
        await page.waitForTimeout(1_500)
        return
      }
    } catch {
      // try next
    }
  }
}

/**
 * Pull chips out of the DOM. Chips have aria-labels shaped like:
 *   "pastrami, 4,012 reviews mention this"
 *   "great service, 1,234 reviews mention"
 * We parse the label instead of relying on CSS class names, which are
 * obfuscated and change.
 */
async function extractChips(page: Page): Promise<GoogleChip[]> {
  type Raw = { keyword: string; count: number }

  const raw = await page.evaluate((): Raw[] => {
    const parseCount = (s: string): number | null => {
      const m = s.match(/([\d,]+)\s+reviews?\s+mention/i)
      if (!m) return null
      const n = parseInt(m[1].replace(/,/g, ''), 10)
      return Number.isFinite(n) ? n : null
    }

    const fromLabel = (label: string): Raw | null => {
      // "pastrami, 4,012 reviews mention this"
      const m = label.match(/^(.+?),\s*([\d,]+)\s+reviews?\s+mention/i)
      if (!m) return null
      const keyword = m[1].trim().toLowerCase()
      const count = parseInt(m[2].replace(/,/g, ''), 10)
      if (!keyword || !Number.isFinite(count)) return null
      return { keyword, count }
    }

    const out: Raw[] = []
    const seen = new Set<string>()

    // Primary: aria-label on chips
    const labeledButtons = document.querySelectorAll<HTMLElement>(
      'button[aria-label*="reviews mention"], [role="button"][aria-label*="reviews mention"], [role="tab"][aria-label*="reviews mention"]'
    )
    for (const el of Array.from(labeledButtons)) {
      const label = el.getAttribute('aria-label') || ''
      const parsed = fromLabel(label)
      if (parsed && !seen.has(parsed.keyword)) {
        out.push(parsed)
        seen.add(parsed.keyword)
      }
    }

    // Fallback: walk button text matching "keyword (N)"
    if (out.length === 0) {
      const btns = document.querySelectorAll<HTMLElement>(
        'button, [role="button"]'
      )
      for (const el of Array.from(btns)) {
        const text = (el.textContent || '').trim()
        const m = text.match(/^([^()]+?)\s*\(\s*([\d,]+)\s*\)$/)
        if (!m) continue
        const keyword = m[1].trim().toLowerCase()
        const count = parseInt(m[2].replace(/,/g, ''), 10)
        if (!keyword || !Number.isFinite(count)) continue
        // Sanity check — skip if text is way too long (not a chip)
        if (text.length > 80) continue
        if (seen.has(keyword)) continue
        out.push({ keyword, count })
        seen.add(keyword)
      }
    }

    // Double-check counts via title/aria when possible (disambiguates
    // identical button text in other parts of the page)
    return out.filter((r) => {
      // Sanity: counts should be small enough to be a mention count
      if (r.count > 1_000_000) return false
      return true
    })
  })

  // Attach null sample quotes by default; sample quotes are opt-in and
  // require clicking each chip (slow). The caller decides.
  return raw.map((r) => ({ ...r, sampleQuote: null }))
}

/**
 * Click each chip one at a time, pull the first highlighted snippet
 * that shows up in the filtered reviews, then click the chip again to
 * deselect before moving on. This is slow — ~1s per chip — so we only
 * do it for the top N chips per restaurant.
 */
async function attachSampleQuotes(
  page: Page,
  chips: GoogleChip[],
  topN: number
): Promise<GoogleChip[]> {
  const withQuotes = [...chips]
  const limit = Math.min(topN, chips.length)

  for (let i = 0; i < limit; i++) {
    const chip = chips[i]
    const labelSelector = `button[aria-label^="${chip.keyword.replace(/"/g, '\\"')}," i]`
    try {
      const btn = page.locator(labelSelector).first()
      if (!(await btn.isVisible({ timeout: 1_500 }))) continue

      await btn.click({ timeout: 2_000 })
      await page.waitForTimeout(800)

      // Grab the first visible highlighted snippet — Google wraps the
      // matched keyword in <b> inside review bodies when a chip is active.
      const quote = await page.evaluate((): string | null => {
        const bolds = document.querySelectorAll<HTMLElement>('b')
        for (const b of Array.from(bolds)) {
          // Walk up to the review body (max 5 levels), grab its text.
          let node: HTMLElement | null = b
          for (let depth = 0; depth < 5 && node; depth++) {
            const text = (node.textContent || '').trim()
            if (text.length > 60 && text.length < 400) {
              return text
            }
            node = node.parentElement
          }
        }
        return null
      })

      if (quote) {
        withQuotes[i] = { ...chip, sampleQuote: quote }
      }

      // Click chip again to deselect (toggle behavior)
      try {
        await btn.click({ timeout: 1_500 })
        await page.waitForTimeout(300)
      } catch {
        // no-op
      }
    } catch {
      // swallow per-chip failures
    }
  }

  return withQuotes
}

export interface ScrapeOptions {
  includeSamples?: boolean
  samplesTopN?: number
  headless?: boolean
  timeoutMs?: number
}

/**
 * Top-level entry point: open a page, scrape chips, return them.
 * Caller supplies either a Google place_id OR a maps URL.
 */
export async function scrapeGoogleChips(
  target: { placeId?: string | null; mapsUrl?: string | null },
  options: ScrapeOptions = {}
): Promise<GoogleChip[]> {
  const url = buildMapsUrl(target)
  if (!url) throw new Error('scrapeGoogleChips: no place_id or mapsUrl')

  const {
    includeSamples = false,
    samplesTopN = 5,
    headless = true,
    timeoutMs = 30_000,
  } = options

  let browser: Browser | null = null
  try {
    browser = await chromium.launch({ headless })
    const context = await browser.newContext({
      userAgent:
        'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/124.0.0.0 Safari/537.36',
      locale: 'en-US',
      viewport: { width: 1280, height: 900 },
    })
    const page = await context.newPage()
    page.setDefaultTimeout(timeoutMs)

    await page.goto(url, { waitUntil: 'domcontentloaded', timeout: timeoutMs })
    await dismissConsent(page)
    await openReviewsTab(page)

    // Wait for at least one chip to appear. Not all places have them —
    // if we time out, return empty.
    try {
      await page.waitForSelector(
        'button[aria-label*="reviews mention"]',
        { timeout: 8_000 }
      )
    } catch {
      // No chips rendered — place may not have enough reviews.
      return []
    }

    const chips = await extractChips(page)

    if (!includeSamples || chips.length === 0) {
      return chips
    }

    return await attachSampleQuotes(page, chips, samplesTopN)
  } finally {
    if (browser) await browser.close().catch(() => {})
  }
}

/**
 * Strip non-dish keywords ("service", "atmosphere", etc.) from a raw
 * chip list. Also drops chips with count < minCount — Google sometimes
 * surfaces very rare keywords that aren't real signal.
 */
export function filterToDishes(
  chips: GoogleChip[],
  opts: { minCount?: number } = {}
): GoogleChip[] {
  const { minCount = 3 } = opts
  return chips.filter(
    (c) =>
      !NON_DISH_STOPWORDS.has(c.keyword) &&
      !NON_DISH_STOPWORDS.has(c.keyword.replace(/^(the|a|an)\s+/, '')) &&
      c.count >= minCount
  )
}
