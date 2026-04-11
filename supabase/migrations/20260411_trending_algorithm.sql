-- Trending algorithm: identifies restaurants with spiking attention
-- Velocity-dominant: rate of change matters more than absolute quality
-- Powers the "Trending" badge and trending sections

CREATE OR REPLACE FUNCTION get_trending_restaurants(
  p_city TEXT DEFAULT NULL,
  p_limit INT DEFAULT 10
)
RETURNS TABLE (
  id UUID,
  name TEXT,
  cuisine TEXT,
  city TEXT,
  neighborhood TEXT,
  address TEXT,
  phone TEXT,
  website TEXT,
  price_range INT,
  photo_url TEXT,
  description TEXT,
  google_place_id TEXT,
  google_rating NUMERIC,
  google_review_count INT,
  google_url TEXT,
  yelp_rating NUMERIC,
  yelp_review_count INT,
  yelp_url TEXT,
  infatuation_rating NUMERIC,
  infatuation_url TEXT,
  michelin_stars INT,
  michelin_designation TEXT,
  michelin_url TEXT,
  james_beard_winner BOOLEAN,
  james_beard_nominated BOOLEAN,
  eater_38 BOOLEAN,
  is_featured BOOLEAN,
  accolades JSONB,
  avg_rating NUMERIC,
  review_count INT,
  created_at TIMESTAMPTZ,
  trending_tier TEXT,
  latest_video_posted_at TIMESTAMPTZ,
  recent_video_count INT
) AS $$
WITH
recent_eng AS (
  SELECT
    v.restaurant_id,
    SUM(v.view_count * 1.0 + v.like_count * 3.0 + v.comment_count * 5.0) AS engagement,
    COUNT(*) AS video_count,
    MAX(v.posted_at) AS latest_post
  FROM restaurant_videos v
  WHERE v.posted_at > NOW() - INTERVAL '14 days'
  GROUP BY v.restaurant_id
),

prior_eng AS (
  SELECT
    v.restaurant_id,
    SUM(v.view_count * 1.0 + v.like_count * 3.0 + v.comment_count * 5.0) AS engagement
  FROM restaurant_videos v
  WHERE v.posted_at BETWEEN NOW() - INTERVAL '45 days' AND NOW() - INTERVAL '14 days'
  GROUP BY v.restaurant_id
),

social_velocity AS (
  SELECT
    COALESCE(re.restaurant_id, pe.restaurant_id) AS restaurant_id,
    re.latest_post,
    COALESCE(re.video_count, 0)::INT AS recent_video_count,
    CASE
      WHEN pe.engagement IS NULL AND re.engagement IS NOT NULL THEN 2.0
      WHEN pe.engagement IS NOT NULL AND re.engagement IS NOT NULL THEN
        (re.engagement - pe.engagement) / GREATEST(pe.engagement, 1.0)
      WHEN pe.engagement IS NOT NULL AND re.engagement IS NULL THEN -1.0
      ELSE 0
    END AS velocity
  FROM recent_eng re
  FULL OUTER JOIN prior_eng pe ON re.restaurant_id = pe.restaurant_id
),

freshness AS (
  SELECT
    sv.restaurant_id,
    sv.velocity,
    sv.latest_post,
    sv.recent_video_count,
    CASE
      WHEN sv.latest_post IS NOT NULL THEN
        EXP(-0.01 * EXTRACT(EPOCH FROM NOW() - sv.latest_post::TIMESTAMP) / 3600.0)
      ELSE 0
    END AS freshness_score
  FROM social_velocity sv
),

accolade_check AS (
  SELECT
    r.id AS restaurant_id,
    CASE
      WHEN r.accolades IS NOT NULL AND jsonb_array_length(r.accolades::JSONB) > 0 AND EXISTS (
        SELECT 1 FROM jsonb_array_elements(r.accolades::JSONB) AS a
        WHERE (a->>'year')::INT = EXTRACT(YEAR FROM NOW())::INT
      ) THEN 1.0
      ELSE 0
    END AS accolade_bonus
  FROM restaurants r
),

scored AS (
  SELECT
    r.*,
    f.latest_post,
    COALESCE(f.recent_video_count, 0) AS _recent_video_count,
    COALESCE(
      PERCENT_RANK() OVER (
        PARTITION BY r.city
        ORDER BY COALESCE(f.velocity, -1)
      ), 0
    ) * 0.45
    + 0 * 0.25  -- rating_momentum placeholder
    + COALESCE(f.freshness_score, 0) * 0.20
    + COALESCE(ac.accolade_bonus, 0) * 0.10
    AS trending_score
  FROM restaurants r
  LEFT JOIN freshness f ON f.restaurant_id = r.id
  LEFT JOIN accolade_check ac ON ac.restaurant_id = r.id
  WHERE (p_city IS NULL OR LOWER(r.city) = LOWER(p_city))
)

SELECT
  s.id,
  s.name,
  s.cuisine,
  s.city,
  s.neighborhood,
  s.address,
  s.phone,
  s.website,
  s.price_range,
  s.photo_url,
  s.description,
  s.google_place_id,
  s.google_rating,
  s.google_review_count,
  s.google_url,
  s.yelp_rating,
  s.yelp_review_count,
  s.yelp_url,
  s.infatuation_rating,
  s.infatuation_url,
  s.michelin_stars,
  s.michelin_designation,
  s.michelin_url,
  s.james_beard_winner,
  s.james_beard_nominated,
  s.eater_38,
  s.is_featured,
  s.accolades::JSONB,
  s.avg_rating,
  s.review_count,
  s.created_at,
  CASE
    WHEN s.trending_score >= 0.90 THEN 'hot'
    WHEN s.trending_score >= 0.70 THEN 'trending'
    ELSE 'none'
  END AS trending_tier,
  s.latest_post AS latest_video_posted_at,
  s._recent_video_count::INT AS recent_video_count
FROM scored s
WHERE s.trending_score >= 0.70
ORDER BY s.trending_score DESC
LIMIT p_limit;

$$ LANGUAGE plpgsql STABLE;
