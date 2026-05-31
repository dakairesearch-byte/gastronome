-- Enforce restaurant uniqueness on google_place_id so re-running the seeder
-- upserts instead of inserting duplicates.
--
-- REVIEW BEFORE APPLYING. This will FAIL if duplicate non-null google_place_id
-- rows already exist. Resolve duplicates first (see scripts/archived/_auditDuplicates.ts),
-- then apply. NULLs are allowed and not deduped (a partial index permits many
-- not-yet-enriched rows).
--
-- The partial unique index is what `onConflict: 'google_place_id'` upserts
-- target in seedRestaurants.ts / src/scripts/seed-restaurants.ts.

-- Detect blockers (run manually before applying):
--   select google_place_id, count(*)
--   from restaurants
--   where google_place_id is not null
--   group by google_place_id having count(*) > 1;

create unique index if not exists restaurants_google_place_id_key
  on restaurants (google_place_id)
  where google_place_id is not null;
