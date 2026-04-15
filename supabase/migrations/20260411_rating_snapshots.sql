-- Rating snapshot table: stores daily rating snapshots for trend detection
-- Populate via a daily cron job or post-fetch hook
-- Used by trending algorithm's rating_momentum component (future)

CREATE TABLE IF NOT EXISTS restaurant_rating_snapshots (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  restaurant_id UUID REFERENCES restaurants(id) ON DELETE CASCADE,
  google_rating NUMERIC,
  google_review_count INT,
  yelp_rating NUMERIC,
  yelp_review_count INT,
  infatuation_rating NUMERIC,
  snapshot_date DATE DEFAULT CURRENT_DATE,
  UNIQUE(restaurant_id, snapshot_date)
);

CREATE INDEX IF NOT EXISTS idx_snapshots_restaurant_date
  ON restaurant_rating_snapshots(restaurant_id, snapshot_date DESC);
