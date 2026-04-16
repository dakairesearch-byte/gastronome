import { createServerSupabaseClient } from '@/lib/supabase/server'
import { computeAllScores, rankScores } from '@/lib/ranking/trending'
import { getCitiesWithLiveCounts } from '@/lib/cities'
import SectionHeader from '@/components/SectionHeader'
import ExploreSearchBar from '@/components/explore/ExploreSearchBar'
import FeaturedCityShowcase from '@/components/explore/FeaturedCityShowcase'
import ExploreCollectionCard from '@/components/cards/ExploreCollectionCard'
import type { Restaurant } from '@/types/database'

export const revalidate = 60

/** Curated collection definitions. */
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

/** Compact display labels matching the Figma city tabs. */
function shortLabelFor(name: string): string {
  if (name === 'New York') return 'NYC'
  if (name === 'Los Angeles') return 'LA'
  if (name === 'San Francisco') return 'SF'
  return name
}

export default async function ExplorePage() {
  const supabase = await createServerSupabaseClient()

  // Get live city list (only cities with restaurants in the DB).
  const cities = await getCitiesWithLiveCounts(supabase)

  // --- Batched trending lookup ---
  // `computeAllScores` is memoized per-request by React.cache, but more
  // importantly we derive the per-city top ranker purely in memory and
  // do a single `.in('id', [...])` fetch for all the trending-winner
  // restaurant rows instead of the previous N queries (one per city).
  // Cities with no trending activity still need a per-city fallback
  // lookup, but those run in parallel.
  const scoreMap = await computeAllScores(supabase, '30d')

  // Top-trending entry per city (null if no activity in the window).
  const trendingByCity = new Map<
    string,
    { restaurant_id: string } | null
  >()
  for (const city of cities) {
    const [top] = rankScores(scoreMap, { city: city.name, limit: 1 })
    trendingByCity.set(city.name, top && top.score > 0 ? top : null)
  }

  const trendingIds = Array.from(trendingByCity.values())
    .filter((e): e is { restaurant_id: string } => e != null)
    .map((e) => e.restaurant_id)

  // Single batched fetch for all the trending-winner rows.
  const trendingById = new Map<string, Restaurant>()
  if (trendingIds.length > 0) {
    const { data } = await supabase
      .from('restaurants')
      .select('*')
      .in('id', trendingIds)
    for (const row of data ?? []) {
      trendingById.set(row.id, row as Restaurant)
    }
  }

  // Fallback: parallel per-city top-rated lookups for cities with no
  // trending activity in the window. One round-trip per fallback city,
  // but all fired concurrently.
  const fallbackCities = cities.filter((c) => trendingByCity.get(c.name) == null)
  const fallbackEntries = await Promise.all(
    fallbackCities.map(async (city) => {
      const { data } = await supabase
        .from('restaurants')
        .select('*')
        .eq('city', city.name)
        .order('google_rating', { ascending: false, nullsFirst: false })
        .limit(1)
        .maybeSingle()
      return [city.name, (data as Restaurant | null) ?? null] as const
    })
  )
  const fallbackByCity = new Map(fallbackEntries)

  const cityFeatures = cities.map((city) => {
    const trendingEntry = trendingByCity.get(city.name)
    const featured: Restaurant | null =
      (trendingEntry && trendingById.get(trendingEntry.restaurant_id)) ||
      fallbackByCity.get(city.name) ||
      null
    return {
      city: city.name,
      shortLabel: shortLabelFor(city.name),
      restaurant: featured,
      locationLabel: `${city.name}, ${city.state}`,
      cityCount: city.live_restaurant_count,
    }
  })

  // Default to NYC if available, otherwise first city.
  const defaultCity =
    cityFeatures.find((c) => c.city === 'New York')?.city ??
    cityFeatures[0]?.city ??
    ''

  // Light per-collection placeholder counts. The COLLECTIONS list is curated,
  // not derived from a join — until the Saved Collections feature is wired
  // to a real table, deterministic dummy counts keep the layout honest.
  const collectionCounts = COLLECTIONS.map((c, i) => ({
    ...c,
    count: 8 + ((i * 7) % 14),
  }))

  return (
    <div style={{ backgroundColor: 'var(--color-background)', minHeight: '100vh' }}>
      <ExploreSearchBar />

      <div className="max-w-7xl mx-auto px-6 lg:px-8 py-16">
        {/* Iconic Dining — city tabs + featured city card */}
        {cityFeatures.length > 0 && (
          <FeaturedCityShowcase cities={cityFeatures} defaultCity={defaultCity} />
        )}

        {/* Editorial Collections */}
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
