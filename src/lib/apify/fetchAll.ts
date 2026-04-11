import { fetchGoogleData } from './google';
import { fetchYelpData } from './yelp';
import { fetchBeliData } from './beli';
import { fetchInfatuationData } from './infatuation';
import { fetchMichelinData } from './michelin';
import { fetchTikTokVideos } from './tiktok';
import { fetchInstagramVideos } from './instagram';

export interface FetchResult {
  success: boolean;
  data?: Record<string, unknown>;
  count?: number;
  error?: string;
}

export interface FetchAllResults {
  google: FetchResult;
  yelp: FetchResult;
  beli: FetchResult;
  infatuation: FetchResult;
  michelin: FetchResult;
  tiktok: FetchResult;
  instagram: FetchResult;
}

type SourceKey = keyof FetchAllResults;

export async function fetchAllSourcesForRestaurant(
  restaurantId: string,
  name: string,
  city: string
): Promise<FetchAllResults> {
  const sources: Record<SourceKey, () => Promise<FetchResult>> = {
    google: () => fetchGoogleData(restaurantId, name, city),
    yelp: () => fetchYelpData(restaurantId, name, city),
    beli: () => fetchBeliData(restaurantId, name, city),
    infatuation: () => fetchInfatuationData(restaurantId, name, city),
    michelin: () => fetchMichelinData(restaurantId, name, city),
    tiktok: () => fetchTikTokVideos(restaurantId, name, city),
    instagram: () => fetchInstagramVideos(restaurantId, name, city),
  };

  const keys = Object.keys(sources) as SourceKey[];
  const promises = keys.map((key) => sources[key]());

  const settled = await Promise.allSettled(promises);

  const results = {} as FetchAllResults;

  settled.forEach((outcome, index) => {
    const key = keys[index];
    if (outcome.status === 'fulfilled') {
      results[key] = outcome.value;
    } else {
      results[key] = {
        success: false,
        error:
          outcome.reason instanceof Error
            ? outcome.reason.message
            : String(outcome.reason),
      };
    }
  });

  return results;
}
