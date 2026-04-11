import { runActor, getDatasetItems } from './client'
import { createServerSupabaseClient } from '@/lib/supabase/server'

export async function fetchGoogleData(restaurantId: string, name: string, city: string) {
  const run = await runActor('compass/crawler-google-places', {
    searchStringsArray: [`${name} restaurant ${city}`],
    maxCrawledPlacesPerSearch: 1,
    language: 'en',
    maxReviews: 0,
  })

  const items = await getDatasetItems(run.defaultDatasetId)
  if (!items.length) return null

  const place = items[0] as any
  const supabase = await createServerSupabaseClient()

  await supabase.from('restaurants').update({
    google_place_id: place.placeId,
    google_rating: place.totalScore,
    google_review_count: place.reviewsCount,
    google_url: place.url,
    google_photo_url: place.imageUrl,
    latitude: place.location?.lat,
    longitude: place.location?.lng,
    address: place.address || undefined,
    phone: place.phone || undefined,
    website: place.website || undefined,
    photo_url: place.imageUrl,
    last_fetched_at: new Date().toISOString(),
  }).eq('id', restaurantId)

  return place
}
