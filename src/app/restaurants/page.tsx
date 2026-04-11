'use client'

import { useState, useEffect, Suspense, useMemo } from 'react'
import { useSearchParams } from 'next/navigation'
import { createClient } from '@/lib/supabase/client'
import { getPlacedRestaurants } from '@/lib/placement'
import RestaurantCard from '@/components/RestaurantCard'
import EmptyState from '@/components/EmptyState'
import { RestaurantCardSkeleton } from '@/components/LoadingSkeleton'
import { getCompositeRating } from '@/lib/compositeRating'
import { Restaurant, City } from '@/types/database'
import { Search, MapPin, Star, Award, Utensils, ChevronDown, ChevronLeft, ChevronRight } from 'lucide-react'

const PAGE_SIZE = 24

type SortTab = 'ranked' | 'top' | 'newest'
type AccoladeFilter = 'michelin_star' | 'bib_gourmand' | 'james_beard' | 'eater_38'

const ACCOLADE_FILTERS: { key: AccoladeFilter; label: string; icon: typeof Star; activeColor: string }[] = [
  { key: 'michelin_star', label: 'Michelin Star', icon: Star, activeColor: 'bg-red-600 text-white border-red-600' },
  { key: 'bib_gourmand', label: 'Bib Gourmand', icon: Star, activeColor: 'bg-red-100 text-red-700 border-red-300' },
  { key: 'james_beard', label: 'James Beard', icon: Award, activeColor: 'bg-amber-100 text-amber-800 border-amber-300' },
  { key: 'eater_38', label: 'Eater 38', icon: Utensils, activeColor: 'bg-pink-100 text-pink-700 border-pink-300' },
]

function RestaurantsContent() {
  const searchParams = useSearchParams()
  const [restaurants, setRestaurants] = useState<Restaurant[]>([])
  const [cities, setCities] = useState<City[]>([])
  const [loading, setLoading] = useState(true)
  const [searchQuery, setSearchQuery] = useState('')
  const [activeSort, setActiveSort] = useState<SortTab>('ranked')
  const [activeFilters, setActiveFilters] = useState<Set<AccoladeFilter>>(new Set())
  const [selectedCity, setSelectedCity] = useState<string>('all')
  const [page, setPage] = useState(1)
  const supabase = createClient()

  useEffect(() => {
    const fetchData = async () => {
      setLoading(true)
      try {
        const [placed, { data: citiesData }] = await Promise.all([
          getPlacedRestaurants(supabase, { limit: 500 }),
          supabase
            .from('cities')
            .select('*')
            .eq('is_active', true)
            .gt('restaurant_count', 0)
            .order('restaurant_count', { ascending: false }),
        ])

        if (placed.length > 0) {
          setRestaurants(placed)
        } else {
          const { data } = await supabase.from('restaurants').select('*')
          if (data) setRestaurants(data)
        }

        if (citiesData) setCities(citiesData)
      } finally {
        setLoading(false)
      }
    }
    fetchData()
  }, [supabase])

  // Filter and sort
  const filtered = useMemo(() => {
    let result = [...restaurants]

    // City filter
    if (selectedCity !== 'all') {
      result = result.filter((r) => r.city.toLowerCase() === selectedCity.toLowerCase())
    }

    // Search
    if (searchQuery.trim()) {
      const q = searchQuery.toLowerCase()
      result = result.filter(
        (r) =>
          r.name.toLowerCase().includes(q) ||
          r.cuisine?.toLowerCase().includes(q) ||
          r.neighborhood?.toLowerCase().includes(q) ||
          r.city.toLowerCase().includes(q)
      )
    }

    // Accolade filters
    if (activeFilters.size > 0) {
      result = result.filter((r) => {
        for (const f of activeFilters) {
          if (f === 'michelin_star' && r.michelin_stars > 0) return true
          if (f === 'bib_gourmand' && r.michelin_designation === 'bib_gourmand') return true
          if (f === 'james_beard' && (r.james_beard_winner || r.james_beard_nominated)) return true
          if (f === 'eater_38' && r.eater_38) return true
        }
        return false
      })
    }

    // Sort
    switch (activeSort) {
      case 'top': {
        result.sort((a, b) => {
          const aComp = getCompositeRating(a)
          const bComp = getCompositeRating(b)
          return (bComp?.rating || 0) - (aComp?.rating || 0)
        })
        break
      }
      case 'newest':
        result.sort(
          (a, b) => new Date(b.created_at).getTime() - new Date(a.created_at).getTime()
        )
        break
      default:
        // "ranked" preserves placement algorithm order
        break
    }

    return result
  }, [restaurants, selectedCity, searchQuery, activeFilters, activeSort])

  const totalPages = Math.ceil(filtered.length / PAGE_SIZE)
  const displayedRestaurants = filtered.slice((page - 1) * PAGE_SIZE, page * PAGE_SIZE)

  const toggleFilter = (key: AccoladeFilter) => {
    setActiveFilters((prev) => {
      const next = new Set(prev)
      if (next.has(key)) next.delete(key)
      else next.add(key)
      return next
    })
    setPage(1)
  }

  const sortTabs: { key: SortTab; label: string }[] = [
    { key: 'ranked', label: 'Ranked' },
    { key: 'top', label: 'Top Rated' },
    { key: 'newest', label: 'Newest' },
  ]

  return (
    <div className="min-h-screen bg-gray-50">
      {/* Hero Header */}
      <div className="bg-gradient-to-br from-gray-900 via-gray-900 to-emerald-950">
        <div className="max-w-6xl mx-auto px-4 sm:px-6 py-10 sm:py-14">
          <h1 className="text-2xl sm:text-3xl font-extrabold text-white tracking-tight">
            Explore Restaurants
          </h1>
          <p className="text-gray-400 mt-1">
            Compare ratings across Google, Yelp, The Infatuation, and Michelin
          </p>

          {/* Inline Search */}
          <div className="mt-6 max-w-xl">
            <div className="relative">
              <Search size={18} className="absolute left-3.5 top-1/2 -translate-y-1/2 text-gray-400" />
              <input
                type="text"
                placeholder="Search restaurants, cuisines, neighborhoods..."
                value={searchQuery}
                onChange={(e) => {
                  setSearchQuery(e.target.value)
                  setPage(1)
                }}
                className="w-full pl-10 pr-4 py-3 bg-white/10 border border-white/20 rounded-xl text-white placeholder-gray-400 text-sm focus:outline-none focus:ring-2 focus:ring-emerald-500 focus:bg-white/15 transition-colors"
              />
            </div>
          </div>
        </div>
      </div>

      {/* Sticky Filter Bar */}
      <div className="sticky top-14 z-30 bg-white/80 backdrop-blur-xl border-b border-gray-200">
        <div className="max-w-6xl mx-auto px-4 sm:px-6 py-3 space-y-3">
          {/* Row 1: Sort tabs + City dropdown */}
          <div className="flex items-center justify-between gap-4">
            {/* Sort Tabs */}
            <div className="flex gap-1">
              {sortTabs.map((tab) => (
                <button
                  key={tab.key}
                  type="button"
                  onClick={() => {
                    setActiveSort(tab.key)
                    setPage(1)
                  }}
                  className={`px-4 py-1.5 text-sm font-medium transition-colors whitespace-nowrap focus-visible:ring-2 focus-visible:ring-emerald-500 outline-none ${
                    activeSort === tab.key
                      ? 'text-emerald-600 border-b-2 border-emerald-600'
                      : 'text-gray-500 hover:text-gray-700 border-b-2 border-transparent'
                  }`}
                >
                  {tab.label}
                </button>
              ))}
            </div>

            {/* City Dropdown */}
            <div className="relative">
              <select
                value={selectedCity}
                onChange={(e) => {
                  setSelectedCity(e.target.value)
                  setPage(1)
                }}
                className="appearance-none pl-3 pr-8 py-1.5 text-sm font-medium border border-gray-200 rounded-lg bg-white text-gray-700 focus:outline-none focus:ring-2 focus:ring-emerald-500 cursor-pointer"
              >
                <option value="all">All Cities</option>
                {cities.map((city) => (
                  <option key={city.id} value={city.name}>
                    {city.name}
                  </option>
                ))}
              </select>
              <ChevronDown size={14} className="absolute right-2.5 top-1/2 -translate-y-1/2 text-gray-400 pointer-events-none" />
            </div>
          </div>

          {/* Row 2: Accolade filter pills */}
          <div className="flex items-center gap-2 overflow-x-auto scrollbar-hide pb-0.5">
            {ACCOLADE_FILTERS.map(({ key, label, icon: Icon, activeColor }) => {
              const isActive = activeFilters.has(key)
              return (
                <button
                  key={key}
                  type="button"
                  onClick={() => toggleFilter(key)}
                  className={`inline-flex items-center gap-1.5 px-3 py-1.5 rounded-full text-xs font-semibold whitespace-nowrap border transition-colors focus-visible:ring-2 focus-visible:ring-emerald-500 outline-none ${
                    isActive
                      ? activeColor
                      : 'bg-white border-gray-200 text-gray-600 hover:bg-gray-50'
                  }`}
                >
                  <Icon size={12} />
                  {label}
                </button>
              )
            })}
            {activeFilters.size > 0 && (
              <button
                type="button"
                onClick={() => {
                  setActiveFilters(new Set())
                  setPage(1)
                }}
                className="text-xs text-gray-400 hover:text-gray-600 font-medium whitespace-nowrap ml-1"
              >
                Clear
              </button>
            )}
          </div>

          {/* Results count */}
          <div className="flex items-center justify-between">
            <p className="text-xs text-gray-400">
              {filtered.length} restaurant{filtered.length !== 1 ? 's' : ''}
              {selectedCity !== 'all' ? ` in ${selectedCity}` : ''}
              {activeFilters.size > 0 ? ' (filtered)' : ''}
            </p>
          </div>
        </div>
      </div>

      {/* Content */}
      <div className="max-w-6xl mx-auto px-4 sm:px-6 py-8 sm:py-10">
        {/* Loading */}
        {loading && (
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-4">
            {Array.from({ length: 8 }).map((_, i) => (
              <RestaurantCardSkeleton key={i} />
            ))}
          </div>
        )}

        {/* Empty */}
        {!loading && filtered.length === 0 && (
          <EmptyState
            icon={MapPin}
            title="No restaurants found"
            description={
              searchQuery || activeFilters.size > 0
                ? 'Try adjusting your search or filters'
                : 'No restaurants in our database yet'
            }
          />
        )}

        {/* Restaurant Grid */}
        {!loading && displayedRestaurants.length > 0 && (
          <>
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-4">
              {displayedRestaurants.map((restaurant, i) => (
                <RestaurantCard
                  key={restaurant.id}
                  restaurant={restaurant}
                  rank={activeSort === 'ranked' ? (page - 1) * PAGE_SIZE + i + 1 : undefined}
                  showRank={activeSort === 'ranked'}
                />
              ))}
            </div>

            {/* Pagination */}
            {totalPages > 1 && (
              <div className="mt-10 flex items-center justify-center gap-3">
                <button
                  type="button"
                  onClick={() => {
                    setPage((p) => Math.max(1, p - 1))
                    window.scrollTo({ top: 0, behavior: 'smooth' })
                  }}
                  disabled={page === 1}
                  className="inline-flex items-center gap-1 px-4 py-2 text-sm font-medium border border-gray-200 rounded-lg bg-white text-gray-700 hover:bg-gray-50 transition-colors disabled:opacity-40 disabled:cursor-not-allowed focus-visible:ring-2 focus-visible:ring-emerald-500 outline-none"
                >
                  <ChevronLeft size={16} />
                  Previous
                </button>
                <span className="text-sm text-gray-500">
                  Page {page} of {totalPages}
                </span>
                <button
                  type="button"
                  onClick={() => {
                    setPage((p) => Math.min(totalPages, p + 1))
                    window.scrollTo({ top: 0, behavior: 'smooth' })
                  }}
                  disabled={page === totalPages}
                  className="inline-flex items-center gap-1 px-4 py-2 text-sm font-medium border border-gray-200 rounded-lg bg-white text-gray-700 hover:bg-gray-50 transition-colors disabled:opacity-40 disabled:cursor-not-allowed focus-visible:ring-2 focus-visible:ring-emerald-500 outline-none"
                >
                  Next
                  <ChevronRight size={16} />
                </button>
              </div>
            )}
          </>
        )}
      </div>
    </div>
  )
}

export default function RestaurantsPage() {
  return (
    <Suspense fallback={<div className="min-h-screen bg-gray-50" />}>
      <RestaurantsContent />
    </Suspense>
  )
}
