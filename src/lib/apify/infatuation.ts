import { runActor, getDatasetItems } from './client'
import { createServerSupabaseClient } from '@/lib/supabase/server'

export async function fetchInfatuationData(restaurantId: string, name: string, city: string) {
  const citySlug = city.toLowerCase().replace(/\s+/g, '-')
  const run = await runActor('apify/cheerio-scraper', {
    startUrls: [{ url: `https://www.theinfatuation.com/${citySlug}/search?query=${encodeURIComponent(name)}` }],
    pageFunction: `async function pageFunction(context) {
      const { $, request } = context;
      const card = $('a[href*="/reviews/"]').first();
      const ratingEl = card.find('[class*="rating"], [class*="score"]').first();
      const rating = ratingEl.length ? parseFloat(ratingEl.text().trim()) : null;
      const snippet = card.find('p').first().text().trim().slice(0, 200);
      const url = card.attr('href');
      return [{ rating, snippet, url: url ? 'https://www.theinfatuation.com' + url : null }];
    }`,
    maxPagesPerCrawl: 1,
  })

  const items = await getDatasetItems(run.defaultDatasetId)
  if (!items.length || !(items[0] as any).rating) return null

  const result = items[0] as any
  const supabase = await createServerSupabaseClient()

  await supabase.from('restaurants').update({
    infatuation_rating: result.rating,
    infatuation_url: result.url,
    infatuation_review_snippet: result.snippet,
    last_fetched_at: new Date().toISOString(),
  }).eq('id', restaurantId)

  return result
}
