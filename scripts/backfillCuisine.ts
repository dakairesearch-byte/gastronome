/**
 * Cuisine backfill — fill `restaurants.cuisine` for rows where it's NULL.
 *
 * Why this script (and not just re-running enrichWithGooglePlaces.ts):
 * the original enrichment script gates on `google_place_id IS NULL`, which
 * skips the ~441 rows where a later award/photo enrichment step ran but
 * never populated the cuisine slot. Those rows DO have place_id and
 * photo_urls — they just have a null cuisine because the path that
 * inserted them (Michelin / Eater / JBF scrapes) didn't extract `types`.
 *
 * Same extraction logic as enrichWithGooglePlaces.ts:
 *   1. Hit Google Places `searchText` with `name + city + state` (or use
 *      place_id directly when we have one — saves a textSearch call).
 *   2. Pull `types[]` and pass through `extractCuisine` to get the
 *      "italian_restaurant" → "Italian" cleanup.
 *   3. Only write cuisine if Google returned something usable; otherwise
 *      leave the row alone (so we don't overwrite a future manual fix).
 *
 * Run:
 *   GOOGLE_PLACES_API_KEY=… SUPABASE_SERVICE_ROLE_KEY=… \
 *   NEXT_PUBLIC_SUPABASE_URL=… npx tsx scripts/backfillCuisine.ts
 *
 *   Add `--dry-run` to preview what would be written without hitting
 *   the DB.
 */

import { createClient } from '@supabase/supabase-js'

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL!
const supabaseKey = process.env.SUPABASE_SERVICE_ROLE_KEY!
const GOOGLE_API_KEY = process.env.GOOGLE_PLACES_API_KEY!

if (!supabaseUrl || !supabaseKey || !GOOGLE_API_KEY) {
  console.error(
    'Missing one of: NEXT_PUBLIC_SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY, GOOGLE_PLACES_API_KEY',
  )
  process.exit(1)
}

const DRY_RUN = process.argv.includes('--dry-run')
const supabase = createClient(supabaseUrl, supabaseKey)

const RATE_LIMIT_MS = 100 // 10 RPS, well under Google's quota

const CITY_STATE_MAP: Record<string, string> = {
  Miami: 'FL',
  'New York': 'NY',
  'Los Angeles': 'CA',
  Chicago: 'IL',
  'San Francisco': 'CA',
  Austin: 'TX',
}

interface PlaceTypes {
  types?: string[]
  name?: string // for logging
}

/**
 * Cuisine extraction — same heuristic as enrichWithGooglePlaces.ts so the
 * backfilled rows look the same as the originally-enriched rows. Picks
 * the first food/restaurant/cafe/bakery/bar type, strips the suffix, and
 * Title Cases it. "italian_restaurant" → "Italian", "korean_food" →
 * "Korean", "wine_bar" → "Wine Bar".
 */
function extractCuisine(types: string[]): string | null {
  const cuisineTypes = types.filter(
    (t) =>
      t.includes('restaurant') ||
      t.includes('food') ||
      t.includes('cafe') ||
      t.includes('bakery') ||
      t.includes('bar'),
  )
  if (cuisineTypes.length === 0) return null
  // Prefer specific cuisine types over the generic "restaurant" entry —
  // Google sorts them roughly that way, but explicit filter is safer.
  const sorted = [...cuisineTypes].sort((a, b) => {
    const aIsGeneric = a === 'restaurant' || a === 'food'
    const bIsGeneric = b === 'restaurant' || b === 'food'
    if (aIsGeneric && !bIsGeneric) return 1
    if (!aIsGeneric && bIsGeneric) return -1
    return 0
  })
  const primary = sorted[0]
    .replace('_restaurant', '')
    .replace('_food', '')
    .replace(/_/g, ' ')
    .replace(/\b\w/g, (c) => c.toUpperCase())
  // Skip results that just resolved to "Restaurant" / "Food" — those
  // aren't a cuisine, they're the placeholder. Leaving the row null is
  // better than writing a string that just says "Restaurant".
  if (primary === 'Restaurant' || primary === 'Food') return null
  return primary
}

/**
 * Fetch place types either by place_id (single GET, cheaper + more
 * accurate when we have it) or by text search (fallback for rows
 * without place_id).
 */
async function fetchTypes(args: {
  place_id: string | null
  name: string
  city: string
}): Promise<PlaceTypes | null> {
  const headers = {
    'Content-Type': 'application/json',
    'X-Goog-Api-Key': GOOGLE_API_KEY,
    'X-Goog-FieldMask': 'types,displayName',
  }
  if (args.place_id) {
    const res = await fetch(
      `https://places.googleapis.com/v1/places/${encodeURIComponent(args.place_id)}`,
      { method: 'GET', headers },
    )
    if (!res.ok) {
      console.error(
        `  place_id GET failed for "${args.name}": ${res.status} ${res.statusText}`,
      )
      return null
    }
    const data = await res.json()
    return { types: data.types, name: data.displayName?.text }
  }
  const state = CITY_STATE_MAP[args.city] || ''
  const res = await fetch(
    'https://places.googleapis.com/v1/places:searchText',
    {
      method: 'POST',
      headers: {
        ...headers,
        'X-Goog-FieldMask': 'places.types,places.displayName',
      },
      body: JSON.stringify({
        textQuery: `${args.name} restaurant ${args.city}, ${state}`,
        maxResultCount: 1,
      }),
    },
  )
  if (!res.ok) {
    console.error(
      `  searchText failed for "${args.name}": ${res.status} ${res.statusText}`,
    )
    return null
  }
  const data = await res.json()
  const place = data.places?.[0]
  return place
    ? { types: place.types, name: place.displayName?.text }
    : null
}

async function main() {
  console.log(
    DRY_RUN ? '🧪 DRY RUN — no DB writes will happen' : '🚀 Live run',
  )

  // Walk past the Supabase 1000-row cap with .range pagination — we have
  // ~441 null-cuisine rows today but more may show up over time.
  const candidates: Array<{
    id: string
    name: string
    city: string
    google_place_id: string | null
  }> = []
  const pageSize = 1000
  let from = 0
  for (;;) {
    const { data, error } = await supabase
      .from('restaurants')
      .select('id, name, city, google_place_id')
      .is('cuisine', null)
      .order('id')
      .range(from, from + pageSize - 1)
    if (error) {
      console.error('Fetch failed:', error.message)
      process.exit(1)
    }
    if (!data || data.length === 0) break
    candidates.push(...data)
    if (data.length < pageSize) break
    from += pageSize
  }

  console.log(`Found ${candidates.length} restaurants with cuisine=null`)
  if (candidates.length === 0) return

  let enriched = 0
  let stillNull = 0
  let failed = 0
  const cuisineCounts = new Map<string, number>()

  for (let i = 0; i < candidates.length; i++) {
    const r = candidates[i]
    try {
      const result = await fetchTypes({
        place_id: r.google_place_id,
        name: r.name,
        city: r.city,
      })
      if (!result || !result.types || result.types.length === 0) {
        console.warn(`  ⚠ no types for ${r.name} (${r.city})`)
        stillNull++
        continue
      }
      const cuisine = extractCuisine(result.types)
      if (!cuisine) {
        console.warn(
          `  ⚠ no specific cuisine in [${result.types.join(',')}] for ${r.name}`,
        )
        stillNull++
        continue
      }
      cuisineCounts.set(cuisine, (cuisineCounts.get(cuisine) ?? 0) + 1)
      if (DRY_RUN) {
        console.log(`  [dry] ${r.name} → ${cuisine}`)
      } else {
        const { error: upd } = await supabase
          .from('restaurants')
          .update({ cuisine })
          .eq('id', r.id)
        if (upd) {
          console.error(`  ✗ update failed for ${r.name}: ${upd.message}`)
          failed++
          continue
        }
      }
      enriched++
      if (enriched % 25 === 0) {
        console.log(`  progress: ${enriched}/${candidates.length} enriched`)
      }
    } catch (err) {
      console.error(
        `  ✗ exception for ${r.name}:`,
        err instanceof Error ? err.message : String(err),
      )
      failed++
    }
    await new Promise((r) => setTimeout(r, RATE_LIMIT_MS))
  }

  console.log('\n=== summary ===')
  console.log(`enriched:    ${enriched}${DRY_RUN ? ' (dry, would have updated)' : ''}`)
  console.log(`still null:  ${stillNull} (Google returned no specific cuisine)`)
  console.log(`failed:      ${failed}`)
  console.log('\ntop cuisines assigned:')
  const sorted = [...cuisineCounts.entries()].sort((a, b) => b[1] - a[1])
  for (const [c, n] of sorted.slice(0, 15)) {
    console.log(`  ${n.toString().padStart(4)} × ${c}`)
  }
}

main().catch((e) => {
  console.error('Fatal:', e)
  process.exit(1)
})
