/**
 * Compare scraped authoritative award lists (Michelin + Eater 38) against the DB.
 * Produces a clear QA report:
 *   - Wrong: rows where DB says X but authoritative says Y
 *   - Missing: restaurants in authoritative list not in DB
 *   - Stale: rows in DB with an award but no authoritative match (likely removed or wrong)
 */
import { createClient } from '@supabase/supabase-js'
import * as fs from 'fs'
import * as path from 'path'

const envPath = path.join(process.cwd(), '.env.local')
if (fs.existsSync(envPath)) {
  for (const line of fs.readFileSync(envPath, 'utf8').split('\n')) {
    const m = line.match(/^([A-Z0-9_]+)=(.*)$/)
    if (m && !process.env[m[1]]) process.env[m[1]] = m[2].replace(/^"|"$/g, '')
  }
}
const s = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
  { auth: { persistSession: false } },
)

const AWARD_QA_DIR = '/sessions/amazing-compassionate-lovelace/tmp/award-qa'

// ---------- load scraped data ----------
const michelinUnion = JSON.parse(fs.readFileSync(`${AWARD_QA_DIR}/michelin/union_by_url.json`, 'utf8')) as Record<string, string>
const eaterAll = JSON.parse(fs.readFileSync(`${AWARD_QA_DIR}/eater/all_eater38.json`, 'utf8')) as Array<{ city: string; count: number; restaurants: string[] }>
const jbfAll = JSON.parse(fs.readFileSync(`${AWARD_QA_DIR}/jbf/all_jbf.json`, 'utf8')) as Array<{ year: number; award_name: string; chef: string; restaurant: string; city: string; state: string; status: string }>

// ---------- name normalization ----------
function decodeEntities(s: string): string {
  return s
    .replace(/&amp;/g, '&')
    .replace(/&#x27;/g, "'")
    .replace(/&#39;/g, "'")
    .replace(/&quot;/g, '"')
    .replace(/&nbsp;/g, ' ')
    .replace(/&lt;/g, '<')
    .replace(/&gt;/g, '>')
    .replace(/&mdash;/g, '—')
    .replace(/&ndash;/g, '–')
}

function normName(s: string): string {
  return decodeEntities(s)
    .toLowerCase()
    .normalize('NFKD')
    .replace(/[\u0300-\u036f]/g, '') // strip diacritics
    .replace(/[''´`]/g, "'")
    .replace(/[^\w\s'&-]/g, ' ')
    .replace(/\s+/g, ' ')
    .replace(/\b(the|a|an|restaurant)\b/gi, '')
    .replace(/\s+/g, ' ')
    .trim()
}

// Derive name from a Michelin URL slug
function nameFromMichelinSlug(url: string): string {
  // /us/en/california/san-francisco/restaurant/atelier-crenn → atelier-crenn → "Atelier Crenn"
  const m = url.match(/\/restaurant\/(.+?)$/)
  if (!m) return ''
  let slug = m[1]
  // Strip trailing numeric suffix like -1213976
  slug = slug.replace(/-\d{5,}$/, '')
  // Title-case
  return slug.split('-').filter(Boolean).map(w => w[0].toUpperCase() + w.slice(1)).join(' ')
}

function cityFromMichelinUrl(url: string): string {
  // /us/en/california/san-francisco/restaurant/atelier-crenn
  const m = url.match(/\/us\/en\/([^/]+)\/([^/]+)\/restaurant\//)
  if (!m) return ''
  // state/city slug → "San Francisco"
  const citySlug = m[2].replace(/^us-/, '')
  return citySlug.split('-').map(w => w[0].toUpperCase() + w.slice(1)).join(' ')
}

const DIST_TO_DESIG: Record<string, string> = {
  'THREE_STARS': 'three_star',
  'TWO_STARS': 'two_star',
  'ONE_STAR': 'one_star',
  'BIB_GOURMAND': 'bib_gourmand',
}

// ---------- fetch all DB rows ----------
async function allDbRows() {
  const out: Array<{ id: string; name: string; city: string | null; state: string | null; michelin_designation: string | null; eater_38: boolean; james_beard_winner: boolean }> = []
  let from = 0
  while (true) {
    const { data, error } = await s
      .from('restaurants')
      .select('id, name, city, state, michelin_designation, eater_38, james_beard_winner')
      .range(from, from + 999)
    if (error) throw error
    if (!data?.length) break
    out.push(...(data as any[]))
    if (data.length < 1000) break
    from += 1000
  }
  return out
}

async function main() {
  const db = await allDbRows()
  console.log(`DB rows: ${db.length}`)

  // Index DB by normName
  const dbByName = new Map<string, typeof db[0]>()
  for (const r of db) {
    const k = normName(r.name)
    if (!dbByName.has(k)) dbByName.set(k, r)
  }

  // ==== MICHELIN ====
  const michelinEntries = Object.entries(michelinUnion).map(([url, dist]) => ({
    url,
    dist,
    desigExpected: DIST_TO_DESIG[dist],
    name: nameFromMichelinSlug(url),
    normName: normName(nameFromMichelinSlug(url)),
    city: cityFromMichelinUrl(url),
  }))
  const michelinByNorm = new Map(michelinEntries.map(e => [e.normName, e]))

  const wrongDesig: Array<{ id: string; name: string; dbDesig: string | null; realDesig: string; url: string; city: string }> = []
  const missingFromDb: Array<typeof michelinEntries[0]> = []
  const dbMichelinNotInScrape: Array<{ id: string; name: string; dbDesig: string }> = []

  for (const me of michelinEntries) {
    const dbMatch = dbByName.get(me.normName)
    if (!dbMatch) {
      missingFromDb.push(me)
    } else if (dbMatch.michelin_designation !== me.desigExpected) {
      wrongDesig.push({ id: dbMatch.id, name: dbMatch.name, dbDesig: dbMatch.michelin_designation, realDesig: me.desigExpected, url: me.url, city: me.city })
    }
  }
  for (const r of db) {
    if (!r.michelin_designation) continue
    const k = normName(r.name)
    if (!michelinByNorm.has(k)) {
      dbMichelinNotInScrape.push({ id: r.id, name: r.name, dbDesig: r.michelin_designation })
    }
  }

  // ==== EATER 38 ====
  const eaterFlat: Array<{ name: string; city: string; normName: string }> = []
  for (const c of eaterAll) {
    for (const name of c.restaurants) {
      eaterFlat.push({ name: decodeEntities(name), city: c.city, normName: normName(name) })
    }
  }
  const eaterByNorm = new Map<string, typeof eaterFlat[0]>()
  for (const e of eaterFlat) if (!eaterByNorm.has(e.normName)) eaterByNorm.set(e.normName, e)

  const eaterWrongFlag: Array<{ id: string; name: string; city: string | null; realCity: string }> = [] // in list, not flagged
  const missingEaterFromDb: Array<typeof eaterFlat[0]> = []
  const dbEaterButNotInScrape: Array<{ id: string; name: string; city: string | null }> = []

  for (const e of eaterFlat) {
    const dbMatch = dbByName.get(e.normName)
    if (!dbMatch) {
      missingEaterFromDb.push(e)
    } else if (!dbMatch.eater_38) {
      eaterWrongFlag.push({ id: dbMatch.id, name: dbMatch.name, city: dbMatch.city, realCity: e.city })
    }
  }
  for (const r of db) {
    if (!r.eater_38) continue
    const k = normName(r.name)
    if (!eaterByNorm.has(k)) {
      dbEaterButNotInScrape.push({ id: r.id, name: r.name, city: r.city })
    }
  }

  // ==== JBF ====
  // Only consider entries with a restaurant name (skip chef-only awards like Best Chef where restaurant is empty)
  const jbfEntries = jbfAll
    .filter(j => j.restaurant && j.restaurant.length > 2)
    .map(j => ({
      ...j,
      // Clean footnote refs like "[29]" from city/state/restaurant
      restaurant: j.restaurant.replace(/\[\d+\]/g, '').replace(/&#\d+;/g, '').trim(),
      state: j.state.replace(/\[\d+\]/g, '').replace(/&#\d+;/g, '').trim(),
      city: j.city.replace(/\[\d+\]/g, '').replace(/&#\d+;/g, '').trim(),
      normName: normName(j.restaurant.replace(/\[\d+\]/g, '')),
    }))

  // Index by normName → latest year per restaurant
  const jbfByNorm = new Map<string, typeof jbfEntries[0]>()
  for (const e of jbfEntries) {
    const prev = jbfByNorm.get(e.normName)
    if (!prev || e.year > prev.year) jbfByNorm.set(e.normName, e)
  }

  const jbfWrongFlag: Array<{ id: string; name: string; city: string | null; dbFlag: boolean; year: number; award: string }> = []
  const jbfMissingFromDb: Array<typeof jbfEntries[0]> = []
  const dbJbfButNotInScrape: Array<{ id: string; name: string; city: string | null }> = []

  for (const [nm, e] of jbfByNorm) {
    const dbMatch = dbByName.get(nm)
    if (!dbMatch) {
      jbfMissingFromDb.push(e)
    } else if (!dbMatch.james_beard_winner) {
      jbfWrongFlag.push({ id: dbMatch.id, name: dbMatch.name, city: dbMatch.city, dbFlag: dbMatch.james_beard_winner, year: e.year, award: e.award_name })
    }
  }
  for (const r of db) {
    if (!r.james_beard_winner) continue
    const k = normName(r.name)
    if (!jbfByNorm.has(k)) {
      dbJbfButNotInScrape.push({ id: r.id, name: r.name, city: r.city })
    }
  }

  // ==== REPORT ====
  const report = {
    generated_at: new Date().toISOString(),
    summary: {
      michelin_scraped: michelinEntries.length,
      michelin_wrong_desig: wrongDesig.length,
      michelin_missing_from_db: missingFromDb.length,
      michelin_db_but_not_scraped: dbMichelinNotInScrape.length,
      eater_scraped: eaterFlat.length,
      eater_wrong_flag: eaterWrongFlag.length,
      eater_missing_from_db: missingEaterFromDb.length,
      eater_db_but_not_scraped: dbEaterButNotInScrape.length,
      jbf_total_entries_2010_2026: jbfEntries.length,
      jbf_unique_restaurants: jbfByNorm.size,
      jbf_wrong_flag: jbfWrongFlag.length,
      jbf_missing_from_db: jbfMissingFromDb.length,
      jbf_db_but_not_scraped: dbJbfButNotInScrape.length,
    },
    michelin_wrong_desig: wrongDesig,
    michelin_missing_from_db: missingFromDb,
    michelin_db_but_not_scraped: dbMichelinNotInScrape,
    eater_wrong_flag: eaterWrongFlag,
    eater_missing_from_db: missingEaterFromDb,
    eater_db_but_not_scraped: dbEaterButNotInScrape,
    jbf_wrong_flag: jbfWrongFlag,
    jbf_missing_from_db: jbfMissingFromDb,
    jbf_db_but_not_scraped: dbJbfButNotInScrape,
  }

  const outPath = `${AWARD_QA_DIR}/qa_report.json`
  fs.writeFileSync(outPath, JSON.stringify(report, null, 2))

  console.log('\n=== QA SUMMARY ===')
  for (const [k, v] of Object.entries(report.summary)) console.log(`  ${k.padEnd(34)} ${v}`)

  console.log('\n=== Michelin WRONG designation (first 20) ===')
  for (const w of wrongDesig.slice(0, 20)) console.log(`  ${w.name.padEnd(34)} DB=${w.dbDesig ?? 'none'}  REAL=${w.realDesig}  (${w.city})`)
  console.log('\n=== Michelin MISSING from DB (first 20) ===')
  for (const m of missingFromDb.slice(0, 20)) console.log(`  ${m.name.padEnd(34)} ${m.desigExpected.padEnd(12)} (${m.city})`)
  console.log('\n=== DB says Michelin but not in scraped 2025 list (first 20) ===')
  for (const m of dbMichelinNotInScrape.slice(0, 20)) console.log(`  ${m.name.padEnd(34)} DB=${m.dbDesig}`)
  console.log('\n=== Eater WRONG flag (first 20) ===')
  for (const e of eaterWrongFlag.slice(0, 20)) console.log(`  ${e.name.padEnd(34)} DB city=${e.city ?? '?'}  REAL=${e.realCity}`)
  console.log('\n=== Eater MISSING from DB (first 20) ===')
  for (const m of missingEaterFromDb.slice(0, 20)) console.log(`  ${m.name.padEnd(34)} ${m.city}`)
  console.log('\n=== DB says Eater 38 but not in any current list (first 20) ===')
  for (const m of dbEaterButNotInScrape.slice(0, 20)) console.log(`  ${m.name.padEnd(34)} city=${m.city ?? '?'}`)

  console.log('\n=== JBF in Wikipedia 2010-2026 but NOT flagged in DB (first 20) ===')
  for (const w of jbfWrongFlag.slice(0, 20)) console.log(`  ${w.name.padEnd(34)} year=${w.year}  award=${w.award.slice(0, 40)}`)
  console.log('\n=== JBF winner MISSING from DB (first 20) ===')
  for (const m of jbfMissingFromDb.slice(0, 20)) console.log(`  ${m.restaurant.padEnd(34)} ${m.year}  ${m.award_name.slice(0, 30).padEnd(30)} (${m.city}, ${m.state})`)
  console.log('\n=== DB flagged JBF but no matching winner in 2010-2026 (first 20) ===')
  for (const m of dbJbfButNotInScrape.slice(0, 20)) console.log(`  ${m.name.padEnd(34)} city=${m.city ?? '?'}`)

  console.log(`\nwrote ${outPath}`)
}

main().catch(e => { console.error(e); process.exit(1) })
