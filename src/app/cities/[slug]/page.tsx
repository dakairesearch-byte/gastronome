import Link from 'next/link'
import { notFound } from 'next/navigation'
import { ArrowLeft, Award, MapPin, Star } from 'lucide-react'
import { createServerSupabaseClient } from '@/lib/supabase/server'
import { topTrendingRestaurants } from '@/lib/ranking/trending'
import { displayCuisine } from '@/lib/restaurant'
import AccoladesBadges from '@/components/AccoladesBadges'
import EmptyState from '@/components/EmptyState'
import type { Restaurant } from '@/types/database'

export const revalidate = 60

interface SearchParamsInput {
  cuisine?: string
  accolade?: string
}

function applyAccoladeFilter(
  rows: Restaurant[],
  accolade: string | null
): Restaurant[] {
  if (!accolade) return rows
  // NOTE: the "Michelin" chip counts *any* Michelin designation (stars, bib
  // gourmand, selected), matching the header badge. This is intentional so
  // the chip result count and the header "N Michelin" badge agree.
  if (accolade === 'michelin_star')
    return rows.filter(
      (r) => (r.michelin_stars ?? 0) > 0 || !!r.michelin_designation
    )
  if (accolade === 'bib_gourmand')
    return rows.filter((r) => r.michelin_designation === 'bib_gourmand')
  if (accolade === 'james_beard')
    return rows.filter((r) => r.james_beard_nominated || r.james_beard_winner)
  if (accolade === 'eater_38') return rows.filter((r) => r.eater_38)
  return rows
}

function applyCuisineFilter(rows: Restaurant[], cuisine: string | null): Restaurant[] {
  if (!cuisine) return rows
  return rows.filter((r) => r.cuisine?.toLowerCase() === cuisine.toLowerCase())
}

async function getCityData(slug: string) {
  const supabase = await createServerSupabaseClient()

  const { data: city } = await supabase
    .from('cities')
    .select('*')
    .eq('slug', slug)
    .single()

  if (!city) return null

  // Live count (never trust cities.restaurant_count — it's denormalized
  // and goes stale with every ingestion).
  //
  // Totals (total, michelin, JB) come from `count: 'exact', head: true`
  // queries — they must NOT be computed from the `.limit(500)` sample, or
  // a city like NY with 600+ rows would undercount Michelins (QA pass 2).
  // The 500-row pull is only used to derive cuisineCounts and to feed the
  // main grid, which is already bounded by what we display.
  const [
    { count: totalCount },
    { count: michelinCountRaw },
    { count: jamesBeardCountRaw },
    { data: allRestaurants },
    trending,
  ] = await Promise.all([
    supabase
      .from('restaurants')
      .select('*', { count: 'exact', head: true })
      .ilike('city', city.name),
    supabase
      .from('restaurants')
      .select('id', { count: 'exact', head: true })
      .ilike('city', city.name)
      .or('michelin_stars.gt.0,michelin_designation.not.is.null'),
    supabase
      .from('restaurants')
      .select('id', { count: 'exact', head: true })
      .ilike('city', city.name)
      .or('james_beard_nominated.eq.true,james_beard_winner.eq.true'),
    supabase
      .from('restaurants')
      .select('*')
      .ilike('city', city.name)
      .order('name', { ascending: true })
      .limit(500),
    topTrendingRestaurants(supabase, {
      window: '30d',
      city: city.name,
      limit: 500,
    }),
  ])

  const all = (allRestaurants ?? []) as Restaurant[]
  const michelinCount = michelinCountRaw ?? 0
  const jamesBeardCount = jamesBeardCountRaw ?? 0
  const cuisineCounts = new Map<string, number>()
  for (const r of all) {
    if (!r.cuisine || r.cuisine === 'Restaurant') continue
    cuisineCounts.set(r.cuisine, (cuisineCounts.get(r.cuisine) ?? 0) + 1)
  }
  const topCuisines = [...cuisineCounts.entries()]
    .sort((a, b) => b[1] - a[1])
    .slice(0, 8)
    .map(([name]) => name)

  return {
    city,
    all,
    trending,
    totalCount: totalCount ?? all.length,
    michelinCount,
    jamesBeardCount,
    topCuisines,
  }
}

export default async function CityPage({
  params,
  searchParams,
}: {
  params: Promise<{ slug: string }>
  searchParams: Promise<SearchParamsInput>
}) {
  const { slug } = await params
  const raw = await searchParams
  const activeCuisine = raw.cuisine?.trim() || null
  const activeAccolade = raw.accolade?.trim() || null

  const data = await getCityData(slug)
  if (!data) notFound()
  const {
    city,
    all,
    trending,
    totalCount,
    michelinCount,
    jamesBeardCount,
    topCuisines,
  } = data

  // Use trending order when available, fall back to alphabetical on empty.
  const trendingById = new Map(trending.map((t) => [t.id, t]))
  const ordered: Restaurant[] =
    trending.length > 0
      ? (trending as Restaurant[]).concat(
          all.filter((r) => !trendingById.has(r.id))
        )
      : all

  const filtered = applyCuisineFilter(
    applyAccoladeFilter(ordered, activeAccolade),
    activeCuisine
  )

  return (
    <div className="min-h-screen bg-gray-50">
      {/* City Header */}
      <div className="relative bg-gradient-to-br from-emerald-600 via-emerald-500 to-teal-500 overflow-hidden">
        {city.photo_url && (
          // eslint-disable-next-line @next/next/no-img-element
          <img
            src={city.photo_url}
            alt={city.name}
            className="absolute inset-0 w-full h-full object-cover opacity-20"
          />
        )}
        <div className="relative max-w-6xl mx-auto px-4 sm:px-6 py-10 sm:py-12">
          <Link
            href="/cities"
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
                {city.state} &middot; {totalCount} restaurant{totalCount !== 1 ? 's' : ''}
              </p>
            </div>
          </div>

          <div className="flex flex-wrap items-center gap-3 mt-6">
            {michelinCount > 0 && (
              <div className="flex items-center gap-1.5 bg-white/15 backdrop-blur-sm rounded-lg px-3 py-1.5">
                <Star size={14} className="text-red-300" />
                <span className="text-sm font-semibold text-white">
                  {michelinCount} Michelin
                </span>
              </div>
            )}
            {jamesBeardCount > 0 && (
              <div className="flex items-center gap-1.5 bg-white/15 backdrop-blur-sm rounded-lg px-3 py-1.5">
                <Award size={14} className="text-amber-300" />
                <span className="text-sm font-semibold text-white">
                  {jamesBeardCount} James Beard
                </span>
              </div>
            )}
          </div>
        </div>
      </div>

      {/* Filters */}
      <div className="sticky top-14 z-20 bg-white/90 backdrop-blur-sm border-b border-gray-200">
        <div className="max-w-6xl mx-auto px-4 sm:px-6 py-3 space-y-2">
          <div className="flex items-center gap-2 overflow-x-auto scrollbar-hide">
            {[
              { key: 'michelin_star', label: 'Michelin' },
              { key: 'bib_gourmand', label: 'Bib Gourmand' },
              { key: 'james_beard', label: 'James Beard' },
              { key: 'eater_38', label: 'Eater 38' },
            ].map(({ key, label }) => {
              const active = activeAccolade === key
              const params = new URLSearchParams()
              if (!active) params.set('accolade', key)
              if (activeCuisine) params.set('cuisine', activeCuisine)
              const qs = params.toString()
              return (
                <Link
                  key={key}
                  href={qs ? `/cities/${city.slug}?${qs}` : `/cities/${city.slug}`}
                  className={`px-3 py-1.5 rounded-full text-xs font-semibold whitespace-nowrap border transition-colors ${
                    active
                      ? 'bg-emerald-600 text-white border-emerald-600'
                      : 'bg-white text-gray-600 border-gray-200 hover:bg-gray-50'
                  }`}
                >
                  {label}
                </Link>
              )
            })}
          </div>
          {topCuisines.length > 0 && (
            <div className="flex items-center gap-2 overflow-x-auto scrollbar-hide">
              {topCuisines.map((cuisineName) => {
                const active =
                  activeCuisine?.toLowerCase() === cuisineName.toLowerCase()
                const params = new URLSearchParams()
                if (activeAccolade) params.set('accolade', activeAccolade)
                if (!active) params.set('cuisine', cuisineName)
                const qs = params.toString()
                return (
                  <Link
                    key={cuisineName}
                    href={qs ? `/cities/${city.slug}?${qs}` : `/cities/${city.slug}`}
                    className={`px-3 py-1 rounded-full text-[11px] font-semibold whitespace-nowrap border transition-colors ${
                      active
                        ? 'bg-emerald-600 text-white border-emerald-600'
                        : 'bg-white text-gray-500 border-gray-200 hover:bg-gray-50'
                    }`}
                  >
                    {cuisineName}
                  </Link>
                )
              })}
            </div>
          )}
        </div>
      </div>

      {/* Body */}
      <div className="max-w-6xl mx-auto px-4 sm:px-6 py-8 sm:py-10">
        <div className="flex items-center justify-between flex-wrap gap-2 mb-4">
          <p className="text-xs text-gray-500">
            <span className="font-semibold text-gray-700">
              {filtered.length.toLocaleString()}
            </span>{' '}
            {filtered.length === 1 ? 'restaurant' : 'restaurants'} showing
            {(activeAccolade || activeCuisine) && (
              <>
                {' of '}
                {totalCount.toLocaleString()}
                {' · filtered by '}
                {[activeAccolade, activeCuisine].filter(Boolean).join(' + ')}
              </>
            )}
            {!activeAccolade && !activeCuisine && (
              <>
                {' · '}
                {trending.length > 0
                  ? 'ranked by trending engagement (30-day window)'
                  : 'alphabetical'}
              </>
            )}
          </p>
          {(activeAccolade || activeCuisine) && (
            <Link
              href={`/cities/${city.slug}`}
              className="inline-flex items-center gap-1 text-xs font-semibold text-emerald-600 hover:text-emerald-700 transition-colors"
            >
              Clear all filters
            </Link>
          )}
        </div>
        {filtered.length === 0 ? (
          <EmptyState
            icon={MapPin}
            title="No matches"
            description="Clear a filter to see all restaurants in this city."
          />
        ) : (
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
            {filtered.map((r) => {
              const trendingRank =
                trending.length > 0 && trendingById.get(r.id)?.trending_rank
              return (
                <Link
                  key={r.id}
                  href={`/restaurants/${r.id}`}
                  className="group block rounded-xl border border-gray-100 bg-white p-4 hover:border-emerald-300 hover:shadow-sm transition-all"
                >
                  <h3 className="font-bold text-gray-900 line-clamp-1 group-hover:text-emerald-600 transition-colors">
                    {r.name}
                  </h3>
                  <p className="mt-1 text-xs text-gray-500 truncate">
                    {displayCuisine(r.cuisine)}
                    {r.neighborhood ? ` • ${r.neighborhood}` : ''}
                  </p>
                  {trendingRank ? (
                    <p className="mt-2 text-[11px] font-semibold text-orange-600">
                      🔥 #{trendingRank} trending in {city.name}
                    </p>
                  ) : null}
                  <div className="mt-2">
                    <AccoladesBadges restaurant={r} maxBadges={3} />
                  </div>
                </Link>
              )
            })}
          </div>
        )}
      </div>
    </div>
  )
}
