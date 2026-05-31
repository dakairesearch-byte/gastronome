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
const s = createClient(process.env.NEXT_PUBLIC_SUPABASE_URL!, process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!, { auth: { persistSession: false } })
async function main() {
  const { data: three } = await s.from('restaurants').select('id, name, city, state, michelin_stars, michelin_designation').eq('michelin_designation', 'three_star').order('name')
  console.log(`== ALL ★★★ in DB (${three?.length}) ==`)
  for (const r of (three ?? []) as any[]) console.log(`  ${(r.name||'').padEnd(36)} ${r.city||'?'}, ${r.state||'?'}`)

  const { data: twos } = await s.from('restaurants').select('id, name, city, state').eq('michelin_designation', 'two_star').order('city', { ascending: true }).order('name')
  console.log(`\n== ALL ★★ in DB (${twos?.length}) ==`)
  for (const r of (twos ?? []) as any[]) console.log(`  ${(r.name||'').padEnd(36)} ${r.city||'?'}, ${r.state||'?'}`)

  // Look for famous 3-stars by name — are they in the DB but mislabeled?
  const famous = ['Eleven Madison Park','Le Bernardin','Masa','Per Se',"Chef's Table",'Atomix','Alinea','Smyth','Atelier Crenn','Benu','Quince','Saison','SingleThread','Single Thread','The French Laundry','French Laundry','Manresa']
  console.log(`\n== famous 3-stars — where are they in the DB? ==`)
  for (const q of famous) {
    const { data: found } = await s.from('restaurants').select('name, city, state, michelin_designation, michelin_stars').ilike('name', `%${q}%`).limit(3)
    if (!found?.length) { console.log(`  [MISSING FROM DB] ${q}`); continue }
    for (const r of found as any[]) {
      console.log(`  ${(r.name||'').padEnd(36)} ${(r.city||'').padEnd(18)} ${(r.state||'?').padEnd(4)} → ${r.michelin_designation || 'none'}`)
    }
  }

  // Same check for 2-stars
  const famous2 = ['Atera','Aska','Daniel','Jungsik','Al Coro','Acquerello','Acquerello SF','Lazy Bear','Californios','Gary Danko','Providence','Mélisse','n/naka','Ever','Oriole','Addison']
  console.log(`\n== famous 2-stars — where are they? ==`)
  for (const q of famous2) {
    const { data: found } = await s.from('restaurants').select('name, city, state, michelin_designation').ilike('name', `%${q}%`).limit(2)
    if (!found?.length) { console.log(`  [MISSING FROM DB] ${q}`); continue }
    for (const r of found as any[]) {
      console.log(`  ${(r.name||'').padEnd(36)} ${(r.city||'').padEnd(18)} ${(r.state||'?').padEnd(4)} → ${r.michelin_designation || 'none'}`)
    }
  }
}
main().catch(e => { console.error(e); process.exit(1) })
