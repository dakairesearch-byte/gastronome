// Simulate the restaurant detail page transform — pull raw top-dish
// rows for a handful of restaurants, apply titleCaseDish +
// dedupePluralDishes, and show the before/after so we know the UI will
// look right in production. Disposable once the audit is done.
import { createClient } from '@supabase/supabase-js'
import fs from 'node:fs'
import path from 'node:path'
import { titleCaseDish, dedupePluralDishes } from '../src/lib/dishes/display'

const envPath = path.join(process.cwd(), '.env.local')
if (fs.existsSync(envPath)) {
  for (const line of fs.readFileSync(envPath, 'utf-8').split('\n')) {
    const m = line.match(/^\s*([A-Z_][A-Z0-9_]*)\s*=\s*(.*)\s*$/)
    if (m && !process.env[m[1]]) process.env[m[1]] = m[2].replace(/^"|"$/g, '')
  }
}

async function main() {
  const supa = createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!,
    { auth: { persistSession: false } }
  )
  // Mix of known-good and known-messy restaurants. Include a couple that
  // had plural dupes in the SQL audit + a few with menu-anchored items
  // so we see [M] vs [R] behavior end-to-end.
  const picks = [
    "Katz's Delicatessen", 'Carbone', "Raoul's", "Joe's Shanghai",
    'a.o.c.', 'Di Fara Pizza', 'Keens', "Peter Luger", 'Emmy Squared',
    "L'Artusi", 'Lilia', 'The Grill',
  ]
  for (const name of picks) {
    const { data: rs } = await supa.from('restaurants').select('id, name').ilike('name', `%${name}%`).limit(1)
    if (!rs || rs.length === 0) { console.log(`[not found] ${name}`); continue }
    const r = rs[0]
    const { data: ds } = await supa
      .from('restaurant_top_dishes')
      .select('rank, display_name, total_mentions, tier, menu_item_id, restaurant_menu_items:menu_item_id ( item_name )')
      .eq('restaurant_id', r.id)
      .order('rank')
      .limit(15)
    if (!ds || ds.length === 0) { console.log(`\n=== ${r.name} === (no dishes)`); continue }
    type Row = {
      display_name: string
      total_mentions: number | null
      tier: string
      menu_item_id: string | null
      restaurant_menu_items:
        | { item_name: string | null }
        | { item_name: string | null }[]
        | null
    }
    const typed = ds as unknown as Row[]
    const projected = typed.map((d) => {
      const j = d.restaurant_menu_items
      const menuName = Array.isArray(j) ? j[0]?.item_name : j?.item_name
      const rawName = d.display_name
      const displayed = titleCaseDish(
        (menuName && menuName.trim()) || rawName
      )
      return {
        name: displayed,
        rawName,
        count: d.total_mentions ?? 0,
        tier: d.tier,
      }
    })
    const final = dedupePluralDishes(projected).slice(0, 6)
    console.log(`\n=== ${r.name} ===`)
    console.log('  Top 6 chips (simulated UI output):')
    for (const d of final) {
      const changed = d.name !== d.rawName
      console.log(`    ${d.name.padEnd(30)} (n=${d.count}, ${d.tier})${changed ? `   [raw: "${d.rawName}"]` : ''}`)
    }
    const dropped = projected.slice(0, 15).length - final.length
    if (dropped > 0) console.log(`  (${dropped} additional rows below the top 6 window)`)
  }
}
main().catch((e) => { console.error(e); process.exit(1) })
