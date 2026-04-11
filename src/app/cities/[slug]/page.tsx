import { createServerSupabaseClient } from '@/lib/supabase/server'
import RestaurantCard from '@/components/RestaurantCard'
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

  const { data: restaurants } = await supabase
    .from('restaurants')
    .select('*')
    .eq('city', city.name)
    .order('google_rating', { ascending: false })

  const cuisines = [...new Set((restaurants || []).map(r => r.cuisine).filter(Boolean))].sort()

  return {
    city,
    restaurants: restaurants || [],
    cuisines,
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

  const { city, restaurants, cuisines } = data

  return (
    <div className="min-h-screen">
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
            href="/"
            className="inline-flex items-center gap-1.5 text-sm text-emerald-100 hover:text-white font-medium mb-4 transition-colors"
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
                {city.state} &middot; {restaurants.length} restaurant{restaurants.length !== 1 ? 's' : ''}
              </p>
            </div>
          </div>
        </div>
      </div>

      {/* Content */}
      <div className="max-w-6xl mx-auto px-4 sm:px-6 py-8 sm:py-12">
        {/* Cuisine filters */}
        {cuisines.length > 0 && (
          <div className="flex gap-2 overflow-x-auto pb-4 scrollbar-hide mb-6">
            {cuisines.map((cuisine) => (
              <span
                key={cuisine}
                className="px-3 py-1.5 bg-white border border-gray-200 rounded-full text-sm font-medium text-gray-700 whitespace-nowrap"
              >
                {cuisine}
              </span>
            ))}
          </div>
        )}

        {/* Restaurant Grid */}
        {restaurants.length > 0 ? (
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
            {restaurants.map((restaurant) => (
              <RestaurantCard key={restaurant.id} restaurant={restaurant} />
            ))}
          </div>
        ) : (
          <div className="text-center py-16 bg-white rounded-xl border border-gray-100">
            <MapPin size={32} className="mx-auto text-gray-300 mb-3" />
            <p className="text-gray-500">No restaurants found in {city.name} yet.</p>
          </div>
        )}
      </div>
    </div>
  )
}
