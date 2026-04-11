import { createServerSupabaseClient } from '@/lib/supabase/server'
import HomeClient from '@/components/home/HomeClient'
import ForYouFeed from '@/components/home/ForYouFeed'
import GenericHomepage from '@/components/home/GenericHomepage'
import { getPlacedRestaurantsServer, getTrendingRestaurants } from '@/lib/placement'

export default async function Home() {
  const supabase = await createServerSupabaseClient()

  // Check auth
  const {
    data: { user },
  } = await supabase.auth.getUser()

  // Fetch common data in parallel
  const [
    placedRestaurants,
    trendingResults,
    { data: cities },
    { count: totalRestaurants },
    { count: totalCities },
  ] = await Promise.all([
    getPlacedRestaurantsServer(supabase, { limit: 12 }),
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
      .eq('is_active', true),
  ])

  const commonProps = {
    trendingRestaurants: placedRestaurants,
    trending: trendingResults,
    cities: cities || [],
    totalRestaurants: totalRestaurants || 0,
    totalCities: totalCities || 0,
  }

  // Logged out → client handles onboarding vs generic
  if (!user) {
    return <HomeClient {...commonProps} />
  }

  // Logged in → check for home_city
  const { data: profile } = await supabase
    .from('profiles')
    .select('*')
    .eq('id', user.id)
    .single()

  if (!profile?.home_city) {
    // Logged in but no home city — show generic homepage
    return <GenericHomepage {...commonProps} />
  }

  // Fetch personalized data for home city using placement algorithm
  const [topRestaurants, trendingInCity, { data: recentInCity }] =
    await Promise.all([
      getPlacedRestaurantsServer(supabase, {
        city: profile.home_city,
        limit: 10,
      }),
      getTrendingRestaurants(supabase, {
        city: profile.home_city,
        limit: 6,
      }),
      supabase
        .from('restaurants')
        .select('*')
        .ilike('city', profile.home_city)
        .order('created_at', { ascending: false })
        .limit(4),
    ])

  const otherCities = (cities || []).filter(
    (c) => c.name.toLowerCase() !== profile.home_city!.toLowerCase()
  )

  return (
    <ForYouFeed
      profile={profile}
      topRestaurants={topRestaurants}
      recentRestaurants={recentInCity || []}
      otherCities={otherCities}
      trendingRestaurants={trendingInCity}
    />
  )
}
