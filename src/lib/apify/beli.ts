import apifyClient from './client';
import { createServerSupabaseClient } from '@/lib/supabase/server';

export async function fetchBeliData(
  restaurantId: string,
  name: string,
  city: string
) {
  const slug = name
    .toLowerCase()
    .replace(/[^a-z0-9\s-]/g, '')
    .replace(/\s+/g, '-');
  const citySlug = city
    .toLowerCase()
    .replace(/[^a-z0-9\s-]/g, '')
    .replace(/\s+/g, '-');

  const startUrl = `https://beliapp.com/restaurants/${citySlug}/${slug}`;

  const run = await apifyClient.actor('apify/cheerio-scraper').call({
    startUrls: [{ url: startUrl }],
    maxRequestsPerCrawl: 1,
    // pageFunction runs inside the Apify actor, not locally
    pageFunction: async function pageFunction(context: {
      $: any;
      request: { url: string };
    }) {
      const { $, request } = context;

      const scoreText = $('[data-testid="beli-score"], .beli-score, .score')
        .first()
        .text()
        .trim();
      const score = parseFloat(scoreText);

      return {
        url: request.url,
        score: isNaN(score) ? null : score,
      };
    },
  });

  const { items } = await apifyClient.dataset(run.defaultDatasetId).listItems();

  if (!items || items.length === 0) {
    return { success: false, error: 'No Beli results found' };
  }

  const result = items[0] as Record<string, unknown>;

  const supabase = await createServerSupabaseClient();

  const updateData: Record<string, unknown> = {
    beli_score: typeof result.score === 'number' ? result.score : null,
    beli_url: typeof result.url === 'string' ? result.url : null,
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
