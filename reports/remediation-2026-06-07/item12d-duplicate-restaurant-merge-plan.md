# Item 12d — Suspected Duplicate Restaurant Pairs (QUEUED — owner approval required)

**Date:** 2026-06-07
**Worker:** W3-accolades-integrity
**Status:** QUEUED. Deleting a venue is significant and these may be LEGITIMATE multi-city outlets, not duplicates. Do NOT run without owner confirmation per pair.

## The 4 suspected pairs (live data 2026-06-07)

| Pair | id | city | state | address | place_id | created_at |
|---|---|---|---|---|---|---|
| Jilli | 16032ece-1299-46a2-b3ed-fe6afe4d2291 | Los Angeles | CA | (null) | (null) | 14:32:33 |
| Jilli | c68d0adb-1c0a-45e7-adfb-a51ff52674d7 | San Francisco | CA | 3489 16th St | (null) | 14:35:49 |
| Magie | 4aa835cf-6a49-4155-8bd5-db0ba4c74356 | Coconut Grove | FL | (null) | (null) | 14:40:28 |
| Magie | 5a0d58c2-49da-4d52-8bcf-2a806fda69fa | Miami | FL | (null) | (null) | 14:44:22 |
| Salt & Straw | 085af390-f061-40e3-913a-70356d4a48da | Los Angeles | CA | 240 N Larchmont Blvd | (null) | 14:43:27 |
| Salt & Straw | 7e09b094-1409-44a4-97f8-983fda8e17c4 | New York | NY | (null) | (null) | 14:42:36 |
| Skinny Louie | 613cc935-d55f-4dcc-929b-aa73ceb036fc | Miami | FL | 6022 S Dixie Hwy | (null) | 14:40:16 |
| Skinny Louie | ff7f7677-9962-47b5-9677-5189d5e1e885 | New York | NY | Upper East Side, Manhattan | (null) | 14:26:47 |

**All 8 rows are OPERATIONAL and currently have 0 videos / 0 menu_items / 0 michelin_history.**

### ⚠️ Adjudication risk — READ FIRST
- **Salt & Straw** is a real national chain with genuine LA *and* NY shops → the LA/NY pair is very likely NOT a duplicate. Recommend **KEEP BOTH**.
- **Skinny Louie** Miami (6022 S Dixie Hwy) vs NY (Upper East Side) → could be two real outlets. Verify before merging.
- **Jilli** LA vs SF, **Magie** Coconut Grove vs Miami → Coconut Grove *is* in Miami, so the Magie pair is the strongest true-duplicate candidate (same metro). Jilli LA vs SF are different metros — verify.

The owner must decide per pair whether it is a duplicate (merge) or two real outlets (keep both, optionally disambiguate names).

## FK children that must be re-pointed before deleting a loser
19 tables reference `restaurants(id)`; 18 are `ON DELETE CASCADE`, `fetch_logs` is `ON DELETE SET NULL`:
`accolades_matches, external_review_dish_mentions, external_reviews, fetch_logs, restaurant_dish_signals, restaurant_eater38_history, restaurant_google_chips, restaurant_highlighted_dishes, restaurant_jbf_history, restaurant_menu_fetches, restaurant_menu_items, restaurant_michelin_history, restaurant_photos, restaurant_top_dishes, restaurant_videos, reviews, user_collection_items, user_favorites, video_dish_mentions`.

> Because all 8 rows currently have empty child data, re-pointing is mostly a no-op today, but the template below is written defensively for safety if children appear before approval.

## Ready-to-run MERGE SQL (per pair) — DO NOT RUN until approved

For each approved pair, choose KEEP (canonical) and LOSE (to delete). Recommendation: keep the row WITH an address/place_id (richer), else the older `created_at`.

```sql
-- TEMPLATE: replace :keep and :lose with the chosen UUIDs for ONE approved pair.
-- Run inside a transaction. Back up both rows + all child rows first.
BEGIN;

-- 0) Safety backup (run as SELECT ... and save output before deleting):
--    SELECT to_jsonb(r) FROM restaurants r WHERE id IN (:keep, :lose);
--    plus SELECT * from each child table WHERE restaurant_id = :lose;

-- 1) Re-point all child rows from loser -> keeper.
UPDATE accolades_matches            SET restaurant_id=:keep WHERE restaurant_id=:lose;
UPDATE external_review_dish_mentions SET restaurant_id=:keep WHERE restaurant_id=:lose;
UPDATE external_reviews             SET restaurant_id=:keep WHERE restaurant_id=:lose;
UPDATE fetch_logs                   SET restaurant_id=:keep WHERE restaurant_id=:lose;
UPDATE restaurant_dish_signals      SET restaurant_id=:keep WHERE restaurant_id=:lose;
UPDATE restaurant_eater38_history   SET restaurant_id=:keep WHERE restaurant_id=:lose;
UPDATE restaurant_google_chips      SET restaurant_id=:keep WHERE restaurant_id=:lose;
UPDATE restaurant_highlighted_dishes SET restaurant_id=:keep WHERE restaurant_id=:lose;
UPDATE restaurant_jbf_history       SET restaurant_id=:keep WHERE restaurant_id=:lose;
UPDATE restaurant_menu_fetches      SET restaurant_id=:keep WHERE restaurant_id=:lose;
UPDATE restaurant_menu_items        SET restaurant_id=:keep WHERE restaurant_id=:lose;
UPDATE restaurant_michelin_history  SET restaurant_id=:keep WHERE restaurant_id=:lose;
UPDATE restaurant_photos            SET restaurant_id=:keep WHERE restaurant_id=:lose;
UPDATE restaurant_top_dishes        SET restaurant_id=:keep WHERE restaurant_id=:lose;
UPDATE restaurant_videos            SET restaurant_id=:keep WHERE restaurant_id=:lose;
UPDATE reviews                      SET restaurant_id=:keep WHERE restaurant_id=:lose;
UPDATE user_collection_items        SET restaurant_id=:keep WHERE restaurant_id=:lose;
UPDATE user_favorites               SET restaurant_id=:keep WHERE restaurant_id=:lose;
UPDATE video_dish_mentions          SET restaurant_id=:keep WHERE restaurant_id=:lose;

-- 2) (Optional) fill any NULL columns on keeper from loser via COALESCE before deleting.
--    e.g. UPDATE restaurants k SET address=COALESCE(k.address,l.address),
--         google_place_id=COALESCE(k.google_place_id,l.google_place_id)
--         FROM restaurants l WHERE k.id=:keep AND l.id=:lose;

-- 3) Delete the loser.
DELETE FROM restaurants WHERE id=:lose;

-- 4) Verify: SELECT count(*) FROM restaurants WHERE id=:lose;  -- expect 0
COMMIT;
```

### Suggested keep/lose (pending owner confirmation)
- **Magie** (strongest dup candidate, same metro): keep=`5a0d58c2-...`(Miami) lose=`4aa835cf-...`(Coconut Grove) — or vice versa per owner's canonical city.
- **Jilli**: keep=`c68d0adb-...`(SF, has address) lose=`16032ece-...`(LA) IF confirmed duplicate.
- **Skinny Louie**: keep=`613cc935-...`(Miami, has address) lose=`ff7f7677-...`(NY) IF confirmed duplicate.
- **Salt & Straw**: recommend **KEEP BOTH** (legit chain LA + NY) unless owner says otherwise.
