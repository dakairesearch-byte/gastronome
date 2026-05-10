// Insert a vision-extracted menu for one restaurant into restaurant_menu_items.
// Usage: node scripts/insertVisionMenu.ts <path-to-json>
// JSON shape:
//   { restaurant_id: string, items: [{ item_name, price_cents?: number, section?, description? }] }
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
const SUPA_URL = process.env.NEXT_PUBLIC_SUPABASE_URL!
const SUPA_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!
const supabase = createClient(SUPA_URL, SUPA_KEY, { auth: { persistSession: false } })

async function main() {
  const file = process.argv[2]
  if (!file) { console.error('usage: insertVisionMenu.ts <file.json>'); process.exit(1) }
  const payload = JSON.parse(fs.readFileSync(file, 'utf8'))
  const { restaurant_id, items } = payload
  if (!restaurant_id || !Array.isArray(items) || items.length === 0) {
    console.error('bad payload'); process.exit(1)
  }
  // Clear any existing vision-source rows for this restaurant to make this idempotent
  const { error: delErr } = await supabase.from('restaurant_menu_items')
    .delete().eq('restaurant_id', restaurant_id).eq('source', 'website-vision')
  if (delErr) { console.error('delete failed:', delErr.message); process.exit(1) }

  const rows = items
    .filter((x: any) => x && typeof x.item_name === 'string' && x.item_name.trim().length > 1)
    .map((x: any) => ({
      restaurant_id,
      item_name: x.item_name.trim().slice(0, 200),
      section: x.section ? String(x.section).trim().slice(0, 120) : null,
      description: x.description ? String(x.description).trim().slice(0, 500) : null,
      price_cents: (typeof x.price_cents === 'number' && x.price_cents >= 50 && x.price_cents <= 100000) ? x.price_cents : null,
      source: 'website-vision'
    }))
  if (rows.length === 0) { console.error('no valid rows'); process.exit(1) }

  // Dedup within the batch on item_name+section
  const seen = new Set<string>()
  const deduped = rows.filter(r => {
    const k = (r.section || '') + '|' + r.item_name.toLowerCase()
    if (seen.has(k)) return false
    seen.add(k); return true
  })

  const { data: r } = await supabase.from('restaurants').select('name,city').eq('id', restaurant_id).single()
  const { error } = await supabase.from('restaurant_menu_items').insert(deduped)
  if (error) { console.error('insert failed:', error.message); process.exit(1) }
  console.log(`[OK] ${r?.name} (${r?.city}) — ${deduped.length} items inserted`)
}
main().catch(e => { console.error(e); process.exit(1) })
