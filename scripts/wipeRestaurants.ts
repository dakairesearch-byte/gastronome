import { createClient } from '@supabase/supabase-js';

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL!;
const supabaseKey = process.env.SUPABASE_SERVICE_ROLE_KEY!;

if (!supabaseUrl || !supabaseKey) {
  console.error('Missing NEXT_PUBLIC_SUPABASE_URL or SUPABASE_SERVICE_ROLE_KEY');
  process.exit(1);
}

const supabase = createClient(supabaseUrl, supabaseKey);

async function wipe() {
  console.log('Wiping restaurant data (preserving profiles and follows)...\n');

  // 1. Delete dependent tables first (FK order)
  const tables = [
    'review_photos',
    'reviews',
    'restaurant_videos',
    'fetch_logs',
    'restaurant_rating_snapshots',
    'restaurants',
  ];

  for (const table of tables) {
    const { error } = await supabase.from(table).delete().gte('id', '00000000-0000-0000-0000-000000000000');
    if (error) {
      // Table might not exist (e.g. restaurant_rating_snapshots) — that's OK
      console.warn(`  ${table}: ${error.message}`);
    } else {
      console.log(`  Deleted all rows from ${table}`);
    }
  }

  // 2. Verify clean slate
  console.log('\nVerification:');
  for (const table of ['restaurants', 'reviews', 'review_photos', 'restaurant_videos', 'fetch_logs']) {
    const { count } = await supabase.from(table).select('*', { count: 'exact', head: true });
    console.log(`  ${table}: ${count} rows`);
  }

  console.log('\nWipe complete!');
}

wipe().catch(console.error);
