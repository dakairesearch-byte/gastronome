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

// NOTE: filter logic used to live here as `applyAccoladeFilter` /
// `applyCuisineFilter` that ran client-side over a `.limit(500)` page.
// Both predicates are now pushed into the Supabase query in the filtered
// branch of `ExplorePage` so we don't silently drop rows past the cap.

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

    // Real counts: each tile previously advertised a hardcoded
    // `8 + ((i*7)%14)` placeholder. Now we run the same filter the tile
    // links to and count the actual matching rows in the active city.
    // Kept parallel; each query is a `head: true` count so we don't
    // pay the page-size transfer cost.
    const collectionCounts = await Promise.all(
      COLLECTIONS.map(async (c) => {
        const url = new URL(c.href, 'https://placeholder.invalid')
        const accolade = url.searchParams.get('accolade')
        const cuisine = url.searchParams.get('cuisine')
        let q = supabase
          .from('restaurants')
          .select('id', { count: 'exact', head: true })
          .ilike('city', activeCity)
        if (cuisine) q = q.ilike('cuisine', cuisine)
        if (accolade === 'michelin_star') q = q.gt('michelin_stars', 0)
        if (accolade === 'bib_gourmand')
          q = q.eq('michelin_designation', 'bib_gourmand')
        if (accolade === 'james_beard')
          q = q.or('james_beard_nominated.eq.true,james_beard_winner.eq.true')
        if (accolade === 'eater_38') q = q.eq('eater_38', true)
        if (accolade === 'hidden_gems')
          q = q.gte('google_rating', 4.3).lte('google_review_count', 500)
        const { count } = await q
        return { ...c, count: count ?? 0 }
      })
    )

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

  // Filtered experience: push cuisine / accolade predicates INTO the DB
  // query so we don't silently drop rows past a hardcoded client-side cap
  // (QA pass 2: advertised "15 Hidden Gems" was actually 193; cap was 500
  // and the footer read "filtered from 500" even if the city had 2000).
  let query = supabase
    .from('restaurants')
    .select('*', { count: 'exact' })
    .ilike('city', activeCity)
    .order('google_rating', { ascending: false, nullsFirst: false })
    .limit(500)

  if (activeCuisine) query = query.ilike('cuisine', activeCuisine)
  if (activeAccolade === 'michelin_star') query = query.gt('michelin_stars', 0)
  if (activeAccolade === 'bib_gourmand')
    query = query.eq('michelin_designation', 'bib_gourmand')
  if (activeAccolade === 'james_beard')
    query = query.or('james_beard_nominated.eq.true,james_beard_winner.eq.true')
  if (activeAccolade === 'eater_38') query = query.eq('eater_38', true)
  if (activeAccolade === 'hidden_gems')
    query = query.gte('google_rating', 4.3).lte('google_review_count', 500)

  const { data: rows, count: filteredTotal } = await query
  const filtered = (rows ?? []) as Restaurant[]
  // Count of restaurants in the city (ignoring the filter) — used for
  // the "… of N total" footer.
  const { count: cityTotal } = await supabase
    .from('restaurants')
    .select('id', { count: 'exact', head: true })
    .ilike('city', activeCity)

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
          {filteredTotal ?? filtered.length} matching · {cityTotal ?? '—'} {activeCity} restaurants total
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
                <div className="flex items-start justify-between gap-2">
                  <h3 className="font-bold text-gray-900 line-clamp-1 group-hover:text-emerald-600 transition-colors">
                    {r.name}
                  </h3>
                  {typeof r.google_rating === 'number' && (
                    <span
                      className="inline-flex items-center gap-1 text-xs"
                      style={{ color: 'var(--color-text-secondary)' }}
                      aria-label={`${r.google_rating.toFixed(1)} stars`}
                    >
                      ★ {r.google_rating.toFixed(1)}
                    </span>
                  )}
                </div>
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
