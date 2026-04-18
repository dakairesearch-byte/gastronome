import Link from 'next/link'
import { createServerSupabaseClient } from '@/lib/supabase/server'
import { topTrendingRestaurants } from '@/lib/ranking/trending'
import SectionHeader from '@/components/SectionHeader'
import ExploreSearchBar from '@/components/explore/ExploreSearchBar'
import Top10Trending from '@/components/explore/Top10Trending'
import ExploreCollectionCard from '@/components/cards/ExploreCollectionCard'
import EmptyState from '@/components/EmptyState'
import { MapPin } from 'lucide-react'
import type { Restaurant } from '@/types/database'

export const revalidate = 60

// NOTE: href values are read as query strings by this page below.
// Values map to fields on `restaurants`:
//   cuisine=Brunch  → filters where cuisine ilike 'Brunch'
//   accolade=hidden_gems | michelin_star | bib_gourmand | james_beard | eater_38
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
  cuisine?: string
  accolade?: string
}

function applyAccoladeFilter(rows: Restaurant[], accolade: string | null): Restaurant[] {
  if (!accolade) return rows
  if (accolade === 'michelin_star') return rows.filter((r) => (r.michelin_stars ?? 0) > 0)
  if (accolade === 'bib_gourmand')
    return rows.filter((r) => r.michelin_designation === 'bib_gourmand')
  if (accolade === 'james_beard')
    return rows.filter((r) => r.james_beard_nominated || r.james_beard_winner)
  if (accolade === 'eater_38') return rows.filter((r) => r.eater_38)
  if (accolade === 'hidden_gems') {
    // "Hidden gem" heuristic: rated well but under-reviewed (<= 500
    // reviews). We pull the review count off `google_review_count`
    // (the actual column name — the original edit referenced a
    // non-existent `google_user_ratings_total` and failed typecheck).
    return rows.filter(
      (r) => (r.google_rating ?? 0) >= 4.3 && (r.google_review_count ?? 0) <= 500
    )
  }
  return rows
}

function applyCuisineFilter(rows: Restaurant[], cuisine: string | null): Restaurant[] {
  if (!cuisine) return rows
  const c = cuisine.toLowerCase()
  return rows.filter((r) => r.cuisine?.toLowerCase() === c)
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

  const activeCuisine = raw.cuisine?.trim() || null
  const activeAccolade = raw.accolade?.trim() || null
  const isFiltering = Boolean(activeCuisine || activeAccolade)

  // Unfiltered experience: Top 10 trending + editorial collection cards.
  if (!isFiltering) {
    const trending = await topTrendingRestaurants(supabase, {
      city: activeCity,
      window: '30d',
      limit: 10,
    })

    const top10: Restaurant[] = [...trending]
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

  // Filtered experience: apply cuisine/accolade across all restaurants in city.
  const { data: rows } = await supabase
    .from('restaurants')
    .select('*')
    .ilike('city', activeCity)
    .order('google_rating', { ascending: false, nullsFirst: false })
    .limit(500)
  const all = (rows ?? []) as Restaurant[]
  const filtered = applyCuisineFilter(applyAccoladeFilter(all, activeAccolade), activeCuisine)

  // Friendly label for the collection that was clicked.
  const matching = COLLECTIONS.find(
    (c) =>
      c.href === `/explore?cuisine=${activeCuisine}` ||
      c.href === `/explore?accolade=${activeAccolade}`
  )
  const heading =
    matching?.title ||
    [activeCuisine, activeAccolade?.replace(/_/g, ' ')].filter(Boolean).join(' · ')

  return (
    <div style={{ backgroundColor: 'var(--color-background)', minHeight: '100vh' }}>
      <ExploreSearchBar cities={cities} initialCity={activeCity} />

      <div className="max-w-7xl mx-auto px-6 lg:px-8 py-16">
        <div className="mb-6 flex items-center justify-between">
          <SectionHeader label={activeCity.toUpperCase()} title={heading || 'Filtered'} />
          <Link
            href="/explore"
            className="text-sm underline"
            style={{ color: 'var(--color-text-secondary)' }}
          >
            Clear filters
          </Link>
        </div>

        <p className="text-xs mb-6" style={{ color: 'var(--color-text-secondary)' }}>
          {filtered.length} showing · filtered from {all.length} {activeCity} restaurants
        </p>

        {filtered.length === 0 ? (
          <EmptyState
            icon={MapPin}
            title="No matches"
            description="Try a different collection or clear the filter to see all trending restaurants."
          />
        ) : (
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
            {filtered.map((r) => (
              <Link
                key={r.id}
                href={`/restaurants/${r.id}`}
                className="group block rounded-xl border border-gray-100 bg-white p-4 hover:border-emerald-300 hover:shadow-sm transition-all"
              >
                <h3 className="font-bold text-gray-900 line-clamp-1 group-hover:text-emerald-600 transition-colors">
                  {r.name}
                </h3>
                <p className="mt-1 text-xs text-gray-500 truncate">
                  {r.cuisine && r.cuisine !== 'Restaurant' ? r.cuisine : 'Restaurant'}
                  {r.neighborhood ? ` • ${r.neighborhood}` : ''}
                </p>
              </Link>
            ))}
          </div>
        )}
      </div>
    </div>
  )
}
