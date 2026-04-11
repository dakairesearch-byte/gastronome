import apifyClient from './client';
import { createServerSupabaseClient } from '@/lib/supabase/server';

export async function fetchYelpData(
  restaurantId: string,
  name: string,
  city: string
) {
  const searchQuery = `${name} ${city}`;

  const run = await apifyClient.actor('tri_angle/yelp-scraper').call({
    searchTerms: [searchQuery],
    maxResults: 1,
    reviewLimit: 0,
  });

  const { items } = await apifyClient.dataset(run.defaultDatasetId).listItems();

  if (!items || items.length === 0) {
    return { success: false, error: 'No Yelp results found' };
  }

  const business = items[0] as Record<string, unknown>;

  const supabase = await createServerSupabaseClient();

  const updateData: Record<string, unknown> = {
    yelp_id: business.businessId ?? business.alias ?? null,
    yelp_rating: typeof business.rating === 'number' ? business.rating : null,
    yelp_review_count: typeof business.reviewCount === 'number' ? business.reviewCount : null,
    yelp_url: business.businessUrl ?? business.url ?? null,
    yelp_photo_url: business.imageUrl ?? business.photoUrl ?? null,
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
