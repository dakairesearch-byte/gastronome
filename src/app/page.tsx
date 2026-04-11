import { createServerSupabaseClient } from '@/lib/supabase/server'
import HomeClient from '@/components/home/HomeClient'
import ForYouFeed from '@/components/home/ForYouFeed'
import GenericHomepage from '@/components/home/GenericHomepage'
import { getCompositeRating } from '@/lib/compositeRating'

export default async function Home() {
  const supabase = await createServerSupabaseClient()

  // Check auth
  const {
    data: { user },
  } = await supabase.auth.getUser()

  // Fetch common data in parallel
  const [
    { data: trendingRestaurants },
    { data: cities },
    { count: totalRestaurants },
    { count: totalCities },
  ] = await Promise.all([
    supabase
      .from('restaurants')
      .select('*')
      .gt('google_rating', 0)
      .order('google_rating', { ascending: false })
      .limit(12),
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
    trendingRestaurants: trendingRestaurants || [],
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

  // Fetch personalized data for home city
  const [{ data: cityRestaurants }, { data: recentInCity }] =
    await Promise.all([
      supabase.from('restaurants').select('*').ilike('city', profile.home_city),
      supabase
        .from('restaurants')
        .select('*')
        .ilike('city', profile.home_city)
        .order('created_at', { ascending: false })
        .limit(4),
    ])

  // Compute composite ratings and sort for top 10
  const topRestaurants = (cityRestaurants || [])
    .map((r) => ({ restaurant: r, composite: getCompositeRating(r) }))
    .filter((item) => item.composite !== null)
    .sort((a, b) => b.composite!.rating - a.composite!.rating)
    .slice(0, 10)
    .map((item) => item.restaurant)

  const otherCities = (cities || []).filter(
    (c) => c.name.toLowerCase() !== profile.home_city!.toLowerCase()
  )

  return (
    <ForYouFeed
      profile={profile}
      topRestaurants={topRestaurants}
      recentRestaurants={recentInCity || []}
      otherCities={otherCities}
      trendingRestaurants={trendingRestaurants || []}
    />
  )
}
