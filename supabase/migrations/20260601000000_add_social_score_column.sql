-- Social buzz signal for the Gastronome Score.
--
-- Adds restaurants.social_score: a 0..1 normalized TikTok+Instagram engagement
-- value, derived from restaurant_videos. The Gastronome Score (src/lib/score.ts)
-- reads it per-row as a CONSENSUS-GATED boost — buzz only lifts a restaurant the
-- ratings already agree is good, so virality alone can't push a mediocre place up.
--
-- Normalization: per restaurant, sum (views + 5*likes) per platform, log-scale
-- (ln(1+x)), then divide by that city+platform's p95 (capped at 1), then average
-- the platform values. Per-city + per-platform so TikTok's ~30x larger view
-- counts and big-city volumes don't dominate.
--
-- The backfill below is idempotent; re-run it nightly after video enrichment to
-- keep social_score fresh (it currently reflects the last restaurant_videos pull).

ALTER TABLE restaurants ADD COLUMN IF NOT EXISTS social_score double precision;

COMMENT ON COLUMN restaurants.social_score IS
  'Normalized 0..1 TikTok+Instagram engagement (per-city, per-platform, log-scaled, p95-anchored). Backfilled from restaurant_videos; refresh nightly alongside enrichment.';

WITH eng AS (
  SELECT v.restaurant_id, r.city, v.platform,
         ln(1 + sum(coalesce(v.view_count,0) + 5*coalesce(v.like_count,0))) AS log_eng
  FROM restaurant_videos v
  JOIN restaurants r ON r.id = v.restaurant_id
  WHERE r.city IS NOT NULL
  GROUP BY v.restaurant_id, r.city, v.platform
),
ref AS (
  SELECT city, platform,
         percentile_cont(0.95) WITHIN GROUP (ORDER BY log_eng) AS p95
  FROM eng GROUP BY city, platform
),
norm AS (
  SELECT e.restaurant_id, LEAST(1.0, e.log_eng / NULLIF(ref.p95, 0)) AS n
  FROM eng e JOIN ref ON ref.city = e.city AND ref.platform = e.platform
),
soc AS (
  SELECT restaurant_id, avg(n) AS social_score
  FROM norm GROUP BY restaurant_id
)
UPDATE restaurants SET social_score = soc.social_score
FROM soc WHERE restaurants.id = soc.restaurant_id;
