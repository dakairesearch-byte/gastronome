import { createServerSupabaseClient } from '@/lib/supabase/server'
import { topTrendingRestaurants } from '@/lib/ranking/trending'
import SectionHeader from '@/components/SectionHeader'
import ExploreSearchBar from '@/components/explore/ExploreSearchBar'
import Top10Trending from '@/components/explore/Top10Trending'
import ExploreCollectionCard from '@/components/cards/ExploreCollectionCard'
import type { Restaurant } from '@/types/database'

export const revalidate = 60

const COLLECTIONS = [
  {
    id: 'brunch',
    title: 'Best Brunch Spots 2026',
    description: 'Start your weekend right at these amazing brunch destinations',
    image: 'https://images.unsplash.com/photo-1516061821-2ac22e822d3f?w=600&q=80',
    curator: 'Editors',
    href: '/explore?cuisine=Brunch',
  },
  {
    id: 'hidden-gems',
    title: 'Hidden Gems',
    description: 'Discover local favorites that are worth the trip',
    image: 'https://images.unsplash.com/photo-1627900440398-5db32dba8db1?w=600&q=80',
    curator: 'Local Explorers',
    href: '/explore?accolade=hidden_gems',
  },
  {
    id: 'date-night',
    title: 'Date Night Perfection',
    description: 'Romantic restaurants for that special evening',
    image: 'https://images.unsplash.com/photo-1722938687772-62a0dbfacc25?w=600&q=80',
    curator: 'Romance Experts',
    href: '/explore?cuisine=French',
  },
  {
    id: 'street-food',
    title: 'Street Food Adventures',
    description: "Bold flavors from the city's best food trucks and stalls",
    image: 'https://images.unsplash.com/photo-1707604341704-74abdc25e52a?w=600&q=80',
    curator: 'Street Food Lovers',
    href: '/explore?cuisine=Mexican',
  },
  {
    id: 'sweet-tooth',
    title: 'Sweet Tooth Heaven',
    description: 'Indulge in the finest desserts and pastries',
    image: 'https://images.unsplash.com/photo-1607257882338-70f7dd2ae344?w=600&q=80',
    curator: 'Dessert Connoisseurs',
    href: '/explore?cuisine=Dessert',
  },
  {
    id: 'healthy',
    title: 'Healthy & Delicious',
    description: "Nutritious meals that don't compromise on taste",
    image: 'https://images.unsplash.com/photo-1649531794884-b8bb1de72e68?w=600&q=80',
    curator: 'Wellness Editors',
    href: '/explore?cuisine=Salad',
  },
]

const DEFAULT_CITY = 'New York'

interface SearchParamsInput {
  city?: string
}

export default async function ExplorePage({
  searchParams,
}: {
  searchParams: Promise<SearchParamsInput>
}) {
  const raw = await searchParams
  const supabase = await createServerSupabaseClient()

  const { data: cityRows } = await supabase
    .from('cities')
    .select('name, slug')
    .eq('is_active', true)
    .order('restaurant_count', { ascending: false })
  const cities = (cityRows ?? []).map((c) => c.name)

  // Pick the active city: URL param wins, else first city from DB, else
  // the hard-coded default. Matching is case-insensitive so shareable
  // links like `/explore?city=new%20york` still resolve.
  const requestedCity = raw.city?.trim()
  const matchedCity =
    requestedCity &&
    cities.find((c) => c.toLowerCase() === requestedCity.toLowerCase())
  const activeCity = matchedCity || requestedCity || cities[0] || DEFAULT_CITY

  const trending = await topTrendingRestaurants(supabase, {
    city: activeCity,
    window: '30d',
    limit: 10,
  })

  let top10: Restaurant[] = trending
  if (top10.length < 10) {
    const existing = new Set(top10.map((r) => r.id))
    const { data } = await supabase
      .from('restaurants')
      .select('*')
      .ilike('city', activeCity)
      .order('google_rating', { ascending: false, nullsFirst: false })
      .limit(10)
    for (const row of (data ?? []) as Restaurant[]) {
      if (top10.length >= 10) break
      if (!existing.has(row.id)) top10.push(row)
    }
  }

  const collectionCounts = COLLECTIONS.map((c, i) => ({
    ...c,
    count: 8 + ((i * 7) % 14),
  }))

  return (
    <div style={{ backgroundColor: 'var(--color-background)', minHeight: '100vh' }}>
      <ExploreSearchBar cities={cities} initialCity={activeCity} />

      <div className="max-w-7xl mx-auto px-6 lg:px-8 py-16">
        {top10.length > 0 && (
          <Top10Trending city={activeCity} restaurants={top10} />
        )}

        <section>
          <SectionHeader label="Expertly Curated" title="Editorial Collections" />
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-8">
            {collectionCounts.map((c) => (
              <ExploreCollectionCard key={c.id} {...c} />
            ))}
          </div>
        </section>
      </div>
    </div>
  )
}
