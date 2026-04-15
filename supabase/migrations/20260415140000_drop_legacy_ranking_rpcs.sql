-- Drop the legacy ranking/placement RPCs.
--
-- Both functions were replaced by the TypeScript `lib/ranking/trending.ts`
-- pipeline, which is now the single source of truth for restaurant
-- ordering project-wide. Leaving them around would let a future page
-- silently reintroduce multi-ranking math.
--
-- Additive migration: no schema changes, no data loss. Reverse ops are
-- the full bodies of the prior migrations (001-series for placement,
-- trending algorithm migration) — re-apply those if you ever need to
-- restore the old RPCs.

DROP FUNCTION IF EXISTS get_placed_restaurants(TEXT, TEXT, INT, INT);
DROP FUNCTION IF EXISTS get_trending_restaurants(TEXT, INT);
