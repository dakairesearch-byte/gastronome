import Link from 'next/link'
import { Award, MapPin, Search, Sparkles, Star, Utensils } from 'lucide-react'
import { createServerSupabaseClient } from '@/lib/supabase/server'
import {
  topTrendingRestaurants,
  type TrendingRestaurant,
} from '@/lib/ranking/trending'
import { paginateSelect } from '@/lib/supabase/paginate'
import CollectionCard from '@/components/cards/CollectionCard'
import HiddenGemCard from '@/components/cards/HiddenGemCard'
import NewOpeningTile from '@/components/cards/NewOpeningTile'
import EmptyState from '@/components/EmptyState'
import type { Restaurant } from '@/types/database'

export const revalidate = 60

interface SearchParamsInput {
  city?: string
  cuisine?: string
  accolade?: string
  neighborhood?: string
}

// "Hidden gem" selection rule: trending score > 0 AND total cross-source
// review volume under this threshold. Tuned to surface spots with recent
// momentum that the big aggregators haven't noticed yet.
const HIDDEN_GEM_REVIEW_THRESHOLD = 500

const EDITORIAL_CITIES = [
  'New York',
  'Los Angeles',
  'Chicago',
  'Miami',
  'San Francisco',
  'Austin',
] as const

function totalReviews(r: Restaurant): number {
  return (r.google_review_count ?? 0) + (r.yelp_review_count ?? 0)
}

export default async function ExplorePage({
  searchParams,
}: {
  searchParams: Promise<SearchParamsInput>
}) {
  const raw = await searchParams
  const city = raw.city?.trim() || null
  const cuisine = raw.cuisine?.trim() || null
  const accolade = raw.accolade?.trim() || null
  const neighborhood = raw.neighborhood?.trim() || null

  const hasFilter = Boolean(city || cuisine || accolade || neighborhood)
  const supabase = await createServerSupabaseClient()

  if (hasFilter) {
    return FilteredExploreView({
      supabase: await supabase,
      city,
      cuisine,
      accolade,
      neighborhood,
    })
  }

  // ----- Hub mode -----

  const [
    eaterRows,
    jamesBeardRes,
    michelinRes,
    bibRes,
    infatuationRes,
    cuisineRows,
    newOpeningsRes,
    trendingSeed,
  ] = await Promise.all([
    // Paginated: hub aggregates a per-city histogram client-side, so a
    // 1000-row cap would quietly drop cities once Eater 38 coverage grows.
    paginateSelect<{ city: string | null }>((from, to) =>
      supabase
        .from('restaurants')
        .select('city')
        .eq('eater_38', true)
        .range(from, to)
    ),
    supabase
      .from('restaurants')
      .select('id', { count: 'exact', head: true })
      .or('james_beard_nominated.eq.true,james_beard_winner.eq.true'),
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
      .not('infatuation_url', 'is', null),
    // Paginated: same reason — we bucket cuisines across the full table.
    paginateSelect<{ cuisine: string | null }>((from, to) =>
      supabase.from('restaurants').select('cuisine').range(from, to)
    ),
    supabase
      .from('restaurants')
      .select('*')
      .gt(
        'created_at',
        new Date(Date.now() - 90 * 24 * 3600 * 1000).toISOString()
      )
      .order('name', { ascending: true })
      .limit(50),
    topTrendingRestaurants(supabase, { window: '30d', limit: 40 }),
  ])

  // Eater 38 per city
  const eaterCountsByCity = new Map<string, number>()
  for (const row of eaterRows) {
    if (!row.city) continue
    eaterCountsByCity.set(
      row.city,
      (eaterCountsByCity.get(row.city) ?? 0) + 1
    )
  }

  // Top 5 cuisines by raw restaurant count
  const cuisineCounts = new Map<string, number>()
  for (const row of cuisineRows) {
    const c = row.cuisine
    if (!c || c === 'Restaurant') continue
    cuisineCounts.set(c, (cuisineCounts.get(c) ?? 0) + 1)
  }
  const topCuisines = [...cuisineCounts.entries()]
    .sort((a, b) => b[1] - a[1])
    .slice(0, 5)

  // Hidden gems: trending > 0 AND low review volume
  const hiddenGems = trendingSeed
    .filter((r) => totalReviews(r) < HIDDEN_GEM_REVIEW_THRESHOLD)
    .slice(0, 8)

  // New openings grouped by city, alphabetical within
  const newOpeningsByCity = new Map<string, Restaurant[]>()
  for (const r of newOpeningsRes.data ?? []) {
    const key = r.city ?? 'Unknown'
    if (!newOpeningsByCity.has(key)) newOpeningsByCity.set(key, [])
    newOpeningsByCity.get(key)!.push(r)
  }

  return (
    <div className="min-h-screen bg-gray-50">
      {/* Hero */}
      <section className="bg-gradient-to-br from-gray-900 via-gray-900 to-emerald-950 text-white">
        <div className="max-w-6xl mx-auto px-4 sm:px-6 py-10 sm:py-14">
          <h1 className="text-3xl sm:text-4xl font-extrabold tracking-tight">
            Discover
          </h1>
          <p className="mt-1 text-gray-400 text-sm">
            Editorial collections, hidden gems, and new openings — not a
            numbered leaderboard.
          </p>
          <form
            action="/search"
            className="mt-6 max-w-xl"
          >
            <div className="relative">
              <Search
                size={18}
                className="absolute left-3.5 top-1/2 -translate-y-1/2 text-gray-400"
              />
              <input
                type="text"
                name="q"
                placeholder="Search restaurants, cuisines, neighborhoods…"
                className="w-full pl-10 pr-4 py-3 bg-white/10 border border-white/20 rounded-xl text-white placeholder-gray-400 text-sm focus:outline-none focus:ring-2 focus:ring-emerald-500 focus:bg-white/15 transition-colors"
              />
            </div>
          </form>
        </div>
      </section>

      <div className="max-w-6xl mx-auto px-4 sm:px-6 py-10 sm:py-14 space-y-14">
        {/* Editorial Collections */}
        <section>
          <div className="flex items-center gap-2 mb-4">
            <Star size={20} className="text-amber-500" />
            <h2 className="text-xl sm:text-2xl font-extrabold text-gray-900 tracking-tight">
              Editorial collections
            </h2>
          </div>
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
            {EDITORIAL_CITIES.map((c) => {
              const count = eaterCountsByCity.get(c) ?? 0
              if (count === 0) return null
              return (
                <CollectionCard
                  key={`eater-${c}`}
                  href={`/explore?accolade=eater_38&city=${encodeURIComponent(c)}`}
                  title={`Eater 38 — ${c}`}
                  subtitle={"Eater's ongoing best-of list"}
                  count={count}
                  accent="pink"
                  icon={<Utensils size={18} />}
                />
              )
            })}
            <CollectionCard
              href="/explore?accolade=michelin_star"
              title="Michelin Starred"
              subtitle="1, 2, and 3 star holders"
              count={michelinRes.count ?? 0}
              accent="red"
              icon={<Star size={18} />}
            />
            <CollectionCard
              href="/explore?accolade=bib_gourmand"
              title="Bib Gourmand"
              subtitle="Michelin's value picks"
              count={bibRes.count ?? 0}
              accent="red"
              icon={<Star size={18} />}
            />
            <CollectionCard
              href="/explore?accolade=james_beard"
              title="James Beard"
              subtitle="Nominees and winners"
              count={jamesBeardRes.count ?? 0}
              accent="amber"
              icon={<Award size={18} />}
            />
            <CollectionCard
              href="/explore?accolade=infatuation"
              title="The Infatuation"
              subtitle="Hit-list restaurants"
              count={infatuationRes.count ?? 0}
              accent="orange"
            />
            {topCuisines.map(([name, count]) => (
              <CollectionCard
                key={`cuisine-${name}`}
                href={`/explore?cuisine=${encodeURIComponent(name)}`}
                title={`Best of ${name}`}
                subtitle="Ranked by trending engagement"
                count={count}
                accent="emerald"
                icon={<Utensils size={18} />}
              />
            ))}
          </div>
        </section>

        {/* Hidden Gems */}
        {hiddenGems.length > 0 && (
          <section>
            <div className="flex items-center gap-2 mb-4">
              <Sparkles size={20} className="text-purple-500" />
              <h2 className="text-xl sm:text-2xl font-extrabold text-gray-900 tracking-tight">
                Hidden gems
              </h2>
              <span className="text-xs text-gray-400 hidden sm:inline">
                High velocity, low review volume
              </span>
            </div>
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
              {hiddenGems.map((r) => (
                <HiddenGemCard key={r.id} restaurant={r} />
              ))}
            </div>
          </section>
        )}

        {/* New Openings */}
        {newOpeningsByCity.size > 0 && (
          <section>
            <div className="flex items-center gap-2 mb-4">
              <Sparkles size={20} className="text-emerald-500" />
              <h2 className="text-xl sm:text-2xl font-extrabold text-gray-900 tracking-tight">
                New openings
              </h2>
              <span className="text-xs text-gray-400 hidden sm:inline">
                Last 90 days, equal play
              </span>
            </div>
            <div className="space-y-6">
              {[...newOpeningsByCity.entries()]
                .sort(([a], [b]) => a.localeCompare(b))
                .map(([cityName, restaurants]) => (
                  <div key={cityName}>
                    <h3 className="inline-flex items-center gap-1.5 text-sm font-bold text-gray-700 mb-2">
                      <MapPin size={13} className="text-emerald-600" />
                      {cityName}
                      <span className="text-gray-400 font-medium">
                        ({restaurants.length})
                      </span>
                    </h3>
                    <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-2.5">
                      {restaurants.map((r) => (
                        <NewOpeningTile key={r.id} restaurant={r} />
                      ))}
                    </div>
                  </div>
                ))}
            </div>
          </section>
        )}

        {/* Browse by Cuisine */}
        {cuisineCounts.size > 0 && (
          <section>
            <div className="flex items-center gap-2 mb-4">
              <Utensils size={20} className="text-emerald-600" />
              <h2 className="text-xl sm:text-2xl font-extrabold text-gray-900 tracking-tight">
                Browse by cuisine
              </h2>
            </div>
            <div className="flex flex-wrap gap-2">
              {[...cuisineCounts.entries()]
                .sort((a, b) => b[1] - a[1])
                .map(([name, count]) => (
                  <Link
                    key={name}
                    href={`/explore?cuisine=${encodeURIComponent(name)}`}
                    className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-full text-xs font-semibold bg-white text-gray-700 border border-gray-200 hover:bg-emerald-50 hover:border-emerald-300 hover:text-emerald-700 transition-colors"
                  >
                    {name}
                    <span className="text-gray-400 font-medium">{count}</span>
                  </Link>
                ))}
            </div>
          </section>
        )}
      </div>
    </div>
  )
}

// ---------- Filtered view ----------

interface FilteredProps {
  supabase: Awaited<ReturnType<typeof createServerSupabaseClient>>
  city: string | null
  cuisine: string | null
  accolade: string | null
  neighborhood: string | null
}

async function FilteredExploreView({
  supabase,
  city,
  cuisine,
  accolade,
  neighborhood,
}: FilteredProps) {
  // Filter restaurants by whatever predicate the caller passed, then rank
  // the surviving set by trending (the project's only ranker). Trending
  // scores are windowed to 30d for filtered collection views so evergreen
  // collections don't oscillate daily.
  const ranked = await topTrendingRestaurants(supabase, {
    window: '30d',
    limit: 200,
    city: city ?? undefined,
    cuisine: cuisine ?? undefined,
  })

  let filtered = ranked as TrendingRestaurant[]
  if (accolade === 'michelin_star') {
    filtered = filtered.filter((r) => (r.michelin_stars ?? 0) > 0)
  } else if (accolade === 'bib_gourmand') {
    filtered = filtered.filter((r) => r.michelin_designation === 'bib_gourmand')
  } else if (accolade === 'james_beard') {
    filtered = filtered.filter(
      (r) => r.james_beard_nominated || r.james_beard_winner
    )
  } else if (accolade === 'eater_38') {
    filtered = filtered.filter((r) => r.eater_38)
  } else if (accolade === 'infatuation') {
    filtered = filtered.filter((r) => r.infatuation_url != null)
  }
  if (neighborhood) {
    filtered = filtered.filter(
      (r) => r.neighborhood?.toLowerCase() === neighborhood.toLowerCase()
    )
  }

  // If trending produced nothing (no events anywhere), fall back to raw
  // restaurants so the collection isn't mysteriously empty.
  let rows: Array<Restaurant & { trending_rank?: number }> = filtered
  let usedFallback = false
  if (rows.length === 0) {
    usedFallback = true
    const fallback = await supabase
      .from('restaurants')
      .select('*')
      .order('name')
      .limit(100)
    let fb: Restaurant[] = (fallback.data ?? []) as Restaurant[]
    if (city) fb = fb.filter((r) => r.city?.toLowerCase() === city.toLowerCase())
    if (cuisine)
      fb = fb.filter((r) => r.cuisine?.toLowerCase() === cuisine.toLowerCase())
    if (accolade === 'michelin_star') fb = fb.filter((r) => (r.michelin_stars ?? 0) > 0)
    if (accolade === 'bib_gourmand')
      fb = fb.filter((r) => r.michelin_designation === 'bib_gourmand')
    if (accolade === 'james_beard')
      fb = fb.filter((r) => r.james_beard_nominated || r.james_beard_winner)
    if (accolade === 'eater_38') fb = fb.filter((r) => r.eater_38)
    if (accolade === 'infatuation') fb = fb.filter((r) => r.infatuation_url != null)
    if (neighborhood)
      fb = fb.filter(
        (r) => r.neighborhood?.toLowerCase() === neighborhood.toLowerCase()
      )
    rows = fb
  }

  const titleBits: string[] = []
  if (accolade === 'michelin_star') titleBits.push('Michelin Starred')
  else if (accolade === 'bib_gourmand') titleBits.push('Bib Gourmand')
  else if (accolade === 'james_beard') titleBits.push('James Beard')
  else if (accolade === 'eater_38') titleBits.push('Eater 38')
  else if (accolade === 'infatuation') titleBits.push('The Infatuation')
  if (cuisine) titleBits.push(cuisine)
  if (neighborhood) titleBits.push(neighborhood)
  if (city) titleBits.push(`in ${city}`)
  const title = titleBits.join(' ') || 'Discover'

  return (
    <div className="min-h-screen bg-gray-50">
      <section className="bg-gradient-to-br from-gray-900 via-gray-900 to-emerald-950 text-white">
        <div className="max-w-6xl mx-auto px-4 sm:px-6 py-10 sm:py-12">
          <Link
            href="/explore"
            className="inline-block text-xs text-gray-400 hover:text-white mb-3 font-medium"
          >
            ← All collections
          </Link>
          <h1 className="text-2xl sm:text-3xl font-extrabold tracking-tight">
            {title}
          </h1>
          <p className="mt-1 text-gray-400 text-sm">
            {rows.length} {rows.length === 1 ? 'restaurant' : 'restaurants'} ·{' '}
            {usedFallback
              ? 'sorted alphabetically (no recent engagement to rank on)'
              : 'ranked by trending engagement (30-day window)'}
          </p>
        </div>
      </section>

      <div className="max-w-6xl mx-auto px-4 sm:px-6 py-8 sm:py-10">
        {rows.length === 0 ? (
          <EmptyState
            icon={MapPin}
            title="No matches"
            description="Try a different collection or cuisine."
          />
        ) : (
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
            {rows.map((r) => (
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
                  {r.city ? ` • ${r.city}` : ''}
                </p>
                {r.trending_rank && (
                  <p className="mt-2 text-[11px] font-semibold text-orange-600">
                    🔥 #{r.trending_rank} trending
                  </p>
                )}
              </Link>
            ))}
          </div>
        )}
      </div>
    </div>
  )
}
