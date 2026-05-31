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
  const { count: rTotal } = await s.from('restaurants').select('id', { count: 'exact', head: true })
  // Get restaurants with at least N dishes
  const thresholds = [1, 3, 5, 10]
  const pageSize = 1000
  const counts = new Map<string, number>()
  for (let from = 0; ; from += pageSize) {
    const { data } = await s.from('restaurant_top_dishes').select('restaurant_id').range(from, from + pageSize - 1)
    if (!data || data.length === 0) break
    for (const r of data) counts.set((r as any).restaurant_id, (counts.get((r as any).restaurant_id) ?? 0) + 1)
    if (data.length < pageSize) break
  }
  console.log(`Total restaurants: ${rTotal}`)
  console.log(`Restaurants with top-dishes rows: ${counts.size}`)
  for (const t of thresholds) {
    let n = 0
    for (const c of counts.values()) if (c >= t) n += 1
    console.log(`  with ≥${t} dishes: ${n}`)
  }
  // Distribution of total_mentions for top-1 dish
  const { data: top1 } = await s.from('restaurant_top_dishes').select('total_mentions, score').eq('rank', 1)
  const bucket = [0, 0, 0, 0, 0, 0]
  for (const r of top1 ?? []) {
    const n = (r as any).total_mentions as number
    if (n < 2) bucket[0]++
    else if (n < 5) bucket[1]++
    else if (n < 10) bucket[2]++
    else if (n < 20) bucket[3]++
    else if (n < 50) bucket[4]++
    else bucket[5]++
  }
  console.log(`Top-1 dish mention distribution: <2:${bucket[0]}  2-4:${bucket[1]}  5-9:${bucket[2]}  10-19:${bucket[3]}  20-49:${bucket[4]}  50+:${bucket[5]}`)
  // Menu-anchored vs rollup
  const { data: tiers } = await s.from('restaurant_top_dishes').select('tier').eq('rank', 1)
  const tierCount = new Map<string, number>()
  for (const r of tiers ?? []) tierCount.set((r as any).tier, (tierCount.get((r as any).tier) ?? 0) + 1)
  console.log(`Top-1 dish tier: ${Array.from(tierCount.entries()).map(([k,v])=>`${k}=${v}`).join(', ')}`)
}
main()
