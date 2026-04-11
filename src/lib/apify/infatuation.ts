import apifyClient from './client';
import { createServerSupabaseClient } from '@/lib/supabase/server';

export async function fetchInfatuationData(
  restaurantId: string,
  name: string,
  city: string
) {
  const searchQuery = encodeURIComponent(`${name} ${city}`);
  const startUrl = `https://www.theinfatuation.com/search?query=${searchQuery}`;

  const run = await apifyClient.actor('apify/cheerio-scraper').call({
    startUrls: [{ url: startUrl }],
    maxRequestsPerCrawl: 3,
    pseudoUrls: [
      {
        purl: 'https://www.theinfatuation.com/[.*]/reviews/[.*]',
        method: 'GET',
      },
    ],
    // pageFunction runs inside the Apify actor, not locally
    pageFunction: async function pageFunction(context: {
      $: any;
      request: { url: string };
    }) {
      const { $, request } = context;

      if (request.url.includes('/reviews/')) {
        const ratingText = $(
          '[data-testid="rating"], .rating-value, .score'
        )
          .first()
          .text()
          .trim();
        const rating = parseFloat(ratingText);

        const snippet = $('meta[name="description"]').attr('content')
          || $('[data-testid="review-snippet"], .review-excerpt, .review-body p')
              .first()
              .text()
              .trim()
              .slice(0, 500);

        return {
          url: request.url,
          rating: isNaN(rating) ? null : rating,
          snippet: snippet || null,
          isReviewPage: true,
        };
      }

      return null;
    },
  });

  const { items } = await apifyClient.dataset(run.defaultDatasetId).listItems();

  const reviewPage = items.find(
    (item) => (item as Record<string, unknown>).isReviewPage
  ) as Record<string, unknown> | undefined;

  if (!reviewPage) {
    return { success: false, error: 'No Infatuation review found' };
  }

  const supabase = await createServerSupabaseClient();

  const updateData: Record<string, unknown> = {
    infatuation_rating:
      typeof reviewPage.rating === 'number' ? reviewPage.rating : null,
    infatuation_url:
      typeof reviewPage.url === 'string' ? reviewPage.url : null,
    infatuation_review_snippet:
      typeof reviewPage.snippet === 'string' ? reviewPage.snippet : null,
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
