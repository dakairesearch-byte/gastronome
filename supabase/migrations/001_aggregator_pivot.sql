-- Gastronome Aggregator Pivot Migration
-- Run this against Supabase project: trwdqzsfgeydafojajbh

-- 1A. Alter restaurants table with new aggregator columns
ALTER TABLE restaurants
  ADD COLUMN IF NOT EXISTS google_place_id text,
  ADD COLUMN IF NOT EXISTS google_photo_url text,
  ADD COLUMN IF NOT EXISTS yelp_id text,
  ADD COLUMN IF NOT EXISTS yelp_photo_url text,
  ADD COLUMN IF NOT EXISTS infatuation_rating numeric(3,1),
  ADD COLUMN IF NOT EXISTS infatuation_url text,
  ADD COLUMN IF NOT EXISTS infatuation_review_snippet text,
  ADD COLUMN IF NOT EXISTS latitude numeric(10,7),
  ADD COLUMN IF NOT EXISTS longitude numeric(10,7),
  ADD COLUMN IF NOT EXISTS photo_url text,
  ADD COLUMN IF NOT EXISTS neighborhood text,
  ADD COLUMN IF NOT EXISTS description text,
  ADD COLUMN IF NOT EXISTS is_featured boolean DEFAULT false,
  ADD COLUMN IF NOT EXISTS michelin_stars integer DEFAULT 0,
  ADD COLUMN IF NOT EXISTS michelin_designation text CHECK (michelin_designation IN ('three_star', 'two_star', 'one_star', 'bib_gourmand', 'recommended', null)),
  ADD COLUMN IF NOT EXISTS michelin_url text,
  ADD COLUMN IF NOT EXISTS james_beard_nominated boolean DEFAULT false,
  ADD COLUMN IF NOT EXISTS james_beard_winner boolean DEFAULT false,
  ADD COLUMN IF NOT EXISTS eater_38 boolean DEFAULT false,
  ADD COLUMN IF NOT EXISTS accolades jsonb DEFAULT '[]',
  ADD COLUMN IF NOT EXISTS last_fetched_at timestamptz;

-- Note: google_rating, google_review_count, google_url, yelp_rating,
-- yelp_review_count, yelp_url, beli_score, beli_url already exist

CREATE INDEX IF NOT EXISTS idx_restaurants_city ON restaurants(city);
CREATE INDEX IF NOT EXISTS idx_restaurants_cuisine ON restaurants(cuisine);
CREATE INDEX IF NOT EXISTS idx_restaurants_google_place_id ON restaurants(google_place_id);
CREATE INDEX IF NOT EXISTS idx_restaurants_is_featured ON restaurants(is_featured) WHERE is_featured = true;

-- 1B. Create restaurant_videos table
CREATE TABLE IF NOT EXISTS restaurant_videos (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  restaurant_id uuid NOT NULL REFERENCES restaurants(id) ON DELETE CASCADE,
  platform text NOT NULL CHECK (platform IN ('tiktok', 'instagram')),
  video_id text NOT NULL,
  video_url text NOT NULL,
  embed_url text,
  thumbnail_url text,
  caption text,
  author_username text,
  author_display_name text,
  like_count integer DEFAULT 0,
  view_count integer DEFAULT 0,
  comment_count integer DEFAULT 0,
  posted_at timestamptz,
  fetched_at timestamptz DEFAULT now(),
  created_at timestamptz DEFAULT now(),
  UNIQUE(platform, video_id)
);

CREATE INDEX IF NOT EXISTS idx_restaurant_videos_restaurant ON restaurant_videos(restaurant_id);
CREATE INDEX IF NOT EXISTS idx_restaurant_videos_likes ON restaurant_videos(like_count DESC);
CREATE INDEX IF NOT EXISTS idx_restaurant_videos_platform ON restaurant_videos(platform);

-- 1C. Create cities table
CREATE TABLE IF NOT EXISTS cities (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  name text NOT NULL,
  state text NOT NULL,
  slug text NOT NULL UNIQUE,
  photo_url text,
  restaurant_count integer DEFAULT 0,
  is_active boolean DEFAULT true,
  created_at timestamptz DEFAULT now()
);

INSERT INTO cities (name, state, slug) VALUES
  ('New York', 'NY', 'new-york'),
  ('Los Angeles', 'CA', 'los-angeles'),
  ('Miami', 'FL', 'miami'),
  ('Chicago', 'IL', 'chicago'),
  ('San Francisco', 'CA', 'san-francisco'),
  ('Austin', 'TX', 'austin'),
  ('Seattle', 'WA', 'seattle'),
  ('Houston', 'TX', 'houston'),
  ('Nashville', 'TN', 'nashville'),
  ('Portland', 'OR', 'portland'),
  ('Denver', 'CO', 'denver'),
  ('Atlanta', 'GA', 'atlanta'),
  ('Philadelphia', 'PA', 'philadelphia'),
  ('Boston', 'MA', 'boston'),
  ('Washington', 'DC', 'washington-dc'),
  ('Dallas', 'TX', 'dallas'),
  ('San Diego', 'CA', 'san-diego'),
  ('New Orleans', 'LA', 'new-orleans'),
  ('Minneapolis', 'MN', 'minneapolis'),
  ('Phoenix', 'AZ', 'phoenix')
ON CONFLICT (slug) DO NOTHING;

-- 1D. Create fetch_logs table
CREATE TABLE IF NOT EXISTS fetch_logs (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  restaurant_id uuid REFERENCES restaurants(id) ON DELETE SET NULL,
  source text NOT NULL,
  status text NOT NULL CHECK (status IN ('pending', 'running', 'success', 'error')),
  error_message text,
  metadata jsonb DEFAULT '{}',
  started_at timestamptz DEFAULT now(),
  completed_at timestamptz
);

-- 1E. RLS Policies
ALTER TABLE restaurants ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "Public read restaurants" ON restaurants;
CREATE POLICY "Public read restaurants" ON restaurants FOR SELECT USING (true);

ALTER TABLE restaurant_videos ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "Public read videos" ON restaurant_videos;
CREATE POLICY "Public read videos" ON restaurant_videos FOR SELECT USING (true);

ALTER TABLE cities ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "Public read cities" ON cities;
CREATE POLICY "Public read cities" ON cities FOR SELECT USING (true);

ALTER TABLE fetch_logs ENABLE ROW LEVEL SECURITY;
