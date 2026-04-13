import Link from 'next/link'
import { createServerSupabaseClient } from '@/lib/supabase/server'
import { MapPin, Star, Award, ChevronRight } from 'lucide-react'
import type { City } from '@/types/database'

export const revalidate = 60

type CityStats = {
  michelinCount: number
  jamesBeardCount: number
  eater38Count: number
  avgRating: number | null
  topCuisines: string[]
}

const CITY_GRADIENTS: Record<string, string> = {
  'New York': 'from-blue-500 to-indigo-600',
  'Los Angeles': 'from-orange-400 to-rose-500',
  'Chicago': 'from-sky-500 to-blue-600',
  'Miami': 'from-cyan-400 to-teal-500',
  'San Francisco': 'from-red-400 to-orange-500',
}

function gradientFor(cityName: string): string {
  return CITY_GRADIENTS[cityName] ?? 'from-emerald-400 to-teal-500'
}

export default async function CitiesPage() {
  const supabase = await createServerSupabaseClient()

  const [citiesRes, statsRes] = await Promise.all([
    supabase
      .from('cities')
      .select('*')
      .eq('is_active', true)
      .gt('restaurant_count', 0)
      .order('restaurant_count', { ascending: false }),
    supabase
      .from('restaurants')
      .select('city, michelin_stars, michelin_designation, james_beard_winner, james_beard_nominated, eater_38, google_rating, cuisine'),
  ])

  const cities = (citiesRes.data ?? []) as City[]
  const allRestaurants = statsRes.data ?? []

  // Compute per-city stats
  const statsMap = new Map<string, CityStats>()
  const grouped = new Map<string, typeof allRestaurants>()
  for (const r of allRestaurants) {
    if (!r.city) continue
    const key = r.city
    if (!grouped.has(key)) grouped.set(key, [])
    grouped.get(key)!.push(r)
  }
  for (const [city, rests] of grouped) {
    const michelinCount = rests.filter(
      (r) => (r.michelin_stars || 0) > 0 || !!r.michelin_designation
    ).length
    const jamesBeardCount = rests.filter(
      (r) => r.james_beard_winner || r.james_beard_nominated
    ).length
    const eater38Count = rests.filter((r) => r.eater_38).length
    const ratings = rests
      .map((r) => r.google_rating)
      .filter((v): v is number => typeof v === 'number' && v > 0)
    const avgRating = ratings.length
      ? ratings.reduce((s, v) => s + v, 0) / ratings.length
      : null

    const cuisineCounts = new Map<string, number>()
    for (const r of rests) {
      if (r.cuisine && r.cuisine !== 'Restaurant') {
        cuisineCounts.set(r.cuisine, (cuisineCounts.get(r.cuisine) || 0) + 1)
      }
    }
    const topCuisines = [...cuisineCounts.entries()]
      .sort((a, b) => b[1] - a[1])
      .slice(0, 5)
      .map(([c]) => c)

    statsMap.set(city, { michelinCount, jamesBeardCount, eater38Count, avgRating, topCuisines })
  }

  const totalRestaurants = cities.reduce(
    (s, c) => s + (c.restaurant_count || 0),
    0
  )

  return (
    <div className="min-h-screen bg-gray-50">
      {/* Compact Hero */}
      <div className="bg-gradient-to-br from-gray-900 via-gray-900 to-emerald-950">
        <div className="max-w-4xl mx-auto px-4 sm:px-6 py-10 sm:py-12">
          <div className="flex items-center gap-2 mb-2">
            <MapPin size={22} className="text-emerald-400" />
            <h1 className="text-2xl sm:text-3xl font-extrabold text-white tracking-tight">
              Explore Cities
            </h1>
          </div>
          <p className="text-gray-400 text-sm">
            {cities.length} {cities.length === 1 ? 'city' : 'cities'} &middot;{' '}
            {totalRestaurants.toLocaleString()} restaurants
          </p>
        </div>
      </div>

      {/* Stacked City Cards */}
      <div className="max-w-4xl mx-auto px-4 sm:px-6 py-8 sm:py-10">
        {cities.length > 0 ? (
          <div className="flex flex-col gap-4">
            {cities.map((city) => {
              const stats = statsMap.get(city.name)
              const gradient = gradientFor(city.name)
              return (
                <Link
                  key={city.id}
                  href={`/cities/${city.slug}`}
                  className="group block bg-white rounded-xl border border-gray-100 hover:border-emerald-200 hover:shadow-md transition-all overflow-hidden"
                >
                  <div className="flex items-stretch">
                    {/* Left gradient accent */}
                    <div
                      className={`hidden sm:block w-1.5 bg-gradient-to-b ${gradient} flex-shrink-0`}
                      aria-hidden="true"
                    />

                    {/* Content */}
                    <div className="flex-1 p-5 sm:p-6 flex flex-col sm:flex-row sm:items-center gap-4">
                      <div className="flex-1 min-w-0">
                        <div className="flex items-baseline gap-2 flex-wrap">
                          <h2 className="text-xl sm:text-2xl font-extrabold text-gray-900 group-hover:text-emerald-600 transition-colors">
                            {city.name}
                          </h2>
                          {city.state && (
                            <span className="text-sm text-gray-500 font-medium">
                              {city.state}
                            </span>
                          )}
                        </div>

                        {/* Stats row */}
                        {stats && (
                          <div className="mt-2.5 flex flex-wrap items-center gap-2 text-xs">
                            {stats.avgRating != null && (
                              <span className="inline-flex items-center gap-1 px-2 py-0.5 bg-amber-50 text-amber-800 rounded-md font-semibold">
                                <Star size={11} className="fill-amber-400 text-amber-400" />
                                Avg {stats.avgRating.toFixed(1)}
                              </span>
                            )}
                            {stats.michelinCount > 0 && (
                              <span className="inline-flex items-center gap-1 px-2 py-0.5 bg-red-50 text-red-700 rounded-md font-semibold">
                                <Star size={11} />
                                {stats.michelinCount} Michelin
                              </span>
                            )}
                            {stats.jamesBeardCount > 0 && (
                              <span className="inline-flex items-center gap-1 px-2 py-0.5 bg-amber-100 text-amber-900 rounded-md font-semibold">
                                <Award size={11} />
                                {stats.jamesBeardCount} James Beard
                              </span>
                            )}
                            {stats.eater38Count > 0 && (
                              <span className="inline-flex items-center gap-1 px-2 py-0.5 bg-pink-50 text-pink-700 rounded-md font-semibold">
                                {stats.eater38Count} Eater 38
                              </span>
                            )}
                          </div>
                        )}

                        {/* Top cuisines */}
                        {stats && stats.topCuisines.length > 0 && (
                          <div className="mt-3 flex flex-wrap gap-1.5">
                            <span className="text-xs text-gray-400 font-medium pt-0.5">
                              Top cuisines:
                            </span>
                            {stats.topCuisines.map((c) => (
                              <span
                                key={c}
                                className="px-2 py-0.5 bg-gray-50 text-gray-600 rounded text-xs font-medium border border-gray-100"
                              >
                                {c}
                              </span>
                            ))}
                          </div>
                        )}
                      </div>

                      {/* Right: count + arrow */}
                      <div className="flex items-center gap-4 sm:gap-6 sm:flex-col sm:items-end sm:justify-center flex-shrink-0">
                        <div className="text-left sm:text-right">
                          <p className="text-2xl sm:text-3xl font-extrabold text-emerald-600 leading-none">
                            {(city.restaurant_count || 0).toLocaleString()}
                          </p>
                          <p className="text-[11px] sm:text-xs text-gray-400 mt-0.5 font-medium">
                            restaurants
                          </p>
                        </div>
                        <ChevronRight
                          size={20}
                          className="text-gray-300 group-hover:text-emerald-500 group-hover:translate-x-0.5 transition-all flex-shrink-0"
                        />
                      </div>
                    </div>
                  </div>
                </Link>
              )
            })}
          </div>
        ) : (
          <div className="text-center py-16 bg-white rounded-xl border border-gray-100">
            <MapPin size={32} className="mx-auto text-gray-300 mb-3" />
            <p className="text-gray-500">
              Cities coming soon — we&apos;re adding restaurants every day.
            </p>
          </div>
        )}
      </div>
    </div>
  )
}
