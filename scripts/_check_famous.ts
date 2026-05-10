import { createClient } from '@supabase/supabase-js'
import fs from 'node:fs'
import path from 'node:path'
const envPath = path.join(process.cwd(), '.env.local')
for (const line of fs.readFileSync(envPath, 'utf-8').split('\n')) {
  const m = line.match(/^\s*([A-Z_][A-Z0-9_]*)\s*=\s*(.*)\s*$/)
  if (m && !process.env[m[1]]) process.env[m[1]] = m[2].replace(/^"|"$/g, '')
}
async function main() {
  const s = createClient(process.env.NEXT_PUBLIC_SUPABASE_URL!, process.env.SUPABASE_SERVICE_ROLE_KEY!)
  const famous = [
    'Katz', 'Peter Luger', 'Joe', "Lilia", "Keens", 'Xi', "Raoul", "Rosa Mexicano",
    'Carbone', 'Rubirosa', 'Prince Street', 'Joe\'s Pizza',
    'Momofuku', 'Eleven Madison', 'Gramercy', 'Russ & Daughters',
    'Levain', 'Dominique Ansel', 'Mission Chinese',
  ]
  for (const frag of famous) {
    const { data: rests } = await s.from('restaurants').select('id, name').ilike('name', `%${frag}%`).limit(3)
    for (const r of rests ?? []) {
      const { data: dishes } = await s
        .from('restaurant_top_dishes')
        .select('rank, display_name, score, positive_count, negative_count, neutral_count, tier, google_mentions, sample_quote')
        .eq('restaurant_id', (r as any).id)
        .order('rank')
        .limit(8)
      if (!dishes || dishes.length === 0) continue
      console.log(`\n# ${(r as any).name}`)
      for (const d of dishes) {
        const q = (d as any).sample_quote?.slice(0, 70) ?? '-'
        console.log(`  #${(d as any).rank} [${(d as any).tier === 'menu_anchored' ? 'M' : 'D'}] ${((d as any).display_name as string).padEnd(26)} s=${((d as any).score as number).toFixed(1).padStart(5)} +${(d as any).positive_count}/-${(d as any).negative_count}/=${(d as any).neutral_count} g=${(d as any).google_mentions} "${q}"`)
      }
    }
  }
}
main()
