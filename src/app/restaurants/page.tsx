'use client'

import { useState, useEffect, useRef, useCallback, Suspense } from 'react'
import { useSearchParams, useRouter } from 'next/navigation'
import { createClient } from '@/lib/supabase/client'
import RestaurantCard from '@/components/RestaurantCard'
import FilterChips from '@/components/FilterChips'
import EmptyState from '@/components/EmptyState'
import { RestaurantCardSkeleton } from '@/components/LoadingSkeleton'
import { Restaurant } from '@/types/database'
import { Search, X, MapPin, ExternalLink, Loader2 } from 'lucide-react'

interface GooglePlaceResult {
  placeId: string
  name: string
  address: string
  city: string
}

declare global {
  interface Window {
    google?: {
      maps?: {
        places?: {
          AutocompleteService: any
          PlacesService: any
        }
      }
    }
  }
}

function RestaurantsContent() {
  const searchParams = useSearchParams()
  const router = useRouter()
  const cityParam = searchParams.get('city') || ''
  const tabParam = searchParams.get('tab') || 'all'
  const [restaurants, setRestaurants] = useState<Restaurant[]>([])
  const [filteredRestaurants, setFilteredRestaurants] = useState<Restaurant[]>([])
  const [googleResults, setGoogleResults] = useState<GooglePlaceResult[]>([])
  const [googleSearching, setGoogleSearching] = useState(false)
  const [availableCuisines, setAvailableCuisines] = useState<string[]>([])
  const [selectedCuisines, setSelectedCuisines] = useState<string[]>([])
  const [activeTab, setActiveTab] = useState<'all' | 'top' | 'new'>(tabParam as any || 'all')
  const [searchQuery, setSearchQuery] = useState(cityParam)
  const [inputValue, setInputValue] = useState(cityParam)
  const [loading, setLoading] = useState(true)
  const autocompleteServiceRef = useRef<any>(null)
  const debounceTimerRef = useRef<NodeJS.Timeout | null>(null)
  const supabase = createClient()
  const apiKey = process.env.NEXT_PUBLIC_GOOGLE_PLACES_API_KEY

  // Load Google Places API
  useEffect(() => {
    if (!apiKey) return
    if (window.google?.maps?.places?.AutocompleteService) {
      autocompleteServiceRef.current = new window.google.maps.places.AutocompleteService()
      return
    }
    const script = document.createElement('script')
    script.src = `https://maps.googleapis.com/maps/api/js?key=${apiKey}&libraries=places`
    script.async = true
    script.onload = () => {
      if (window.google?.maps?.places?.AutocompleteService) {
        autocompleteServiceRef.current = new window.google.maps.places.AutocompleteService()
      }
    }
    document.head.appendChild(script)
    return () => { if (script.parentNode) script.parentNode.removeChild(script) }
  }, [apiKey])

  // Cleanup debounce timer
  useEffect(() => {
    return () => { if (debounceTimerRef.current) clearTimeout(debounceTimerRef.current) }
  }, [])

  const searchGooglePlaces = useCallback(async (query: string): Promise<GooglePlaceResult[]> => {
    if (!query.trim() || !autocompleteServiceRef.current) return []
    try {
      const predictions = await new Promise<any[]>((resolve) => {
        autocompleteServiceRef.current.getPlacePredictions(
          { input: query, types: ['establishment'] },
          (preds: any[] | null, status: string) => {
            if (status === 'OK' && preds) resolve(preds)
            else resolve([])
          }
        )
      })
      return predictions.slice(0, 5).map((p) => {
        const parts = p.description.split(',')
        const city = parts.length > 1 ? parts[1].trim() : ''
        return {
          placeId: p.place_id,
          name: p.structured_formatting?.main_text || parts[0],
          city,
          address: p.description,
        }
      })
    } catch {
      return []
    }
  }, [])

  useEffect(() => {
    const fetchRestaurants = async () => {
      setLoading(true)
      try {
        const { data } = await supabase.from('restaurants').select('*')
        if (data) {
          setRestaurants(data)
          const cuisines = [...new Set(data.map((r) => r.cuisine))].sort()
          setAvailableCuisines(cuisines)
        }
      } finally {
        setLoading(false)
      }
    }
    fetchRestaurants()
  }, [supabase])

  useEffect(() => {
    let filtered = [...restaurants]

    if (searchQuery.trim()) {
      const q = searchQuery.toLowerCase()
      filtered = filtered.filter(
        (r) =>
          r.name.toLowerCase().includes(q) ||
          r.cuisine.toLowerCase().includes(q) ||
          r.city.toLowerCase().includes(q)
      )
    }

    if (selectedCuisines.length > 0) {
      filtered = filtered.filter((r) => selectedCuisines.includes(r.cuisine))
    }

    switch (activeTab) {
      case 'top':
        filtered = filtered.filter((r) => r.avg_rating && r.avg_rating > 0)
        filtered.sort((a, b) => (b.avg_rating || 0) - (a.avg_rating || 0))
        break
      case 'new':
        filtered.sort(
          (a, b) =>
            new Date(b.created_at).getTime() - new Date(a.created_at).getTime()
        )
        break
      default:
        filtered.sort((a, b) => (b.avg_rating || 0) - (a.avg_rating || 0))
    }

    setFilteredRestaurants(filtered)
  }, [restaurants, selectedCuisines, activeTab, searchQuery])

  // Search Google Places when query changes (debounced)
  useEffect(() => {
    if (debounceTimerRef.current) clearTimeout(debounceTimerRef.current)

    if (!searchQuery.trim()) {
      setGoogleResults([])
      setGoogleSearching(false)
      return
    }

    setGoogleSearching(true)
    debounceTimerRef.current = setTimeout(async () => {
      const results = await searchGooglePlaces(searchQuery)
      // Deduplicate: remove Google results that match local restaurant names
      const localNames = new Set(filteredRestaurants.map((r) => r.name.toLowerCase()))
      const filtered = results.filter((g) => !localNames.has(g.name.toLowerCase()))
      setGoogleResults(filtered)
      setGoogleSearching(false)
    }, 400)
  }, [searchQuery, searchGooglePlaces, filteredRestaurants])

  const handleSearchInput = (value: string) => {
    setInputValue(value)
    setSearchQuery(value)
  }

  const handleCuisineChange = (cuisine: string) => {
    setSelectedCuisines((prev) =>
      prev.includes(cuisine)
        ? prev.filter((c) => c !== cuisine)
        : [...prev, cuisine]
    )
  }

  const handleClearFilters = () => {
    setSelectedCuisines([])
    setSearchQuery('')
    setInputValue('')
  }

  const tabs = [
    { key: 'all' as const, label: 'All' },
    { key: 'top' as const, label: 'Top Rated' },
    { key: 'new' as const, label: 'Newest' },
  ]

  return (
    <div className="min-h-screen">
      <div className="max-w-6xl mx-auto px-4 sm:px-6 py-6 sm:py-10">
        {/* Header */}
        <div className="mb-6">
          <h1 className="text-2xl sm:text-3xl font-bold text-gray-900">Explore restaurants</h1>
          <p className="text-sm text-gray-500 mt-1">Discover restaurants reviewed by our community</p>
        </div>

        {/* Sticky Filter Bar */}
        <div className="sticky top-14 z-30 -mx-4 px-4 sm:-mx-6 sm:px-6 py-3 bg-white/80 backdrop-blur-xl border-b border-gray-100 mb-6 space-y-3">
          {/* Search + Tabs row */}
          <div className="flex flex-col sm:flex-row gap-3">
            {/* Search */}
            <div className="relative flex-1">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400" size={16} />
              <input
                type="text"
                value={inputValue}
                onChange={(e) => handleSearchInput(e.target.value)}
                placeholder="Search by name, cuisine, or city..."
                className="w-full py-2 pl-9 pr-9 text-sm text-gray-900 bg-gray-50 border border-gray-200 rounded-lg focus:ring-2 focus:ring-emerald-500 focus:border-transparent outline-none transition focus:bg-white"
              />
              {inputValue && (
                <button
                  type="button"
                  onClick={() => { setInputValue(''); setSearchQuery('') }}
                  className="absolute right-3 top-1/2 -translate-y-1/2 text-gray-400 hover:text-gray-600"
                  aria-label="Clear search"
                >
                  <X size={14} />
                </button>
              )}
            </div>

            {/* Tabs */}
            <div className="flex gap-1 bg-gray-100 rounded-lg p-1 flex-shrink-0">
              {tabs.map((tab) => (
                <button
                  key={tab.key}
                  type="button"
                  onClick={() => setActiveTab(tab.key)}
                  className={`px-4 py-1.5 text-sm font-medium rounded-md transition-colors whitespace-nowrap ${
                    activeTab === tab.key
                      ? 'bg-white text-gray-900 shadow-sm'
                      : 'text-gray-500 hover:text-gray-700'
                  }`}
                >
                  {tab.label}
                </button>
              ))}
            </div>
          </div>

          {/* Cuisine Filters */}
          {availableCuisines.length > 0 && (
            <FilterChips
              cuisines={availableCuisines}
              selectedCuisines={selectedCuisines}
              onCuisineChange={handleCuisineChange}
              onClearAll={handleClearFilters}
            />
          )}

          {/* Results count */}
          <div className="flex items-center justify-between">
            <p className="text-xs text-gray-400">
              {filteredRestaurants.length} restaurant{filteredRestaurants.length !== 1 ? 's' : ''}
            </p>
            {(selectedCuisines.length > 0 || searchQuery) && (
              <button
                type="button"
                onClick={handleClearFilters}
                className="text-xs text-emerald-600 hover:text-emerald-700 font-medium"
              >
                Clear all filters
              </button>
            )}
          </div>
        </div>

        {/* Loading */}
        {loading && (
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
            {[1, 2, 3, 4, 5, 6].map((i) => (
              <RestaurantCardSkeleton key={i} />
            ))}
          </div>
        )}

        {/* Empty — only show if no local AND no google results */}
        {!loading && filteredRestaurants.length === 0 && googleResults.length === 0 && !googleSearching && (
          <EmptyState
            icon={MapPin}
            title="No restaurants found"
            description={
              selectedCuisines.length > 0 || searchQuery
                ? 'Try adjusting your filters or search terms'
                : 'No restaurants in our database yet'
            }
          />
        )}

        {/* Restaurant Grid */}
        {!loading && filteredRestaurants.length > 0 && (
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
            {filteredRestaurants.map((restaurant) => (
              <RestaurantCard key={restaurant.id} restaurant={restaurant} />
            ))}
          </div>
        )}

        {/* Google Places Results */}
        {searchQuery.trim() && (googleResults.length > 0 || googleSearching) && (
          <div className={filteredRestaurants.length > 0 ? 'mt-8' : ''}>
            <div className="flex items-center gap-2 mb-4">
              <span className="inline-block px-2 py-0.5 bg-blue-50 text-blue-600 text-xs rounded font-medium">
                Google
              </span>
              <h2 className="text-sm font-semibold text-gray-500">Results from Google Places</h2>
            </div>
            {googleSearching ? (
              <div className="flex items-center justify-center py-8">
                <Loader2 className="animate-spin text-gray-400" size={20} />
              </div>
            ) : (
              <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3">
                {googleResults.map((place) => (
                  <button
                    key={place.placeId}
                    type="button"
                    onClick={() =>
                      router.push(
                        `/review/new?name=${encodeURIComponent(place.name)}&city=${encodeURIComponent(place.city)}&address=${encodeURIComponent(place.address)}`
                      )
                    }
                    className="bg-white rounded-xl border border-gray-100 p-4 text-left transition-all hover:shadow-md hover:-translate-y-0.5 group"
                  >
                    <div className="flex items-start justify-between gap-2">
                      <div className="min-w-0 flex-1">
                        <p className="font-semibold text-gray-900 truncate group-hover:text-emerald-600 transition-colors">
                          {place.name}
                        </p>
                        <div className="flex items-center gap-1 mt-1.5 text-sm text-gray-500">
                          <MapPin size={13} className="text-gray-400 flex-shrink-0" />
                          <span className="truncate">{place.address}</span>
                        </div>
                      </div>
                      <ExternalLink size={14} className="text-gray-300 flex-shrink-0 mt-1" />
                    </div>
                    <p className="text-xs text-emerald-600 font-medium mt-3">
                      Write a review &rarr;
                    </p>
                  </button>
                ))}
              </div>
            )}
          </div>
        )}
      </div>
    </div>
  )
}

export default function RestaurantsPage() {
  return (
    <Suspense fallback={<div className="min-h-screen" />}>
      <RestaurantsContent />
    </Suspense>
  )
}
