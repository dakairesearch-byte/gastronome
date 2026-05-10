/**
 * For Michelin historical restaurants that aren't in the DB, insert new rows
 * with their historical designation. Use the LATEST Wikipedia year as the
 * "current michelin_designation" field (even if that's 2019 for a restaurant
 * that has since closed — at least we have the record).
 *
 * Then re-run history upsert so all history rows are populated.
 *
 *   npx tsx scripts/insertHistoricalRestaurants.ts [--apply]
 */
import { createClient } from '@supabase/supabase-js'
import * as fs from 'fs'
import * as path from 'path'

const envPath = path.join(process.cwd(), '.env.local')
if (fs.existsSync(envPath)) {
  for (const line of fs.readFileSync(envPath, 'utf8').split('\n')) {
    const m = line.match(/^([A-Z0-9_]+)=(.*)$/); if (m && !process.env[m[1]]) process.env[m[1]] = m[2].replace(/^"|"$/g, '')
  }
}
const s = createClient(process.env.NEXT_PUBLIC_SUPABASE_URL!, process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!, { auth: { persistSession: false } })

const DRY = !process.argv.includes('--apply')
console.log(`=== insertHistoricalRestaurants ${DRY ? '(DRY)' : '(APPLY)'} ===`)

const historical = JSON.parse(fs.readFileSync('/sessions/amazing-compassionate-lovelace/tmp/award-qa/michelin/historical_by_year.json', 'utf8')) as Array<{ name: string; year: number; designation: string; location: string; state: string }>

function decodeEntities(v: string): string {
  return (v || '').replace(/&amp;/g, '&').replace(/&#x27;/g, "'").replace(/&#39;/g, "'").replace(/&quot;/g, '"').replace(/&nbsp;/g, ' ').replace(/&mdash;/g, '—').replace(/&ndash;/g, '–')
}
function normName(s: string): string {
  return decodeEntities(s || '').toLowerCase().normalize('NFKD').replace(/[\u0300-\u036f]/g, '').replace(/[''´`]/g, "'").replace(/[^\w\s'&-]/g, ' ').replace(/\s+/g, ' ').replace(/\b(the|a|an|restaurant)\b/gi, '').replace(/\s+/g, ' ').trim()
}

// Extract city from Wikipedia "location" field. It's often like
// "Manhattan – Lower East Side" or "Brooklyn – Williamsburg"
// For NY, all Manhattan/Brooklyn/Queens/Bronx/Staten Island → "New York"
function cityFromLocation(location: string, state: string): string {
  const loc = (location || '').toLowerCase()
  if (state === 'NY') {
    if (/manhattan|brooklyn|queens|bronx|staten island|harlem|chelsea|village|midtown|soho|tribeca|williamsburg|greenpoint/.test(loc)) return 'New York'
    return 'New York'
  }
  if (state === 'CA') {
    // California location field often has specific city, e.g. "San Francisco – Mission"
    if (/san francisco/.test(loc)) return 'San Francisco'
    if (/los angeles|hollywood|west hollywood|beverly hills|santa monica|venice|culver city|malibu|pasadena/.test(loc)) {
      if (/santa monica/.test(loc)) return 'Santa Monica'
      if (/beverly hills/.test(loc)) return 'Beverly Hills'
      if (/culver city/.test(loc)) return 'Culver City'
      if (/hollywood|west hollywood/.test(loc)) return 'Hollywood'
      return 'Los Angeles'
    }
    if (/yountville/.test(loc)) return 'Yountville'
    if (/healdsburg/.test(loc)) return 'Healdsburg'
    if (/napa/.test(loc)) return 'Napa'
    if (/sonoma/.test(loc)) return 'Sonoma'
    if (/oakland/.test(loc)) return 'Oakland'
    if (/berkeley/.test(loc)) return 'Berkeley'
    // default
    return location ? location.split(/[–-]/)[0].trim() : ''
  }
  if (state === 'IL') return 'Chicago'
  if (state === 'DC') return 'Washington'
  if (state === 'TX') {
    if (/austin/.test(loc)) return 'Austin'
    return location ? location.split(/[–-]/)[0].trim() : ''
  }
  return location ? location.split(/[–-]/)[0].trim() : ''
}

// Filter to our 6-metro scope
const METRO_CITY: Record<string, string[]> = {
  NYC:    ['new york', 'brooklyn', 'queens', 'bronx', 'staten island', 'long island city'],
  CHI:    ['chicago'],
  LA:     ['los angeles', 'santa monica', 'beverly hills', 'culver city', 'west hollywood', 'hollywood', 'venice', 'pasadena', 'malibu'],
  MIA:    ['miami', 'miami beach', 'coral gables'],
  SF_BAY: ['san francisco', 'oakland', 'berkeley', 'palo alto', 'napa', 'yountville', 'calistoga', 'rutherford', 'sonoma', 'healdsburg'],
  AUS:    ['austin'],
}
function inScope(city: string): boolean {
  const c = (city || '').toLowerCase().trim()
  for (const cities of Object.values(METRO_CITY)) if (cities.includes(c)) return true
  return false
}

async function main() {
  const db: any[] = []; let from = 0
  while (true) {
    const { data } = await s.from('restaurants').select('id, name, city, state').range(from, from + 999)
    if (!data?.length) break
    db.push(...data); if (data.length < 1000) break; from += 1000
  }
  const dbByName = new Map<string, any[]>()
  for (const r of db) {
    const k = normName(r.name)
    if (!dbByName.has(k)) dbByName.set(k, [])
    dbByName.get(k)!.push(r)
  }

  // Group historical by normName — for unmatched, collect all years + latest designation
  const byNorm = new Map<string, { name: string; state: string; location: string; entries: typeof historical; latestDesig: string; latestYear: number }>()
  for (const h of historical) {
    const k = normName(h.name)
    if (dbByName.has(k)) continue // already in DB
    let g = byNorm.get(k)
    if (!g) {
      g = { name: h.name, state: h.state, location: h.location, entries: [], latestDesig: h.designation, latestYear: h.year }
      byNorm.set(k, g)
    }
    g.entries.push(h)
    if (h.year > g.latestYear) { g.latestYear = h.year; g.latestDesig = h.designation; g.location = h.location }
  }

  const toInsert: Array<{ name: string; city: string; state: string; michelin_designation: string; entries: typeof historical }> = []
  for (const g of byNorm.values()) {
    const city = cityFromLocation(g.location, g.state)
    if (!inScope(city)) continue
    toInsert.push({
      name: decodeEntities(g.name),
      city,
      state: g.state,
      michelin_designation: g.latestDesig,
      entries: g.entries,
    })
  }

  console.log(`Unique unmatched historical restaurants: ${byNorm.size}`)
  console.log(`In 6-metro scope → to insert: ${toInsert.length}`)
  console.log(`\nSample inserts:`)
  for (const t of toInsert.slice(0, 20)) console.log(`  ${t.name.padEnd(30)} ${t.city.padEnd(16)} ${t.state}  latest=${t.michelin_designation}  years=${t.entries.length}`)

  if (DRY) { console.log('\n--- DRY RUN — re-run with --apply to commit ---'); return }

  // Insert new restaurants
  let ok = 0, fail = 0
  const insertedIds: Map<string, string> = new Map() // normName → new id
  for (let i = 0; i < toInsert.length; i += 50) {
    const batch = toInsert.slice(i, i + 50).map(t => ({
      name: t.name,
      city: t.city,
      state: t.state,
      michelin_designation: t.michelin_designation,
    }))
    const { data, error } = await s.from('restaurants').insert(batch).select('id, name')
    if (error) { console.error(`insert batch ${i}: ${error.message}`); fail += batch.length; continue }
    ok += (data?.length ?? 0)
    for (const r of data ?? []) insertedIds.set(normName(r.name), r.id)
  }
  console.log(`\nInserted ${ok} ok, ${fail} fail`)

  // Upsert history rows for the newly inserted restaurants
  const histRows: any[] = []
  for (const t of toInsert) {
    const id = insertedIds.get(normName(t.name))
    if (!id) continue
    for (const e of t.entries) {
      histRows.push({ restaurant_id: id, year: e.year, designation: e.designation })
    }
  }
  // Dedupe (restaurant_id, year) keeping highest rank
  const rank = { three_star: 4, two_star: 3, one_star: 2, bib_gourmand: 1 }
  const uniq = new Map<string, any>()
  for (const h of histRows) {
    const k = `${h.restaurant_id}|${h.year}`
    const prev = uniq.get(k)
    if (!prev || (rank[h.designation as keyof typeof rank] ?? 0) > (rank[prev.designation as keyof typeof rank] ?? 0)) uniq.set(k, h)
  }
  const finalHist = Array.from(uniq.values())
  let hok = 0, hfail = 0
  for (let i = 0; i < finalHist.length; i += 100) {
    const batch = finalHist.slice(i, i + 100)
    const { error } = await s.from('restaurant_michelin_history').upsert(batch, { onConflict: 'restaurant_id,year', ignoreDuplicates: false })
    if (error) { console.error(`hist batch ${i}: ${error.message}`); hfail += batch.length } else hok += batch.length
  }
  console.log(`History upserted: ${hok} ok, ${hfail} fail`)
}

main().catch(e => { console.error(e); process.exit(1) })
