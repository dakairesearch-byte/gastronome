/**
 * Upsert year-by-year Michelin history from Wikipedia per-city articles
 * into restaurant_michelin_history. Matches entries to DB rows by normName + state.
 *
 * Usage:  npx tsx scripts/applyMichelinHistory.ts [--apply]
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
console.log(`=== applyMichelinHistory ${DRY ? '(DRY)' : '(APPLY)'} ===\n`)

const historical = JSON.parse(fs.readFileSync('/sessions/amazing-compassionate-lovelace/tmp/award-qa/michelin/historical_by_year.json', 'utf8')) as Array<{ name: string; year: number; designation: string; location: string; state: string; source_file: string }>

function decodeEntities(v: string): string {
  return (v || '').replace(/&amp;/g, '&').replace(/&#x27;/g, "'").replace(/&#39;/g, "'").replace(/&quot;/g, '"').replace(/&nbsp;/g, ' ').replace(/&mdash;/g, '—').replace(/&ndash;/g, '–').replace(/&lt;/g, '<').replace(/&gt;/g, '>')
}
function normName(s: string): string {
  return decodeEntities(s || '').toLowerCase().normalize('NFKD').replace(/[\u0300-\u036f]/g, '').replace(/[''´`]/g, "'").replace(/[^\w\s'&-]/g, ' ').replace(/\s+/g, ' ').replace(/\b(the|a|an|restaurant)\b/gi, '').replace(/\s+/g, ' ').trim()
}

async function main() {
  // Fetch all DB rows
  const rows: any[] = []; let from = 0
  while (true) {
    const { data } = await s.from('restaurants').select('id, name, city, state').range(from, from + 999)
    if (!data?.length) break
    rows.push(...data)
    if (data.length < 1000) break
    from += 1000
  }
  console.log(`DB rows: ${rows.length}`)

  // Index by normName → array of DB rows (to allow same-name disambiguation by state)
  const idx = new Map<string, any[]>()
  for (const r of rows) {
    const k = normName(r.name)
    if (!idx.has(k)) idx.set(k, [])
    idx.get(k)!.push(r)
  }

  // Build history-row plan
  const plan: Array<{ restaurant_id: string; year: number; designation: string; source_url: string | null }> = []
  let matched = 0, unmatched = 0
  const unmatchedNames = new Set<string>()
  for (const h of historical) {
    const dbRows = idx.get(normName(h.name)) || []
    // Prefer same-state
    const target = dbRows.find(r => r.state === h.state) || dbRows[0]
    if (!target) {
      unmatched++
      unmatchedNames.add(h.name)
      continue
    }
    plan.push({
      restaurant_id: target.id,
      year: h.year,
      designation: h.designation,
      source_url: null,
    })
    matched++
  }
  console.log(`Historical entries: ${historical.length}`)
  console.log(`Matched to DB: ${matched}`)
  console.log(`Unmatched: ${unmatched} (unique names: ${unmatchedNames.size})`)
  console.log(`\nUnmatched sample (first 20):`)
  Array.from(unmatchedNames).slice(0, 20).forEach(n => console.log(`  ${n}`))

  // Dedupe plan rows (restaurant_id, year) — keep the highest rank
  const rank = { 'three_star': 4, 'two_star': 3, 'one_star': 2, 'bib_gourmand': 1 }
  const uniq = new Map<string, typeof plan[0]>()
  for (const p of plan) {
    const k = `${p.restaurant_id}|${p.year}`
    const prev = uniq.get(k)
    if (!prev || (rank[p.designation as keyof typeof rank] ?? 0) > (rank[prev.designation as keyof typeof rank] ?? 0)) {
      uniq.set(k, p)
    }
  }
  const uniqPlan = Array.from(uniq.values())
  console.log(`\nDeduped plan rows: ${uniqPlan.length}`)
  console.log(`Years covered: ${Math.min(...uniqPlan.map(x => x.year))} - ${Math.max(...uniqPlan.map(x => x.year))}`)

  if (DRY) { console.log('\n--- DRY RUN — re-run with --apply to commit ---'); return }

  // Upsert in batches (onConflict restaurant_id,year)
  let ok = 0, fail = 0
  for (let i = 0; i < uniqPlan.length; i += 100) {
    const batch = uniqPlan.slice(i, i + 100)
    const { error } = await s.from('restaurant_michelin_history').upsert(batch, { onConflict: 'restaurant_id,year', ignoreDuplicates: false })
    if (error) { console.error(`batch ${i} err: ${error.message}`); fail += batch.length } else ok += batch.length
  }
  console.log(`\nUpserted: ${ok} ok, ${fail} fail`)
}

main().catch(e => { console.error(e); process.exit(1) })
