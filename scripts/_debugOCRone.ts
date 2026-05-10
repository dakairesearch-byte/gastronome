// Debug wrapper: import scrapeMenusOCR's processOne and run on one restaurant to surface the real error
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

const ID = process.argv[2] || 'b37dc06d-9ba4-41a8-8ff4-8766add47f1c' // Ippudo default

async function main() {
  const { data: r, error } = await supabase.from('restaurants').select('id, name, website').eq('id', ID).single()
  if (error || !r) { console.error('lookup failed', error); process.exit(1) }
  console.log('target:', r)

  // Dynamically import processOne (named export isn't exposed, so re-import the module as side effect — instead call its logic inline)
  try {
    const mod: any = await import('./scrapeMenusOCR.ts' as any)
    console.log('module keys:', Object.keys(mod))
  } catch (e: any) {
    console.error('IMPORT ERROR:', e?.stack || e?.message || e)
  }
}
main().catch(e => { console.error('TOP ERROR:', e?.stack || e?.message || e); process.exit(1) })
