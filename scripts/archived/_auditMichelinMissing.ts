import { createClient } from '@supabase/supabase-js'
import * as fs from 'fs'
import * as path from 'path'
const envPath = path.join(process.cwd(), '.env.local')
if (fs.existsSync(envPath)) for (const line of fs.readFileSync(envPath, 'utf8').split('\n')) { const m = line.match(/^([A-Z0-9_]+)=(.*)$/); if (m && !process.env[m[1]]) process.env[m[1]] = m[2].replace(/^"|"$/g, '') }
const s = createClient(process.env.NEXT_PUBLIC_SUPABASE_URL!, process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!, { auth: { persistSession: false } })
async function main() {
  // Hunt for Masa under various spellings + Napa Valley + Sushi Yasuda etc
  const qs = ['Masa', 'MASA', 'Sushi Masa', 'Yountville', 'Healdsburg', 'Napa', 'Sonoma', 'French Laundry', 'Single Thread', 'SingleThread', 'Addison', 'Del Mar', 'Al Coro', 'Atera', 'Aska', 'Brooklyn Fare']
  for (const q of qs) {
    const { data } = await s.from('restaurants').select('name, city, state, michelin_designation').ilike('name', `%${q}%`).limit(3)
    if (!data?.length) { console.log(`[MISS] ${q}`); continue }
    for (const r of data as any[]) console.log(`  ${q.padEnd(20)} → ${r.name.padEnd(34)} ${(r.city||'').padEnd(16)} ${r.state||'?'}  ${r.michelin_designation||'none'}`)
  }

  // What cities exist that contain famous restaurant areas?
  const { data: napa } = await s.from('restaurants').select('name, city, state').or('city.ilike.%Yountville%,city.ilike.%Healdsburg%,city.ilike.%Napa%,city.ilike.%Sonoma%').limit(30)
  console.log(`\n== Napa/Yountville/Healdsburg rows in DB ==`)
  for (const r of (napa ?? []) as any[]) console.log(`  ${r.name} — ${r.city}, ${r.state||'?'}`)

  // Confirm the full "state='?'" vs "state='NY'" split for NY
  const { count: nyNull } = await s.from('restaurants').select('*', { count: 'exact', head: true }).eq('city', 'New York').is('state', null)
  const { count: nyBlank } = await s.from('restaurants').select('*', { count: 'exact', head: true }).eq('city', 'New York').eq('state', '')
  const { count: nyQ } = await s.from('restaurants').select('*', { count: 'exact', head: true }).eq('city', 'New York').eq('state', '?')
  const { count: nyNY } = await s.from('restaurants').select('*', { count: 'exact', head: true }).eq('city', 'New York').eq('state', 'NY')
  console.log(`\n== NY state-column split ==`)
  console.log(`  NULL   : ${nyNull}`)
  console.log(`  ''     : ${nyBlank}`)
  console.log(`  '?'    : ${nyQ}`)
  console.log(`  'NY'   : ${nyNY}`)
}
main().catch(e => { console.error(e); process.exit(1) })
