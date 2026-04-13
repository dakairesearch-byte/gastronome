import { createServerSupabaseClient } from '@/lib/supabase/server'
import ForYouFeed from '@/components/home/ForYouFeed'
import GenericHomepage from '@/components/home/GenericHomepage'
import { getPlacedRestaurantsServer, getTrendingRestaurants } from '@/lib/placement'

export default async function Home() {
  const supabase = await createServerSupabaseClient()

  // Check auth
  const {
    data: { user },
  } = await supabase.auth.getUser()

  // Fetch common data in parallel.
  // Over-fetch placed restaurants so we can drop any that have nothing
  // to display (no ratings, no accolades) — empty cards make the home
  // page look broken.
  const [
    rawPlacedRestaurants,
    trendingResults,
    { data: cities },
    { count: totalRestaurants },
    { count: totalCities },
  ] = await Promise.all([
    getPlacedRestaurantsServer(supabase, { limit: 30 }),
    getTrendingRestaurants(supabase, { limit: 10 }),
    supabase
      .from('cities')
      .select('*')
      .eq('is_active', true)
      .order('restaurant_count', { ascending: false })
      .limit(6),
    supabase
      .from('restaurants')
      .select('*', { count: 'exact', head: true }),
    supabase
      .from('cities')
      .select('*', { count: 'exact', head: true })
      .eq('is_active', true)
      .gt('restaurant_count', 0),
  ])

  // Drop restaurants with nothing visible to show (no ratings, no accolades).
  const hasVisibleData = (r: typeof rawPlacedRestaurants[number]) =>
    r.google_rating != null ||
    r.yelp_rating != null ||
    r.infatuation_rating != null ||
    r.beli_score != null ||
    (r.michelin_stars ?? 0) > 0 ||
    r.james_beard_winner ||
    r.james_beard_nominated ||
    r.eater_38
  const placedRestaurants = rawPlacedRestaurants
    .filter(hasVisibleData)
    .slice(0, 12)

  // Logged out → marketing homepage
  if (!user) {
    return (
      <GenericHomepage
        trendingRestaurants={placedRestaurants}
        trending={trendingResults}
        cities={cities || []}
        totalRestaurants={totalRestaurants || 0}
        totalCities={totalCities || 0}
      />
    )
  }

  // Logged in → get profile
  const { data: profile } = await supabase
    .from('profiles')
    .select('*')
    .eq('id', user.id)
    .single()

  const homeCity = profile?.home_city || null

  // Fetch personalized data (city-filtered if home_city set, global otherwise)
  const [topRestaurants, trendingInScope, { data: recentInScope }] =
    await Promise.all([
      getPlacedRestaurantsServer(supabase, {
        ...(homeCity ? { city: homeCity } : {}),
        limit: 10,
      }),
      getTrendingRestaurants(supabase, {
        ...(homeCity ? { city: homeCity } : {}),
        limit: 6,
      }),
      homeCity
        ? supabase
            .from('restaurants')
            .select('*')
            .ilike('city', homeCity)
            .order('created_at', { ascending: false })
            .limit(4)
        : supabase
            .from('restaurants')
            .select('*')
            .order('created_at', { ascending: false })
            .limit(4),
    ])

  const otherCities = homeCity
    ? (cities || []).filter(
        (c) => c.name.toLowerCase() !== homeCity.toLowerCase()
      )
    : (cities || [])

  return (
    <ForYouFeed
      profile={profile || { display_name: 'there', username: '', home_city: null } as any}
      topRestaurants={topRestaurants}
      recentRestaurants={recentInScope || []}
      otherCities={otherCities}
      trendingRestaurants={trendingInScope}
    />
  )
}
