/**
 * Dump newly inserted restaurant ids (with website / with place_id) to text files
 * for use by scrapeMenusV100 + scrapeGoogleReviewsBulk.
 */
import { createClient } from '@supabase/supabase-js'
import * as fs from 'fs'
import * as path from 'path'

const envPath = path.join(process.cwd(), '.env.local')
if (fs.existsSync(envPath)) {
  for (const line of fs.readFileSync(envPath, 'utf8').split('\n')) {
    const m = line.match(/^([A-Z0-9_]+)=(.*)$/); if (m && !process.env[m[1]]) process.env[m[1]] = m[2].replace(/^"|"$/g, '')
  }
}
const s = createClient(process.env.NEXT_PUBLIC_SUPABASE_URL!, process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!, { auth: { persistSession: false } })

async function main() {
  const tmp = path.join(process.cwd(), 'tmp')
  fs.mkdirSync(tmp, { recursive: true })

  // For menu scraping: rows with a website
  const { data: m } = await s.from('restaurants').select('id, name, website').gte('created_at', '2026-04-24').not('website', 'is', null).neq('website', '').order('id')
  const menuIds = (m ?? []).map((r: any) => r.id)
  fs.writeFileSync(path.join(tmp, 'new-menu-ids.txt'), menuIds.join('\n'))
  console.log(`new-menu-ids.txt: ${menuIds.length}`)

  // For Google Maps chips/reviews: rows with a google_place_id
  const { data: g } = await s.from('restaurants').select('id, name, google_place_id').gte('created_at', '2026-04-24').not('google_place_id', 'is', null).order('id')
  const googleIds = (g ?? []).map((r: any) => r.id)
  fs.writeFileSync(path.join(tmp, 'new-google-ids.txt'), googleIds.join('\n'))
  console.log(`new-google-ids.txt: ${googleIds.length}`)
}
main().catch(e => { console.error(e); process.exit(1) })
