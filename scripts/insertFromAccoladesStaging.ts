/**
 * Insert restaurants from accolades_staging rows that are currently unmatched.
 *
 * Pipeline:
 *   1. Pull unmatched staging rows (no row in accolades_matches with restaurant_id)
 *   2. Dedupe by (normalized_name, city)
 *   3. Junk filter — skip section headers and other non-restaurant entries
 *   4. Near-miss detection — pg_trgm similarity > 0.85 against existing catalog;
 *      auto-link to existing instead of inserting a duplicate
 *   5. Insert stub rows (name, city, state, optional address) — google_place_id
 *      stays null so enrichWithGooglePlaces.ts will pick them up next
 *   6. Backfill accolades_matches for ALL staging rows pointing to either the
 *      newly-inserted row or the existing near-miss
 *
 *   npx tsx scripts/insertFromAccoladesStaging.ts            (DRY)
 *   npx tsx scripts/insertFromAccoladesStaging.ts --apply    (APPLY)
 *
 * Companion docs:
 *   - CATALOG_ENRICHMENT_PLAN.md (workspace root)
 *   - ACCOLADES_GAP_REPORT.md (workspace root)
 */
import { createClient } from '@supabase/supabase-js'
import type { Database } from '../src/types/database'
import * as fs from 'fs'
import * as path from 'path'

const envPath = path.join(process.cwd(), '.env.local')
if (fs.existsSync(envPath)) {
  for (const line of fs.readFileSync(envPath, 'utf8').split('\n')) {
    const m = line.match(/^([A-Z0-9_]+)=(.*)$/)
    if (m && !process.env[m[1]]) process.env[m[1]] = m[2].replace(/^"|"$/g, '')
  }
}

const s = createClient<Database>(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
  { auth: { persistSession: false } }
)

const DRY = !process.argv.includes('--apply')

// Trigram-similarity thresholds:
//   - CANDIDATE_THRESHOLD: report as a possible near-miss for review
//   - AUTO_LINK_THRESHOLD: confidently auto-link without manual approval
// Real-world: pg_trgm scores Wilde's/Wildes ≈ 0.55, Intero/Interore ≈ 0.5,
// so we surface candidates from 0.5 but only auto-link at 0.85+.
const CANDIDATE_THRESHOLD = 0.5
const AUTO_LINK_THRESHOLD = 0.85

// Manual overrides: pairs the user has already approved as the same restaurant.
// Entries here will be auto-linked regardless of similarity score.
// Format: { norm: <staging normalized_name>, city: <staging city>, catalog_name: <exact catalog name> }
const KNOWN_NEAR_MISS: Array<{ norm: string; city: string; catalog_name: string }> = [
  // Approved 2026-05-09 by user during gap-report review:
  { norm: "wilde's", city: 'Los Angeles', catalog_name: 'Wildes' },
  { norm: 'intero',  city: 'Austin',      catalog_name: 'Interore' },
]

console.log(`=== insertFromAccoladesStaging ${DRY ? '(DRY)' : '(APPLY)'} ===`)

// ---- City → state, scope filter ----
const CITY_STATE: Record<string, string> = {
  'Austin': 'TX',
  'Chicago': 'IL',
  'Los Angeles': 'CA',
  'Miami': 'FL',
  'New York': 'NY',
  'San Francisco': 'CA',
  // Long-tail (in case staging contains them via cross-mapping)
  'Brooklyn': 'NY', 'Queens': 'NY', 'Bronx': 'NY', 'Long Island City': 'NY',
  'Hollywood': 'CA', 'Beverly Hills': 'CA', 'Santa Monica': 'CA',
  'Culver City': 'CA', 'Pasadena': 'CA', 'Venice': 'CA',
  'Oakland': 'CA', 'Berkeley': 'CA', 'San Jose': 'CA',
  'Miami Beach': 'FL',
}

// ---- Junk filter ----
const JUNK_REGEX = [
  /^more in dining out/i,
  /^see also/i,
  /^[A-Z][a-z]+ Map$/,
  /^chapter \d+/i,
  /^section /i,
]
const JUNK_EXACT = new Set([
  'sky pavilion', // Eater list section header that leaked
])
function isJunk(name: string): boolean {
  const n = (name || '').trim()
  if (n.length < 3 || n.length > 80) return true
  if (JUNK_EXACT.has(n.toLowerCase())) return true
  for (const re of JUNK_REGEX) if (re.test(n)) return true
  return false
}

// ---- Normalization (mirrors normName from insertHistoricalRestaurants.ts) ----
function decodeEntities(v: string): string {
  return (v || '')
    .replace(/&amp;/g, '&').replace(/&#x27;/g, "'").replace(/&#39;/g, "'")
    .replace(/&quot;/g, '"').replace(/&nbsp;/g, ' ')
    .replace(/&mdash;/g, '—').replace(/&ndash;/g, '–')
}
function normName(s: string): string {
  return decodeEntities(s || '')
    .toLowerCase()
    .normalize('NFKD').replace(/[̀-ͯ]/g, '')
    .replace(/[’‘´`]/g, "'")
    .replace(/[^\w\s'&-]/g, ' ')
    .replace(/\s+/g, ' ')
    .replace(/\b(the|a|an|restaurant)\b/gi, '')
    .replace(/\s+/g, ' ')
    .trim()
}

interface StagingRow {
  id: number
  source: string
  list_name: string | null
  city: string
  name: string
  normalized_name: string
  address: string | null
  url: string | null
  source_url: string | null
  year: number | null
}

interface Group {
  norm: string
  city: string
  display_name: string  // from Infatuation if available, else first source
  address: string | null
  staging_ids: number[]
  sources: Set<string>
  list_names: Set<string>
  source_urls: Set<string>
  years: Set<number>
}

async function fetchUnmatched(): Promise<StagingRow[]> {
  // RPC-equivalent via two queries (Supabase JS doesn't easily express NOT EXISTS)
  const { data: matched, error: e1 } = await s
    .from('accolades_matches')
    .select('staging_id')
    .not('restaurant_id', 'is', null)
  if (e1) throw new Error(`fetch matches: ${e1.message}`)
  const matchedIds = new Set((matched ?? []).map((m: any) => m.staging_id))

  const all: StagingRow[] = []
  let from = 0
  while (true) {
    const { data, error } = await s
      .from('accolades_staging')
      .select('id, source, list_name, city, name, normalized_name, address, url, source_url, year')
      .range(from, from + 999)
    if (error) throw new Error(`fetch staging: ${error.message}`)
    if (!data?.length) break
    all.push(...(data as StagingRow[]))
    if (data.length < 1000) break
    from += 1000
  }
  return all.filter(r => !matchedIds.has(r.id))
}

async function fetchCatalogNorms(): Promise<Map<string, { id: string; name: string; city: string }[]>> {
  const all: any[] = []
  let from = 0
  while (true) {
    const { data, error } = await s
      .from('restaurants')
      .select('id, name, city, _norm_name')
      .range(from, from + 999)
    if (error) throw new Error(`fetch catalog: ${error.message}`)
    if (!data?.length) break
    all.push(...data)
    if (data.length < 1000) break
    from += 1000
  }
  // Index by city → list of {id, name, _norm_name}
  const byCity = new Map<string, { id: string; name: string; norm: string }[]>()
  for (const r of all) {
    const norm = r._norm_name || normName(r.name)
    const key = r.city || ''
    if (!byCity.has(key)) byCity.set(key, [])
    byCity.get(key)!.push({ id: r.id, name: r.name, norm })
  }
  return byCity as any
}

// pg_trgm-style trigram similarity (sufficient for "Wilde's" vs "Wildes")
function trigrams(s: string): Set<string> {
  const padded = `  ${s}  `
  const t = new Set<string>()
  for (let i = 0; i < padded.length - 2; i++) t.add(padded.slice(i, i + 3))
  return t
}
function similarity(a: string, b: string): number {
  if (a === b) return 1
  if (!a || !b) return 0
  const ta = trigrams(a), tb = trigrams(b)
  let inter = 0
  for (const t of ta) if (tb.has(t)) inter++
  return inter / (ta.size + tb.size - inter)
}

// City-equivalence for near-miss search (NYC includes boroughs, etc.)
function citySearchSet(city: string): string[] {
  if (city === 'New York') return ['New York', 'Brooklyn', 'Queens', 'Bronx', 'Long Island City']
  if (city === 'Los Angeles') return ['Los Angeles', 'Hollywood', 'Beverly Hills', 'Santa Monica', 'Culver City', 'Venice', 'Pasadena']
  if (city === 'San Francisco') return ['San Francisco', 'Oakland', 'Berkeley']
  if (city === 'Miami') return ['Miami', 'Miami Beach']
  return [city]
}

function findNearMiss(
  norm: string,
  city: string,
  catalog: Map<string, { id: string; name: string; norm: string }[]>
): { id: string; name: string; sim: number } | null {
  let best: { id: string; name: string; sim: number } | null = null
  for (const c of citySearchSet(city)) {
    const rows = catalog.get(c) || []
    for (const r of rows) {
      const sim = similarity(norm, r.norm)
      if (sim >= CANDIDATE_THRESHOLD && (!best || sim > best.sim)) {
        best = { id: r.id, name: r.name, sim }
      }
    }
  }
  return best
}

function isManuallyApproved(norm: string, city: string, catalogName: string): boolean {
  return KNOWN_NEAR_MISS.some(k =>
    k.norm.toLowerCase() === norm.toLowerCase() &&
    k.city === city &&
    k.catalog_name === catalogName
  )
}

async function main() {
  // 1. Fetch unmatched staging rows
  const staging = await fetchUnmatched()
  console.log(`Unmatched staging rows: ${staging.length}`)

  // 2. Group by (normalized_name, city)
  const groups = new Map<string, Group>()
  let junkCount = 0
  let oosCount = 0
  for (const r of staging) {
    if (isJunk(r.name)) { junkCount++; continue }
    if (!CITY_STATE[r.city]) { oosCount++; continue }
    const k = `${r.normalized_name}|${r.city}`
    let g = groups.get(k)
    if (!g) {
      g = {
        norm: r.normalized_name,
        city: r.city,
        display_name: decodeEntities(r.name),
        address: r.address || null,
        staging_ids: [],
        sources: new Set(),
        list_names: new Set(),
        source_urls: new Set(),
        years: new Set(),
      }
      groups.set(k, g)
    }
    g.staging_ids.push(r.id)
    g.sources.add(r.source)
    if (r.list_name) g.list_names.add(r.list_name)
    if (r.source_url) g.source_urls.add(r.source_url)
    if (r.year != null) g.years.add(r.year)
    if (!g.address && r.address) g.address = r.address  // prefer first non-null address (Infatuation)
    // If this row has Infatuation source (best name quality), prefer its display_name
    if (r.source === 'infatuation_list') g.display_name = decodeEntities(r.name)
  }
  console.log(`Groups: ${groups.size} (junk skipped: ${junkCount}, out-of-scope city: ${oosCount})`)

  // 3. Near-miss detection
  const catalog = await fetchCatalogNorms()
  console.log(`Catalog index built: ${[...catalog.values()].reduce((a,b)=>a+b.length,0)} restaurants across ${catalog.size} cities`)

  const linkExisting: Array<{ group: Group; restaurant_id: string; matched_name: string; sim: number; reason: string }> = []
  const reviewCandidates: Array<{ group: Group; restaurant_id: string; matched_name: string; sim: number }> = []
  const toInsert: Group[] = []
  for (const g of groups.values()) {
    const nm = findNearMiss(g.norm, g.city, catalog)
    if (!nm) {
      toInsert.push(g)
      continue
    }
    const approved = isManuallyApproved(g.norm, g.city, nm.name)
    if (nm.sim >= AUTO_LINK_THRESHOLD || approved) {
      linkExisting.push({
        group: g, restaurant_id: nm.id, matched_name: nm.name, sim: nm.sim,
        reason: approved ? 'KNOWN_NEAR_MISS' : `sim>=${AUTO_LINK_THRESHOLD}`,
      })
    } else {
      // Borderline: print for review but DO NOT auto-link. These are inserted as new rows.
      reviewCandidates.push({ group: g, restaurant_id: nm.id, matched_name: nm.name, sim: nm.sim })
      toInsert.push(g)
    }
  }

  console.log(`\nAuto-linked to existing catalog: ${linkExisting.length}`)
  for (const x of linkExisting) {
    console.log(`  "${x.group.display_name}" (${x.group.city}) → ${x.matched_name} (sim ${x.sim.toFixed(3)}, ${x.reason})`)
  }
  if (reviewCandidates.length) {
    console.log(`\n⚠ Borderline near-miss candidates (NOT auto-linked, will insert as new):`)
    console.log(`  Add to KNOWN_NEAR_MISS in this script if these are the same restaurant.`)
    for (const x of reviewCandidates) {
      console.log(`  "${x.group.display_name}" (${x.group.city}) ≈ ${x.matched_name} (sim ${x.sim.toFixed(3)})`)
    }
  }
  console.log(`\nNew restaurants to insert: ${toInsert.length}`)
  console.log(`Sample inserts:`)
  for (const g of toInsert.slice(0, 20)) {
    const sources = [...g.sources].join(',')
    console.log(`  ${g.display_name.padEnd(34)} ${g.city.padEnd(16)} [${sources}]`)
  }

  if (DRY) {
    console.log('\n--- DRY RUN — re-run with --apply to commit ---')
    console.log(`Would insert: ${toInsert.length} new restaurants`)
    console.log(`Would link to existing: ${linkExisting.length} groups`)
    const totalStagingCovered =
      [...toInsert].reduce((a, g) => a + g.staging_ids.length, 0) +
      linkExisting.reduce((a, x) => a + x.group.staging_ids.length, 0)
    console.log(`Would create ${totalStagingCovered} accolades_matches rows`)
    return
  }

  // 4. Insert new restaurants in batches of 50
  const insertedByGroup: Map<Group, string> = new Map()  // group → new restaurant_id
  let insOk = 0, insFail = 0
  for (let i = 0; i < toInsert.length; i += 50) {
    const batch = toInsert.slice(i, i + 50)
    const payload = batch.map(g => ({
      name: g.display_name,
      city: g.city,
      state: CITY_STATE[g.city],
      address: g.address || null,
      // Stash provenance in accolades JSONB for traceability
      accolades: [...g.sources].map(src => ({
        type: src,
        source_urls: [...g.source_urls],
        list_names: [...g.list_names],
        years: [...g.years],
        ingested_at: new Date().toISOString(),
        via: 'insertFromAccoladesStaging',
      })),
    }))
    const { data, error } = await s.from('restaurants').insert(payload).select('id, name')
    if (error) {
      console.error(`insert batch ${i}: ${error.message}`)
      insFail += batch.length
      continue
    }
    // Match back by normalized name within the batch
    const dataNormed = new Map<string, string>()
    for (const r of data ?? []) dataNormed.set(normName(r.name), (r as any).id)
    for (const g of batch) {
      const id = dataNormed.get(normName(g.display_name))
      if (id) { insertedByGroup.set(g, id); insOk++ }
      else insFail++
    }
  }
  console.log(`\nInserted: ${insOk} ok, ${insFail} fail`)

  // 5. Backfill accolades_matches
  // Both newly-inserted groups AND near-miss-linked groups
  const matchRows: Array<{ staging_id: number; restaurant_id: string; match_score: number; match_method: string }> = []
  for (const [g, rid] of insertedByGroup) {
    for (const sid of g.staging_ids) {
      matchRows.push({
        staging_id: sid,
        restaurant_id: rid,
        match_score: 1.0,
        match_method: 'post_insertFromAccoladesStaging',
      })
    }
  }
  for (const x of linkExisting) {
    for (const sid of x.group.staging_ids) {
      matchRows.push({
        staging_id: sid,
        restaurant_id: x.restaurant_id,
        match_score: x.sim,
        match_method: 'fuzzy_near_miss_link',
      })
    }
  }
  console.log(`\nBackfilling ${matchRows.length} accolades_matches rows`)
  let mOk = 0, mFail = 0
  for (let i = 0; i < matchRows.length; i += 100) {
    const batch = matchRows.slice(i, i + 100)
    const { error } = await s.from('accolades_matches').upsert(batch, { onConflict: 'staging_id', ignoreDuplicates: false })
    if (error) { console.error(`match batch ${i}: ${error.message}`); mFail += batch.length }
    else mOk += batch.length
  }
  console.log(`accolades_matches: ${mOk} ok, ${mFail} fail`)

  console.log(`\nDone. Run scripts/enrichWithGooglePlaces.ts next to populate google_place_id and the rest.`)
}

main().catch(e => { console.error(e); process.exit(1) })
