import Link from 'next/link'
import { createServerSupabaseClient } from '@/lib/supabase/server'
import RestaurantCard from '@/components/RestaurantCard'
import { Clock, MapPin, ChevronRight } from 'lucide-react'

export const revalidate = 60

export const metadata = {
  title: 'Recently Updated | Gastronome',
  description:
    'See the latest restaurant additions and rating updates across all cities.',
}

export default async function RecentPage() {
  const supabase = await createServerSupabaseClient()

  const { data: restaurants } = await supabase
    .from('restaurants')
    .select('*')
    .order('updated_at', { ascending: false, nullsFirst: false })
    .limit(60)

  const [{ data: cityRows }] = await Promise.all([
    supabase.from('cities').select('name, slug').eq('is_active', true),
  ])

  const slugByCity = new Map<string, string>()
  for (const c of cityRows ?? []) {
    if (c.name && c.slug) slugByCity.set(c.name.toLowerCase(), c.slug)
  }

  // Group by city, preserving per-city recency
  const cityGroups = new Map<string, NonNullable<typeof restaurants>>()
  for (const r of restaurants ?? []) {
    const city = r.city || 'Unknown'
    if (!cityGroups.has(city)) cityGroups.set(city, [])
    cityGroups.get(city)!.push(r)
  }

  const sortedGroups = [...cityGroups.entries()]
    .map(([city, rests]) => ({
      city,
      restaurants: rests.slice(0, 6),
      latestUpdate: rests[0]?.updated_at || '',
    }))
    .sort(
      (a, b) =>
        new Date(b.latestUpdate).getTime() - new Date(a.latestUpdate).getTime()
    )

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
          </p>
        </div>
      </div>

      {/* City Sections */}
      <div className="max-w-6xl mx-auto px-4 sm:px-6 py-8 sm:py-10">
        {sortedGroups.length > 0 ? (
          <div className="space-y-10">
            {sortedGroups.map((group) => {
              const slug = slugByCity.get(group.city.toLowerCase())
              return (
                <section key={group.city}>
                  <div className="flex items-center justify-between mb-4">
                    <div className="flex items-center gap-2">
                      <MapPin size={18} className="text-emerald-600" />
                      <h2 className="text-xl font-bold text-gray-900">
                        {group.city}
                      </h2>
                      <span className="text-sm text-gray-400">
                        {group.restaurants.length} updated
                      </span>
                    </div>
                    {slug && (
                      <Link
                        href={`/cities/${slug}`}
                        className="inline-flex items-center gap-1 text-sm text-emerald-600 hover:text-emerald-700 font-medium"
                      >
                        View all <ChevronRight size={14} />
                      </Link>
                    )}
                  </div>

                  <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
                    {group.restaurants.map((restaurant) => (
                      <RestaurantCard
                        key={restaurant.id}
                        restaurant={restaurant}
                      />
                    ))}
                  </div>
                </section>
              )
            })}
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
