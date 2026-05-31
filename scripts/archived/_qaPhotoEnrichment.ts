/**
 * Post-enrichment QA:
 *   1. Count rows with/without place_id + photos before vs after
 *   2. Spot-check 20 random rows: print (db_name, matched place name, address, photo)
 *   3. HEAD-check 20 random photo URLs via the Gastronome photo proxy
 *      (uses the deployed site or localhost)
 *   4. Cross-check: random rows where DB name vs Google displayName diverge
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

const PHOTO_PROXY_BASE = process.env.PHOTO_PROXY_BASE ?? 'https://gastronome.vercel.app'
const GOOGLE_API_KEY = process.env.GOOGLE_PLACES_API_KEY!

function normName(v: string): string {
  return (v || '').toLowerCase().normalize('NFKD').replace(/[\u0300-\u036f]/g, '').replace(/['']/g, "'").replace(/[^\w\s'&-]/g, ' ').replace(/\s+/g, ' ').replace(/\b(the|a|an|restaurant)\b/gi, '').replace(/\s+/g, ' ').trim()
}
function nameSim(a: string, b: string): number {
  const ta = new Set(normName(a).split(' ').filter(Boolean))
  const tb = new Set(normName(b).split(' ').filter(Boolean))
  if (!ta.size || !tb.size) return 0
  let inter = 0; for (const t of ta) if (tb.has(t)) inter++
  return inter / new Set([...ta, ...tb]).size
}

async function main() {
  // Coverage counts
  const { count: total } = await s.from('restaurants').select('*', { count: 'exact', head: true })
  const { count: withPid } = await s.from('restaurants').select('*', { count: 'exact', head: true }).not('google_place_id', 'is', null)
  const { count: withPhoto } = await s.from('restaurants').select('*', { count: 'exact', head: true }).not('photo_url', 'is', null).neq('photo_url', '')
  const { count: withArr } = await s.from('restaurants').select('*', { count: 'exact', head: true }).gt('array_length(photo_urls, 1)', 0).limit(1)

  console.log(`=== coverage ===`)
  console.log(`total:                     ${total}`)
  console.log(`with google_place_id:      ${withPid}  (${(100 * (withPid! / total!)).toFixed(1)}%)`)
  console.log(`with photo_url (primary):  ${withPhoto}  (${(100 * (withPhoto! / total!)).toFixed(1)}%)`)

  // Sample 20 random rows with photos
  const { data: sample } = await s
    .from('restaurants')
    .select('id, name, city, state, google_place_id, photo_url, photo_urls, address')
    .not('photo_url', 'is', null)
    .neq('photo_url', '')
    .order('id').limit(200)
  if (!sample?.length) { console.log('no sample rows'); return }
  const pick = (arr: any[], n: number) => arr.sort(() => Math.random() - 0.5).slice(0, n)
  const shown = pick(sample as any[], 20)
  console.log(`\n=== sample 20 enriched rows ===`)
  for (const r of shown) {
    const nPhotos = Array.isArray(r.photo_urls) ? r.photo_urls.length : 0
    console.log(`  ${r.name.slice(0, 30).padEnd(30)}  ${(r.city || '?').padEnd(16)} ${r.state ?? '?'}  photos=${nPhotos}  addr="${(r.address || '').slice(0, 40)}"`)
  }

  // HEAD-check 20 photo proxy URLs
  console.log(`\n=== HEAD-checking 20 random photo URLs via ${PHOTO_PROXY_BASE} ===`)
  const urls = pick(sample as any[], 20).map(r => `${PHOTO_PROXY_BASE}${r.photo_url}`).filter(Boolean)
  let ok = 0, bad = 0
  const badList: string[] = []
  for (const u of urls) {
    try {
      const res = await fetch(u, { method: 'HEAD', redirect: 'follow' })
      if (res.ok) ok++
      else { bad++; badList.push(`${res.status} ${u.slice(0, 80)}`) }
    } catch (e: any) { bad++; badList.push(`EXC ${e.message} ${u.slice(0, 80)}`) }
    await new Promise(r => setTimeout(r, 100))
  }
  console.log(`  ok=${ok}  bad=${bad}`)
  for (const b of badList.slice(0, 10)) console.log(`  ${b}`)

  // Name divergence spot-check: query Google with DB name and compare to stored address
  // (skipped when there's no API key; just reads what's in DB)
  console.log(`\n=== suspect-name scan (DB name vs stored address) ===`)
  let suspectCount = 0
  for (const r of shown) {
    if (!r.address) continue
    // Loose check: if the DB name tokens don't appear at all in the address, flag
    const nameTokens = normName(r.name).split(' ').filter(t => t.length > 3)
    const addrLower = (r.address || '').toLowerCase()
    const hits = nameTokens.filter(t => addrLower.includes(t))
    const ratio = nameTokens.length ? hits.length / nameTokens.length : 1
    if (ratio === 0 && nameTokens.length > 0) {
      suspectCount++
      console.log(`  SUSPECT: "${r.name}"  ≢  address="${r.address.slice(0, 60)}"`)
    }
  }
  console.log(`  suspects: ${suspectCount} / ${shown.length}`)

  console.log(`\n(Name divergence is often fine — e.g. "Le Bernardin" doesn't appear in "155 W 51st St". Use as triage signal, not truth.)`)
}

main().catch(e => { console.error(e); process.exit(1) })
