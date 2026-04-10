'use client'

import { useEffect, useRef, useState, useCallback } from 'react'
import { useRouter } from 'next/navigation'
import {
  Search,
  MapPin,
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
  lat?: number
  lng?: number
  isLocal: boolean
  isGooglePlace: boolean
}

interface RestaurantSearchDropdownProps {
  onSelectLocal?: (restaurant: Restaurant) => void
  onSelectGoogle?: (place: GooglePlacesResult & SearchResult) => void
  placeholder?: string
  className?: string
  size?: 'sm' | 'md' | 'lg'
  navigateOnEnter?: boolean
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
  navigateOnEnter = true,
}: RestaurantSearchDropdownProps) {
  const router = useRouter()
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

  const sizeClasses = {
    sm: 'px-2 py-1 text-sm',
    md: 'px-4 py-3 text-base',
    lg: 'px-4 py-4 text-lg',
  }

  // Load Google Places API
  useEffect(() => {
    if (!apiKey) return

    if (window.google?.maps?.places?.AutocompleteService) {
      setGoogleApiAvailable(true)
      autocompleteServiceRef.current = new window.google.maps.places.AutocompleteService()
      return
    }

    const script = document.createElement('script')
    script.src = `https://maps.googleapis.com/maps/api/js?key=${apiKey}&libraries=places`
    script.async = true
    script.onload = () => {
      setGoogleApiAvailable(true)
      if (window.google?.maps?.places?.AutocompleteService) {
        autocompleteServiceRef.current = new window.google.maps.places.AutocompleteService()
      }
    }
    document.head.appendChild(script)

    return () => {
      if (script.parentNode) script.parentNode.removeChild(script)
    }
  }, [apiKey])

  const searchLocalRestaurants = useCallback(
    async (searchQuery: string): Promise<SearchResult[]> => {
      if (!searchQuery.trim()) return []
      try {
        const { data: localResults } = await supabase
          .from('restaurants')
          .select('id, name, cuisine, city, address, avg_rating')
          .ilike('name', `%${searchQuery}%`)
          .limit(5)

        return (localResults || []).map((r) => ({
          id: r.id,
          name: r.name,
          cuisine: r.cuisine,
          city: r.city,
          address: r.address ?? undefined,
          avg_rating: r.avg_rating ?? undefined,
          isLocal: true,
          isGooglePlace: false,
        }))
      } catch (error) {
        console.error('Error searching local restaurants:', error)
        return []
      }
    },
    [supabase]
  )

  const searchGooglePlaces = useCallback(
    async (searchQuery: string): Promise<SearchResult[]> => {
      if (!searchQuery.trim() || !autocompleteServiceRef.current) return []
      try {
        const predictions = await new Promise<any[]>((resolve) => {
          autocompleteServiceRef.current.getPlacePredictions(
            { input: searchQuery, types: ['establishment'] },
            (preds: any[] | null, status: string) => {
              if (status === 'OK' && preds) resolve(preds)
              else resolve([])
            }
          )
        })

        return predictions.slice(0, 5).map((prediction) => {
          const parts = prediction.description.split(',')
          const city = parts.length > 1 ? parts[1].trim() : ''
          return {
            placeId: prediction.place_id,
            name: prediction.structured_formatting?.main_text || prediction.description.split(',')[0],
            city,
            address: prediction.description,
            isLocal: false,
            isGooglePlace: true,
          }
        })
      } catch (error) {
        console.error('Google Places search error:', error)
        return []
      }
    },
    []
  )

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

        const localNames = new Set(localResults.map((r) => r.name.toLowerCase()))
        const filteredGoogle = googleResults.filter(
          (g) => !localNames.has(g.name.toLowerCase())
        )

        const combined = [...localResults, ...filteredGoogle]
        setResults(combined)
        setIsOpen(combined.length > 0)
      } catch (error) {
        console.error('Search error:', error)
      } finally {
        setIsLoading(false)
      }
    },
    [searchLocalRestaurants, searchGooglePlaces, googleApiAvailable]
  )

  const handleInputChange = useCallback(
    (e: React.ChangeEvent<HTMLInputElement>) => {
      const value = e.target.value
      setQuery(value)
      setSelectedIndex(-1)

      if (debounceTimerRef.current) clearTimeout(debounceTimerRef.current)

      if (value.trim()) {
        setIsLoading(true)
        debounceTimerRef.current = setTimeout(() => {
          performSearch(value)
        }, 300)
      } else {
        setResults([])
        setIsOpen(false)
        setIsLoading(false)
      }
    },
    [performSearch]
  )

  const handleSelectLocal = useCallback(
    (restaurant: SearchResult) => {
      if (onSelectLocal) {
        onSelectLocal({
          id: restaurant.id!,
          name: restaurant.name,
          cuisine: restaurant.cuisine || '',
          city: restaurant.city,
          address: restaurant.address || '',
          avg_rating: restaurant.avg_rating || 0,
          review_count: 0,
          price_range: 1,
          website: null,
          phone: null,
          created_at: new Date().toISOString(),
          updated_at: new Date().toISOString(),
        } as Restaurant)
      }
      setQuery('')
      setResults([])
      setIsOpen(false)
    },
    [onSelectLocal]
  )

  const handleSelectGoogle = useCallback(
    (result: SearchResult) => {
      if (onSelectGoogle) {
        onSelectGoogle(result as GooglePlacesResult & SearchResult)
      }
      setQuery('')
      setResults([])
      setIsOpen(false)
    },
    [onSelectGoogle]
  )

  const handleKeyDown = useCallback(
    (e: React.KeyboardEvent<HTMLInputElement>) => {
      if (e.key === 'Enter') {
        e.preventDefault()
        if (isOpen && selectedIndex >= 0 && results[selectedIndex]) {
          const selected = results[selectedIndex]
          if (selected.isGooglePlace) handleSelectGoogle(selected)
          else handleSelectLocal(selected)
        } else if (navigateOnEnter && query.trim()) {
          router.push(`/search?q=${encodeURIComponent(query.trim())}`)
          setQuery('')
          setResults([])
          setIsOpen(false)
        }
        return
      }

      if (!isOpen || results.length === 0) return

      switch (e.key) {
        case 'ArrowDown':
          e.preventDefault()
          setSelectedIndex((prev) => (prev < results.length - 1 ? prev + 1 : 0))
          break
        case 'ArrowUp':
          e.preventDefault()
          setSelectedIndex((prev) => (prev > 0 ? prev - 1 : results.length - 1))
          break
        case 'Escape':
          setIsOpen(false)
          break
      }
    },
    [isOpen, results, selectedIndex, handleSelectLocal, handleSelectGoogle, navigateOnEnter, query, router]
  )

  useEffect(() => {
    return () => {
      if (debounceTimerRef.current) clearTimeout(debounceTimerRef.current)
    }
  }, [])

  useEffect(() => {
    function handleClickOutside(event: MouseEvent) {
      if (containerRef.current && !containerRef.current.contains(event.target as Node)) {
        setIsOpen(false)
      }
    }
    document.addEventListener('mousedown', handleClickOutside)
    return () => document.removeEventListener('mousedown', handleClickOutside)
  }, [])

  return (
    <div ref={containerRef} className={`relative w-full ${className}`}>
      <div className="relative">
        <Search className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400" size={18} />
        <input
          ref={inputRef}
          type="text"
          placeholder={placeholder}
          value={query}
          onChange={handleInputChange}
          onKeyDown={handleKeyDown}
          onFocus={() => query && results.length > 0 && setIsOpen(true)}
          className={`w-full ${sizeClasses[size]} pl-10 pr-3 bg-white border border-gray-300 rounded-xl focus:outline-none focus:border-emerald-500 transition-colors`}
        />
        {query && (
          <button
            onClick={() => {
              setQuery('')
              setResults([])
              setIsOpen(false)
              inputRef.current?.focus()
            }}
            className="absolute right-3 top-1/2 -translate-y-1/2 text-gray-400 hover:text-gray-600"
          >
            <X size={18} />
          </button>
        )}
      </div>

      {isOpen && (results.length > 0 || isLoading) && (
        <div className="absolute top-full left-0 right-0 mt-1 bg-white border border-gray-200 rounded-xl shadow-lg z-50 max-h-96 overflow-y-auto">
          {isLoading ? (
            <div className="flex items-center justify-center py-6">
              <Loader2 className="animate-spin text-emerald-500" size={20} />
            </div>
          ) : (
            <>
              {/* Local results */}
              {results.some((r) => r.isLocal) && (
                <>
                  <div className="px-3 py-1.5 text-[10px] font-semibold text-gray-400 uppercase tracking-wider">
                    On Gastronome
                  </div>
                  <ul>
                    {results.filter((r) => r.isLocal).map((result) => {
                      const index = results.indexOf(result)
                      return (
                        <li
                          key={`local-${result.id}`}
                          onClick={() => handleSelectLocal(result)}
                          className={`px-4 py-2.5 cursor-pointer transition-colors ${
                            index === selectedIndex ? 'bg-emerald-50' : 'hover:bg-gray-50'
                          }`}
                        >
                          <div className="flex items-start justify-between gap-2">
                            <div className="flex-1 min-w-0">
                              <div className="flex items-center gap-2">
                                <p className="font-medium text-gray-900 truncate text-sm">{result.name}</p>
                                {result.avg_rating != null && result.avg_rating > 0 && (
                                  <span className="flex items-center gap-0.5 text-xs">
                                    <Star size={11} className="fill-amber-400 text-amber-400" />
                                    {result.avg_rating.toFixed(1)}
                                  </span>
                                )}
                              </div>
                              <div className="flex items-center gap-1 text-xs text-gray-500">
                                {result.cuisine && (
                                  <>
                                    <span>{result.cuisine}</span>
                                    <span>&middot;</span>
                                  </>
                                )}
                                <MapPin size={11} className="flex-shrink-0" />
                                <span className="truncate">{result.city}</span>
                              </div>
                            </div>
                            {index === selectedIndex && (
                              <Check size={16} className="text-emerald-500 flex-shrink-0 mt-0.5" />
                            )}
                          </div>
                        </li>
                      )
                    })}
                  </ul>
                </>
              )}

              {/* Google results */}
              {results.some((r) => r.isGooglePlace) && (
                <>
                  <div className="px-3 py-1.5 text-[10px] font-semibold text-gray-400 uppercase tracking-wider border-t border-gray-100">
                    From Google
                  </div>
                  <ul>
                    {results.filter((r) => r.isGooglePlace).map((result) => {
                      const index = results.indexOf(result)
                      return (
                        <li
                          key={`google-${result.placeId}`}
                          onClick={() => handleSelectGoogle(result)}
                          className={`px-4 py-2.5 cursor-pointer transition-colors ${
                            index === selectedIndex ? 'bg-emerald-50' : 'hover:bg-gray-50'
                          }`}
                        >
                          <div className="flex items-start justify-between gap-2">
                            <div className="flex-1 min-w-0">
                              <div className="flex items-center gap-2">
                                <p className="font-medium text-gray-900 truncate text-sm">{result.name}</p>
                                <span className="inline-block px-1.5 py-0.5 bg-blue-50 text-blue-600 text-[10px] rounded font-medium">
                                  Google
                                </span>
                              </div>
                              <div className="flex items-center gap-1 text-xs text-gray-500">
                                <MapPin size={11} className="flex-shrink-0" />
                                <span className="truncate">{result.address || result.city}</span>
                              </div>
                            </div>
                            {index === selectedIndex && (
                              <Check size={16} className="text-emerald-500 flex-shrink-0 mt-0.5" />
                            )}
                          </div>
                        </li>
                      )
                    })}
                  </ul>
                </>
              )}
            </>
          )}
        </div>
      )}
    </div>
  )
}
