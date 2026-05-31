/**
 * Throwaway audit — counts Michelin / Eater 38 / JBF / Bib restaurants per city,
 * and flags obvious data hygiene problems (e.g. james_beard_nominated tied to winner).
 * Delete after use.
 */
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
const s = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
  { auth: { persistSession: false } },
)

async function cnt(col: string, val: any): Promise<number> {
  const { count } = await s.from('restaurants').select('*', { count: 'exact', head: true }).eq(col, val)
  return count ?? 0
}

async function main() {
  const { count: total } = await s.from('restaurants').select('*', { count: 'exact', head: true })
  const m3 = await cnt('michelin_designation', 'three_star')
  const m2 = await cnt('michelin_designation', 'two_star')
  const m1 = await cnt('michelin_designation', 'one_star')
  const bib = await cnt('michelin_designation', 'bib_gourmand')
  const rec = await cnt('michelin_designation', 'recommended')
  const eater = await cnt('eater_38', true)
  const jbw = await cnt('james_beard_winner', true)
  const jbn = await cnt('james_beard_nominated', true)

  console.log(`== overall counts ==`)
  console.log(`total restaurants:     ${total}`)
  console.log(`Michelin ★★★:          ${m3}`)
  console.log(`Michelin ★★:           ${m2}`)
  console.log(`Michelin ★:            ${m1}`)
  console.log(`Bib Gourmand:          ${bib}`)
  console.log(`Michelin Recommended:  ${rec}`)
  console.log(`Eater 38:              ${eater}`)
  console.log(`James Beard winner:    ${jbw}`)
  console.log(`James Beard nominee:   ${jbn}`)

  const { count: jbwAndNom } = await s.from('restaurants')
    .select('*', { count: 'exact', head: true })
    .eq('james_beard_winner', true)
    .eq('james_beard_nominated', true)
  const { count: jbNomNoWin } = await s.from('restaurants')
    .select('*', { count: 'exact', head: true })
    .eq('james_beard_winner', false)
    .eq('james_beard_nominated', true)
  console.log(`JBF winner+nominee:    ${jbwAndNom}  (if == ${jbn}, fields are lockstep)`)
  console.log(`JBF nominee-only:      ${jbNomNoWin}`)

  // Cohort by city — pull paginated
  const byCity = new Map<string, { total: number; m3: number; m2: number; m1: number; bib: number; eater: number; jbw: number }>()
  let from = 0, pageSize = 1000
  while (true) {
    const { data, error } = await s
      .from('restaurants')
      .select('city, state, michelin_designation, eater_38, james_beard_winner')
      .range(from, from + pageSize - 1)
    if (error || !data || !data.length) break
    for (const r of data as any[]) {
      const k = `${r.city ?? '?'}, ${r.state ?? '?'}`
      const b = byCity.get(k) ?? { total: 0, m3: 0, m2: 0, m1: 0, bib: 0, eater: 0, jbw: 0 }
      b.total++
      if (r.michelin_designation === 'three_star') b.m3++
      else if (r.michelin_designation === 'two_star') b.m2++
      else if (r.michelin_designation === 'one_star') b.m1++
      else if (r.michelin_designation === 'bib_gourmand') b.bib++
      if (r.eater_38) b.eater++
      if (r.james_beard_winner) b.jbw++
      byCity.set(k, b)
    }
    if (data.length < pageSize) break
    from += pageSize
  }

  const top = Array.from(byCity.entries()).sort((a, b) => b[1].total - a[1].total).slice(0, 20)
  console.log(`\n== top 20 cities by restaurant count ==`)
  console.log(`${'city'.padEnd(30)}  tot  ★★★  ★★   ★  bib eater jbw`)
  for (const [c, b] of top) {
    console.log(`${c.slice(0, 30).padEnd(30)}  ${b.total.toString().padStart(3)}  ${b.m3.toString().padStart(3)}  ${b.m2.toString().padStart(3)}  ${b.m1.toString().padStart(3)}  ${b.bib.toString().padStart(3)}  ${b.eater.toString().padStart(4)}  ${b.jbw.toString().padStart(3)}`)
  }

  // Sanity: cities that actually have ANY awards (to know what we must re-scrape)
  const award = Array.from(byCity.entries()).filter(([_, b]) => b.m3 + b.m2 + b.m1 + b.bib + b.eater + b.jbw > 0).sort((a, b) => (b[1].m3+b[1].m2+b[1].m1+b[1].bib+b[1].eater+b[1].jbw) - (a[1].m3+a[1].m2+a[1].m1+a[1].bib+a[1].eater+a[1].jbw))
  console.log(`\n== cities with any awards (${award.length} cities) ==`)
  for (const [c, b] of award.slice(0, 30)) {
    const sum = b.m3 + b.m2 + b.m1 + b.bib + b.eater + b.jbw
    console.log(`  ${sum.toString().padStart(3)}  ${c}`)
  }
}

main().catch(e => { console.error(e); process.exit(1) })
