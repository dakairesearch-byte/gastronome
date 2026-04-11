import type { Restaurant } from '@/types/database'

export type TrendingTier = 'hot' | 'trending' | 'none'

export type TrendingRestaurant = Restaurant & {
  trending_tier: TrendingTier
  latest_video_posted_at: string | null
  recent_video_count: number
}

export type PlacedRestaurant = Restaurant & {
  placement_order: number
}

// The generated Database type has Functions: [_ in never]: never
// because these RPCs aren't in the generated schema yet.
// Use a loose type for the rpc call to avoid TS errors.
// eslint-disable-next-line @typescript-eslint/no-explicit-any
type SupabaseAny = { rpc: (fn: string, params: Record<string, unknown>) => Promise<{ data: any; error: any }>; from: any }

/**
 * Fetch restaurants ordered by the placement algorithm.
 * Falls back to a basic rating sort if the RPC is not yet deployed.
 */
export async function getPlacedRestaurants(
  supabase: ReturnType<typeof import('@/lib/supabase/client').createClient>,
  options: { city?: string; cuisine?: string; limit?: number; offset?: number } = {}
): Promise<Restaurant[]> {
  const { city, cuisine, limit = 20, offset = 0 } = options

  try {
    const { data, error } = await (supabase as unknown as SupabaseAny).rpc('get_placed_restaurants', {
      p_city: city ?? null,
      p_cuisine: cuisine ?? null,
      p_limit: limit,
      p_offset: offset,
    })

    if (error) throw error
    if (data && (data as unknown[]).length > 0) return data as Restaurant[]
  } catch {
    // RPC not deployed yet — fall through to direct query
  }

  // Fallback: basic quality sort
  let query = supabase.from('restaurants').select('*')
  if (city) query = query.ilike('city', city)
  if (cuisine) query = query.ilike('cuisine', cuisine)
  query = query
    .order('google_rating', { ascending: false })
    .range(offset, offset + limit - 1)

  const { data } = await query
  return (data as Restaurant[]) || []
}

/**
 * Fetch restaurants ordered by the placement algorithm (server-side).
 */
export async function getPlacedRestaurantsServer(
  supabase: Awaited<ReturnType<typeof import('@/lib/supabase/server').createServerSupabaseClient>>,
  options: { city?: string; cuisine?: string; limit?: number; offset?: number } = {}
): Promise<Restaurant[]> {
  const { city, cuisine, limit = 20, offset = 0 } = options

  try {
    const { data, error } = await (supabase as unknown as SupabaseAny).rpc('get_placed_restaurants', {
      p_city: city ?? null,
      p_cuisine: cuisine ?? null,
      p_limit: limit,
      p_offset: offset,
    })

    if (error) throw error
    if (data && (data as unknown[]).length > 0) return data as Restaurant[]
  } catch {
    // RPC not deployed yet — fall through
  }

  let query = supabase.from('restaurants').select('*')
  if (city) query = query.ilike('city', city)
  if (cuisine) query = query.ilike('cuisine', cuisine)
  query = query
    .order('google_rating', { ascending: false })
    .range(offset, offset + limit - 1)

  const { data } = await query
  return (data as Restaurant[]) || []
}

/**
 * Fetch trending restaurants from the trending algorithm.
 * Falls back to empty array if RPC not deployed.
 */
export async function getTrendingRestaurants(
  supabase: Awaited<ReturnType<typeof import('@/lib/supabase/server').createServerSupabaseClient>>,
  options: { city?: string; limit?: number } = {}
): Promise<TrendingRestaurant[]> {
  const { city, limit = 10 } = options

  try {
    const { data, error } = await (supabase as unknown as SupabaseAny).rpc('get_trending_restaurants', {
      p_city: city ?? null,
      p_limit: limit,
    })

    if (error) throw error
    if (data && (data as unknown[]).length > 0) return data as TrendingRestaurant[]
  } catch {
    // RPC not deployed yet — fall through
  }

  return []
}
