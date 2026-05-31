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
  const { data } = await s.from('restaurant_top_dishes').select('*').limit(2)
  console.log('restaurant_top_dishes sample:', JSON.stringify(data, null, 2))
  const { count } = await s.from('restaurant_top_dishes').select('id', { count: 'exact', head: true })
  console.log('total rows:', count)
  const { count: rcount } = await s.from('restaurants').select('id', { count: 'exact', head: true })
  console.log('total restaurants:', rcount)
  const { data: mexample } = await s.from('external_review_dish_mentions').select('*').limit(2)
  console.log('external_review_dish_mentions sample:', JSON.stringify(mexample, null, 2))
  const { count: mcount } = await s.from('external_review_dish_mentions').select('id', { count: 'exact', head: true })
  console.log('total mentions:', mcount)
}
main()
