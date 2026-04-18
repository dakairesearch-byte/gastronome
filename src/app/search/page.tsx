'use client'

import { useState, useEffect, useCallback, useRef, Suspense } from 'react'
import { useSearchParams } from 'next/navigation'
import { createClient } from '@/lib/supabase/client'
import SearchBar from '@/components/SearchBar'
import RestaurantCard from '@/components/RestaurantCard'
import FilterChips from '@/components/FilterChips'
import EmptyState from '@/components/EmptyState'
import { RestaurantCardSkeleton } from '@/components/LoadingSkeleton'
import { Search, UtensilsCrossed, MapPin, Utensils } from 'lucide-react'
import { Restaurant } from '@/types/database'
import Link from 'next/link'

interface GooglePlaceResult {
  placeId: string
  name: string
  address: string
  city: string
  rating?: number
}

interface DishHit {
  dish_name: string
  mention_count: number
  restaurant: Restaurant
}

function SearchContent() {
  const searchParams = useSearchParams()
  const query = searchParams.get('q') || searchParams.get('cuisine') || ''
  const [searchQuery, setSearchQuery] = useState(query)
  const [selectedCuisines, setSelectedCuisines] = useState<string[]>(
    searchParams.get('cuisine') ? [searchParams.get('cuisine')!] : []
  )
  const [restaurants, setRestaurants] = useState<Restaurant[]>([])
  const [googlePlaces, setGooglePlaces] = useState<GooglePlaceResult[]>([])
  const [dishes, setDishes] = useState<DishHit[]>([])
  const [availableCuisines, setAvailableCuisines] = useState<string[]>([])
  const [loading, setLoading] = useState(true)
  const supabase = createClient()

  const autocompleteServiceRef = useRef<any>(null)
  const [googleApiReady, setGoogleApiReady] = useState(false)
  const apiKey = process.env.NEXT_PUBLIC_GOOGLE_PLACES_API_KEY

  // Load Google Places API
  useEffect(() => {
    if (!apiKey) return

    // Check if already loaded
    if (window.google?.maps?.places) {
      autocompleteServiceRef.current = new window.google.maps.places.AutocompleteService()
      setGoogleApiReady(true)
      return
    }

    const script = document.createElement('script')
    script.src = `https://maps.googleapis.com/maps/api/js?key=${apiKey}&libraries=places`
    script.async = true
    script.defer = true

    script.onload = () => {
      if (window.google?.maps?.places) {
        autocompleteServiceRef.current = new window.google.maps.places.AutocompleteService()
        setGoogleApiReady(true)
      }
    }

    document.head.appendChild(script)

    return () => {
      if (script.parentNode) {
        script.parentNode.removeChild(script)
      }
    }
  }, [apiKey])

  // Search Google Places
  const searchGooglePlaces = useCallback(
    async (searchQuery: string): Promise<GooglePlaceResult[]> => {
      if (!searchQuery.trim() || !autocompleteServiceRef.current) return []

      try {
        const predictions = await new Promise<any[]>((resolve) => {
          autocompleteServiceRef.current.getPlacePredictions(
            {
              input: searchQuery,
              types: ['establishment'],
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

        const results = await Promise.all(
          predictions
            .filter((p) => {
              const types = p.types || []
              return (
                types.includes('restaurant') ||
                types.includes('food') ||
                types.includes('cafe') ||
                types.includes('bakery') ||
                types.includes('bar') ||
                types.includes('meal_delivery') ||
                types.includes('meal_takeaway')
              )
            })
            .slice(0, 8)
            .map(
              (prediction) =>
                new Promise<GooglePlaceResult | null>((resolve) => {
                  const map = document.createElement('div')
                  const placesService = new window.google!.maps!.places!.PlacesService(map)

                  placesService.getDetails(
                    {
                      placeId: prediction.place_id,
                      fields: ['name', 'formatted_address', 'geometry', 'rating', 'place_id'],
                    },
                    (place: any, status: string) => {
                      if (status === 'OK' && place) {
                        const address = place.formatted_address || ''
                        const addressParts = address.split(',')
                        const city =
                          addressParts.length > 1 ? addressParts[addressParts.length - 2].trim() : ''

                        resolve({
                          placeId: prediction.place_id,
                          name: place.name,
                          address,
                          city,
                          rating: place.rating,
                        })
                      } else {
                        resolve(null)
                    }
                    }
                  )
                })
            )
        )

        return results.filter((r): r is GooglePlaceResult => r !== null)
      } catch {
        return []
      }
    },
    []
  )

  useEffect(() => {
    const fetchAllCuisines = async () => {
      const { data } = await supabase.from('restaurants').select('cuisine')
      if (data) {
        const cuisines = [...new Set(data.map((r) => r.cuisine))].sort()
        setAvailableCuisines(cuisines)
      }
    }
    fetchAllCuisines()
  }, [supabase])

  useEffect(() => {
    const performSearch = async () => {
      setLoading(true)
      try {
        let restaurantQuery = supabase.from('restaurants').select('*')

        if (searchQuery.trim()) {
          const sanitized = searchQuery.replace(/[%_\\]/g, '')
          restaurantQuery = restaurantQuery.or(
            `name.ilike.%${sanitized}%,cuisine.ilike.%${sanitized}%,city.ilike.%${sanitized}%`
          )
        }

        if (selectedCuisines.length > 0) {
          restaurantQuery = restaurantQuery.in('cuisine', selectedCuisines)
        }

        const { data: restaurantData } = await restaurantQuery
          .order('name', { ascending: true })
          .limit(20)

        // Search returns results in text-match + alphabetical order. No
        // ranking here â discovery lives on /explore, which uses the
        // project's single trending function.
        const orderedRestaurants: Restaurant[] = restaurantData || []
        setRestaurants(orderedRestaurants)

        // Search Google Places in parallel
        let googleResults: GooglePlaceResult[] = []
        if (searchQuery.trim() && googleApiReady) {
          googleResults = await searchGooglePlaces(searchQuery)
          // Filter out Google results that already exist locally (by name match)
          const localNames = new Set(orderedRestaurants.map((r) => r.name.toLowerCase()))
          googleResults = googleResults.filter(
            (g) => !localNames.has(g.name.toLowerCase())
          )
        }
        setGooglePlaces(googleResults)

        // Dish search: match highlighted dishes by name across all
        // restaurants, ranked by mention_count so the most talked-about
        // plates surface first. We include the joined restaurant so the
        // result cards can link straight to the place.
        let dishResults: DishHit[] = []
        if (searchQuery.trim()) {
          const sanitized = searchQuery.replace(/[%_\\]/g, '')
          const { data: dishRows, error: dishErr } = await supabase
            .from('restaurant_highlighted_dishes')
            .select('dish_name, mention_count, restaurant:restaurants(*)')
            .ilike('dish_name', `%${sanitized}%`)
            .order('mention_count', { ascending: false })
            .limit(20)

          if (!dishErr && dishRows) {
            dishResults = (dishRows as unknown as Array<{
              dish_name: string
              mention_count: number | null
              restaurant: Restaurant | null
            }>)
              .filter((d): d is { dish_name: string; mention_count: number | null; restaurant: Restaurant } => !!d.restaurant)
              .map((d) => ({
                dish_name: d.dish_name,
                mention_count: d.mention_count ?? 0,
                restaurant: d.restaurant,
              }))

            // Respect the cuisine filter on dishes too.
            if (selectedCuisines.length > 0) {
              dishResults = dishResults.filter((d) =>
                selectedCuisines.includes(d.restaurant.cuisine)
              )
            }
          }
        }
        setDishes(dishResults)
      } finally {
        setLoading(false)
      }
    }

    const timer = setTimeout(performSearch, 300)
    return () => clearTimeout(timer)
  }, [searchQuery, selectedCuisines, supabase, googleApiReady, searchGooglePlaces])

  const handleCuisineChange = (cuisine: string) => {
    setSelectedCuisines((prev) =>
      prev.includes(cuisine)
        ? prev.filter((c) => c !== cuisine)
        : [...prev, cuisine]
    )
  }

  const handleClearFilters = () => {
    setSelectedCuisines([])
  }

  const totalRestaurants = restaurants.length + googlePlaces.length
  const hasAnyResults = totalRestaurants > 0 || dishes.length > 0

  return (
    <div className="min-h-screen bg-gray-50">
      <div className="max-w-2xl mx-auto px-4 sm:px-6 py-6 sm:py-10 space-y-6">
        {/* Header */}
        <div>
          <h1 className="text-2xl font-bold text-gray-900">Search</h1>
          <p className="text-sm text-gray-500 mt-1">Find restaurants by name, cuisine, or city</p>
        </div>

        {/* Search Bar */}
        <SearchBar
          placeholder="Search restaurants, cuisines, or cities..."
          initialValue={searchQuery}
          onSearch={setSearchQuery}
        />

        {/* Cuisine Filters */}
        {availableCuisines.length > 0 && (
          <FilterChips
            cuisines={availableCuisines}
            selectedCuisines={selectedCuisines}
            onCuisineChange={handleCuisineChange}
            onClearAll={handleClearFilters}
          />
        )}

        {/* Loading */}
        {loading && (
          <div className="space-y-4">
            {[1, 2, 3].map((i) => (
              <RestaurantCardSkeleton key={i} />
            ))}
          </div>
        )}

        {/* No Results */}
        {!loading && !hasAnyResults && (
          <EmptyState
            icon={Search}
            title={searchQuery || selectedCuisines.length > 0 ? 'No results found' : 'Start searching'}
            description={
              searchQuery || selectedCuisines.length > 0
                ? 'Try adjusting your filters or search terms'
                : 'Enter a restaurant, cuisine, city, or dish (try "ramen" or "pizza") to get started'
            }
            ctaText="Discover"
            ctaHref="/explore"
          />
        )}

        {/* Results */}
        {!loading && hasAnyResults && (
          <div className="space-y-3">
            {/* Dishes that match the query â shown first since it's often
                why someone typed a food word in. Each card links to the
                restaurant that serves it. */}
            {dishes.length > 0 && (
              <>
                <div className="flex items-center gap-2 pt-1">
                  <div className="h-px bg-gray-200 flex-1" />
                  <span className="text-xs text-gray-500 font-medium flex items-center gap-1">
                    <Utensils size={12} /> Dishes matching &ldquo;{searchQuery}&rdquo;
                  </span>
                  <div className="h-px bg-gray-200 flex-1" />
                </div>
                {dishes.map((d, i) => (
                  <Link
                    key={`${d.restaurant.id}-${d.dish_name}-${i}`}
                    href={`/restaurants/${d.restaurant.id}`}
                    className="block bg-white rounded-lg border border-gray-100 p-4 hover:shadow-md transition-shadow"
                  >
                    <div className="flex items-center gap-3">
                      <div className="w-10 h-10 rounded-full bg-amber-50 flex items-center justify-center flex-shrink-0">
                        <Utensils size={18} className="text-amber-600" />
                      </div>
                      <div className="flex-1 min-w-0">
                        <p className="text-sm font-semibold text-gray-900 truncate">
                          {d.dish_name}
                        </p>
                        <p className="text-xs text-gray-500 truncate">
                          at {d.restaurant.name}
                          {d.restaurant.city ? ` Â· ${d.restaurant.city}` : ''}
                        </p>
                      </div>
                      <span className="text-xs font-medium text-amber-700 bg-amber-50 px-2 py-0.5 rounded-full flex-shrink-0">
                        {d.mention_count} {d.mention_count === 1 ? 'mention' : 'mentions'}
                      </span>
                    </div>
                  </Link>
                ))}
                {restaurants.length > 0 && (
                  <div className="flex items-center gap-2 pt-2">
                    <div className="h-px bg-gray-200 flex-1" />
                    <span className="text-xs text-gray-400 font-medium">
                      Restaurants
                    </span>
                    <div className="h-px bg-gray-200 flex-1" />
                  </div>
                )}
              </>
            )}

            {/* Local results */}
            {restaurants.map((restaurant) => (
              <RestaurantCard key={restaurant.id} restaurant={restaurant} />
            ))}

            {/* Google Places results */}
            {googlePlaces.length > 0 && (
              <>
                {restaurants.length > 0 && (
                  <div className="flex items-center gap-2 pt-2">
                    <div className="h-px bg-gray-200 flex-1" />
                    <span className="text-xs text-gray-400 font-medium flex items-center gap-1">
                      <MapPin size={12} /> From Google
                    </span>
                    <div className="h-px bg-gray-200 flex-1" />
                  </div>
                )}
                {googlePlaces.map((place) => (
                  <Link
                    key={place.placeId}
                    href={`/review/new?name=${encodeURIComponent(place.name)}&city=${encodeURIComponent(place.city)}&address=${encodeURIComponent(place.address)}`}
                    className="block bg-white rounded-lg border border-gray-100 p-4 hover:shadow-md transition-shadow"
                  >
                    <div className="flex items-center gap-3">
                      <div className="w-10 h-10 rounded-full bg-blue-50 flex items-center justify-center flex-shrink-0">
                        <MapPin size={18} className="text-blue-500" />
                      </div>
                      <div className="flex-1 min-w-0">
                        <p className="text-sm font-semibold text-gray-900 truncate">{place.name}</p>
                        <p className="text-xs text-gray-500 truncate">{place.city}</p>
                      </div>
                      <div className="flex items-center gap-2 flex-shrink-0">
                        {place.rating && (
                          <span className="text-xs font-medium text-blue-600 bg-blue-50 px-2 py-0.5 rounded-full">
                            {place.rating.toFixed(1)}
                          </span>
                        )}
                      </div>
                    </div>
                  </Link>
                ))}
              </>
            )}
          </div>
        )}
      </div>
    </div>
  )
}

export default function SearchPage() {
  return (
    <Suspense fallback={<div className="min-h-screen" />}>
      <SearchContent />
    </Suspense>
  )
}
