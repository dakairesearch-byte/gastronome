-- Phase A: Junk cleanup before catalog enrichment
-- Removes 7 known-bad Eater 38 entries that leaked into restaurants from the
-- 2026 scrape. Each was a section header, not a real restaurant.
--
-- Run order:
--   1. Verify with the SELECT below
--   2. Run the DELETE block in a transaction
--   3. Re-verify the count

-- ============================================================================
-- VERIFY (read-only — safe)
-- ============================================================================

SELECT r.id, r.name, r.city,
       (SELECT COUNT(*) FROM restaurant_eater38_history WHERE restaurant_id = r.id) AS eater_history_rows,
       (SELECT COUNT(*) FROM restaurant_michelin_history WHERE restaurant_id = r.id) AS michelin_history_rows,
       (SELECT COUNT(*) FROM restaurant_jbf_history WHERE restaurant_id = r.id) AS jbf_history_rows,
       (SELECT COUNT(*) FROM external_reviews WHERE restaurant_id = r.id) AS external_reviews,
       (SELECT COUNT(*) FROM restaurant_videos WHERE restaurant_id = r.id) AS videos,
       (SELECT COUNT(*) FROM restaurant_menu_items WHERE restaurant_id = r.id) AS menu_items
FROM restaurants r
WHERE r.name ILIKE 'more in dining out%'
   OR (r.name = 'Sky Pavilion' AND r.city = 'New York')
ORDER BY r.name;

-- ============================================================================
-- DELETE (run inside a transaction)
-- ============================================================================

BEGIN;

-- Children first (FK cascades exist on most but be explicit)
DELETE FROM restaurant_eater38_history
WHERE restaurant_id IN (
  SELECT id FROM restaurants
  WHERE name ILIKE 'more in dining out%'
     OR (name = 'Sky Pavilion' AND city = 'New York')
);

DELETE FROM accolades_matches
WHERE restaurant_id IN (
  SELECT id FROM restaurants
  WHERE name ILIKE 'more in dining out%'
     OR (name = 'Sky Pavilion' AND city = 'New York')
);

DELETE FROM restaurants
WHERE name ILIKE 'more in dining out%'
   OR (name = 'Sky Pavilion' AND city = 'New York');

-- Confirm count: should be 0
SELECT COUNT(*) AS remaining_junk
FROM restaurants
WHERE name ILIKE 'more in dining out%'
   OR (name = 'Sky Pavilion' AND city = 'New York');

-- COMMIT;  -- uncomment after verifying the COUNT above is 0
-- ROLLBACK;  -- to undo if anything looks wrong
