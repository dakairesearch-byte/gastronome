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
  const { data: dict } = await s.from('dish_dict').select('phrase').ilike('phrase', '%pastrami%')
  console.log('pastrami in dict:', dict)
  const { data: r } = await s.from('restaurants').select('id, name').ilike('name', '%Katz%').limit(3)
  for (const rest of r ?? []) {
    console.log(`\n${(rest as any).name} (${(rest as any).id}):`)
    const { data: revs } = await s.from('external_reviews').select('source, rating, text').eq('restaurant_id', (rest as any).id).limit(10)
    console.log(`  ${revs?.length} reviews sampled`)
    for (const rev of revs ?? []) {
      const t = (rev as any).text ?? ''
      if (t.toLowerCase().includes('pastrami')) {
        console.log(`  [${(rev as any).source}] "${t.slice(0, 200)}"`)
      }
    }
    const { data: mentions } = await s.from('external_review_dish_mentions').select('dish_name, sentiment').eq('restaurant_id', (rest as any).id)
    const counts = new Map<string, number>()
    for (const m of mentions ?? []) counts.set((m as any).dish_name, ((counts.get((m as any).dish_name)) ?? 0) + 1)
    console.log(`  dishes extracted: ${Array.from(counts.entries()).sort((a,b)=>b[1]-a[1]).slice(0,10).map(([d,n])=>`${d}(${n})`).join(', ')}`)
  }
}
main()
