import { runActor, getDatasetItems } from './client'
import { createServerSupabaseClient } from '@/lib/supabase/server'

export async function fetchMichelinData(restaurantId: string, name: string, city: string) {
  const run = await runActor('apify/cheerio-scraper', {
    startUrls: [{ url: `https://guide.michelin.com/us/en/search?q=${encodeURIComponent(name + ' ' + city)}` }],
    pageFunction: `async function pageFunction(context) {
      const { $, request } = context;
      const card = $('[data-restaurant-name], .card__menu-content').first();
      if (!card.length) return [{ found: false }];

      const stars = card.find('.michelin-stars, [class*="star"]').length
        || card.find('img[alt*="star"]').length;
      const isBib = card.find('[alt*="Bib"], [class*="bib"]').length > 0;
      const isRecommended = card.find('[alt*="Selected"], [class*="selected"]').length > 0;
      const link = card.closest('a').attr('href');

      let designation = null;
      if (stars >= 3) designation = 'three_star';
      else if (stars === 2) designation = 'two_star';
      else if (stars === 1) designation = 'one_star';
      else if (isBib) designation = 'bib_gourmand';
      else if (isRecommended) designation = 'recommended';

      return [{
        found: true,
        stars,
        designation,
        url: link ? 'https://guide.michelin.com' + link : null,
      }];
    }`,
    maxPagesPerCrawl: 1,
  })

  const items = await getDatasetItems(run.defaultDatasetId)
  if (!items.length || !(items[0] as any).found) return null

  const result = items[0] as any
  const supabase = await createServerSupabaseClient()

  const accolades: any[] = []
  if (result.designation) {
    const labels: Record<string, string> = {
      three_star: '3 Michelin Stars',
      two_star: '2 Michelin Stars',
      one_star: '1 Michelin Star',
      bib_gourmand: 'Bib Gourmand',
      recommended: 'Michelin Recommended',
    }
    accolades.push({
      type: 'michelin',
      label: labels[result.designation] || 'Michelin',
      url: result.url,
      icon: result.stars > 0 ? '⭐' : '🍽️',
    })
  }

  await supabase.from('restaurants').update({
    michelin_stars: result.stars || 0,
    michelin_designation: result.designation,
    michelin_url: result.url,
    accolades: accolades,
    last_fetched_at: new Date().toISOString(),
  }).eq('id', restaurantId)

  return result
}
