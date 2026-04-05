'use client'

import { useEffect, useRef, useState, useCallback } from 'react'
import {
  Search,
  MapPin,
  ExternalLink,
  Star,
  Check,
  Loader2,
  X,
} from 'lucide-react'
import { createClient } from '@/lib/supabase/client'
import { Restaurant } from '@/types/database'

interface GooglePlacesResult {
  placeId: string
  name: string
  address: string
  city: string
  lat?: number
  lng?: number
  rating?: number
  types: string[]
}

interface SearchResult {
  id?: string
  name: string
  cuisine?: string
  city: string
  address?: string
  avg_rating?: number
  placeId?: string
  rating?: number
  isLocal: boolean
  isGooglePlace: boolean
}

interface RestaurantSearchDropdownProps {
  onSelectLocal?: (restaurant: Restaurant) => void
  onSelectGoogle?: (place: GooglePlacesResult & SearchResult) => void
  placeholder?: string
  className?: string
  size?: 'sm' | 'md' | 'lg'
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

export default function RestaurantSearchDropdown({
  onSelectLocal,
  onSelectGoogle,
  placeholder = 'Find a restaurant...',
  className = '',
  size = 'md',
}: RestaurantSearchDropdownProps) {
  const inputRef = useRef<HTMLInputElement>(null)
  const containerRef = useRef<HTMLDivElement>(null)
  const autocompleteServiceRef = useRef<any>(null)
  const debounceTimerRef = useRef<NodeJS.Timeout | null>(null)

  const [query, setQuery] = useState('')
  const [results, setResults] = useState<SearchResult[]>([])
  const [isOpen, setIsOpen] = useState(false)
  const [isLoading, setIsLoading] = useState(false)
  const [selectedIndex, setSelectedIndex] = useState(-1)
  const [googleApiAvailable, setGoogleApiAvailable] = useState(false)

  const supabase = createClient()
  const apiKey = process.env.NEXT_PUBLIC_GOOGLE_PLACES_API_KEY

  // Size classes
  const sizeClasses = {
    sm: 'px-2 py-1 text-sm',
    md: 'px-4 py-3 text-base',
    lg: 'px-4 py-4 text-lg',
  }

  // Load Google Places API
  useEffect(() => {
    if (!apiKey) {
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

    document.head.appendChild(script)

    return () => {
      if (script.parentNode) {
        script.parentNode.removeChild(script)
      }
    }
  }, [apiKey])

  // Search local restaurants
  const searchLocalRestaurants = useCallback(
    async (searchQuery: string): Promise<SearchResult[]> => {
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
            id: restaurant.id,
            name: restaurant.name,
            cuisine: restaurant.cuisine,
            city: restaurant.city,
            address: restaurant.address || undefined,
            avg_rating: restaurant.avg_rating || undefined,
            isLocal: true,
            isGooglePlace: false,
          }))
        : []
    },
    [supabase]
  )

  // Search Google Places
  const searchGooglePlaces = useCallback(
    async (searchQuery: string): Promise<SearchResult[]> => {
      if (!searchQuery.trim() || !autocompleteServiceRef.current) return []

      try {
        const predictions = await new Promise<any[]>((resolve) => {
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

        const filtered = predictions.filter((p) => {
          const description = p.description.toLowerCase()
          return (
            description.includes('restaurant') ||
            description.includes('cafe') ||
            description.includes('pizza') ||
            description.includes('sushi') ||
            description.includes('bar') ||
            description.includes('bistro')
          )
        })

        const results = await Promise.all(
          filtered.slice(0, 5).map((prediction) =>
            new Promise<SearchResult | null>((resolve) => {
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
                  ],
                },
                (place: any) => {
                  if (place) {
                    const address = place.formatted_address || ''
                    const addressParts = address.split(',')
                    const city =
                      addressParts.length > 1
                        ? addressParts[addressParts.length - 2].trim()
                        : ''

                    resolve({
                      placeId: prediction.place_id,
                      name: place.name,
                      address,
                      city,
                      rating: place.rating,
                      lat: place.geometry?.location?.lat(),
                      lng: place.geometry?.location?.lng(),
                      isLocal: false,
                      isGooglePlace: true,
                    })
                  } else {
                    resolve(null)
                  }
                }
              )
            })
          )
        )

        return results.filter((r) => r !== null) as SearchResult[]
      } catch {
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
          googleApiAvailable
            ? searchGooglePlaces(searchQuery)
            : Promise.resolve([]),
        ])

        const combined = [...localResults, ...googleResults]
        setResults(combined)
        setIsOpen(combined.length > 0)
      } catch {
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
    if (result.isLocal && onSelectLocal) {
      onSelectLocal({
        id: result.id!,
        name: result.name,
        cuisine: result.cuisine!,
        city: result.city,
        address: result.address || null,
        phone: null,
        website: null,
        price_range: 1,
        avg_rating: result.avg_rating || null,
        review_count: 0,
        created_at: '',
        updated_at: '',
      })
    } else if (result.isGooglePlace && onSelectGoogle) {
      onSelectGoogle(result as any)
    }

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
        setSelectedIndex((prev) =>
          prev < results.length - 1 ? prev + 1 : prev
        )
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

  // Close on outside click
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
    inputRef.current?.focus()
  }

  return (
    <div ref={containerRef} className={`relative w-full ${className}`}>
      <div className="relative">
        <Search className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400 pointer-events-none flex-shrink-0" size={16} />

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
          className={`w-full pl-9 pr-9 border border-gray-300 rounded-lg focus:ring-2 focus:ring-amber-500 focus:border-transparent outline-none transition bg-white text-gray-900 placeholder-gray-500 ${sizeClasses[size]}`}
          autoComplete="off"
        />

        {isLoading && (
          <div className="absolute right-3 top-1/2 -translate-y-1/2 text-amber-500">
            <Loader2 size={16} className="animate-spin" />
          </div>
        )}

        {!isLoading && query && (
          <button
            onClick={handleClear}
            className="absolute right-3 top-1/2 -translate-y-1/2 text-gray-400 hover:text-gray-600 transition-colors"
          >
            <X size={16} />
          </button>
        )}
      </div>

      {/* Results Dropdown */}
      {isOpen && results.length > 0 && (
        <div className="absolute top-full left-0 right-0 mt-2 bg-white border border-gray-200 rounded-lg shadow-lg z-50 max-h-96 overflow-y-auto">
          {/* Local Results */}
          {results.some((r) => r.isLocal) && (
            <>
              <div className="px-3 py-2 bg-gray-50 border-b border-gray-100 text-xs font-semibold text-gray-600 uppercase">
                <Check className="inline mr-1" size={12} />
                On Gastronome
              </div>
              {results
                .filter((r) => r.isLocal)
                .map((result, idx) => {
                  const resultIdx = results.indexOf(result)
                  return (
                    <button
                      key={`local-${result.id}`}
                      onClick={() => handleSelectResult(result)}
                      className={`w-full px-3 py-2 text-left border-b border-gray-100 transition-colors ${
                        selectedIndex === resultIdx
                          ? 'bg-amber-50'
                          : 'hover:bg-gray-50'
                      }`}
                    >
                      <div className="flex items-center gap-2 justify-between">
                        <div className="flex-1 min-w-0">
                          <p className="font-medium text-gray-900 text-sm truncate">
                            {result.name}
                          </p>
                          <p className="text-xs text-gray-600 truncate">
                            {result.cuisine} â¢ {result.city}
                          </p>
                        </div>
                        {result.avg_rating && (
                          <div className="flex-shrink-0 flex items-center gap-0.5">
                            <Star size={12} className="text-amber-400 fill-amber-400" />
                            <span className="text-xs font-medium text-gray-700">
                              {result.avg_rating.toFixed(1)}
                            </span>
                          </div>
                        )}
                      </div>
                    </button>
                  )
                })}
            </>
          )}

          {/* Google Results */}
          {results.some((r) => r.isGooglePlace) && (
            <>
              <div className="px-3 py-2 bg-gray-50 border-b border-gray-100 text-xs font-semibold text-gray-600 uppercase">
                From Google
              </div>
              {results
                .filter((r) => r.isGooglePlace)
                .map((result) => {
                  const resultIdx = results.indexOf(result)
                  return (
                    <button
                      key={`google-${result.placeId}`}
                      onClick={() => handleSelectResult(result)}
                      className={`w-full px-3 py-2 text-left border-b border-gray-100 transition-colors ${
                        selectedIndex === resultIdx
                          ? 'bg-amber-50'
                          : 'hover:bg-gray-50'
                      }`}
                    >
                      <div className="flex items-center gap-2 justify-between">
                        <div className="flex-1 min-w-0">
                          <p className="font-medium text-gray-900 text-sm truncate">
                            {result.name}
                          </p>
                          <p className="text-xs text-gray-600 truncate">
                            {result.city}
                          </p>
                        </div>
                        <div className="flex-shrink-0 flex items-center gap-1">
                          {result.rating && (
                            <div className="flex items-center gap-0.5">
                              <Star size={12} className="text-blue-400 fill-blue-400" />
                              <span className="text-xs font-medium text-gray-700">
                                {result.rating.toFixed(1)}
                              </span>
                            </div>
                          )}
                          <a
                            href={`https://www.google.com/maps/search/${encodeURIComponent(result.name)}`}
                            target="_blank"
                            rel="noopener noreferrer"
                            onClick={(e) => e.stopPropagation()}
                            className="text-gray-400 hover:text-amber-600"
                          >
                            <ExternalLink size={12} />
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
      {isOpen &&
        query &&
        !isLoading &&
        results.length === 0 && (
          <div className="absolute top-full left-0 right-0 mt-2 bg-white border border-gray-200 rounded-lg shadow-lg z-50 p-3 text-center">
            <p className="text-gray-500 text-xs">No restaurants found</p>
          </div>
        )}
    </div>
  )
}
