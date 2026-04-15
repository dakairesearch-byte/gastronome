/**
 * Google Places API (New) client for fetching restaurant data and reviews.
 *
 * Endpoints used:
 * - Text Search: POST https://places.googleapis.com/v1/places:searchText
 * - Place Details: GET https://places.googleapis.com/v1/places/{id}
 */

import { createServerSupabaseClient } from '@/lib/supabase/server'

const GOOGLE_API_KEY = process.env.GOOGLE_PLACES_API_KEY!

const PLACES_BASE = 'https://places.googleapis.com/v1'

// Field masks for different request types
const SEARCH_FIELDS = [
  'places.id',
  'places.displayName',
  'places.formattedAddress',
  'places.rating',
  'places.userRatingCount',
  'places.googleMapsUri',
  'places.websiteUri',
  'places.nationalPhoneNumber',
  'places.location',
  'places.photos',
  'places.priceLevel',
].join(',')

const DETAIL_FIELDS = [
  'id',
  'displayName',
  'formattedAddress',
  'rating',
  'userRatingCount',
  'googleMapsUri',
  'websiteUri',
  'nationalPhoneNumber',
  'location',
  'photos',
  'reviews',
  'priceLevel',
].join(',')

/**
 * Search for restaurants using Google Places Text Search
 */
export async function searchPlaces(query: string, maxResultCount = 10): Promise<GooglePlace[]> {
  const res = await fetch(`${PLACES_BASE}/places:searchText`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'X-Goog-Api-Key': GOOGLE_API_KEY,
      'X-Goog-FieldMask': SEARCH_FIELDS,
    },
    body: JSON.stringify({
      textQuery: query,
      maxResultCount,
    }),
  })

  if (!res.ok) {
    const text = await res.text()
    throw new Error(`Places search failed: ${res.status} ${text}`)
  }

  const data = await res.json()
  return data.places ?? []
}

/**
 * Search for a single restaurant using Google Places Text Search
 */
export async function searchPlace(query: string): Promise<GooglePlace | null> {
  const results = await searchPlaces(query, 1)
  return results[0] ?? null
}

/**
 * Get place details including reviews
 */
export async function getPlaceDetails(placeId: string): Promise<GooglePlaceDetails | null> {
  const res = await fetch(`${PLACES_BASE}/places/${placeId}`, {
    headers: {
      'X-Goog-Api-Key': GOOGLE_API_KEY,
      'X-Goog-FieldMask': DETAIL_FIELDS,
    },
  })

  if (!res.ok) {
    const text = await res.text()
    throw new Error(`Place details failed: ${res.status} ${text}`)
  }

  return res.json()
}

/**
 * Get a photo URL from a photo reference
 */
export function getPhotoUrl(photoName: string, maxWidth = 800): string {
  return `${PLACES_BASE}/${photoName}/media?maxWidthPx=${maxWidth}&key=${GOOGLE_API_KEY}`
}

/**
 * Fetch Google data for a restaurant and update Supabase
 */
export async function fetchGoogleData(restaurantId: string, name: string, city: string) {
  // Step 1: Search for the place
  const query = `${name} restaurant ${city}`
  const place = await searchPlace(query)
  if (!place) return null

  // Step 2: Get full details with reviews
  const details = await getPlaceDetails(place.id)
  if (!details) return null

  // Step 3: Build photo URL
  const photoUrl = details.photos?.[0]?.name
    ? getPhotoUrl(details.photos[0].name)
    : null

  // Step 4: Update Supabase
  const supabase = await createServerSupabaseClient()

  await supabase.from('restaurants').update({
    google_place_id: details.id,
    google_rating: details.rating || null,
    google_review_count: details.userRatingCount || 0,
    google_url: details.googleMapsUri || null,
    google_photo_url: photoUrl,
    latitude: details.location?.latitude || undefined,
    longitude: details.location?.longitude || undefined,
    address: details.formattedAddress || undefined,
    phone: details.nationalPhoneNumber || undefined,
    website: details.websiteUri || undefined,
    photo_url: photoUrl,
    last_fetched_at: new Date().toISOString(),
  }).eq('id', restaurantId)

  return {
    placeId: details.id,
    rating: details.rating,
    reviewCount: details.userRatingCount,
    url: details.googleMapsUri,
    photoUrl,
    reviews: details.reviews || [],
    address: details.formattedAddress,
    phone: details.nationalPhoneNumber,
    website: details.websiteUri,
  }
}

// Types
export interface GooglePlace {
  id: string
  displayName: { text: string; languageCode: string }
  formattedAddress: string
  rating?: number
  userRatingCount?: number
  googleMapsUri?: string
  websiteUri?: string
  nationalPhoneNumber?: string
  location?: { latitude: number; longitude: number }
  photos?: GooglePhoto[]
  priceLevel?: string
}

export interface GooglePlaceDetails extends GooglePlace {
  reviews?: GoogleReview[]
}

export interface GooglePhoto {
  name: string
  widthPx: number
  heightPx: number
  authorAttributions: { displayName: string; uri: string }[]
}

export interface GoogleReview {
  name: string
  relativePublishTimeDescription: string
  rating: number
  text?: { text: string; languageCode: string }
  originalText?: { text: string; languageCode: string }
  authorAttribution: {
    displayName: string
    uri: string
    photoUri: string
  }
  publishTime: string
}
