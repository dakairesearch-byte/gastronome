-- Instagram support: per-restaurant handle + relaxed video dedup semantics
--
-- Adds Instagram columns on restaurants so a handle can be manually associated
-- per restaurant, and changes the uniqueness of restaurant_videos so the same
-- reel/video shortcode can be tagged under multiple restaurants (useful for
-- e.g. "best pizza in NYC" reels that reference several places).
--
-- Additive. No data is dropped. Reverse operations are documented at the end.

ALTER TABLE restaurants
  ADD COLUMN IF NOT EXISTS instagram_handle text,
  ADD COLUMN IF NOT EXISTS instagram_url text,
  ADD COLUMN IF NOT EXISTS instagram_follower_count integer,
  ADD COLUMN IF NOT EXISTS instagram_last_fetched_at timestamptz;

CREATE INDEX IF NOT EXISTS idx_restaurants_instagram_handle
  ON restaurants(instagram_handle)
  WHERE instagram_handle IS NOT NULL;

-- Swap the unique constraint on restaurant_videos from (platform, video_id)
-- to (restaurant_id, platform, video_id). The old constraint prevented the
-- same reel shortcode from appearing under multiple restaurants; the new
-- one scopes uniqueness per restaurant, matching how upserts are done from
-- the admin ingestion endpoint.
ALTER TABLE restaurant_videos
  DROP CONSTRAINT IF EXISTS restaurant_videos_platform_video_id_key;

ALTER TABLE restaurant_videos
  ADD CONSTRAINT restaurant_videos_restaurant_platform_video_id_key
  UNIQUE (restaurant_id, platform, video_id);

-- Reverse operations (for manual rollback):
--
-- ALTER TABLE restaurant_videos
--   DROP CONSTRAINT IF EXISTS restaurant_videos_restaurant_platform_video_id_key;
-- ALTER TABLE restaurant_videos
--   ADD CONSTRAINT restaurant_videos_platform_video_id_key
--   UNIQUE (platform, video_id);
--
-- DROP INDEX IF EXISTS idx_restaurants_instagram_handle;
--
-- ALTER TABLE restaurants
--   DROP COLUMN IF EXISTS instagram_last_fetched_at,
--   DROP COLUMN IF EXISTS instagram_follower_count,
--   DROP COLUMN IF EXISTS instagram_url,
--   DROP COLUMN IF EXISTS instagram_handle;
