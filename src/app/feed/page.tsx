import Link from 'next/link'
import { createServerSupabaseClient } from '@/lib/supabase/server'
import RestaurantRow from '@/components/RestaurantRow'
import { Clock, MapPin, ChevronRight } from 'lucide-react'

export const revalidate = 60

export const metadata = {
  title: 'Recently Updated | Gastronome',
  description:
    'See the latest restaurant additions and rating updates across all cities.',
}

const PER_CITY = 8

export default async function RecentPage() {
  const supabase = await createServerSupabaseClient()

  const { data: cityRows } = await supabase
    .from('cities')
    .select('id, name, slug, restaurant_count')
    .eq('is_active', true)
    .gt('restaurant_count', 0)
    .order('restaurant_count', { ascending: false })

  const cities = cityRows ?? []

  const cityData = await Promise.all(
    cities.map(async (city) => {
      const { data: restaurants, count } = await supabase
        .from('restaurants')
        .select('*', { count: 'exact' })
        .ilike('city', city.name)
        .order('updated_at', { ascending: false, nullsFirst: false })
        .limit(PER_CITY)

      return {
        city,
        restaurants: restaurants ?? [],
        total: count ?? 0,
      }
    })
  )

  const activeCityData = cityData.filter((d) => d.restaurants.length > 0)
  const totalTracked = activeCityData.reduce((sum, d) => sum + d.total, 0)

  return (
    <div className="min-h-screen bg-gray-50">
      {/* Header */}
      <div className="bg-gradient-to-br from-gray-900 via-gray-900 to-emerald-950">
        <div className="max-w-6xl mx-auto px-4 sm:px-6 py-10 sm:py-12">
          <div className="flex items-center gap-2 mb-2">
            <Clock size={22} className="text-emerald-400" />
            <h1 className="text-2xl sm:text-3xl font-extrabold text-white tracking-tight">
              Recently Updated
            </h1>
          </div>
          <p className="text-gray-400 text-sm">
            Latest restaurant additions and rating updates
            {activeCityData.length > 0 && totalTracked > 0 && (
              <>
                {' '}across {activeCityData.length}{' '}
                {activeCityData.length === 1 ? 'city' : 'cities'} &middot;{' '}
                {totalTracked.toLocaleString()} restaurants tracked
              </>
            )}
          </p>
        </div>
      </div>

      {/* City Sections */}
      <div className="max-w-6xl mx-auto px-4 sm:px-6 py-8 sm:py-12">
        {activeCityData.length > 0 ? (
          <div className="space-y-12">
            {activeCityData.map(({ city, restaurants, total }) => (
              <section key={city.id}>
                <div className="flex items-center justify-between mb-5">
                  <div className="flex items-center gap-2">
                    <MapPin size={18} className="text-emerald-600" />
                    <h2 className="text-xl sm:text-2xl font-bold text-gray-900">
                      {city.name}
                    </h2>
                    <span className="text-sm text-gray-400">
                      {total.toLocaleString()} tracked
                    </span>
                  </div>
                  <Link
                    href={`/cities/${city.slug}`}
                    className="inline-flex items-center gap-1 text-sm text-emerald-600 hover:text-emerald-700 font-medium"
                  >
                    View all <ChevronRight size={14} />
                  </Link>
                </div>

                <div className="bg-white rounded-2xl border border-gray-100 overflow-hidden">
                  {restaurants.map((restaurant) => (
                    <RestaurantRow
                      key={restaurant.id}
                      restaurant={restaurant}
                    />
                  ))}
                </div>
              </section>
            ))}
          </div>
        ) : (
          <div className="text-center bg-white rounded-xl border border-gray-100 p-10">
            <Clock size={36} className="mx-auto text-gray-300 mb-3" />
            <h2 className="text-lg font-bold text-gray-900 mb-2">
              No restaurants yet
            </h2>
            <p className="text-sm text-gray-500">
              Check back soon — we&apos;re adding new restaurants every day.
            </p>
          </div>
        )}
      </div>
    </div>
  )
}
