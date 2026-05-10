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
  for (const src of ['ecosia', 'startpage']) {
    const { data } = await s.from('external_reviews').select('text, rating').eq('source', src).limit(3)
    console.log(`\n${src} examples:`)
    for (const r of data ?? []) console.log(`  [rating=${(r as any).rating}] len=${(r as any).text?.length} :: ${(r as any).text?.slice(0, 200)}`)
  }
}
main()
