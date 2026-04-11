-- Placement algorithm: determines default restaurant ordering across the app
-- Quality-dominant: ratings account for ~77% of placement
-- Never exposed as a score to users

CREATE OR REPLACE FUNCTION get_placed_restaurants(
  p_city TEXT DEFAULT NULL,
  p_cuisine TEXT DEFAULT NULL,
  p_limit INT DEFAULT 20,
  p_offset INT DEFAULT 0
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
  google_photo_url TEXT,
  yelp_id TEXT,
  yelp_rating NUMERIC,
  yelp_review_count INT,
  yelp_url TEXT,
  yelp_photo_url TEXT,
  infatuation_rating NUMERIC,
  infatuation_url TEXT,
  infatuation_review_snippet TEXT,
  michelin_stars INT,
  michelin_designation TEXT,
  michelin_url TEXT,
  james_beard_winner BOOLEAN,
  james_beard_nominated BOOLEAN,
  eater_38 BOOLEAN,
  is_featured BOOLEAN,
  accolades JSONB,
  latitude NUMERIC,
  longitude NUMERIC,
  avg_rating NUMERIC,
  review_count INT,
  last_fetched_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ,
  updated_at TIMESTAMPTZ,
  placement_order BIGINT
) AS $$
WITH confidence_threshold AS (
  SELECT 100.0 AS val
),

-- LAYER 1: Quality Score (0-5 scale)
quality AS (
  SELECT
    r.id,
    r.google_rating AS g_norm,
    r.yelp_rating AS y_norm,
    (r.infatuation_rating / 10.0) * 5.0 AS i_norm,
    0.35 * LEAST(COALESCE(r.google_review_count, 0)::NUMERIC / ct.val, 1.0) AS g_weight,
    0.30 * LEAST(COALESCE(r.yelp_review_count, 0)::NUMERIC / ct.val, 1.0) AS y_weight,
    CASE WHEN r.infatuation_rating IS NOT NULL THEN 0.35 ELSE 0 END AS i_weight
  FROM restaurants r, confidence_threshold ct
),

quality_scores AS (
  SELECT
    q.id,
    CASE
      WHEN (
        CASE WHEN q.g_norm IS NOT NULL THEN q.g_weight ELSE 0 END +
        CASE WHEN q.y_norm IS NOT NULL THEN q.y_weight ELSE 0 END +
        q.i_weight
      ) > 0
      THEN (
        COALESCE(q.g_norm * q.g_weight, 0) +
        COALESCE(q.y_norm * q.y_weight, 0) +
        COALESCE(q.i_norm * q.i_weight, 0)
      ) / NULLIF(
        CASE WHEN q.g_norm IS NOT NULL THEN q.g_weight ELSE 0 END +
        CASE WHEN q.y_norm IS NOT NULL THEN q.y_weight ELSE 0 END +
        q.i_weight,
        0
      )
      ELSE NULL
    END AS quality_score
  FROM quality q
),

-- LAYER 2: Social Momentum (percentile rank 0-1 within city)
video_engagement AS (
  SELECT
    v.restaurant_id,
    SUM(v.view_count) AS total_views,
    SUM(v.like_count) AS total_likes,
    SUM(v.comment_count) AS total_comments,
    MAX(v.posted_at) AS latest_post
  FROM restaurant_videos v
  WHERE v.posted_at > NOW() - INTERVAL '90 days'
  GROUP BY v.restaurant_id
),

momentum_raw AS (
  SELECT
    ve.restaurant_id,
    (ve.total_views * 1.0 + ve.total_likes * 3.0 + ve.total_comments * 5.0)
      * EXP(-0.03 * EXTRACT(DAY FROM NOW() - ve.latest_post::TIMESTAMP))
    AS weighted_engagement
  FROM video_engagement ve
),

-- LAYER 3: Prestige Modifier (additive, capped at 1.0)
prestige AS (
  SELECT
    r.id,
    LEAST(
      (CASE r.michelin_stars
        WHEN 3 THEN 0.60
        WHEN 2 THEN 0.45
        WHEN 1 THEN 0.30
        ELSE
          CASE
            WHEN r.michelin_designation = 'Bib Gourmand' THEN 0.20
            WHEN r.michelin_designation IS NOT NULL THEN 0.05
            ELSE 0
          END
      END)
      + (CASE WHEN r.james_beard_winner THEN 0.25
              WHEN r.james_beard_nominated THEN 0.10
              ELSE 0 END)
      + (CASE WHEN r.eater_38 THEN 0.10 ELSE 0 END),
      1.0
    ) AS prestige_modifier
  FROM restaurants r
),

-- COMBINE
combined AS (
  SELECT
    r.*,
    COALESCE(qs.quality_score * 4.0, 0)
    + COALESCE(
        PERCENT_RANK() OVER (
          PARTITION BY r.city
          ORDER BY COALESCE(mr.weighted_engagement, 0)
        ) * 1.0,
        0
      )
    + COALESCE(p.prestige_modifier, 0)
    AS placement_score,
    (CASE WHEN r.google_rating IS NOT NULL THEN 1 ELSE 0 END +
     CASE WHEN r.yelp_rating IS NOT NULL THEN 1 ELSE 0 END +
     CASE WHEN r.infatuation_rating IS NOT NULL THEN 1 ELSE 0 END) AS source_count,
    COALESCE(r.google_review_count, 0) + COALESCE(r.yelp_review_count, 0) AS total_reviews
  FROM restaurants r
  LEFT JOIN quality_scores qs ON qs.id = r.id
  LEFT JOIN momentum_raw mr ON mr.restaurant_id = r.id
  LEFT JOIN prestige p ON p.id = r.id
  WHERE
    (p_city IS NULL OR LOWER(r.city) = LOWER(p_city))
    AND (p_cuisine IS NULL OR LOWER(r.cuisine) = LOWER(p_cuisine))
)

SELECT
  c.id,
  c.name,
  c.cuisine,
  c.city,
  c.neighborhood,
  c.address,
  c.phone,
  c.website,
  c.price_range,
  c.photo_url,
  c.description,
  c.google_place_id,
  c.google_rating,
  c.google_review_count,
  c.google_url,
  c.google_photo_url,
  c.yelp_id,
  c.yelp_rating,
  c.yelp_review_count,
  c.yelp_url,
  c.yelp_photo_url,
  c.infatuation_rating,
  c.infatuation_url,
  c.infatuation_review_snippet,
  c.michelin_stars,
  c.michelin_designation,
  c.michelin_url,
  c.james_beard_winner,
  c.james_beard_nominated,
  c.eater_38,
  c.is_featured,
  c.accolades::JSONB,
  c.latitude,
  c.longitude,
  c.avg_rating,
  c.review_count,
  c.last_fetched_at,
  c.created_at,
  c.updated_at,
  ROW_NUMBER() OVER (
    ORDER BY
      c.placement_score DESC NULLS LAST,
      c.source_count DESC,
      c.total_reviews DESC,
      c.name ASC
  ) AS placement_order
FROM combined c
ORDER BY placement_order
LIMIT p_limit
OFFSET p_offset;

$$ LANGUAGE plpgsql STABLE;
