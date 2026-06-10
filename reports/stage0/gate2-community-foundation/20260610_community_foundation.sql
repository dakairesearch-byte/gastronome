-- Gate 2: Community Foundation — provenance columns, trust tables, RPC skeleton
-- PLANNING ARTIFACT ONLY — do not apply without owner approval of gate2.
--
-- Verified against live schema 2026-06-10:
--   reviews columns: id, restaurant_id, author_id, title(NOT NULL), content(NOT NULL),
--                    rating(integer NOT NULL), visit_date, created_at, updated_at
--   RLS: enabled; existing policies: public SELECT, critics INSERT, author UPDATE/DELETE
--   Grants: anon + authenticated hold all privileges (RLS is the gate)
--
-- This migration runs in a single transaction. All guards are idempotent.
-- After applying: regenerate src/types/database.ts via Supabase CLI.

BEGIN;

-- ============================================================
-- 1. Extend reviews table for the Verdict Stack
-- ============================================================

-- 1a. Make title and content nullable (Verdict Stack = no free text at launch;
--     a "Been" row has NULL rating, NULL title, NULL content — all valid verdicts)
ALTER TABLE public.reviews
  ALTER COLUMN title DROP NOT NULL,
  ALTER COLUMN content DROP NOT NULL;

-- 1b. Change rating to allow NULL (Been = row exists, rating = NULL)
--     Note: rating was integer NOT NULL; we must drop the NOT NULL only.
--     The whole-number 1-10 CHECK is added below.
ALTER TABLE public.reviews
  ALTER COLUMN rating DROP NOT NULL;

-- 1c. Verdict Stack columns — all additive, no data migration needed (reviews=0)
ALTER TABLE public.reviews
  ADD COLUMN IF NOT EXISTS would_return       boolean,
  ADD COLUMN IF NOT EXISTS dish_tags          text[],
  -- Trust ledger — stamped by submit_verdict() RPC; never written by clients
  ADD COLUMN IF NOT EXISTS trust_weight       numeric       NOT NULL DEFAULT 0,
  ADD COLUMN IF NOT EXISTS identity_tier      smallint      NOT NULL DEFAULT 0,
  ADD COLUMN IF NOT EXISTS visit_verified     boolean       NOT NULL DEFAULT false,
  ADD COLUMN IF NOT EXISTS ip_hash            text,
  ADD COLUMN IF NOT EXISTS ua_hash            text,
  ADD COLUMN IF NOT EXISTS quarantined        boolean       NOT NULL DEFAULT false;

-- 1d. Whole-number 1-10 constraint (replaces unconstrained integer range)
--     Drop old constraint if it somehow exists, then add.
ALTER TABLE public.reviews
  DROP CONSTRAINT IF EXISTS rating_whole_1_10;
ALTER TABLE public.reviews
  ADD CONSTRAINT rating_whole_1_10
    CHECK (rating IS NULL OR (rating BETWEEN 1 AND 10));

-- 1e. One verdict per (user, restaurant) — free to add at reviews=0, expensive later.
--     Uses author_id which maps to profiles(id).
ALTER TABLE public.reviews
  DROP CONSTRAINT IF EXISTS one_verdict_per_user;
ALTER TABLE public.reviews
  ADD CONSTRAINT one_verdict_per_user
    UNIQUE (author_id, restaurant_id);

-- ============================================================
-- 2. restaurant_comparisons (pairwise duels)
-- ============================================================
CREATE TABLE IF NOT EXISTS public.restaurant_comparisons (
  id               uuid        PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id          uuid        NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
  winner_id        uuid        NOT NULL REFERENCES public.restaurants(id) ON DELETE CASCADE,
  loser_id         uuid        NOT NULL REFERENCES public.restaurants(id) ON DELETE CASCADE,
  prompted_context text,
  -- Trust provenance (same stamping pattern as reviews)
  trust_weight     numeric     NOT NULL DEFAULT 0,
  identity_tier    smallint    NOT NULL DEFAULT 0,
  created_at       timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT winner_ne_loser CHECK (winner_id <> loser_id)
);

-- One comparison per ordered (user, unordered pair) — prevents re-voting the same pair
CREATE UNIQUE INDEX IF NOT EXISTS one_pair_per_user
  ON public.restaurant_comparisons (user_id, least(winner_id, loser_id), greatest(winner_id, loser_id));

-- ============================================================
-- 3. restaurant_community_stats (materialized by nightly job — NOT a trigger)
--    Schema ships now; job scaffolded in Stage 3 when data exists.
-- ============================================================
CREATE TABLE IF NOT EXISTS public.restaurant_community_stats (
  restaurant_id    uuid        PRIMARY KEY REFERENCES public.restaurants(id) ON DELETE CASCADE,
  -- Been / return rate
  n_been           int         NOT NULL DEFAULT 0,
  n_return_asked   int         NOT NULL DEFAULT 0,
  n_return_yes     int         NOT NULL DEFAULT 0,
  -- Numeric ratings (trust-weighted, calibrated)
  n_ratings        int         NOT NULL DEFAULT 0,
  weighted_n       numeric     NOT NULL DEFAULT 0,   -- Σ trust_weight of rating rows
  mean_raw         numeric,
  mean_calibrated  numeric,
  ci_halfwidth     numeric,
  -- Elo / Bradley-Terry from comparisons
  elo              numeric     NOT NULL DEFAULT 1400, -- seeded at 1400 (below-average prior)
  n_comparisons    int         NOT NULL DEFAULT 0,
  -- Housekeeping
  computed_at      timestamptz
);

-- ============================================================
-- 4. user_trust (sybil weights — never shown to users)
-- ============================================================
CREATE TABLE IF NOT EXISTS public.user_trust (
  user_id          uuid        PRIMARY KEY REFERENCES public.profiles(id) ON DELETE CASCADE,
  weight           numeric     NOT NULL DEFAULT 0.25 CHECK (weight BETWEEN 0 AND 2),
  components       jsonb,                               -- raw sub-scores for audit
  computed_at      timestamptz NOT NULL DEFAULT now()
);

-- ============================================================
-- 5. review_votes (helpfulness Wilson sort — dishes and reviews)
--    👍-only at launch; downvote column added later if needed.
-- ============================================================
CREATE TABLE IF NOT EXISTS public.review_votes (
  review_id        uuid        NOT NULL REFERENCES public.reviews(id) ON DELETE CASCADE,
  user_id          uuid        NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
  vote             smallint    NOT NULL DEFAULT 1 CHECK (vote IN (1, -1)),
  created_at       timestamptz NOT NULL DEFAULT now(),
  PRIMARY KEY (review_id, user_id)
);

-- ============================================================
-- 6. user_rating_stats (per-user μ/σ for calibration — updated nightly)
-- ============================================================
CREATE TABLE IF NOT EXISTS public.user_rating_stats (
  user_id          uuid        PRIMARY KEY REFERENCES public.profiles(id) ON DELETE CASCADE,
  n_ratings        int         NOT NULL DEFAULT 0,
  mean_rating      numeric,                             -- μ_u
  stddev_rating    numeric,                             -- σ_u (NULL below ~3 ratings)
  computed_at      timestamptz NOT NULL DEFAULT now()
);

-- ============================================================
-- 7. RLS policies
-- ============================================================

-- 7a. reviews — replace critics-only INSERT with: no direct INSERT from clients
--     (RPC is the only write path). Keep public SELECT. Add own-row SELECT for
--     authenticated users (needed for profile page / your own verdicts).
DROP POLICY IF EXISTS "Critics can create reviews" ON public.reviews;

-- Ensure public SELECT remains (may already exist from prior migration)
DROP POLICY IF EXISTS "Reviews are viewable by everyone" ON public.reviews;
CREATE POLICY "Reviews are viewable by everyone"
  ON public.reviews FOR SELECT USING (true);

-- Authenticated users can read their own unquarantined rows even if public SELECT
-- ever gets restricted in a future migration
DROP POLICY IF EXISTS "Authors can read own reviews" ON public.reviews;
CREATE POLICY "Authors can read own reviews"
  ON public.reviews FOR SELECT
  USING (auth.uid() = author_id);

-- "Authors can update their own reviews" and "Authors can delete their own
-- reviews" policies remain in place from prior migration. NOTE (overseer F2):
-- section 8 revokes the table-level UPDATE grant, so the UPDATE policy is
-- inert for clients — edits flow through the submit_verdict() upsert. Author
-- DELETE keeps its grant and stays self-service.

-- 7b. restaurant_comparisons — public read; NO direct client writes.
--     This table carries trust provenance columns (trust_weight, identity_tier);
--     a client-facing INSERT policy would let callers forge them. Duels write
--     via a Phase 2 submit_comparison() SECURITY DEFINER RPC (same pattern as
--     submit_verdict). [Amended by overseer F2 2026-06-10: original draft
--     created an "Authenticated insert comparisons" policy that contradicted
--     the RPC-only write model stated in this section's own comment.]
ALTER TABLE public.restaurant_comparisons ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Public read comparisons" ON public.restaurant_comparisons;
CREATE POLICY "Public read comparisons"
  ON public.restaurant_comparisons FOR SELECT USING (true);

-- Defense in depth: Supabase default privileges grant table writes to anon/
-- authenticated on newly created tables; revoke so RLS is not the only gate.
DROP POLICY IF EXISTS "Authenticated insert comparisons" ON public.restaurant_comparisons;
REVOKE INSERT, UPDATE, DELETE ON public.restaurant_comparisons FROM anon, authenticated;

-- 7c. restaurant_community_stats — public read; writes by service role only
ALTER TABLE public.restaurant_community_stats ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Public read community stats" ON public.restaurant_community_stats;
CREATE POLICY "Public read community stats"
  ON public.restaurant_community_stats FOR SELECT USING (true);

-- 7d. user_trust — no public read (weights never shown to users); service role only
ALTER TABLE public.user_trust ENABLE ROW LEVEL SECURITY;
-- No SELECT policy = deny all to anon/authenticated; service role bypasses.

-- 7e. review_votes — authenticated users can insert/delete own votes; public read
ALTER TABLE public.review_votes ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Public read review votes" ON public.review_votes;
CREATE POLICY "Public read review votes"
  ON public.review_votes FOR SELECT USING (true);

DROP POLICY IF EXISTS "Users manage own votes" ON public.review_votes;
CREATE POLICY "Users manage own votes"
  ON public.review_votes FOR ALL
  USING (auth.uid() = user_id)
  WITH CHECK (auth.uid() = user_id);

-- 7f. user_rating_stats — users can read own; service role writes
ALTER TABLE public.user_rating_stats ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Users read own rating stats" ON public.user_rating_stats;
CREATE POLICY "Users read own rating stats"
  ON public.user_rating_stats FOR SELECT
  USING (auth.uid() = user_id);

-- ============================================================
-- 8. Revoke direct INSERT/UPDATE on reviews from anon + authenticated
--    (submit_verdict RPC runs as SECURITY DEFINER = postgres role, bypasses this)
-- ============================================================
REVOKE INSERT, UPDATE ON public.reviews FROM anon;
REVOKE INSERT, UPDATE ON public.reviews FROM authenticated;
-- Keep SELECT and DELETE grants (SELECT: read reviews; DELETE: author self-service)

-- ============================================================
-- 9. submit_verdict() RPC skeleton — SECURITY DEFINER
--    Full body implemented in Stage 2 by api-builder.
--    Skeleton establishes the signature, ownership, and security model.
-- ============================================================
-- See submit_verdict_rpc.sql in this gate dir for the full annotated skeleton.
-- Applied separately after api-builder implements the body.

COMMIT;
