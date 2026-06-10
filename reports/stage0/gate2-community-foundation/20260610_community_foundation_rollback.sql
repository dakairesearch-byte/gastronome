-- Rollback for 20260610_community_foundation.sql
-- PLANNING ARTIFACT ONLY — run only if the migration needs to be reversed.
-- All statements are idempotent (IF EXISTS guards).

BEGIN;

-- Restore direct INSERT/UPDATE grants
GRANT INSERT, UPDATE ON public.reviews TO anon;
GRANT INSERT, UPDATE ON public.reviews TO authenticated;

-- Restore critics-only INSERT policy
DROP POLICY IF EXISTS "Authors can read own reviews" ON public.reviews;
DROP POLICY IF EXISTS "Critics can create reviews" ON public.reviews;
CREATE POLICY "Critics can create reviews"
  ON public.reviews FOR INSERT
  WITH CHECK (
    EXISTS (SELECT 1 FROM public.profiles WHERE id = auth.uid() AND is_critic = true)
  );

-- Drop new tables (all empty at rollback; no data loss)
DROP TABLE IF EXISTS public.user_rating_stats;
DROP TABLE IF EXISTS public.review_votes;
DROP TABLE IF EXISTS public.user_trust;
DROP TABLE IF EXISTS public.restaurant_community_stats;
DROP TABLE IF EXISTS public.restaurant_comparisons;

-- Drop provenance columns from reviews
ALTER TABLE public.reviews
  DROP CONSTRAINT IF EXISTS one_verdict_per_user,
  DROP CONSTRAINT IF EXISTS rating_whole_1_10,
  DROP COLUMN IF EXISTS quarantined,
  DROP COLUMN IF EXISTS ua_hash,
  DROP COLUMN IF EXISTS ip_hash,
  DROP COLUMN IF EXISTS visit_verified,
  DROP COLUMN IF EXISTS identity_tier,
  DROP COLUMN IF EXISTS trust_weight,
  DROP COLUMN IF EXISTS dish_tags,
  DROP COLUMN IF EXISTS would_return;

-- Safety guard (overseer F2): SET NOT NULL below fails if any verdict rows
-- (NULL title/content/rating) were written via the RPC after the migration.
-- Abort loudly rather than half-rolling-back; migrate or delete those rows
-- first with explicit owner approval.
DO $$
BEGIN
  IF EXISTS (
    SELECT 1 FROM public.reviews
    WHERE title IS NULL OR content IS NULL OR rating IS NULL
  ) THEN
    RAISE EXCEPTION 'rollback blocked: reviews contains verdict rows with NULL title/content/rating; resolve them before restoring NOT NULL';
  END IF;
END $$;

-- Restore NOT NULL on title, content, rating
ALTER TABLE public.reviews
  ALTER COLUMN title   SET NOT NULL,
  ALTER COLUMN content SET NOT NULL,
  ALTER COLUMN rating  SET NOT NULL;

-- Drop the RPC if it was applied
DROP FUNCTION IF EXISTS public.submit_verdict(uuid, boolean, smallint, text[], date);

COMMIT;
