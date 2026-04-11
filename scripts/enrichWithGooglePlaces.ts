import { createClient } from '@supabase/supabase-js';

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL!;
const supabaseKey = process.env.SUPABASE_SERVICE_ROLE_KEY!;

if (!supabaseUrl || !supabaseKey) {
  console.error('Missing NEXT_PUBLIC_SUPABASE_URL or SUPABASE_SERVICE_ROLE_KEY');
  process.exit(1);
}

const GOOGLE_API_KEY = process.env.GOOGLE_PLACES_API_KEY!;
if (!GOOGLE_API_KEY) {
  console.error('Missing GOOGLE_PLACES_API_KEY');
  process.exit(1);
}

const supabase = createClient(supabaseUrl, supabaseKey);

const RATE_LIMIT_MS = 100; // 100ms between requests to stay under quota

// City -> state mapping for Google Places search query
const CITY_STATE_MAP: Record<string, string> = {
  'Miami': 'FL',
  'New York': 'NY',
  'Los Angeles': 'CA',
  'Chicago': 'IL',
  'San Francisco': 'CA',
};

interface PlaceResult {
  id: string;
  displayName: { text: string };
  formattedAddress: string;
  location: { latitude: number; longitude: number };
  rating?: number;
  userRatingCount?: number;
  priceLevel?: string;
  types?: string[];
  nationalPhoneNumber?: string;
  websiteUri?: string;
  photos?: Array<{ name: string }>;
  googleMapsUri?: string;
  editorialSummary?: { text: string };
}

const PRICE_MAP: Record<string, number> = {
  PRICE_LEVEL_FREE: 1,
  PRICE_LEVEL_INEXPENSIVE: 1,
  PRICE_LEVEL_MODERATE: 2,
  PRICE_LEVEL_EXPENSIVE: 3,
  PRICE_LEVEL_VERY_EXPENSIVE: 4,
};

function extractCuisine(types: string[]): string | null {
  const cuisineTypes = types.filter(t =>
    t.includes('restaurant') || t.includes('food') || t.includes('cafe') ||
    t.includes('bakery') || t.includes('bar')
  );
  if (cuisineTypes.length === 0) return null;
  // Clean up the type string: "italian_restaurant" -> "Italian"
  const primary = cuisineTypes[0]
    .replace('_restaurant', '')
    .replace('_food', '')
    .replace(/_/g, ' ')
    .replace(/\b\w/g, c => c.toUpperCase());
  return primary;
}

async function searchPlace(name: string, city: string): Promise<PlaceResult | null> {
  const state = CITY_STATE_MAP[city] || '';
  const fieldMask = [
    'places.id', 'places.displayName', 'places.formattedAddress',
    'places.location', 'places.rating', 'places.userRatingCount',
    'places.priceLevel', 'places.types', 'places.nationalPhoneNumber',
    'places.websiteUri', 'places.photos', 'places.googleMapsUri',
    'places.editorialSummary',
  ].join(',');

  const res = await fetch('https://places.googleapis.com/v1/places:searchText', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'X-Goog-Api-Key': GOOGLE_API_KEY,
      'X-Goog-FieldMask': fieldMask,
    },
    body: JSON.stringify({
      textQuery: `${name} restaurant ${city}, ${state}`,
      maxResultCount: 1,
    }),
  });

  if (!res.ok) {
    const body = await res.text();
    console.error(`Google API error for "${name}": ${res.status} ${res.statusText} - ${body}`);
    return null;
  }

  const data = await res.json();
  return data.places?.[0] || null;
}

function getPhotoUrl(photoName: string, maxWidth = 800): string {
  return `https://places.googleapis.com/v1/${photoName}/media?maxWidthPx=${maxWidth}&key=${GOOGLE_API_KEY}`;
}

async function enrich() {
  // Get all restaurants without google_place_id
  const { data: restaurants, error } = await supabase
    .from('restaurants')
    .select('id, name, city')
    .is('google_place_id', null)
    .order('city')
    .limit(1000);

  if (error || !restaurants) {
    console.error('Failed to fetch restaurants:', error?.message);
    return;
  }

  console.log(`Found ${restaurants.length} restaurants to enrich`);

  let enriched = 0;
  let failed = 0;

  for (const restaurant of restaurants) {
    try {
      const place = await searchPlace(restaurant.name, restaurant.city);

      if (!place) {
        console.warn(`  No result for: ${restaurant.name} (${restaurant.city})`);
        failed++;
        continue;
      }

      const photoUrl = place.photos?.[0]
        ? getPhotoUrl(place.photos[0].name)
        : null;

      const cuisine = place.types ? extractCuisine(place.types) : null;

      const updateData: Record<string, any> = {
        google_place_id: place.id,
        address: place.formattedAddress,
        latitude: place.location.latitude,
        longitude: place.location.longitude,
        google_rating: place.rating || null,
        google_review_count: place.userRatingCount || 0,
        price_range: place.priceLevel ? PRICE_MAP[place.priceLevel] || 2 : 2,
        phone: place.nationalPhoneNumber || null,
        website: place.websiteUri || null,
        google_url: place.googleMapsUri || null,
        google_photo_url: photoUrl,
        photo_url: photoUrl, // Use as primary photo until we have better sources
        description: place.editorialSummary?.text || null,
        last_fetched_at: new Date().toISOString(),
      };

      // Only override cuisine if we got one from Google and current is the placeholder
      if (cuisine) {
        updateData.cuisine = cuisine;
      }

      const { error: updateError } = await supabase
        .from('restaurants')
        .update(updateData)
        .eq('id', restaurant.id);

      if (updateError) {
        console.error(`  Update failed for ${restaurant.name}: ${updateError.message}`);
        failed++;
      } else {
        enriched++;
        if (enriched % 25 === 0) {
          console.log(`  Progress: ${enriched}/${restaurants.length} enriched`);
        }
      }

      // Rate limiting
      await new Promise(r => setTimeout(r, RATE_LIMIT_MS));
    } catch (err: any) {
      console.error(`  Exception for ${restaurant.name}: ${err.message}`);
      failed++;
    }
  }

  console.log(`\nDone! Enriched: ${enriched}, Failed: ${failed}`);
}

enrich().catch(console.error);
