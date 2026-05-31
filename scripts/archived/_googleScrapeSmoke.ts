/**
 * Smoke test for Google Maps chip scraper.
 * Pulls chips for a single known-good restaurant and prints them.
 */
import { scrapeGoogleChips, filterToDishes } from '../src/lib/google/scrape'

async function main() {
  const placeId = process.argv[2] || 'ChIJCar0f49ZwokR6ozLV-dHNTE' // Katz's
  console.log(`Scraping chips for place_id=${placeId} …`)
  const t0 = Date.now()
  const chips = await scrapeGoogleChips(
    { placeId, mapsUrl: null },
    { includeSamples: false, headless: true, timeoutMs: 30_000 }
  )
  const ms = Date.now() - t0
  console.log(`Got ${chips.length} chips in ${ms}ms`)
  for (const c of chips) {
    console.log(`  ${c.keyword.padEnd(30)} ${c.count}`)
  }
  console.log('---')
  const dishes = filterToDishes(chips, { minCount: 3 })
  console.log(`After filterToDishes: ${dishes.length}`)
  for (const c of dishes) console.log(`  ${c.keyword.padEnd(30)} ${c.count}`)
}

main().catch((err) => { console.error(err); process.exit(1) })
