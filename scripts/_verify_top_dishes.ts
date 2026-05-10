// One-shot spot check: print top dishes for a handful of well-known
// restaurants to confirm restaurant_top_dishes is populated and sensible
// before we consider Phase A "done". Disposable — delete after.
import { createClient } from '@supabase/supabase-js'
import fs from 'node:fs'
import path from 'node:path'

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
  const picks = [
    "Katz's Delicatessen", 'Keens Steakhouse', 'Carbone', "Raoul's",
    "Joe's Shanghai", "Xi'an Famous Foods", 'a.o.c.', "Roberta's",
    'Di Fara Pizza', 'Lilia',
  ]
  for (const name of picks) {
    const { data: rs } = await supa
      .from('restaurants')
      .select('id, name')
      .ilike('name', `%${name}%`)
      .limit(1)
    if (!rs || rs.length === 0) {
      console.log(`[not found] ${name}`)
      continue
    }
    const r = rs[0]
    const { data: ds } = await supa
      .from('restaurant_top_dishes')
      .select(
        'rank, display_name, score, total_mentions, positive_count, negative_count, tier, sample_quote, menu_item_id'
      )
      .eq('restaurant_id', r.id)
      .order('rank')
      .limit(6)
    console.log(`\n=== ${r.name} ===`)
    if (!ds || ds.length === 0) {
      console.log('  (no top dishes)')
      continue
    }
    for (const d of ds) {
      const badge = d.menu_item_id ? '[M]' : '[R]'
      const q = d.sample_quote
        ? ` "${String(d.sample_quote).slice(0, 60).replace(/\s+/g, ' ')}..."`
        : ''
      console.log(
        `  #${d.rank} ${badge} ${String(d.display_name).padEnd(28)} ` +
          `score=${Number(d.score).toFixed(2).padStart(6)}  ` +
          `n=${d.total_mentions}  +${d.positive_count}/-${d.negative_count}${q}`
      )
    }
  }
}
main().catch((e) => {
  console.error(e)
  process.exit(1)
})
