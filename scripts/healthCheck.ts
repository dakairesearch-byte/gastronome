/**
 * Pipeline health check. Run after nightly refreshes (enrich / top-dishes /
 * menus) so a silently-broken run fails LOUDLY instead of going unnoticed.
 *
 *   npx tsx scripts/healthCheck.ts
 *
 * Exits non-zero if any assertion fails (suitable for cron / CI alerting).
 */
import { createClient } from '@supabase/supabase-js'
import * as fs from 'fs'
import * as path from 'path'

// ---------------- Env loading ----------------
const envPath = path.join(process.cwd(), '.env.local')
if (fs.existsSync(envPath)) {
  for (const line of fs.readFileSync(envPath, 'utf8').split('\n')) {
    const m = line.match(/^([A-Z0-9_]+)=(.*)$/)
    if (m && !process.env[m[1]]) process.env[m[1]] = m[2].replace(/^"|"$/g, '')
  }
}
const SUPA_URL = process.env.NEXT_PUBLIC_SUPABASE_URL!
const SUPA_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!
if (!SUPA_URL || !SUPA_KEY) {
  console.error('Missing NEXT_PUBLIC_SUPABASE_URL / SUPABASE_SERVICE_ROLE_KEY in .env.local')
  process.exit(1)
}
const sb = createClient(SUPA_URL, SUPA_KEY, { auth: { persistSession: false } })

// Tunables — override the staleness window via STALE_HOURS.
const STALE_HOURS = Number(process.env.STALE_HOURS ?? 36)
const MIN_RESTAURANTS = Number(process.env.MIN_RESTAURANTS ?? 100)
const MAX_NULL_RATING_PCT = Number(process.env.MAX_NULL_RATING_PCT ?? 60)

const failures: string[] = []
const warnings: string[] = []

async function count(table: string, filter?: (q: any) => any): Promise<number> {
  let q = sb.from(table).select('id', { count: 'exact', head: true })
  if (filter) q = filter(q)
  const { count: c, error } = await q
  if (error) {
    failures.push(`count(${table}) failed: ${error.message}`)
    return -1
  }
  return c ?? 0
}

async function main() {
  console.log('[health] running pipeline health check...\n')

  // 1. Core table is populated.
  const restaurants = await count('restaurants')
  if (restaurants >= 0 && restaurants < MIN_RESTAURANTS) {
    failures.push(`restaurants=${restaurants} below floor ${MIN_RESTAURANTS}`)
  }
  console.log(`  restaurants: ${restaurants}`)

  // 2. Ratings aren't overwhelmingly null (a broken enrich wipes/skips them).
  const nullRating = await count('restaurants', (q) => q.is('google_rating', null))
  if (restaurants > 0 && nullRating >= 0) {
    const pct = Math.round((nullRating / restaurants) * 100)
    console.log(`  null google_rating: ${pct}%`)
    if (pct > MAX_NULL_RATING_PCT) {
      failures.push(`null google_rating ${pct}% exceeds ${MAX_NULL_RATING_PCT}%`)
    }
  }

  // 3. Top dishes exist (the FromChips/computeTopDishes pipeline ran).
  const topDishes = await count('restaurant_top_dishes')
  console.log(`  restaurant_top_dishes: ${topDishes}`)
  if (topDishes === 0) failures.push('restaurant_top_dishes is empty')

  // 4. The most recent top-dishes computation isn't stale.
  const { data: latestDish } = await sb
    .from('restaurant_top_dishes')
    .select('computed_at')
    .order('computed_at', { ascending: false })
    .limit(1)
    .maybeSingle()
  if (latestDish?.computed_at) {
    const ageH = (Date.now() - new Date(latestDish.computed_at).getTime()) / 3.6e6
    console.log(`  top_dishes computed_at age: ${ageH.toFixed(1)}h`)
    if (ageH > STALE_HOURS) warnings.push(`top_dishes stale (${ageH.toFixed(1)}h > ${STALE_HOURS}h)`)
  } else {
    warnings.push('no top_dishes computed_at found')
  }

  // 5. A pipeline run logged recently (fetch_logs is the audit trail).
  const { data: latestLog } = await sb
    .from('fetch_logs')
    .select('created_at')
    .order('created_at', { ascending: false })
    .limit(1)
    .maybeSingle()
  if (latestLog?.created_at) {
    const ageH = (Date.now() - new Date(latestLog.created_at).getTime()) / 3.6e6
    console.log(`  last fetch_log age: ${ageH.toFixed(1)}h`)
    if (ageH > STALE_HOURS) warnings.push(`no fetch_logs in ${ageH.toFixed(1)}h`)
  } else {
    warnings.push('fetch_logs is empty')
  }

  console.log('')
  for (const w of warnings) console.warn(`  ⚠ WARN: ${w}`)
  for (const f of failures) console.error(`  ✗ FAIL: ${f}`)

  if (failures.length > 0) {
    console.error(`\n[health] ${failures.length} failure(s). Pipeline is unhealthy.`)
    process.exit(1)
  }
  console.log(`\n[health] OK${warnings.length ? ` (${warnings.length} warning(s))` : ''}.`)
}

main().catch((e) => {
  console.error('[health] crashed:', e)
  process.exit(1)
})
