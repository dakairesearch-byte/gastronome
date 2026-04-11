'use client'

import { useState, useMemo } from 'react'
import RestaurantCard from '@/components/RestaurantCard'
import EmptyState from '@/components/EmptyState'
import { getCompositeRating } from '@/lib/compositeRating'
import { Restaurant } from '@/types/database'
import { Search, MapPin, Star, Award, Utensils, ChevronLeft, ChevronRight } from 'lucide-react'

const PAGE_SIZE = 24

type SortTab = 'ranked' | 'top' | 'newest'
type AccoladeFilter = 'michelin_star' | 'bib_gourmand' | 'james_beard' | 'eater_38'

const ACCOLADE_FILTERS: { key: AccoladeFilter; label: string; icon: typeof Star; activeColor: string }[] = [
  { key: 'michelin_star', label: 'Michelin Star', icon: Star, activeColor: 'bg-red-600 text-white border-red-600' },
  { key: 'bib_gourmand', label: 'Bib Gourmand', icon: Star, activeColor: 'bg-red-100 text-red-700 border-red-300' },
  { key: 'james_beard', label: 'James Beard', icon: Award, activeColor: 'bg-amber-100 text-amber-800 border-amber-300' },
  { key: 'eater_38', label: 'Eater 38', icon: Utensils, activeColor: 'bg-pink-100 text-pink-700 border-pink-300' },
]

interface CityRestaurantGridProps {
  restaurants: Restaurant[]
  cityName: string
}

export default function CityRestaurantGrid({ restaurants, cityName }: CityRestaurantGridProps) {
  const [searchQuery, setSearchQuery] = useState('')
  const [activeSort, setActiveSort] = useState<SortTab>('ranked')
  const [activeFilters, setActiveFilters] = useState<Set<AccoladeFilter>>(new Set())
  const [page, setPage] = useState(1)

  const filtered = useMemo(() => {
    let result = [...restaurants]

    // Search
    if (searchQuery.trim()) {
      const q = searchQuery.toLowerCase()
      result = result.filter(
        (r) =>
          r.name.toLowerCase().includes(q) ||
          r.cuisine?.toLowerCase().includes(q) ||
          r.neighborhood?.toLowerCase().includes(q)
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
  }, [restaurants, searchQuery, activeFilters, activeSort])

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
    <div className="space-y-6">
      {/* Search */}
      <div className="max-w-md">
        <div className="relative">
          <Search size={16} className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400" />
          <input
            type="text"
            placeholder={`Search in ${cityName}...`}
            value={searchQuery}
            onChange={(e) => {
              setSearchQuery(e.target.value)
              setPage(1)
            }}
            className="w-full pl-9 pr-4 py-2.5 bg-white border border-gray-200 rounded-xl text-gray-900 placeholder-gray-400 text-sm focus:outline-none focus:ring-2 focus:ring-emerald-500 focus:border-emerald-500 transition-colors"
          />
        </div>
      </div>

      {/* Sort tabs + Accolade filters */}
      <div className="space-y-3">
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

        {/* Accolade filter pills */}
        <div className="flex items-center gap-2 overflow-x-auto scrollbar-hide">
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
        <p className="text-xs text-gray-400">
          {filtered.length} restaurant{filtered.length !== 1 ? 's' : ''}
          {activeFilters.size > 0 || searchQuery ? ' (filtered)' : ''}
        </p>
      </div>

      {/* Restaurant Grid */}
      {displayedRestaurants.length > 0 ? (
        <>
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
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
            <div className="mt-8 flex items-center justify-center gap-3">
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
      ) : (
        <EmptyState
          icon={MapPin}
          title="No restaurants found"
          description={
            searchQuery || activeFilters.size > 0
              ? 'Try adjusting your search or filters'
              : `No restaurants in ${cityName} yet.`
          }
        />
      )}
    </div>
  )
}
