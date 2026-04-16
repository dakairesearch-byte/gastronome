import { createServerSupabaseClient } from '@/lib/supabase/server'
import { topTrendingRestaurants } from '@/lib/ranking/trending'
import SectionHeader from '@/components/SectionHeader'
import ExploreSearchBar from '@/components/explore/ExploreSearchBar'
import CityTrendingList from '@/components/explore/CityTrendingList'
import ExploreAccoladeCard from '@/components/cards/ExploreAccoladeCard'
import ExploreCollectionCard from '@/components/cards/ExploreCollectionCard'
import type { Restaurant } from '@/types/database'

export const revalidate = 60

const CITIES = ['New York', 'Los Angeles', 'Miami', 'Chicago', 'San Francisco']

/** Accolade card images (Unsplash). */
const ACCOLADE_IMAGES: Record<string, string> = {
  michelin:
    'https://images.unsplash.com/photo-1675729378170-dff874aaaa24?w=600&q=80',
  bib: 'https://images.unsplash.com/photo-1722938687772-62a0dbfacc25?w=600&q=80',
  jamesBeard:
    'https://images.unsplash.com/photo-1627378378955-a3f4e406c5de?w=600&q=80',
  eater:
    'https://images.unsplash.com/photo-1774635800472-41eaa93c1453?w=600&q=80',
}

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

export default async function ExplorePage() {
  const supabase = await createServerSupabaseClient()

  // Parallel data fetches
  const [
    cityResults,
    michelinRes,
    bibRes,
    jamesBeardRes,
    eaterRes,
  ] = await Promise.all([
    // Top 10 per city
    Promise.all(
      CITIES.map(async (city) => {
        const restaurants = await topTrendingRestaurants(supabase, {
          window: '30d',
          limit: 10,
          city,
        })
        // Fallback: if trending is empty, use google_rating
        let list: Restaurant[] = restaurants
        if (list.length === 0) {
          const { data } = await supabase
            .from('restaurants')
            .select('*')
            .eq('city', city)
            .order('google_rating', { ascending: false, nullsFirst: false })
            .limit(10)
          list = (data ?? []) as Restaurant[]
        }
        return { city, restaurants: list }
      })
    ),
    // Accolade counts
    supabase
      .from('restaurants')
      .select('id', { count: 'exact', head: true })
      .gt('michelin_stars', 0),
    supabase
      .from('restaurants')
      .select('id', { count: 'exact', head: true })
      .eq('michelin_designation', 'bib_gourmand'),
    supabase
      .from('restaurants')
      .select('id', { count: 'exact', head: true })
      .or('james_beard_nominated.eq.true,james_beard_winner.eq.true'),
    supabase
      .from('restaurants')
      .select('id', { count: 'exact', head: true })
      .eq('eater_38', true),
  ])

  const accolades = [
    {
      title: 'Michelin Starred',
      description: "The world's most prestigious culinary distinction, recognizing exceptional cuisine",
      image: ACCOLADE_IMAGES.michelin,
      count: michelinRes.count ?? 0,
      href: '/explore?accolade=michelin_star',
    },
    {
      title: 'Bib Gourmand',
      description: "Michelin's recognition of exceptional value and quality dining experiences",
      image: ACCOLADE_IMAGES.bib,
      count: bibRes.count ?? 0,
      href: '/explore?accolade=bib_gourmand',
    },
    {
      title: 'James Beard Awards',
      description: "America's most coveted culinary honor celebrating excellence in gastronomy",
      image: ACCOLADE_IMAGES.jamesBeard,
      count: jamesBeardRes.count ?? 0,
      href: '/explore?accolade=james_beard',
    },
    {
      title: 'Eater 38',
      description: 'The essential restaurants list, curated by Eater editors for every city',
      image: ACCOLADE_IMAGES.eater,
      count: eaterRes.count ?? 0,
      href: '/explore?accolade=eater_38',
    },
  ]

  // Count per collection (rough)
  const collectionCounts = COLLECTIONS.map((c) => ({
    ...c,
    count: Math.floor(Math.random() * 12) + 8, // placeholder until wired
  }))

  return (
    <div style={{ backgroundColor: 'var(--color-background)', minHeight: '100vh' }}>
      {/* Search Bar */}
      <ExploreSearchBar />

      <div className="max-w-7xl mx-auto px-6 lg:px-8 py-8">
        {/* Trending by City */}
        <CityTrendingList cityGroups={cityResults} defaultCity="New York" />

        {/* Accolades */}
        <section className="mb-24">
          <SectionHeader label="Prestige & Excellence" title="Acclaimed Dining" />
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
            {accolades.map((a) => (
              <ExploreAccoladeCard key={a.title} {...a} />
            ))}
          </div>
        </section>

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
