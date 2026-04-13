'use client'

import { useRouter, usePathname } from 'next/navigation'
import { useCallback, useState, useTransition } from 'react'
import { Search, Star, Award, Utensils, ChevronDown } from 'lucide-react'

export type SortTab = 'ranked' | 'top' | 'newest'
export type AccoladeFilter =
  | 'michelin_star'
  | 'bib_gourmand'
  | 'james_beard'
  | 'eater_38'

const SORT_TABS: { key: SortTab; label: string }[] = [
  { key: 'ranked', label: 'Ranked' },
  { key: 'top', label: 'Top Rated' },
  { key: 'newest', label: 'Newest' },
]

const ACCOLADE_FILTERS: {
  key: AccoladeFilter
  label: string
  icon: typeof Star
  activeColor: string
}[] = [
  { key: 'michelin_star', label: 'Michelin Star', icon: Star, activeColor: 'bg-red-600 text-white border-red-600' },
  { key: 'bib_gourmand', label: 'Bib Gourmand', icon: Star, activeColor: 'bg-red-100 text-red-700 border-red-300' },
  { key: 'james_beard', label: 'James Beard', icon: Award, activeColor: 'bg-amber-100 text-amber-800 border-amber-300' },
  { key: 'eater_38', label: 'Eater 38', icon: Utensils, activeColor: 'bg-pink-100 text-pink-700 border-pink-300' },
]

interface ExploreFiltersProps {
  cities: { name: string }[]
  tab: SortTab
  city: string
  accolade: AccoladeFilter | null
  q: string
}

export default function ExploreFilters({
  cities,
  tab,
  city,
  accolade,
  q,
}: ExploreFiltersProps) {
  const router = useRouter()
  const pathname = usePathname()
  const [, startTransition] = useTransition()
  const [search, setSearch] = useState(q)

  const push = useCallback(
    (next: {
      tab?: SortTab
      city?: string
      accolade?: AccoladeFilter | null
      q?: string
    }) => {
      const params = new URLSearchParams()
      const resolvedTab = next.tab ?? tab
      const resolvedCity = next.city ?? city
      const resolvedAccolade =
        next.accolade === null
          ? null
          : next.accolade ?? accolade
      const resolvedQ = next.q ?? search

      if (resolvedTab && resolvedTab !== 'ranked') params.set('tab', resolvedTab)
      if (resolvedCity && resolvedCity !== 'all') params.set('city', resolvedCity)
      if (resolvedAccolade) params.set('accolade', resolvedAccolade)
      if (resolvedQ?.trim()) params.set('q', resolvedQ.trim())

      const query = params.toString()
      startTransition(() => {
        router.push(query ? `${pathname}?${query}` : pathname)
      })
    },
    [router, pathname, tab, city, accolade, search]
  )

  return (
    <>
      {/* Hero with inline search */}
      <div className="bg-gradient-to-br from-gray-900 via-gray-900 to-emerald-950">
        <div className="max-w-6xl mx-auto px-4 sm:px-6 py-10 sm:py-14">
          <h1 className="text-2xl sm:text-3xl font-extrabold text-white tracking-tight">
            Explore Restaurants
          </h1>
          <p className="text-gray-400 mt-1">
            Compare ratings across Google, Yelp, Beli &amp; The Infatuation
          </p>

          <form
            onSubmit={(e) => {
              e.preventDefault()
              push({ q: search })
            }}
            className="mt-6 max-w-xl"
          >
            <div className="relative">
              <Search
                size={18}
                className="absolute left-3.5 top-1/2 -translate-y-1/2 text-gray-400"
              />
              <input
                type="text"
                placeholder="Search restaurants, cuisines, neighborhoods..."
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                className="w-full pl-10 pr-4 py-3 bg-white/10 border border-white/20 rounded-xl text-white placeholder-gray-400 text-sm focus:outline-none focus:ring-2 focus:ring-emerald-500 focus:bg-white/15 transition-colors"
              />
            </div>
          </form>
        </div>
      </div>

      {/* Sticky filter bar */}
      <div className="sticky top-14 z-30 bg-white/80 backdrop-blur-xl border-b border-gray-200">
        <div className="max-w-6xl mx-auto px-4 sm:px-6 py-3 space-y-3">
          <div className="flex items-center justify-between gap-4">
            <div className="flex gap-1">
              {SORT_TABS.map((t) => (
                <button
                  key={t.key}
                  type="button"
                  onClick={() => push({ tab: t.key })}
                  className={`px-4 py-1.5 text-sm font-medium transition-colors whitespace-nowrap focus-visible:ring-2 focus-visible:ring-emerald-500 outline-none ${
                    tab === t.key
                      ? 'text-emerald-600 border-b-2 border-emerald-600'
                      : 'text-gray-500 hover:text-gray-700 border-b-2 border-transparent'
                  }`}
                >
                  {t.label}
                </button>
              ))}
            </div>

            <div className="relative">
              <select
                value={city}
                onChange={(e) => push({ city: e.target.value })}
                className="appearance-none pl-3 pr-8 py-1.5 text-sm font-medium border border-gray-200 rounded-lg bg-white text-gray-700 focus:outline-none focus:ring-2 focus:ring-emerald-500 cursor-pointer"
              >
                <option value="all">All Cities</option>
                {cities.map((c) => (
                  <option key={c.name} value={c.name}>
                    {c.name}
                  </option>
                ))}
              </select>
              <ChevronDown
                size={14}
                className="absolute right-2.5 top-1/2 -translate-y-1/2 text-gray-400 pointer-events-none"
              />
            </div>
          </div>

          <div className="flex items-center gap-2 overflow-x-auto scrollbar-hide pb-0.5">
            {ACCOLADE_FILTERS.map(({ key, label, icon: Icon, activeColor }) => {
              const isActive = accolade === key
              return (
                <button
                  key={key}
                  type="button"
                  onClick={() => push({ accolade: isActive ? null : key })}
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
            {(accolade || city !== 'all' || q) && (
              <button
                type="button"
                onClick={() =>
                  push({ accolade: null, city: 'all', q: '', tab: 'ranked' })
                }
                className="text-xs text-gray-400 hover:text-gray-600 font-medium whitespace-nowrap ml-1"
              >
                Clear
              </button>
            )}
          </div>
        </div>
      </div>
    </>
  )
}
