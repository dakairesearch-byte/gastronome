/**
 * Fetch business_status from Google Places Details for every row with
 * google_place_id, populate the column, then DELETE all rows where
 * business_status = 'CLOSED_PERMANENTLY'.
 *
 *   --dryRun     do everything except the final DELETE
 *   --apply      (default) actually delete
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
const KEY = process.env.GOOGLE_PLACES_API_KEY!

const args = Object.fromEntries(process.argv.slice(2).map(a => { const [k,v]=a.replace(/^--/,'').split('='); return [k, v ?? 'true'] })) as Record<string,string>
const DRY = args.dryRun === 'true'

async function main() {
  // Pull all rows with place_id and current business_status (so we can resume)
  const rows: Array<{id:string; name:string; google_place_id:string; business_status:string|null; michelin_designation:string|null}> = []
  let from = 0
  while (true) {
    const { data, error } = await s.from('restaurants').select('id, name, google_place_id, business_status, michelin_designation').not('google_place_id','is',null).range(from, from+999)
    if (error) throw error
    if (!data?.length) break
    rows.push(...(data as any))
    if (data.length < 1000) break
    from += 1000
  }
  console.log(`rows to check: ${rows.length}`)
  const toFetch = rows.filter(r => !r.business_status)
  console.log(`need fresh business_status: ${toFetch.length}`)

  let ops=0, ct=0, cp=0, fail=0
  for (let i = 0; i < toFetch.length; i++) {
    const r = toFetch[i]
    try {
      const res = await fetch(`https://places.googleapis.com/v1/places/${encodeURIComponent(r.google_place_id)}`, {
        headers: { 'X-Goog-Api-Key': KEY, 'X-Goog-FieldMask': 'businessStatus' },
      })
      if (!res.ok) { fail++; continue }
      const j = await res.json() as { businessStatus?: string }
      const status = j.businessStatus ?? 'OPERATIONAL'
      await s.from('restaurants').update({ business_status: status }).eq('id', r.id)
      if (status === 'OPERATIONAL') ops++
      else if (status === 'CLOSED_TEMPORARILY') ct++
      else if (status === 'CLOSED_PERMANENTLY') cp++
      if ((i+1) % 100 === 0) console.log(`  fetched ${i+1}/${toFetch.length}  ops=${ops} closed_temp=${ct} closed_perm=${cp} fail=${fail}`)
    } catch (e) { fail++ }
    await new Promise(r => setTimeout(r, 60))
  }
  console.log(`\nfetch done: ops=${ops} closed_temp=${ct} closed_perm=${cp} fail=${fail}`)

  // Now delete all closed_permanently
  const { count: cpCount } = await s.from('restaurants').select('*', { count: 'exact', head: true }).eq('business_status', 'CLOSED_PERMANENTLY')
  console.log(`\nrows with CLOSED_PERMANENTLY: ${cpCount}`)

  if (DRY) {
    console.log('DRY — skipping delete')
    return
  }

  // Paginate: PostgREST caps un-ranged selects at 1000 rows; an unpaginated read
  // here would silently purge only the first 1000 CLOSED_PERMANENTLY rows.
  const closed: Array<{ id: string; name: string; city: string | null; michelin_designation: string | null }> = []
  for (let cFrom = 0; ; cFrom += 1000) {
    const { data, error } = await s.from('restaurants').select('id, name, city, michelin_designation').eq('business_status', 'CLOSED_PERMANENTLY').order('id').range(cFrom, cFrom + 999)
    if (error) throw error
    if (!data?.length) break
    closed.push(...(data as any))
    if (data.length < 1000) break
  }
  console.log(`\n=== will DELETE these ${closed?.length} rows (cascades to history/menus/mentions): ===`)
  for (const r of (closed ?? []) as any[]) console.log(`  ${r.name} — ${r.city} — michelin=${r.michelin_designation ?? 'none'}`)

  if (closed?.length) {
    const ids = (closed as any[]).map(r => r.id)
    // Delete in chunks to keep URLs sane
    let deleted = 0, dfail = 0
    for (let i = 0; i < ids.length; i += 50) {
      const chunk = ids.slice(i, i + 50)
      const { error } = await s.from('restaurants').delete().in('id', chunk)
      if (error) { dfail += chunk.length; console.error(`delete chunk err: ${error.message}`) }
      else deleted += chunk.length
    }
    console.log(`\nDELETED: ${deleted}  fail: ${dfail}`)
  }
}
main().catch(e => { console.error(e); process.exit(1) })
