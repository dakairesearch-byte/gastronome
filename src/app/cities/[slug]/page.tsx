import { createServerSupabaseClient } from '@/lib/supabase/server'
import { getPlacedRestaurantsServer } from '@/lib/placement'
import CityRestaurantGrid from '@/components/CityRestaurantGrid'
import { notFound } from 'next/navigation'
import Link from 'next/link'
import { MapPin, ArrowLeft } from 'lucide-react'

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
    limit: 200,
  })

  const cuisines = [...new Set(restaurants.map(r => r.cuisine).filter(c => c && c !== 'Restaurant'))].sort()

  // Get accurate total count (not limited by placement query)
  const { count: totalCount } = await supabase
    .from('restaurants')
    .select('*', { count: 'exact', head: true })
    .eq('city', city.name)

  return {
    city,
    restaurants,
    cuisines,
    totalCount: totalCount || restaurants.length,
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

  const { city, restaurants, cuisines, totalCount } = data

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
        </div>
      </div>

      {/* Content */}
      <div className="max-w-6xl mx-auto px-4 sm:px-6 py-8 sm:py-12">
        <CityRestaurantGrid
          restaurants={restaurants}
          cuisines={cuisines}
          cityName={city.name}
        />
      </div>
    </div>
  )
}
