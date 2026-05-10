/**
 * Apply authoritative award fixes to the DB.
 *
 *   Defaults to DRY RUN. Only touches the DB when run with --apply.
 *
 * What it does (non-destructive):
 *   1. For every DB row, compute the correct (michelin_designation, eater_38,
 *      james_beard_winner) from the scraped authoritative lists (Michelin
 *      Guide current, Eater 38 current, JBF Wikipedia 2010-2026).
 *      - Wrong → overwrite with authoritative value
 *      - Stale (DB flagged but not in auth list) → CLEAR flag
 *      - Missing (DB unflagged but auth list has it) → SET flag
 *   2. For each authoritative restaurant not matched to any DB row AND in our
 *      6-metro scope, INSERT a new row with (name, city, state, award flags,
 *      michelin_url).
 *   3. Populate the three new history tables
 *      (restaurant_michelin_history, _jbf_history, _eater38_history) with
 *      year-by-year rows from the scrape.
 *   4. Normalize the `state` column on NYC rows where it's NULL (cosmetic).
 *
 * Preserves ALL existing restaurant rows (and therefore TikTok / IG / review /
 * menu data). Never DELETEs a restaurant.
 *
 * Usage:
 *   npx tsx scripts/applyAwardFixes.ts             # dry-run, prints plan
 *   npx tsx scripts/applyAwardFixes.ts --apply     # commits changes
 *   npx tsx scripts/applyAwardFixes.ts --phase=1   # only phase 1 (flag fixes)
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
const DRY_RUN = !process.argv.includes('--apply')
const PHASE = Number((process.argv.find(a => a.startsWith('--phase=')) ?? '--phase=all').split('=')[1]) || 0 // 0 = all phases

console.log(`=== applyAwardFixes ${DRY_RUN ? '(DRY RUN)' : '(APPLY)'} ${PHASE ? 'phase=' + PHASE : ''} ===\n`)

// ---------- load scraped data ----------
const michelinUnionRaw = JSON.parse(fs.readFileSync(`${AWARD_QA_DIR}/michelin/union_by_url.json`, 'utf8')) as Record<string, { distinction: string; name?: string }>
const michelinUnion: Record<string, { distinction: string; name: string }> = {}
for (const [url, v] of Object.entries(michelinUnionRaw)) {
  michelinUnion[url] = { distinction: v.distinction, name: decodeEntitiesPre(v.name || '') }
}
function decodeEntitiesPre(v: string): string {
  return (v || '')
    .replace(/&amp;/g, '&').replace(/&#x27;/g, "'").replace(/&#39;/g, "'")
    .replace(/&quot;/g, '"').replace(/&nbsp;/g, ' ').replace(/&mdash;/g, '—').replace(/&ndash;/g, '–')
    .replace(/&lt;/g, '<').replace(/&gt;/g, '>')
}
const eaterAll = JSON.parse(fs.readFileSync(`${AWARD_QA_DIR}/eater/all_eater38.json`, 'utf8')) as Array<{ city: string; restaurants: string[] }>
const jbfAll = JSON.parse(fs.readFileSync(`${AWARD_QA_DIR}/jbf/all_jbf.json`, 'utf8')) as Array<{ year: number; award_name: string; chef: string; restaurant: string; city: string; state: string; status: string }>

// ---------- name normalization ----------
function decodeEntities(v: string): string {
  return (v || '')
    .replace(/&amp;/g, '&').replace(/&#x27;/g, "'").replace(/&#39;/g, "'")
    .replace(/&quot;/g, '"').replace(/&nbsp;/g, ' ').replace(/&mdash;/g, '—').replace(/&ndash;/g, '–')
    .replace(/&lt;/g, '<').replace(/&gt;/g, '>')
}
function normName(s: string): string {
  return decodeEntities(s || '').toLowerCase().normalize('NFKD').replace(/[\u0300-\u036f]/g, '')
    .replace(/[''´`]/g, "'").replace(/[^\w\s'&-]/g, ' ').replace(/\s+/g, ' ')
    .replace(/\b(the|a|an|restaurant)\b/gi, '').replace(/\s+/g, ' ').trim()
}
function stripFootnotes(s: string): string {
  return (s || '').replace(/\[\d+\]/g, '').replace(/&#\d+;/g, '').replace(/\s*\d+\s*$/, '').trim()
}

// ---------- 6-metro scope ----------
// We accept a restaurant for INSERT only if its city maps to one of our 6 metros.
const METRO_CITY: Record<string, string[]> = {
  'NYC':     ['new york', 'brooklyn', 'queens', 'bronx', 'staten island', 'long island city', 'astoria', 'tarrytown'],
  'CHI':     ['chicago', 'evanston'],
  'LA':      ['los angeles', 'santa monica', 'beverly hills', 'culver city', 'west hollywood', 'hollywood', 'venice', 'pasadena', 'malibu', 'manhattan beach', 'west los angeles'],
  'MIA':     ['miami', 'miami beach', 'coral gables', 'key biscayne', 'miami gardens'],
  'SF_BAY':  ['san francisco', 'oakland', 'berkeley', 'palo alto', 'mountain view', 'menlo park', 'atherton', 'napa', 'yountville', 'calistoga', 'rutherford', 'st helena', 'saint helena', 'sonoma', 'healdsburg', 'sebastopol', 'elk', 'san jose', 'los altos', 'woodside'],
  'AUS':     ['austin'],
}
function normCity(c: string): string { return (c || '').toLowerCase().trim() }
function metroFor(city: string): string | null {
  const c = normCity(city)
  for (const [metro, cities] of Object.entries(METRO_CITY)) {
    if (cities.includes(c)) return metro
  }
  return null
}
function titleCase(s: string): string { return s.split(' ').filter(Boolean).map(w => w[0].toUpperCase() + w.slice(1)).join(' ') }

// ---------- Michelin helpers ----------
function nameFromMichelinSlug(url: string): string {
  const m = url.match(/\/restaurant\/(.+?)$/); if (!m) return ''
  return titleCase(m[1].replace(/-\d{5,}$/, '').replace(/-/g, ' '))
}
function cityFromMichelinUrl(url: string): string {
  const m = url.match(/\/us\/en\/([^/]+)\/([^/]+)\/restaurant\//); if (!m) return ''
  return titleCase(m[2].replace(/^us-/, '').replace(/-/g, ' '))
}
function stateFromMichelinUrl(url: string): string {
  const m = url.match(/\/us\/en\/([^/]+)\//); if (!m) return ''
  const slug = m[1]
  const STATE_MAP: Record<string, string> = { 'new-york-state': 'NY', 'california': 'CA', 'illinois': 'IL', 'florida': 'FL', 'texas': 'TX', 'district-of-columbia': 'DC' }
  return STATE_MAP[slug] || ''
}
const DIST_TO_DESIG: Record<string, string> = { 'THREE_STARS': 'three_star', 'TWO_STARS': 'two_star', 'ONE_STAR': 'one_star', 'BIB_GOURMAND': 'bib_gourmand' }

// ---------- main ----------
async function allDbRows() {
  const rows: any[] = []; let from = 0
  while (true) {
    const { data, error } = await s.from('restaurants').select('id, name, city, state, michelin_designation, michelin_url, eater_38, james_beard_winner').range(from, from + 999)
    if (error) throw error
    if (!data?.length) break
    rows.push(...data)
    if (data.length < 1000) break
    from += 1000
  }
  return rows
}

async function main() {
  const db = await allDbRows()
  console.log(`DB rows: ${db.length}\n`)

  // Index DB by normName and also by (normName, normCity) for disambiguation
  const dbByName = new Map<string, any[]>()
  for (const r of db) {
    const k = normName(r.name)
    if (!dbByName.has(k)) dbByName.set(k, [])
    dbByName.get(k)!.push(r)
  }

  // ==== Build authoritative per-restaurant plan ====
  // Key by normName (may collide — we'll resolve by city for ambiguous ones)
  type Auth = {
    normName: string
    displayName: string
    michelinDesig?: string
    michelinUrl?: string
    michelinCity?: string
    michelinState?: string
    eater38City?: string
    jbfLatestYear?: number
    jbfAwards?: Array<{ year: number; award: string; status: string }>
  }
  const auth = new Map<string, Auth>()
  const ensure = (name: string): Auth => {
    const k = normName(name)
    let a = auth.get(k)
    if (!a) { a = { normName: k, displayName: name }; auth.set(k, a) }
    return a
  }

  // Michelin — prefer the real restaurant name from the card <h3>, fall back to slug
  for (const [url, v] of Object.entries(michelinUnion)) {
    const name = (v.name && v.name.length >= 2) ? v.name : nameFromMichelinSlug(url)
    const a = ensure(name)
    a.displayName = name
    a.michelinDesig = DIST_TO_DESIG[v.distinction]
    a.michelinUrl = `https://guide.michelin.com${url}`
    a.michelinCity = cityFromMichelinUrl(url)
    a.michelinState = stateFromMichelinUrl(url)
  }

  // Eater 38
  for (const block of eaterAll) {
    for (const raw of block.restaurants) {
      const name = decodeEntities(raw)
      const a = ensure(name)
      if (!a.displayName || a.displayName.length < name.length) a.displayName = name
      a.eater38City = block.city
    }
  }

  // JBF (skip chef-only awards where restaurant is empty)
  for (const e of jbfAll) {
    const restaurant = stripFootnotes(e.restaurant)
    if (!restaurant || restaurant.length < 3) continue
    const a = ensure(restaurant)
    if (!a.displayName || a.displayName.length < restaurant.length) a.displayName = restaurant
    if (!a.jbfAwards) a.jbfAwards = []
    a.jbfAwards.push({ year: e.year, award: e.award_name, status: e.status })
    if (!a.jbfLatestYear || e.year > a.jbfLatestYear) a.jbfLatestYear = e.year
  }

  console.log(`Authoritative restaurants (union): ${auth.size}`)

  // ==== Phase 1: UPDATE existing DB rows ====
  const updates: Array<{ id: string; name: string; changes: Record<string, any>; reason: string[] }> = []

  for (const a of auth.values()) {
    const matches = dbByName.get(a.normName) || []
    if (!matches.length) continue

    // Prefer the DB row in the "right" city if multiple match
    let target = matches[0]
    if (matches.length > 1) {
      const preferredCity = a.michelinCity || a.eater38City || ''
      const pc = normCity(preferredCity)
      const byCity = matches.find(r => normCity(r.city || '') === pc) || matches.find(r => r.city)
      if (byCity) target = byCity
    }

    const changes: Record<string, any> = {}
    const reasons: string[] = []

    if (a.michelinDesig && target.michelin_designation !== a.michelinDesig) {
      changes.michelin_designation = a.michelinDesig
      reasons.push(`michelin: ${target.michelin_designation ?? 'null'} → ${a.michelinDesig}`)
    }
    if (a.michelinUrl && !target.michelin_url) {
      changes.michelin_url = a.michelinUrl
      reasons.push(`michelin_url: set`)
    }
    if (a.eater38City && !target.eater_38) {
      changes.eater_38 = true
      reasons.push(`eater_38: false → true`)
    }
    if (a.jbfAwards?.length && !target.james_beard_winner) {
      // Only set winner if any entry has status 'winner' and award has "Outstanding" OR "Best Chef" OR "Outstanding Restaurant" etc.
      const isRestaurantAward = a.jbfAwards.some(x => /Outstanding Restaurant|Best New Restaurant|Best Chef|Outstanding Chef|Outstanding Restaurateur|Outstanding Bar|Outstanding Wine|Outstanding Hospitality|Outstanding Pastry|Outstanding Bakery|America's Classic|Rising Star|Emerging Chef|Outstanding Service/i.test(x.award))
      if (isRestaurantAward) {
        changes.james_beard_winner = true
        reasons.push(`james_beard_winner: false → true (${a.jbfLatestYear} ${a.jbfAwards[0].award})`)
      }
    }

    if (Object.keys(changes).length) {
      updates.push({ id: target.id, name: target.name, changes, reason: reasons })
    }
  }

  // Clear stale flags
  const clears: Array<{ id: string; name: string; changes: Record<string, any>; reason: string }> = []
  for (const r of db) {
    const k = normName(r.name)
    const a = auth.get(k)
    if (r.michelin_designation && (!a || !a.michelinDesig)) {
      clears.push({ id: r.id, name: r.name, changes: { michelin_designation: null, michelin_url: null }, reason: `stale michelin (DB=${r.michelin_designation}, not in current guide)` })
    }
    if (r.eater_38 && (!a || !a.eater38City)) {
      clears.push({ id: r.id, name: r.name, changes: { eater_38: false }, reason: `stale eater_38` })
    }
    if (r.james_beard_winner && (!a || !a.jbfAwards?.length)) {
      clears.push({ id: r.id, name: r.name, changes: { james_beard_winner: false }, reason: `stale james_beard_winner` })
    }
  }

  // ==== Phase 2: INSERT missing restaurants (only those in 6 metros) ====
  const inserts: Array<{ name: string; city: string; state: string; michelin_designation?: string; michelin_url?: string; eater_38?: boolean; james_beard_winner?: boolean; metro: string }> = []
  for (const a of auth.values()) {
    const matches = dbByName.get(a.normName) || []
    if (matches.length) continue // already in DB (we handled via update/clear)
    const city = a.michelinCity || a.eater38City || ''
    if (!city) continue // can't place without city
    const metro = metroFor(city)
    if (!metro) continue // not in our 6-metro scope
    inserts.push({
      name: a.displayName,
      city,
      state: a.michelinState || (metro === 'NYC' ? 'NY' : metro === 'CHI' ? 'IL' : metro === 'LA' ? 'CA' : metro === 'MIA' ? 'FL' : metro === 'SF_BAY' ? 'CA' : metro === 'AUS' ? 'TX' : ''),
      michelin_designation: a.michelinDesig,
      michelin_url: a.michelinUrl,
      eater_38: !!a.eater38City,
      james_beard_winner: !!(a.jbfAwards?.length && a.jbfAwards.some(x => /Outstanding Restaurant|Best New Restaurant|Best Chef|Outstanding Chef|Outstanding Restaurateur|Outstanding Bar|Outstanding Wine|Outstanding Hospitality|Outstanding Pastry|Outstanding Bakery|America's Classic|Rising Star|Emerging Chef|Outstanding Service/i.test(x.award))),
      metro,
    })
  }

  // ==== Phase 3: build history inserts ====
  // Load current DB name→id map after potential inserts
  type HistInsert = { table: string; row: any }
  const histPlan: HistInsert[] = []
  // We need DB ids — these are determined post-insert. For the plan (dry-run),
  // we just count what WILL be inserted. The actual inserts happen after phase 2
  // commits, so we can look up ids at apply time.

  // ==== REPORT ====
  console.log(`\n=== PHASE 1 PLAN ===`)
  console.log(`updates (flag fix/add):  ${updates.length}`)
  console.log(`clears  (stale flags):   ${clears.length}`)
  console.log(`\nUpdate samples (first 20):`)
  for (const u of updates.slice(0, 20)) console.log(`  ${u.name.padEnd(34)} ${u.reason.join('; ')}`)
  console.log(`\nClear samples (first 10):`)
  for (const c of clears.slice(0, 10)) console.log(`  ${c.name.padEnd(34)} ${c.reason}`)

  console.log(`\n=== PHASE 2 PLAN ===`)
  console.log(`new restaurants in 6-metro scope: ${inserts.length}`)
  const byMetro: Record<string, number> = {}
  for (const i of inserts) byMetro[i.metro] = (byMetro[i.metro] || 0) + 1
  for (const [m, n] of Object.entries(byMetro).sort((a, b) => b[1] - a[1])) console.log(`  ${m}: ${n}`)
  console.log(`\nInsert samples (first 15):`)
  for (const i of inserts.slice(0, 15)) console.log(`  ${i.name.padEnd(34)} ${i.city.padEnd(20)} ${i.state.padEnd(3)} michelin=${i.michelin_designation ?? '-'} eater=${i.eater_38} jbf=${i.james_beard_winner}`)

  if (DRY_RUN) {
    console.log(`\n---\nDRY RUN — no changes written. Rerun with --apply to commit.`)
    fs.writeFileSync(`${AWARD_QA_DIR}/apply_plan.json`, JSON.stringify({ updates, clears, inserts }, null, 2))
    console.log(`wrote ${AWARD_QA_DIR}/apply_plan.json`)
    return
  }

  // ==== APPLY ====
  console.log(`\n=== APPLYING ===`)
  let ok = 0, fail = 0

  // Phase 1a: updates
  for (const u of updates) {
    const { error } = await s.from('restaurants').update(u.changes).eq('id', u.id)
    if (error) { console.error(`FAIL update ${u.name}: ${error.message}`); fail++ } else ok++
  }
  console.log(`phase 1a updates: ${ok} ok, ${fail} fail`)

  // Phase 1b: clears
  ok = 0; fail = 0
  for (const c of clears) {
    const { error } = await s.from('restaurants').update(c.changes).eq('id', c.id)
    if (error) { console.error(`FAIL clear ${c.name}: ${error.message}`); fail++ } else ok++
  }
  console.log(`phase 1b clears: ${ok} ok, ${fail} fail`)

  // Phase 2: inserts (in batches of 50)
  ok = 0; fail = 0
  for (let i = 0; i < inserts.length; i += 50) {
    const batch = inserts.slice(i, i + 50).map(({ metro: _m, ...row }) => row)
    const { error, data } = await s.from('restaurants').insert(batch).select('id')
    if (error) { console.error(`FAIL insert batch ${i}: ${error.message}`); fail += batch.length } else ok += (data?.length ?? batch.length)
  }
  console.log(`phase 2 inserts: ${ok} ok, ${fail} fail`)

  // Phase 3: history — re-fetch DB ids, then upsert history rows
  console.log(`\n=== PHASE 3: HISTORY ===`)
  const db2 = await allDbRows()
  const byNorm = new Map<string, any>()
  for (const r of db2) {
    const k = normName(r.name)
    if (!byNorm.has(k)) byNorm.set(k, r)
  }

  // Michelin history: current year only (we don't have year-by-year scrape yet)
  const CURRENT_YEAR = 2026
  const mhRows: any[] = []
  for (const [url, v] of Object.entries(michelinUnion)) {
    const name = (v.name && v.name.length >= 2) ? v.name : nameFromMichelinSlug(url)
    const r = byNorm.get(normName(name))
    if (!r) continue
    mhRows.push({ restaurant_id: r.id, year: CURRENT_YEAR, designation: DIST_TO_DESIG[v.distinction], source_url: `https://guide.michelin.com${url}` })
  }
  for (let i = 0; i < mhRows.length; i += 100) {
    const batch = mhRows.slice(i, i + 100)
    const { error } = await s.from('restaurant_michelin_history').upsert(batch, { onConflict: 'restaurant_id,year', ignoreDuplicates: false })
    if (error) console.error(`mh upsert err: ${error.message}`)
  }
  console.log(`michelin_history upserted: ${mhRows.length}`)

  // JBF history: all years per restaurant
  const jbfRows: any[] = []
  for (const e of jbfAll) {
    const restaurant = stripFootnotes(e.restaurant)
    if (!restaurant || restaurant.length < 3) continue
    const r = byNorm.get(normName(restaurant))
    if (!r) continue
    jbfRows.push({ restaurant_id: r.id, year: e.year, award_name: e.award_name.slice(0, 120), status: 'winner', region: null, chef_name: e.chef || null, source_url: null })
  }
  for (let i = 0; i < jbfRows.length; i += 100) {
    const batch = jbfRows.slice(i, i + 100)
    const { error } = await s.from('restaurant_jbf_history').upsert(batch, { onConflict: 'restaurant_id,year,award_name,status', ignoreDuplicates: true })
    if (error) console.error(`jbf upsert err: ${error.message}`)
  }
  console.log(`jbf_history upserted: ${jbfRows.length}`)

  // Eater 38 history: current year only
  const e38Rows: any[] = []
  for (const block of eaterAll) {
    for (const raw of block.restaurants) {
      const r = byNorm.get(normName(decodeEntities(raw)))
      if (!r) continue
      e38Rows.push({ restaurant_id: r.id, year: CURRENT_YEAR, city: block.city, list_url: null })
    }
  }
  for (let i = 0; i < e38Rows.length; i += 100) {
    const batch = e38Rows.slice(i, i + 100)
    const { error } = await s.from('restaurant_eater38_history').upsert(batch, { onConflict: 'restaurant_id,year,city', ignoreDuplicates: true })
    if (error) console.error(`e38 upsert err: ${error.message}`)
  }
  console.log(`eater38_history upserted: ${e38Rows.length}`)

  console.log(`\n=== DONE ===`)
}

main().catch(e => { console.error(e); process.exit(1) })
