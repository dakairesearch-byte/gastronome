-- Migration: submit_verdict() SECURITY DEFINER RPC — full body
-- Gate 2, Stage 2 — api-builder lane
-- Mirror of: reports/stage0/gate2-community-foundation/submit_verdict_rpc.sql
--
-- Pre-flight: drop legacy reviews_rating_check (1..5) superseded by
-- rating_whole_1_10 (1..10) added in 20260610_community_foundation.sql.

ALTER TABLE public.reviews
  DROP CONSTRAINT IF EXISTS reviews_rating_check;

CREATE OR REPLACE FUNCTION public.submit_verdict(
  p_restaurant_id  uuid,
  p_rating         int      DEFAULT NULL,
  p_would_return   boolean  DEFAULT NULL,
  p_dish_tags      text[]   DEFAULT NULL,
  p_ip             text     DEFAULT NULL,
  p_ua             text     DEFAULT NULL
)
RETURNS public.reviews
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
DECLARE
  v_user_id        uuid;
  v_identity_tier  smallint;
  v_ip_hash        text;
  v_ua_hash        text;
  v_trust_weight   numeric;
  v_result         public.reviews;
  v_new_rest_count bigint;
  v_day_cap_count  bigint;
BEGIN

  -- 1. Require authenticated caller
  v_user_id := auth.uid();
  IF v_user_id IS NULL THEN
    RAISE EXCEPTION 'Authentication required to submit a verdict'
      USING ERRCODE = '42501';
  END IF;

  -- 2a. Validate rating
  IF p_rating IS NOT NULL AND (p_rating < 1 OR p_rating > 10) THEN
    RAISE EXCEPTION 'Rating must be NULL or an integer between 1 and 10 (got %)', p_rating
      USING ERRCODE = '22023';
  END IF;

  -- 2b. Validate restaurant exists
  IF NOT EXISTS (
    SELECT 1 FROM public.restaurants WHERE id = p_restaurant_id
  ) THEN
    RAISE EXCEPTION 'Restaurant % not found', p_restaurant_id
      USING ERRCODE = '22023';
  END IF;

  -- 3. Resolve identity_tier from auth.users.app_metadata
  SELECT
    CASE
      WHEN (
        (au.raw_app_meta_data->>'provider') = 'google'
        OR (au.raw_app_meta_data->'providers') @> '"google"'::jsonb
      ) THEN 1::smallint
      ELSE 0::smallint
    END
  INTO v_identity_tier
  FROM auth.users au
  WHERE au.id = v_user_id;

  IF v_identity_tier IS NULL THEN
    v_identity_tier := 0;
  END IF;

  -- 4. Hash IP and UA — never store raw values
  v_ip_hash := CASE WHEN p_ip IS NOT NULL THEN md5(p_ip) ELSE NULL END;
  v_ua_hash := CASE WHEN p_ua IS NOT NULL THEN md5(p_ua) ELSE NULL END;

  -- 5. Ensure user_trust row exists; read current weight
  INSERT INTO public.user_trust (user_id, weight, computed_at)
  VALUES (v_user_id, 0.25, now())
  ON CONFLICT (user_id) DO NOTHING;

  SELECT weight INTO v_trust_weight
  FROM public.user_trust
  WHERE user_id = v_user_id;

  v_trust_weight := COALESCE(v_trust_weight, 0.25);

  -- 6. Hard cap: ≤3 first-verdicts/day on thin restaurants (<5 verdicts)
  IF NOT EXISTS (
    SELECT 1 FROM public.reviews
    WHERE author_id = v_user_id AND restaurant_id = p_restaurant_id
  ) THEN
    SELECT COUNT(*) INTO v_new_rest_count
    FROM public.reviews
    WHERE restaurant_id = p_restaurant_id;

    IF v_new_rest_count < 5 THEN
      SELECT COUNT(*) INTO v_day_cap_count
      FROM public.reviews r
      WHERE r.author_id = v_user_id
        AND r.created_at >= (now() AT TIME ZONE 'UTC')::date
        AND (
          SELECT COUNT(*) FROM public.reviews r2
          WHERE r2.restaurant_id = r.restaurant_id
        ) < 5;

      IF v_day_cap_count >= 3 THEN
        RAISE EXCEPTION 'Daily limit reached: you may add at most 3 verdicts per day on newly-listed restaurants (those with fewer than 5 verdicts). Try again tomorrow.'
          USING ERRCODE = 'P0001';
      END IF;
    END IF;
  END IF;

  -- 7. UPSERT with partial-update merge (NULL params preserve existing values)
  INSERT INTO public.reviews (
    restaurant_id,
    author_id,
    title,
    content,
    rating,
    would_return,
    dish_tags,
    trust_weight,
    identity_tier,
    visit_verified,
    ip_hash,
    ua_hash,
    quarantined,
    created_at,
    updated_at
  )
  VALUES (
    p_restaurant_id,
    v_user_id,
    NULL,
    NULL,
    p_rating,
    p_would_return,
    p_dish_tags,
    v_trust_weight,
    v_identity_tier,
    false,
    v_ip_hash,
    v_ua_hash,
    false,
    now(),
    now()
  )
  ON CONFLICT (author_id, restaurant_id)
  DO UPDATE SET
    rating         = COALESCE(EXCLUDED.rating,        reviews.rating),
    would_return   = COALESCE(EXCLUDED.would_return,  reviews.would_return),
    dish_tags      = COALESCE(EXCLUDED.dish_tags,     reviews.dish_tags),
    trust_weight   = EXCLUDED.trust_weight,
    identity_tier  = EXCLUDED.identity_tier,
    ip_hash        = COALESCE(EXCLUDED.ip_hash,       reviews.ip_hash),
    ua_hash        = COALESCE(EXCLUDED.ua_hash,       reviews.ua_hash),
    updated_at     = now()
  RETURNING * INTO v_result;

  RETURN v_result;

EXCEPTION
  WHEN OTHERS THEN
    RAISE;
END;
$$;

REVOKE ALL ON FUNCTION public.submit_verdict(uuid, int, boolean, text[], text, text)
  FROM PUBLIC;

REVOKE EXECUTE ON FUNCTION public.submit_verdict(uuid, int, boolean, text[], text, text)
  FROM anon;

GRANT EXECUTE ON FUNCTION public.submit_verdict(uuid, int, boolean, text[], text, text)
  TO authenticated;

COMMENT ON FUNCTION public.submit_verdict IS
  'The only permitted write path into reviews for client callers.
   SECURITY DEFINER: runs as postgres, bypasses RLS and the REVOKE on authenticated.
   Stamps identity_tier (0=email-only, 1=google-oauth), ip_hash, ua_hash, trust_weight
   on every row. Partial-update UPSERT: NULL params preserve existing field values.
   Hard cap: <=3 first-verdicts/day on restaurants with <5 verdicts (ERRCODE P0001).
   Gate 2 — finalized 2026-06-10.';
