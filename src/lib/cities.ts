/**
 * Live city-count helpers.
 *
 * The `cities.restaurant_count` column is a denormalized integer set by a
 * seed script and goes stale fast (NYC gets new restaurants and the column
 * doesn't move). Every page that shows a city card or a count-per-city
 * stat should go through this helper so the numbers reflect the actual
 * restaurants table.
 */

import type { SupabaseClient } from '@supabase/supabase-js'
import type { City, Database } from '@/types/database'
import { paginateSelect } from '@/lib/supabase/paginate'

type Supabase = SupabaseClient<Database>

export type CityWithLiveCount = City & { live_restaurant_count: number }

/**
 * Fetch every active city and join in the live `COUNT(restaurants) WHERE
 * city = name` value. Cities with zero restaurants are filtered out so
 * the caller never has to render an empty card (e.g. Denver with 0).
 */
export async function getCitiesWithLiveCounts(
  supabase: Supabase
): Promise<CityWithLiveCount[]> {
  const [citiesRes, restaurantRows] = await Promise.all([
    supabase.from('cities').select('*').eq('is_active', true),
    // Paginated: the restaurants table can easily cross PostgREST's 1000-row
    // cap, which would silently under-count busy cities like NYC.
    paginateSelect<{ city: string | null }>((from, to) =>
      supabase.from('restaurants').select('city').range(from, to)
    ),
  ])

  const cities = (citiesRes.data ?? []) as City[]
  const counts = new Map<string, number>()
  for (const row of restaurantRows) {
    if (!row.city) continue
    const key = row.city.toLowerCase()
    counts.set(key, (counts.get(key) ?? 0) + 1)
  }

  return cities
    .map((c) => ({
      ...c,
      live_restaurant_count: counts.get(c.name.toLowerCase()) ?? 0,
    }))
    .filter((c) => c.live_restaurant_count > 0)
    .sort((a, b) => b.live_restaurant_count - a.live_restaurant_count)
}
