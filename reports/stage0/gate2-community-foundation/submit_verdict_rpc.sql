-- submit_verdict() SECURITY DEFINER RPC — skeleton + annotated body
-- PLANNING ARTIFACT ONLY — do not apply without owner approval of gate2.
--
-- This is the ONLY permitted write path into public.reviews for client callers.
-- Runs as the 'postgres' role (SECURITY DEFINER), so it bypasses RLS and the
-- REVOKE on authenticated/anon — which is intentional. Direct INSERT/UPDATE
-- on reviews from anon/authenticated is revoked in 20260610_community_foundation.sql.
--
-- Caller: authenticated Supabase client via supabase.rpc('submit_verdict', {...})
-- Returns: the upserted review row (for optimistic UI update)
--
-- Signature is final. Body marked TODO for api-builder to implement in Stage 2.

CREATE OR REPLACE FUNCTION public.submit_verdict(
  p_restaurant_id  uuid,
  p_would_return   boolean   DEFAULT NULL,   -- NULL = skipped tier 2
  p_rating         smallint  DEFAULT NULL,   -- NULL = skipped tier 3; 1-10 enforced
  p_dish_tags      text[]    DEFAULT NULL,   -- NULL = skipped tier 4
  p_visit_date     date      DEFAULT NULL
)
RETURNS public.reviews
LANGUAGE plpgsql
SECURITY DEFINER
-- Restrict search_path to prevent search-path injection attacks
SET search_path = public
AS $$
DECLARE
  v_user_id        uuid;
  v_identity_tier  smallint;
  v_ip_hash        text;
  v_ua_hash        text;
  v_trust_weight   numeric;
  v_result         public.reviews;
BEGIN
  -- ── 1. Authenticate caller ──────────────────────────────────────────────────
  v_user_id := auth.uid();
  IF v_user_id IS NULL THEN
    RAISE EXCEPTION 'not_authenticated' USING ERRCODE = '42501';
  END IF;

  -- ── 2. Validate inputs ──────────────────────────────────────────────────────
  IF p_rating IS NOT NULL AND (p_rating < 1 OR p_rating > 10) THEN
    RAISE EXCEPTION 'rating_out_of_range: must be 1-10 or null' USING ERRCODE = '22023';
  END IF;

  IF NOT EXISTS (SELECT 1 FROM public.restaurants WHERE id = p_restaurant_id) THEN
    RAISE EXCEPTION 'restaurant_not_found' USING ERRCODE = '22023';
  END IF;

  -- ── 3. Resolve identity_tier ────────────────────────────────────────────────
  -- TODO (api-builder): query auth.users + profiles to determine tier:
  --   Tier 0 = email-only, unverified          → weight base 0.05
  --   Tier 1 = OAuth provider (google) or phone verified → weight base 0.5
  --   Tier 2 = Tier 1 + account ≥14 days + ≥3 restaurants rated in ≥2 neighborhoods → weight base 1.0
  -- Stub: everyone starts at tier 0 until identity ladder is live (Gate 5 / Phase 2)
  v_identity_tier := 0;

  -- ── 4. Stamp IP and UA hashes ───────────────────────────────────────────────
  -- TODO (api-builder): extract from request headers via Supabase edge function
  -- context or store as NULL until the edge function wrapper ships.
  -- NEVER store raw IP/UA — only MD5/SHA-256 hash for fingerprinting.
  -- Stub: NULL until the edge function wrapper wraps this RPC.
  v_ip_hash := NULL;
  v_ua_hash := NULL;

  -- ── 5. Compute initial trust_weight ─────────────────────────────────────────
  -- TODO (api-builder): full formula per §2 + §6:
  --   w_base     = CASE identity_tier WHEN 0 THEN 0.05 WHEN 1 THEN 0.5 ELSE 1.0 END
  --   w_age      = 1.0  (replaced by user_trust.weight once nightly job runs)
  --   w_verified = CASE visit_verified WHEN true THEN 3.0 ELSE 1.0 END  (Phase 2)
  --   trust_weight = LEAST(2.0, w_base * w_age * w_verified)
  --
  -- For Phase 1 (trust logging, weighting OFF): stamp the computed weight but
  -- aggregation in restaurant_community_stats uses weight = 0.25 flat until
  -- the nightly trust job has run ≥30 days. This means the weight column is
  -- always written correctly but the nightly job is the authority.
  --
  -- Stub: identity_tier 0 → 0.05
  v_trust_weight := CASE v_identity_tier
    WHEN 0 THEN 0.05
    WHEN 1 THEN 0.50
    ELSE 1.00
  END;

  -- ── 6. Hard rate-limit: ≤3 first-ratings/day on restaurants with <5 ratings ─
  -- TODO (api-builder): implement check:
  --   IF (SELECT COUNT(*) FROM reviews WHERE restaurant_id = p_restaurant_id) < 5
  --   AND (SELECT COUNT(*) FROM reviews WHERE author_id = v_user_id
  --        AND restaurant_id IN (
  --            SELECT restaurant_id FROM reviews r2
  --            WHERE r2.author_id = v_user_id
  --            AND r2.created_at > now() - interval '1 day'
  --            AND (SELECT COUNT(*) FROM reviews WHERE restaurant_id = r2.restaurant_id) < 5
  --        )) >= 3
  --   THEN RAISE EXCEPTION 'rate_limit_new_restaurants' USING ERRCODE = 'P0429';
  --   (NB overseer F2: SQLSTATE must be 5 alphanumeric chars — '429' is invalid
  --    and would itself raise at runtime; 'P0429' is a valid custom code.)
  --   END IF;
  -- Stub: no-op until implemented.

  -- ── 7. Upsert the verdict row ────────────────────────────────────────────────
  -- Uses INSERT ... ON CONFLICT for one_verdict_per_user UNIQUE constraint.
  -- "Been" = a row with NULL rating (tier 1 only); edits UPDATE the existing row.
  INSERT INTO public.reviews (
    restaurant_id,
    author_id,
    title,           -- NULL (structured-only; no free text at launch)
    content,         -- NULL
    rating,
    visit_date,
    would_return,
    dish_tags,
    trust_weight,
    identity_tier,
    visit_verified,
    ip_hash,
    ua_hash,
    quarantined,
    updated_at
  )
  VALUES (
    p_restaurant_id,
    v_user_id,
    NULL,
    NULL,
    p_rating,
    p_visit_date,
    p_would_return,
    p_dish_tags,
    v_trust_weight,
    v_identity_tier,
    false,            -- visit_verified: Phase 2 (geofence multiplier)
    v_ip_hash,
    v_ua_hash,
    false,            -- quarantined: nightly brigade detector sets this
    now()
  )
  ON CONFLICT (author_id, restaurant_id)
  DO UPDATE SET
    rating         = EXCLUDED.rating,
    would_return   = EXCLUDED.would_return,
    dish_tags      = EXCLUDED.dish_tags,
    visit_date     = COALESCE(EXCLUDED.visit_date, reviews.visit_date),
    trust_weight   = EXCLUDED.trust_weight,
    identity_tier  = EXCLUDED.identity_tier,
    ip_hash        = EXCLUDED.ip_hash,
    ua_hash        = EXCLUDED.ua_hash,
    updated_at     = now()
    -- quarantined is intentionally NOT updated here — only the brigade detector resets it
  RETURNING * INTO v_result;

  -- ── 8. Dish tags → restaurant_dish_signals ───────────────────────────────────
  -- TODO (api-builder): if p_dish_tags IS NOT NULL AND array_length(p_dish_tags,1) > 0,
  -- INSERT each tag into restaurant_dish_signals with signal_source = 'community_vote'.
  -- UPSERT pattern (never truncate — CLAUDE.md landmine).
  -- Stub: no-op until implemented.

  RETURN v_result;

EXCEPTION
  WHEN OTHERS THEN
    -- Ensure errors bubble up cleanly with the original SQLSTATE
    RAISE;
END;
$$;

-- ── Ownership and permissions ──────────────────────────────────────────────────
-- Function is owned by postgres (SECURITY DEFINER runs as postgres).
-- Grant EXECUTE to authenticated users only — anon users get no write path.
-- anon users can see public reviews (SELECT on table) but cannot submit.
REVOKE ALL ON FUNCTION public.submit_verdict(uuid, boolean, smallint, text[], date)
  FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.submit_verdict(uuid, boolean, smallint, text[], date)
  TO authenticated;

COMMENT ON FUNCTION public.submit_verdict IS
  'The only permitted write path into reviews for client callers.
   SECURITY DEFINER: runs as postgres, bypasses RLS and the REVOKE on authenticated.
   Stamps identity_tier, ip_hash, ua_hash, trust_weight on every row.
   Gate 2 — approved YYYY-MM-DD.';
