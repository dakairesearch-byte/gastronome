import apifyClient from './client';
import { createServerSupabaseClient } from '@/lib/supabase/server';

export async function fetchMichelinData(
  restaurantId: string,
  name: string,
  city: string
) {
  const searchQuery = encodeURIComponent(`${name} ${city}`);
  const startUrl = `https://guide.michelin.com/en/search?q=${searchQuery}`;

  const run = await apifyClient.actor('apify/cheerio-scraper').call({
    startUrls: [{ url: startUrl }],
    maxRequestsPerCrawl: 3,
    pseudoUrls: [
      {
        purl: 'https://guide.michelin.com/[.*]/restaurant/[.*]',
        method: 'GET',
      },
    ],
    // pageFunction runs inside the Apify actor, not locally
    pageFunction: async function pageFunction(context: {
      $: any;
      request: { url: string };
    }) {
      const { $, request } = context;

      if (request.url.includes('/restaurant/')) {
        let stars: number | null = null;
        let designation: string | null = null;
        const accolades: string[] = [];

        const distinctions = $(
          '.restaurant-details__classification, .distinction-title, [data-testid="distinction"]'
        );
        distinctions.each((_: number, el: any) => {
          const text = $(el).text().trim();
          accolades.push(text);

          if (/three stars/i.test(text) || /3 stars/i.test(text)) {
            stars = 3;
            designation = 'Three MICHELIN Stars';
          } else if (/two stars/i.test(text) || /2 stars/i.test(text)) {
            stars = 2;
            designation = 'Two MICHELIN Stars';
          } else if (/one star/i.test(text) || /1 star/i.test(text)) {
            stars = 1;
            designation = 'One MICHELIN Star';
          } else if (/bib gourmand/i.test(text)) {
            stars = 0;
            designation = 'Bib Gourmand';
          } else if (/selected/i.test(text) || /recommended/i.test(text)) {
            stars = 0;
            designation = 'MICHELIN Selected';
          }
        });

        const greenStarEl = $(
          '.michelin-green-star, [data-testid="green-star"]'
        );
        if (greenStarEl.length > 0) {
          accolades.push('MICHELIN Green Star');
        }

        return {
          url: request.url,
          stars,
          designation,
          accolades,
          isRestaurantPage: true,
        };
      }

      return null;
    },
  });

  const { items } = await apifyClient.dataset(run.defaultDatasetId).listItems();

  const restaurantPage = items.find(
    (item) => (item as Record<string, unknown>).isRestaurantPage
  ) as Record<string, unknown> | undefined;

  if (!restaurantPage) {
    return { success: false, error: 'No Michelin listing found' };
  }

  const supabase = await createServerSupabaseClient();

  const accoladesArr = Array.isArray(restaurantPage.accolades)
    ? restaurantPage.accolades
    : [];

  const updateData: Record<string, unknown> = {
    michelin_stars:
      typeof restaurantPage.stars === 'number' ? restaurantPage.stars : null,
    michelin_designation:
      typeof restaurantPage.designation === 'string'
        ? restaurantPage.designation
        : null,
    michelin_url:
      typeof restaurantPage.url === 'string' ? restaurantPage.url : null,
    accolades: accoladesArr.length > 0 ? accoladesArr : null,
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
