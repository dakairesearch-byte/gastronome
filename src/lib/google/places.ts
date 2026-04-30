/**
 * Google Places API (New) — Text Search only.
 *
 * Used by the restaurant search route to surface external results when a
 * signed-in user types a query that the local catalog can't satisfy.
 * Endpoint: POST https://places.googleapis.com/v1/places:searchText
 */

const GOOGLE_API_KEY = process.env.GOOGLE_PLACES_API_KEY!
const PLACES_BASE = 'https://places.googleapis.com/v1'

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
  photos?: { name: string; widthPx: number; heightPx: number }[]
  priceLevel?: string
}
