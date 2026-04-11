import apifyClient from './client';
import { createServerSupabaseClient } from '@/lib/supabase/server';

export async function fetchGoogleData(
  restaurantId: string,
  name: string,
  city: string
) {
  const searchQuery = `${name} ${city}`;

  const run = await apifyClient.actor('compass/crawler-google-places').call({
    searchStringsArray: [searchQuery],
    maxCrawledPlacesPerSearch: 1,
    language: 'en',
    maxReviews: 0,
  });

  const { items } = await apifyClient.dataset(run.defaultDatasetId).listItems();

  if (!items || items.length === 0) {
    return { success: false, error: 'No Google Places results found' };
  }

  const place = items[0] as Record<string, unknown>;

  const supabase = await createServerSupabaseClient();

  const updateData: Record<string, unknown> = {
    google_place_id: place.placeId ?? null,
    google_rating: typeof place.totalScore === 'number' ? place.totalScore : null,
    google_review_count: typeof place.reviewsCount === 'number' ? place.reviewsCount : null,
    google_url: place.url ?? null,
    google_photo_url: place.imageUrl ?? null,
    latitude: typeof place.location === 'object' && place.location !== null
      ? (place.location as Record<string, unknown>).lat ?? null
      : null,
    longitude: typeof place.location === 'object' && place.location !== null
      ? (place.location as Record<string, unknown>).lng ?? null
      : null,
    address: place.address ?? null,
    phone: place.phone ?? null,
    website: place.website ?? null,
    photo_url: place.imageUrl ?? null,
    last_fetched_at: new Date().toISOString(),
  };

  const { error } = await supabase
    .from('restaurants')
    .update(updateData)
    .eq('id', restaurantId);

  if (error) {
    return { success: false, error: `Supabase update failed: ${error.message}` };
  }

  return { success: true, data: updateData };
}
