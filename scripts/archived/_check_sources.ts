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
  const { data } = await s.rpc('run_sql' as any, {}).then(() => ({ data: null })).catch(() => ({ data: null }))
  // Aggregate by source manually
  const sources = new Map<string, number>()
  const pageSize = 1000
  let total = 0
  for (let from = 0; ; from += pageSize) {
    const { data: batch } = await s.from('external_reviews').select('source').range(from, from + pageSize - 1)
    if (!batch || batch.length === 0) break
    for (const r of batch) {
      const src = (r as any).source
      sources.set(src, (sources.get(src) ?? 0) + 1)
      total += 1
    }
    if (batch.length < pageSize) break
  }
  console.log('external_reviews by source:')
  for (const [src, n] of sources) console.log(`  ${src}: ${n}`)
  console.log('total:', total)
}
main()
