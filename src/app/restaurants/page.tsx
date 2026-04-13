import Link from 'next/link'
import { createServerSupabaseClient } from '@/lib/supabase/server'
import RestaurantCard from '@/components/RestaurantCard'
import EmptyState from '@/components/EmptyState'
import ExploreFilters, {
  type SortTab,
  type AccoladeFilter,
} from '@/components/restaurants/ExploreFilters'
import { MapPin, ChevronLeft, ChevronRight } from 'lucide-react'

export const revalidate = 60

const PAGE_SIZE = 24

interface SearchParamsInput {
  tab?: string
  city?: string
  accolade?: string
  page?: string
  q?: string
}

function parseTab(value: string | undefined): SortTab {
  return value === 'top' || value === 'newest' ? value : 'ranked'
}

function parseAccolade(value: string | undefined): AccoladeFilter | null {
  if (
    value === 'michelin_star' ||
    value === 'bib_gourmand' ||
    value === 'james_beard' ||
    value === 'eater_38'
  ) {
    return value
  }
  return null
}

function escapeIlike(value: string): string {
  // Strip PostgREST-meaningful punctuation that could break the .or() expression.
  return value.replace(/[%,()]/g, ' ').trim()
}

function buildPageLink(
  params: {
    tab: SortTab
    city: string
    accolade: AccoladeFilter | null
    q: string
  },
  page: number
): string {
  const search = new URLSearchParams()
  if (params.tab !== 'ranked') search.set('tab', params.tab)
  if (params.city !== 'all') search.set('city', params.city)
  if (params.accolade) search.set('accolade', params.accolade)
  if (params.q) search.set('q', params.q)
  if (page > 1) search.set('page', String(page))
  const query = search.toString()
  return query ? `/restaurants?${query}` : '/restaurants'
}

export default async function RestaurantsPage({
  searchParams,
}: {
  searchParams: Promise<SearchParamsInput>
}) {
  const raw = await searchParams
  const tab = parseTab(raw.tab)
  const city = raw.city?.trim() || 'all'
  const accolade = parseAccolade(raw.accolade)
  const q = raw.q?.trim() || ''
  const page = Math.max(1, parseInt(raw.page ?? '1', 10) || 1)

  const supabase = await createServerSupabaseClient()

  const { data: citiesData } = await supabase
    .from('cities')
    .select('name')
    .eq('is_active', true)
    .gt('restaurant_count', 0)
    .order('restaurant_count', { ascending: false })
  const cities = citiesData ?? []

  let query = supabase.from('restaurants').select('*', { count: 'exact' })

  if (city !== 'all') {
    query = query.eq('city', city)
  }

  if (accolade === 'michelin_star') {
    query = query.gt('michelin_stars', 0)
  } else if (accolade === 'bib_gourmand') {
    query = query.eq('michelin_designation', 'bib_gourmand')
  } else if (accolade === 'james_beard') {
    query = query.or('james_beard_nominated.eq.true,james_beard_winner.eq.true')
  } else if (accolade === 'eater_38') {
    query = query.eq('eater_38', true)
  }

  if (q) {
    const safe = escapeIlike(q)
    if (safe) {
      query = query.or(
        `name.ilike.%${safe}%,cuisine.ilike.%${safe}%,neighborhood.ilike.%${safe}%,city.ilike.%${safe}%`
      )
    }
  }

  if (tab === 'ranked') {
    // Only restaurants with at least one rating or accolade.
    query = query.or(
      'google_rating.not.is.null,yelp_rating.not.is.null,infatuation_rating.not.is.null,beli_score.not.is.null,michelin_stars.gt.0,james_beard_nominated.eq.true,james_beard_winner.eq.true,eater_38.eq.true'
    )
    query = query
      .order('avg_rating', { ascending: false, nullsFirst: false })
      .order('google_rating', { ascending: false, nullsFirst: false })
      .order('review_count', { ascending: false })
  } else if (tab === 'top') {
    query = query.order('google_rating', { ascending: false, nullsFirst: false })
  } else {
    query = query.order('created_at', { ascending: false })
  }

  const from = (page - 1) * PAGE_SIZE
  const to = from + PAGE_SIZE - 1
  query = query.range(from, to)

  const { data, count } = await query
  const restaurants = data ?? []
  const totalCount = count ?? 0
  const totalPages = Math.max(1, Math.ceil(totalCount / PAGE_SIZE))

  const linkParams = { tab, city, accolade, q }

  return (
    <div className="min-h-screen bg-gray-50">
      <ExploreFilters
        cities={cities}
        tab={tab}
        city={city}
        accolade={accolade}
        q={q}
      />

      <div className="max-w-6xl mx-auto px-4 sm:px-6 py-8 sm:py-10">
        {/* Results summary */}
        <div className="flex items-baseline justify-between mb-6 gap-4">
          <p className="text-sm text-gray-500">
            <span className="text-2xl font-extrabold text-emerald-600">
              {totalCount.toLocaleString()}
            </span>{' '}
            restaurant{totalCount !== 1 ? 's' : ''}
            {city !== 'all' ? ` in ${city}` : ''}
            {accolade ? ' (filtered)' : ''}
          </p>
          {totalPages > 1 && (
            <p className="text-xs text-gray-400">
              Page {page} of {totalPages}
            </p>
          )}
        </div>

        {restaurants.length === 0 ? (
          <EmptyState
            icon={MapPin}
            title="No restaurants found"
            description={
              q || accolade || city !== 'all'
                ? 'Try adjusting your search or filters'
                : 'No restaurants in our database yet'
            }
          />
        ) : (
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-4">
            {restaurants.map((restaurant, i) => (
              <RestaurantCard
                key={restaurant.id}
                restaurant={restaurant}
                rank={tab === 'ranked' ? (page - 1) * PAGE_SIZE + i + 1 : undefined}
                showRank={tab === 'ranked'}
              />
            ))}
          </div>
        )}

        {totalPages > 1 && (
          <nav className="mt-10 flex items-center justify-center gap-3">
            {page > 1 ? (
              <Link
                href={buildPageLink(linkParams, page - 1)}
                className="inline-flex items-center gap-1 px-4 py-2 text-sm font-medium border border-gray-200 rounded-lg bg-white text-gray-700 hover:bg-gray-50 transition-colors"
              >
                <ChevronLeft size={16} />
                Previous
              </Link>
            ) : (
              <span className="inline-flex items-center gap-1 px-4 py-2 text-sm font-medium border border-gray-200 rounded-lg bg-white text-gray-400 cursor-not-allowed">
                <ChevronLeft size={16} />
                Previous
              </span>
            )}
            <span className="text-sm text-gray-500">
              Page {page} of {totalPages}
            </span>
            {page < totalPages ? (
              <Link
                href={buildPageLink(linkParams, page + 1)}
                className="inline-flex items-center gap-1 px-4 py-2 text-sm font-medium border border-gray-200 rounded-lg bg-white text-gray-700 hover:bg-gray-50 transition-colors"
              >
                Next
                <ChevronRight size={16} />
              </Link>
            ) : (
              <span className="inline-flex items-center gap-1 px-4 py-2 text-sm font-medium border border-gray-200 rounded-lg bg-white text-gray-400 cursor-not-allowed">
                Next
                <ChevronRight size={16} />
              </span>
            )}
          </nav>
        )}
      </div>
    </div>
  )
}
