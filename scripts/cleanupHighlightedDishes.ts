/**
 * cleanupHighlightedDishes.ts
 *
 * Task #10 companion: prune obvious noise rows from restaurant_highlighted_dishes
 * and canonicalize over-aggressive stems (e.g. "hummu" -> "hummus", "frie" ->
 * "fries", "meatball" -> "meatballs") so users see natural dish names on the
 * restaurant page.
 *
 * We do NOT touch `dish_name` when a row also has a matched_menu_item_id —
 * the matcher already promoted it to a display_name, so the raw dish_name can
 * stay for traceability. We only target rows with no promotion.
 *
 * Run:
 *   npx tsx scripts/cleanupHighlightedDishes.ts            # dry-run
 *   npx tsx scripts/cleanupHighlightedDishes.ts --write    # persist
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

const SUPA_URL = process.env.NEXT_PUBLIC_SUPABASE_URL!
const SUPA_KEY =
  process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!
const sb = createClient(SUPA_URL, SUPA_KEY, { auth: { persistSession: false } })

const WRITE = process.argv.includes('--write')

// ---- Noise patterns (mirrors matchDishesToMenuItems.ts) ----
const NOISE_PATTERNS = [
  /\bi['\u2019]ve\b/i,
  /\bwe['\u2019]ve\b/i,
  /\bi['\u2019]m\b/i,
  /\bwe['\u2019]re\b/i,
  /\bfor a while\b/i,
  /\bduring rush hour\b/i,
  /\bdining experience/i,
  /\bcame out\b/i,
  /\blooking just\b/i,
  /^in [a-z\s]+$/i, // "in san francisco"
  /^the\b/i,
  /\b(restaurant|place|spot|joint|best|favorite|perfect|amazing|experience)\b/i,
  /^(blessed|busy|more|too|very|just|warm|hot|cold|fresh|great|good|nice|new)$/i,
  /^(more|too|very) .+/i,
  /\bsized\b.*\bfor\b/i,
  /\bi have\b/i,
  /^\s*$/,
]
const STOP_WORDS = new Set([
  'the', 'a', 'an', 'of', 'and', 'or', 'to', 'at', 'in', 'on', 'for', 'with',
  'by', 'from', 'as', 'is', 'it', 'be', 'very', 'just', 'more', 'too', 'so',
  'my', 'our', 'your', 'their', 'this', 'that', 'these', 'those', 'have',
  'had', 'was', 'were', 'been', 'being', 'am', 'are', 'will', 'would',
  'could', 'should', 'out', 'up', 'down', 'off', 'over', 'again',
])

function isNoisy(name: string): boolean {
  const s = (name ?? '').trim().toLowerCase()
  if (!s) return true
  if (s.length < 3) return true
  if (s.split(/\s+/).length > 5) return true
  for (const re of NOISE_PATTERNS) if (re.test(s)) return true
  const toks = s.split(/\s+/).filter((t) => !STOP_WORDS.has(t))
  if (toks.length === 0) return true
  return false
}

// Canonicalize over-stemmed single-word dishes back to their natural form.
const CANON: Record<string, string> = {
  hummu: 'hummus',
  frie: 'fries',
  waffle: 'waffle',
  oy: 'oyster',
  clammy: 'clam',
  brisket: 'brisket',
  // Plurals that users expect on menus:
  dumpling: 'dumplings',
  wing: 'wings',
  rib: 'ribs',
  noodle: 'noodles',
  meatball: 'meatballs',
  taco: 'tacos',
  bun: 'buns',
  pierogi: 'pierogies',
  potsticker: 'potstickers',
  empanada: 'empanadas',
  arancini: 'arancini',
  bao: 'bao',
  tostada: 'tostadas',
}
function canon(name: string): string {
  const s = name.trim()
  if (!s) return s
  const lower = s.toLowerCase()
  if (CANON[lower]) return CANON[lower]
  return s
}

type Row = {
  restaurant_id: string
  dish_name: string
  mention_count: number | null
  matched_menu_item_id: string | null
  display_name: string | null
}

async function loadAll(): Promise<Row[]> {
  const rows: Row[] = []
  let from = 0
  const PAGE = 1000
  while (true) {
    const { data, error } = await sb
      .from('restaurant_highlighted_dishes')
      .select('restaurant_id,dish_name,mention_count,matched_menu_item_id,display_name')
      .range(from, from + PAGE - 1)
    if (error) throw error
    if (!data || data.length === 0) break
    rows.push(...(data as unknown as Row[]))
    if (data.length < PAGE) break
    from += PAGE
  }
  return rows
}

async function main() {
  console.log(`[cleanup] mode=${WRITE ? 'WRITE' : 'DRY-RUN'}`)
  const rows = await loadAll()
  console.log(`[cleanup] loaded ${rows.length} dish rows`)

  // 1. Delete noise rows that HAVE NOT been matched by the matcher.
  // If matched -> keep (we're already showing display_name), but log it.
  const toDelete: Array<{ restaurant_id: string; dish_name: string }> = []
  const renameOps: Array<{
    restaurant_id: string
    oldName: string
    newName: string
  }> = []

  // Index existing (restaurant_id, dish_name) so we avoid renaming into a clash.
  const existing = new Set<string>()
  for (const r of rows) existing.add(`${r.restaurant_id}|${r.dish_name.toLowerCase()}`)

  for (const r of rows) {
    if (isNoisy(r.dish_name)) {
      if (r.matched_menu_item_id) {
        // Matcher already promoted this — keep but note.
        continue
      }
      toDelete.push({ restaurant_id: r.restaurant_id, dish_name: r.dish_name })
      continue
    }
    const canonName = canon(r.dish_name)
    if (canonName !== r.dish_name) {
      const key = `${r.restaurant_id}|${canonName.toLowerCase()}`
      if (existing.has(key)) {
        // Collides with an existing row in the same restaurant — drop the
        // weird stem form; the canonical one already exists and presumably has
        // equal or higher mention_count. Safer to delete the stem row.
        toDelete.push({ restaurant_id: r.restaurant_id, dish_name: r.dish_name })
      } else {
        renameOps.push({
          restaurant_id: r.restaurant_id,
          oldName: r.dish_name,
          newName: canonName,
        })
        existing.add(key)
      }
    }
  }

  console.log(`[cleanup] plan: delete ${toDelete.length}, rename ${renameOps.length}`)
  // Show samples
  console.log('[cleanup] sample deletes:')
  for (const d of toDelete.slice(0, 15)) {
    console.log(`  drop: ${JSON.stringify(d.dish_name)} (restaurant ${d.restaurant_id.slice(0, 8)})`)
  }
  console.log('[cleanup] sample renames:')
  for (const r of renameOps.slice(0, 15)) {
    console.log(`  rename: ${JSON.stringify(r.oldName)} -> ${JSON.stringify(r.newName)}`)
  }

  if (!WRITE) {
    console.log('[cleanup] dry-run. re-run with --write to persist.')
    return
  }

  // Execute in batches using .eq() composite-key updates/deletes.
  let deleted = 0
  for (const d of toDelete) {
    const { error } = await sb
      .from('restaurant_highlighted_dishes')
      .delete()
      .eq('restaurant_id', d.restaurant_id)
      .eq('dish_name', d.dish_name)
    if (error) {
      console.error(`  delete error [${d.restaurant_id}|${d.dish_name}]:`, error.message)
    } else {
      deleted++
    }
  }
  console.log(`[cleanup] deleted ${deleted}/${toDelete.length}`)

  let renamed = 0
  for (const r of renameOps) {
    const { error } = await sb
      .from('restaurant_highlighted_dishes')
      .update({ dish_name: r.newName })
      .eq('restaurant_id', r.restaurant_id)
      .eq('dish_name', r.oldName)
    if (error) {
      console.error(`  rename error [${r.restaurant_id}|${r.oldName}]:`, error.message)
    } else {
      renamed++
    }
  }
  console.log(`[cleanup] renamed ${renamed}/${renameOps.length}`)
}

main().catch((e) => {
  console.error(e)
  process.exit(1)
})
