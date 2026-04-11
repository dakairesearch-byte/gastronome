import { runActor, getDatasetItems } from './client'
import { createServerSupabaseClient } from '@/lib/supabase/server'

export async function fetchYelpData(restaurantId: string, name: string, city: string) {
  const run = await runActor('tri_angle/yelp-scraper', {
    searchTerms: [`${name}`],
    locations: [city],
    maxResults: 1,
    reviewLimit: 0,
  })

  const items = await getDatasetItems(run.defaultDatasetId)
  if (!items.length) return null

  const biz = items[0] as any
  const supabase = await createServerSupabaseClient()

  await supabase.from('restaurants').update({
    yelp_id: biz.bizId || biz.id,
    yelp_rating: biz.rating,
    yelp_review_count: biz.reviewCount,
    yelp_url: biz.url,
    yelp_photo_url: biz.imageUrl || biz.photos?.[0],
    last_fetched_at: new Date().toISOString(),
  }).eq('id', restaurantId)

  return biz
}
