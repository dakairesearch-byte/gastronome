-- RLS policies for profiles table
-- Fixes: "new row violates row-level security policy for table profiles"

ALTER TABLE profiles ENABLE ROW LEVEL SECURITY;

-- Anyone can read profiles (public directory)
DROP POLICY IF EXISTS "Public read profiles" ON profiles;
CREATE POLICY "Public read profiles" ON profiles
  FOR SELECT USING (true);

-- Authenticated users can insert their own profile (signup)
DROP POLICY IF EXISTS "Users can insert own profile" ON profiles;
CREATE POLICY "Users can insert own profile" ON profiles
  FOR INSERT WITH CHECK (auth.uid() = id);

-- Authenticated users can update their own profile
DROP POLICY IF EXISTS "Users can update own profile" ON profiles;
CREATE POLICY "Users can update own profile" ON profiles
  FOR UPDATE USING (auth.uid() = id)
  WITH CHECK (auth.uid() = id);

-- RLS policies for reviews table
ALTER TABLE reviews ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Public read reviews" ON reviews;
CREATE POLICY "Public read reviews" ON reviews
  FOR SELECT USING (true);

DROP POLICY IF EXISTS "Users can insert own reviews" ON reviews;
CREATE POLICY "Users can insert own reviews" ON reviews
  FOR INSERT WITH CHECK (auth.uid() = author_id);

DROP POLICY IF EXISTS "Users can update own reviews" ON reviews;
CREATE POLICY "Users can update own reviews" ON reviews
  FOR UPDATE USING (auth.uid() = author_id)
  WITH CHECK (auth.uid() = author_id);

DROP POLICY IF EXISTS "Users can delete own reviews" ON reviews;
CREATE POLICY "Users can delete own reviews" ON reviews
  FOR DELETE USING (auth.uid() = author_id);

-- RLS policies for follows table
ALTER TABLE follows ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Public read follows" ON follows;
CREATE POLICY "Public read follows" ON follows
  FOR SELECT USING (true);

DROP POLICY IF EXISTS "Users can insert own follows" ON follows;
CREATE POLICY "Users can insert own follows" ON follows
  FOR INSERT WITH CHECK (auth.uid() = follower_id);

DROP POLICY IF EXISTS "Users can delete own follows" ON follows;
CREATE POLICY "Users can delete own follows" ON follows
  FOR DELETE USING (auth.uid() = follower_id);

-- RLS policies for review_photos table
ALTER TABLE review_photos ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Public read review_photos" ON review_photos;
CREATE POLICY "Public read review_photos" ON review_photos
  FOR SELECT USING (true);

DROP POLICY IF EXISTS "Users can insert own review_photos" ON review_photos;
CREATE POLICY "Users can insert own review_photos" ON review_photos
  FOR INSERT WITH CHECK (
    auth.uid() = (SELECT author_id FROM reviews WHERE id = review_id)
  );
