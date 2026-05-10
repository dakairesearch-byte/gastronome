/**
 * Find state=NULL vs state='NY' / state='CA' etc. duplicates.
 * For each normalized (name, city) pair, list all DB rows.
 * Also count child rows (mentions, menu_items) per candidate so we know
 * which twin has more data.
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

function normName(s: string): string {
  return (s || '').toLowerCase().normalize('NFKD').replace(/[\u0300-\u036f]/g, '').replace(/[''´`]/g, "'").replace(/[^\w\s'&-]/g, ' ').replace(/\s+/g, ' ').replace(/\b(the|a|an|restaurant)\b/gi, '').replace(/\s+/g, ' ').trim()
}

async function main() {
  // Pull all rows with the fields we need for conflict-resolution
  const rows: any[] = []
  let from = 0
  while (true) {
    const { data, error } = await s.from('restaurants').select('id, name, city, state, michelin_designation, eater_38, james_beard_winner, website, address, latitude, longitude, created_at, updated_at').range(from, from + 999)
    if (error) throw error
    if (!data?.length) break
    rows.push(...data)
    if (data.length < 1000) break
    from += 1000
  }
  console.log(`DB rows: ${rows.length}`)

  // Group by (normName, city)
  const groups = new Map<string, any[]>()
  for (const r of rows) {
    const k = `${normName(r.name)}||${(r.city || '').toLowerCase().trim()}`
    if (!groups.has(k)) groups.set(k, [])
    groups.get(k)!.push(r)
  }
  const dupGroups = Array.from(groups.entries()).filter(([_, rs]) => rs.length > 1)
  console.log(`Duplicate groups: ${dupGroups.length}`)
  console.log(`Duplicate rows total: ${dupGroups.reduce((s, [_, rs]) => s + rs.length, 0)}`)

  // For the top 30 duplicate groups, pull child-row counts for each twin
  const sampleGroups = dupGroups.slice(0, 30)
  console.log(`\n=== Top 30 duplicate groups (with child-row counts) ===`)
  for (const [k, rs] of sampleGroups) {
    const [name] = k.split('||')
    console.log(`\n  name="${name}" (${rs.length} rows):`)
    for (const r of rs) {
      const [{ count: mentions }, { count: items }, { count: signals }] = await Promise.all([
        s.from('review_dish_mentions').select('*', { count: 'exact', head: true }).eq('restaurant_id', r.id),
        s.from('restaurant_menu_items').select('*', { count: 'exact', head: true }).eq('restaurant_id', r.id),
        s.from('restaurant_dish_signals').select('*', { count: 'exact', head: true }).eq('restaurant_id', r.id).then((x: any) => x).catch(() => ({ count: 0 })),
      ])
      const hasAward = r.michelin_designation || r.eater_38 || r.james_beard_winner
      console.log(`    id=${r.id.slice(0, 8)}  state=${(r.state ?? 'NULL').padEnd(6)}  website=${r.website ? 'y' : 'n'}  mentions=${mentions ?? 0}  items=${items ?? 0}  signals=${signals ?? 0}  awards=${hasAward ? 'Y' : '-'}  addr="${(r.address || '').slice(0, 40)}"`)
    }
  }

  // Summary stats
  let totalWithAwards = 0, totalWithMentions = 0, totalWithItems = 0, groupsWithAwardCollision = 0
  for (const [_, rs] of dupGroups) {
    let hasAwardInGroup = false, hasMentionsInGroup = false, hasItemsInGroup = false
    for (const r of rs) {
      if (r.michelin_designation || r.eater_38 || r.james_beard_winner) hasAwardInGroup = true
    }
    if (hasAwardInGroup) groupsWithAwardCollision++
  }
  console.log(`\n=== Summary ===`)
  console.log(`Duplicate groups where at least one twin has awards: ${groupsWithAwardCollision}`)
}

main().catch(e => { console.error(e); process.exit(1) })
