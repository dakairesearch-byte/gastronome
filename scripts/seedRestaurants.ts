import { createClient } from '@supabase/supabase-js';
import * as fs from 'fs';

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL!;
const supabaseKey = process.env.SUPABASE_SERVICE_ROLE_KEY!;

if (!supabaseUrl || !supabaseKey) {
  console.error('Missing NEXT_PUBLIC_SUPABASE_URL or SUPABASE_SERVICE_ROLE_KEY');
  process.exit(1);
}

const supabase = createClient(supabaseUrl, supabaseKey);

// City key -> { city } mapping (restaurants table has no state column)
const CITY_MAP: Record<string, { city: string; state: string }> = {
  Miami: { city: 'Miami', state: 'FL' },
  NYC: { city: 'New York', state: 'NY' },
  LA: { city: 'Los Angeles', state: 'CA' },
  Chicago: { city: 'Chicago', state: 'IL' },
  SF: { city: 'San Francisco', state: 'CA' },
};

interface SeedRestaurant {
  name: string;
  city: string;
  sources: string[];
  lists: string[];
  accolades: string[];
}

function parseMichelinFromAccolades(accolades: string[]): {
  michelin_stars: number;
  michelin_designation: string | null;
} {
  for (const a of accolades) {
    if (a.includes('Michelin 3 Star')) return { michelin_stars: 3, michelin_designation: 'three_star' };
    if (a.includes('Michelin 2 Star')) return { michelin_stars: 2, michelin_designation: 'two_star' };
    if (a.includes('Michelin 1 Star')) return { michelin_stars: 1, michelin_designation: 'one_star' };
    if (a.includes('Bib Gourmand')) return { michelin_stars: 0, michelin_designation: 'bib_gourmand' };
  }
  return { michelin_stars: 0, michelin_designation: null };
}

function parseJamesBeardFromAccolades(accolades: string[]): {
  james_beard_winner: boolean;
  jb_awards: Array<{ award: string; year: number }>;
} {
  const jbAccolades = accolades.filter(a => a.startsWith('James Beard'));
  if (jbAccolades.length === 0) return { james_beard_winner: false, jb_awards: [] };

  const jb_awards = jbAccolades.map(a => {
    const yearMatch = a.match(/\((\d{4})\)/);
    const year = yearMatch ? parseInt(yearMatch[1]) : 0;
    const award = a.replace('James Beard ', '').replace(/\s*\(\d{4}\)/, '');
    return { award, year };
  });

  return { james_beard_winner: true, jb_awards };
}

async function seed() {
  const seedPath = './gastronome-seed-data-with-accolades.json';
  if (!fs.existsSync(seedPath)) {
    console.error(`Seed data file not found at ${seedPath}`);
    process.exit(1);
  }

  const rawData = JSON.parse(fs.readFileSync(seedPath, 'utf-8'));

  let total = 0;
  let errors = 0;

  for (const [key, restaurants] of Object.entries(rawData)) {
    const cityInfo = CITY_MAP[key];
    if (!cityInfo) {
      console.warn(`Unknown city key: ${key}, skipping`);
      continue;
    }

    const batch = (restaurants as SeedRestaurant[]).map(r => {
      const { michelin_stars, michelin_designation } = parseMichelinFromAccolades(r.accolades || []);
      const { james_beard_winner, jb_awards } = parseJamesBeardFromAccolades(r.accolades || []);

      // Build accolades JSONB array
      const accoladesJson: any[] = [];
      if (michelin_designation) {
        accoladesJson.push({
          type: 'michelin',
          designation: michelin_designation,
          stars: michelin_stars,
        });
      }
      for (const jb of jb_awards) {
        accoladesJson.push({
          type: 'james_beard',
          award: jb.award,
          year: jb.year,
        });
      }

      // Preserve source/list info as accolades too
      for (const list of (r.lists || [])) {
        if (list.includes('Essential 38')) {
          accoladesJson.push({ type: 'eater_38', label: list });
        } else if (list.includes('Infatuation')) {
          accoladesJson.push({ type: 'infatuation', label: list });
        }
      }

      return {
        name: r.name,
        city: cityInfo.city,
        cuisine: 'Restaurant', // Placeholder — enrichment will fill from Google
        price_range: 2, // Default — enrichment will update from Google
        michelin_stars,
        michelin_designation,
        james_beard_winner,
        james_beard_nominated: james_beard_winner,
        eater_38: (r.lists || []).some((l: string) => l.includes('Essential 38')),
        accolades: accoladesJson,
        description: null,
        is_featured: michelin_stars >= 2 || james_beard_winner,
      };
    });

    // Insert in chunks of 50 to avoid payload limits
    for (let i = 0; i < batch.length; i += 50) {
      const chunk = batch.slice(i, i + 50);
      const { error } = await supabase.from('restaurants').insert(chunk);
      if (error) {
        console.error(`Error inserting chunk for ${key} (${i}-${i + chunk.length}):`, error.message);
        errors += chunk.length;
      } else {
        total += chunk.length;
        console.log(`Inserted ${key}: ${Math.min(i + 50, batch.length)}/${batch.length}`);
      }
    }
  }

  console.log(`\nDone! Inserted ${total} restaurants (${errors} errors)`);

  // Update city restaurant counts
  for (const [, cityInfo] of Object.entries(CITY_MAP)) {
    const { count } = await supabase
      .from('restaurants')
      .select('*', { count: 'exact', head: true })
      .eq('city', cityInfo.city);

    await supabase
      .from('cities')
      .update({ restaurant_count: count || 0 })
      .eq('name', cityInfo.city);

    console.log(`Updated ${cityInfo.city} count: ${count}`);
  }
}

seed().catch(console.error);
