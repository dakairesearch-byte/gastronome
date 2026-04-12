import { createServerSupabaseClient } from '@/lib/supabase/server'
import { getPlacedRestaurantsServer } from '@/lib/placement'
import CityRestaurantGrid from '@/components/CityRestaurantGrid'
import { notFound } from 'next/navigation'
import Link from 'next/link'
import { MapPin, ArrowLeft, Star, Award, TrendingUp } from 'lucide-react'

export const revalidate = 60

async function getCityData(slug: string) {
  const supabase = await createServerSupabaseClient()

  const { data: city } = await supabase
    .from('cities')
    .select('*')
    .eq('slug', slug)
    .single()

  if (!city) return null

  // Use placement algorithm for restaurant ordering
  const restaurants = await getPlacedRestaurantsServer(supabase, {
    city: city.name,
    limit: 500,
  })

  // Get accurate total count (not limited by placement query)
  const { count: totalCount } = await supabase
    .from('restaurants')
    .select('*', { count: 'exact', head: true })
    .eq('city', city.name)

  // Aggregate video buzz per restaurant (tiktok + instagram)
  const restaurantIds = restaurants.map((r) => r.id)
  const buzzByRestaurant: Record<
    string,
    {
      tiktok: { likes: number; views: number; count: number }
      instagram: { likes: number; views: number; count: number }
      totalCount: number
    }
  > = {}

  if (restaurantIds.length > 0) {
    const { data: videoRows } = await supabase
      .from('restaurant_videos')
      .select('restaurant_id, platform, like_count, view_count')
      .in('restaurant_id', restaurantIds)

    for (const row of videoRows ?? []) {
      const entry =
        buzzByRestaurant[row.restaurant_id] ??
        (buzzByRestaurant[row.restaurant_id] = {
          tiktok: { likes: 0, views: 0, count: 0 },
          instagram: { likes: 0, views: 0, count: 0 },
          totalCount: 0,
        })
      const platform = row.platform === 'tiktok' ? 'tiktok' : row.platform === 'instagram' ? 'instagram' : null
      if (!platform) continue
      entry[platform].likes += row.like_count ?? 0
      entry[platform].views += row.view_count ?? 0
      entry[platform].count += 1
      entry.totalCount += 1
    }
  }

  // Compute city stats
  const michelinCount = restaurants.filter((r) => r.michelin_stars > 0).length
  const jamesBeardCount = restaurants.filter((r) => r.james_beard_winner || r.james_beard_nominated).length

  // Average Google rating across restaurants that have one
  const ratedRestaurants = restaurants.filter((r) => r.google_rating != null && r.google_rating > 0)
  const avgRating = ratedRestaurants.length > 0
    ? Math.round((ratedRestaurants.reduce((sum, r) => sum + (r.google_rating || 0), 0) / ratedRestaurants.length) * 10) / 10
    : null

  return {
    city,
    restaurants,
    totalCount: totalCount || restaurants.length,
    michelinCount,
    jamesBeardCount,
    avgRating,
    buzzByRestaurant,
  }
}

export default async function CityPage({
  params,
}: {
  params: Promise<{ slug: string }>
}) {
  const { slug } = await params
  const data = await getCityData(slug)

  if (!data) notFound()

  const { city, restaurants, totalCount, michelinCount, jamesBeardCount, avgRating, buzzByRestaurant } = data

  return (
    <div className="min-h-screen bg-gray-50">
      {/* City Header */}
      <div className="relative bg-gradient-to-br from-emerald-600 via-emerald-500 to-teal-500 overflow-hidden">
        {city.photo_url && (
          <img
            src={city.photo_url}
            alt={city.name}
            className="absolute inset-0 w-full h-full object-cover opacity-20"
          />
        )}
        <div className="relative max-w-6xl mx-auto px-4 sm:px-6 py-12 sm:py-16">
          <Link
            href="/cities"
            className="inline-flex items-center gap-1.5 text-sm text-emerald-100 hover:text-white font-medium mb-4 transition-colors focus-visible:ring-2 focus-visible:ring-white outline-none rounded"
          >
            <ArrowLeft size={14} />
            All cities
          </Link>
          <div className="flex items-end gap-3">
            <MapPin size={28} className="text-white/70 mb-1" />
            <div>
              <h1 className="text-3xl sm:text-4xl font-extrabold text-white tracking-tight">
                {city.name}
              </h1>
              <p className="text-emerald-100 mt-1">
                {city.state} &middot; {totalCount} restaurant{totalCount !== 1 ? 's' : ''}
              </p>
            </div>
          </div>

          {/* Stats Row */}
          <div className="flex flex-wrap items-center gap-4 sm:gap-6 mt-6">
            {michelinCount > 0 && (
              <div className="flex items-center gap-1.5 bg-white/15 backdrop-blur-sm rounded-lg px-3 py-1.5">
                <Star size={14} className="text-red-300" />
                <span className="text-sm font-semibold text-white">
                  {michelinCount} Michelin
                </span>
              </div>
            )}
            {jamesBeardCount > 0 && (
              <div className="flex items-center gap-1.5 bg-white/15 backdrop-blur-sm rounded-lg px-3 py-1.5">
                <Award size={14} className="text-amber-300" />
                <span className="text-sm font-semibold text-white">
                  {jamesBeardCount} James Beard
                </span>
              </div>
            )}
            {avgRating && (
              <div className="flex items-center gap-1.5 bg-white/15 backdrop-blur-sm rounded-lg px-3 py-1.5">
                <TrendingUp size={14} className="text-emerald-200" />
                <span className="text-sm font-semibold text-white">
                  {avgRating} avg rating
                </span>
              </div>
            )}
          </div>
        </div>
      </div>

      {/* Content */}
      <div className="max-w-4xl mx-auto px-4 sm:px-6 py-6 sm:py-8">
        <CityRestaurantGrid
          restaurants={restaurants}
          cityName={city.name}
          buzzByRestaurant={buzzByRestaurant}
        />
      </div>
    </div>
  )
}
