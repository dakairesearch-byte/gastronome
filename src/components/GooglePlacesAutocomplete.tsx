'use client'

import { useEffect, useRef, useState, useCallback } from 'react'
import { Search, MapPin, ExternalLink, Loader2, X } from 'lucide-react'
import { createClient } from '@/lib/supabase/client'
import { Restaurant } from '@/types/database'

export interface GooglePlacesResult {
  placeId: string
  name: string
  address: string
  city: string
  lat?: number
  lng?: number
  rating?: number
  types: string[]
  isFromGoogle: true
}

interface LocalRestaurantResult extends Restaurant {
  isFromGoogle: false
}

type SearchResult = GooglePlacesResult | LocalRestaurantResult

interface GooglePlacesAutocompleteProps {
  onSelect: (result: SearchResult) => void
  placeholder?: string
  className?: string
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

export default function GooglePlacesAutocomplete({
  onSelect,
  placeholder = 'Search for a restaurant...',
  className = '',
}: GooglePlacesAutocompleteProps) {
  const inputRef = useRef<HTMLInputElement>(null)
  const containerRef = useRef<HTMLDivElement>(null)
  const autocompleteServiceRef = useRef<any>(null)
  const placesServiceRef = useRef<any>(null)
  const debounceTimerRef = useRef<NodeJS.Timeout | null>(null)

  const [query, setQuery] = useState('')
  const [results, setResults] = useState<SearchResult[]>([])
  const [isOpen, setIsOpen] = useState(false)
  const [isLoading, setIsLoading] = useState(false)
  const [selectedIndex, setSelectedIndex] = useState(-1)
  const [googleApiAvailable, setGoogleApiAvailable] = useState(false)

  const supabase = createClient()
  const apiKey = process.env.NEXT_PUBLIC_GOOGLE_PLACES_API_KEY

  // Load Google Places API
  useEffect(() => {
    if (!apiKey) {
      console.warn('Google Places API key not configured')
      return
    }

    const script = document.createElement('script')
    script.src = `https://maps.googleapis.com/maps/api/js?key=${apiKey}&libraries=places`
    script.async = true
    script.defer = true

    script.onload = () => {
      if (window.google?.maps?.places) {
        autocompleteServiceRef.current = new window.google.maps.places.AutocompleteService()
        setGoogleApiAvailable(true)
      }
    }

    script.onerror = () => {
      console.error('Failed to load Google Places API')
    }

    document.head.appendChild(script)

    return () => {
      if (script.parentNode) {
        script.parentNode.removeChild(script)
      }
    }
  }, [apiKey])

  // Search local restaurants in Supabase
  const searchLocalRestaurants = useCallback(
    async (searchQuery: string): Promise<LocalRestaurantResult[]> => {
      if (!searchQuery.trim()) return []

      const { data } = await supabase
        .from('restaurants')
        .select('*')
        .or(
          `name.ilike.%${searchQuery}%,cuisine.ilike.%${searchQuery}%,city.ilike.%${searchQuery}%`
        )
        .limit(5)

      return data
        ? data.map((restaurant) => ({
            ...restaurant,
            isFromGoogle: false,
          }))
        : []
    },
    [supabase]
  )

  // Search Google Places
  const searchGooglePlaces = useCallback(
    async (searchQuery: string): Promise<GooglePlacesResult[]> => {
      if (!searchQuery.trim() || !autocompleteServiceRef.current) return []

      try {
        const predictions = await new Promise<any[]>((resolve, reject) => {
          autocompleteServiceRef.current.getPlacePredictions(
            {
              input: searchQuery,
              types: ['establishment'],
              componentRestrictions: { country: 'us' },
            },
            (predictions: any[], status: string) => {
              if (status === 'OK' && predictions) {
                resolve(predictions)
              } else {
                resolve([])
              }
            }
          )
        })

        // Filter to restaurant-like places and get details
        const results = await Promise.all(
          predictions
            .filter((p) => {
              const description = p.description.toLowerCase()
              const types = p.types || []
              return (
                (description.includes('restaurant') ||
                  description.includes('cafe') ||
                  description.includes('pizza') ||
                  description.includes('sushi') ||
                  description.includes('bar') ||
                  description.includes('bistro') ||
                  description.includes('diner') ||
                  types.includes('restaurant') ||
                  types.includes('food') ||
                  types.includes('cafe')) &&
                !description.includes('hotels')
              )
            })
            .slice(0, 5)
            .map((prediction) =>
              new Promise<GooglePlacesResult | null>((resolve) => {
                const map = document.createElement('div')
                const placesService = new window.google!.maps!.places!.PlacesService(map)

                placesService.getDetails(
                  {
                    placeId: prediction.place_id,
                    fields: [
                      'name',
                      'formatted_address',
                      'geometry',
                      'rating',
                      'place_id',
                      'types',
                    ],
                  },
                  (place: any, status: string) => {
                    if (status === 'OK' && place) {
                      const address = place.formatted_address || ''
                      const addressParts = address.split(',')
                      const city = addressParts.length > 1 ? addressParts[addressParts.length - 2].trim() : ''

                      resolve({
                        placeId: prediction.place_id,
                        name: place.name,
                        address,
                        city,
                        lat: place.geometry?.location?.lat(),
                        lng: place.geometry?.location?.lng(),
                        rating: place.rating,
                        types: place.types || [],
                        isFromGoogle: true,
                      })
                    } else {
                      resolve(null)
                    }
                  }
                )
              })
            )
        )

        return results.filter((r) => r !== null) as GooglePlacesResult[]
      } catch (error) {
        console.error('Google Places search error:', error)
        return []
      }
    },
    []
  )

  // Perform combined search
  const performSearch = useCallback(
    async (searchQuery: string) => {
      if (!searchQuery.trim()) {
        setResults([])
        setIsOpen(false)
        return
      }

      setIsLoading(true)
      setSelectedIndex(-1)

      try {
        const [localResults, googleResults] = await Promise.all([
          searchLocalRestaurants(searchQuery),
          googleApiAvailable ? searchGooglePlaces(searchQuery) : Promise.resolve([]),
        ])

        // Combine results: local first, then Google
        const combined = [...localResults, ...googleResults]
        setResults(combined)
        setIsOpen(combined.length > 0)
      } catch (error) {
        console.error('Search error:', error)
        setResults([])
      } finally {
        setIsLoading(false)
      }
    },
    [searchLocalRestaurants, searchGooglePlaces, googleApiAvailable]
  )

  // Handle input change with debounce
  const handleInputChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const value = e.target.value
    setQuery(value)
    setSelectedIndex(-1)

    if (debounceTimerRef.current) {
      clearTimeout(debounceTimerRef.current)
    }

    debounceTimerRef.current = setTimeout(() => {
      performSearch(value)
    }, 300)
  }

  // Handle result selection
  const handleSelectResult = (result: SearchResult) => {
    onSelect(result)
    setQuery('')
    setResults([])
    setIsOpen(false)
    setSelectedIndex(-1)
  }

  // Handle keyboard navigation
  const handleKeyDown = (e: React.KeyboardEvent<HTMLInputElement>) => {
    if (!isOpen || results.length === 0) {
      if (e.key === 'ArrowDown') {
        e.preventDefault()
        setIsOpen(true)
      }
      return
    }

    switch (e.key) {
      case 'ArrowDown':
        e.preventDefault()
        setSelectedIndex((prev) => (prev < results.length - 1 ? prev + 1 : prev))
        break
      case 'ArrowUp':
        e.preventDefault()
        setSelectedIndex((prev) => (prev > 0 ? prev - 1 : -1))
        break
      case 'Enter':
        e.preventDefault()
        if (selectedIndex >= 0 && results[selectedIndex]) {
          handleSelectResult(results[selectedIndex])
        }
        break
      case 'Escape':
        e.preventDefault()
        setIsOpen(false)
        setSelectedIndex(-1)
        break
      default:
        break
    }
  }

  // Close dropdown when clicking outside
  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (
        containerRef.current &&
        !containerRef.current.contains(event.target as Node)
      ) {
        setIsOpen(false)
        setSelectedIndex(-1)
      }
    }

    if (isOpen) {
      document.addEventListener('mousedown', handleClickOutside)
      return () => {
        document.removeEventListener('mousedown', handleClickOutside)
      }
    }
  }, [isOpen])

  const handleClear = () => {
    setQuery('')
    setResults([])
    setIsOpen(false)
    setSelectedIndex(-1)
    inputRef.current?.focus()
  }

  return (
    <div ref={containerRef} className={`relative w-full ${className}`}>
      <div className="relative">
        <div className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400 pointer-events-none">
          <Search size={18} />
        </div>

        <input
          ref={inputRef}
          type="text"
          value={query}
          onChange={handleInputChange}
          onKeyDown={handleKeyDown}
          onFocus={() => {
            if (results.length > 0) setIsOpen(true)
          }}
          placeholder={placeholder}
          className="w-full pl-10 pr-10 py-3 border border-gray-300 rounded-xl focus:ring-2 focus:ring-amber-500 focus:border-transparent outline-none transition bg-white text-gray-900"
          autoComplete="off"
        />

        {isLoading && (
          <div className="absolute right-3 top-1/2 -translate-y-1/2 text-amber-500">
            <Loader2 size={18} className="animate-spin" />
          </div>
        )}

        {!isLoading && query && (
          <button
            onClick={handleClear}
            className="absolute right-3 top-1/2 -translate-y-1/2 text-gray-400 hover:text-gray-600 transition-colors"
          >
            <X size={18} />
          </button>
        )}
      </div>

      {/* Dropdown Results */}
      {isOpen && results.length > 0 && (
        <div className="absolute top-full left-0 right-0 mt-2 bg-white border border-gray-200 rounded-xl shadow-lg z-50 max-h-96 overflow-y-auto">
          {/* Local Results Section */}
          {results.some((r) => !r.isFromGoogle) && (
            <>
              <div className="px-4 py-2 bg-gray-50 border-b border-gray-100 text-xs font-semibold text-gray-600 uppercase tracking-wide">
                On Gastronome
              </div>
              {results
                .filter((r) => !r.isFromGoogle)
                .map((result, index) => {
                  const restaurant = result as LocalRestaurantResult
                  const resultIndex = results.indexOf(result)
                  return (
                    <button
                      key={`local-${restaurant.id}`}
                      onClick={() => handleSelectResult(result)}
                      className={`w-full px-4 py-3 text-left border-b border-gray-100 transition-colors ${
                        selectedIndex === resultIndex
                          ? 'bg-amber-50'
                          : 'hover:bg-gray-50'
                      }`}
                    >
                      <div className="flex items-start gap-3">
                        <div className="flex-1 min-w-0">
                          <p className="font-medium text-gray-900 truncate">
                            {restaurant.name}
                          </p>
                          <p className="text-sm text-gray-600 truncate">
                            {restaurant.cuisine} • {restaurant.city}
                          </p>
                          {restaurant.address && (
                            <p className="text-xs text-gray-500 truncate">
                              {restaurant.address}
                            </p>
                          )}
                        </div>
                        {restaurant.avg_rating && (
                          <div className="flex-shrink-0">
                            <span className="inline-flex items-center px-2 py-1 rounded-full text-xs font-medium bg-amber-100 text-amber-800">
                              {restaurant.avg_rating.toFixed(1)}
                            </span>
                          </div>
                        )}
                      </div>
                    </button>
                  )
                })}
            </>
          )}

          {/* Google Places Results Section */}
          {results.some((r) => r.isFromGoogle) && (
            <>
              <div className="px-4 py-2 bg-gray-50 border-b border-gray-100 text-xs font-semibold text-gray-600 uppercase tracking-wide">
                From Google Maps
              </div>
              {results
                .filter((r) => r.isFromGoogle)
                .map((result, index) => {
                  const place = result as GooglePlacesResult
                  const resultIndex = results.indexOf(result)
                  return (
                    <button
                      key={`google-${place.placeId}`}
                      onClick={() => handleSelectResult(result)}
                      className={`w-full px-4 py-3 text-left border-b border-gray-100 transition-colors ${
                        selectedIndex === resultIndex
                          ? 'bg-amber-50'
                          : 'hover:bg-gray-50'
                      }`}
                    >
                      <div className="flex items-start gap-3">
                        <div className="flex-1 min-w-0">
                          <p className="font-medium text-gray-900 truncate">
                            {place.name}
                          </p>
                          <p className="text-sm text-gray-600 truncate">
                            {place.city}
                          </p>
                          <p className="text-xs text-gray-500 truncate">
                            {place.address}
                          </p>
                        </div>
                        <div className="flex-shrink-0 flex items-center gap-2">
                          {place.rating && (
                            <span className="inline-flex items-center px-2 py-1 rounded-full text-xs font-medium bg-blue-100 text-blue-800">
                              {place.rating.toFixed(1)}
                            </span>
                          )}
                          <a
                            href={`https://www.google.com/maps/search/${encodeURIComponent(place.name + ' ' + place.address)}`}
                            target="_blank"
                            rel="noopener noreferrer"
                            onClick={(e) => e.stopPropagation()}
                            className="text-gray-400 hover:text-amber-600 transition-colors"
                          >
                            <ExternalLink size={16} />
                          </a>
                        </div>
                      </div>
                    </button>
                  )
                })}
            </>
          )}
        </div>
      )}

      {/* Empty State */}
      {isOpen && query && !isLoading && results.length === 0 && (
        <div className="absolute top-full left-0 right-0 mt-2 bg-white border border-gray-200 rounded-xl shadow-lg z-50 p-4 text-center">
          <p className="text-gray-500 text-sm">No restaurants found</p>
        </div>
      )}
    </div>
  )
}
