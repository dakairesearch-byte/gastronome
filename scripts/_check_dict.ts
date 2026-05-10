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
  const { data } = await s.from('dish_dict').select('canonical, phrase, confidence').in('phrase', ['hummu', 'hummus', 'steak frite', 'steak frites', 'oyster', 'oysters', 'kebab', 'kebabs', 'falafel', 'steak'])
  console.log('specific:', JSON.stringify(data, null, 2))
  const { data: total } = await s.from('dish_dict').select('phrase').like('phrase', '%humm%')
  console.log('humm-like:', total?.map(r => r.phrase))
  const { data: all } = await s.from('dish_dict').select('phrase').order('phrase').limit(80)
  console.log('first 80 A-:', all?.map(r => r.phrase).join(', '))
  const { count } = await s.from('dish_dict').select('phrase', { count: 'exact', head: true })
  console.log('total rows:', count)
}
main()
