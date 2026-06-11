-- Migration: submit_comparison() SECURITY DEFINER RPC
-- Stage 5 — duels lane
-- Writes to restaurant_comparisons via RPC only (table-level INSERT revoked from anon/authenticated in 20260610000000).
-- Same trust-stamping pattern as submit_verdict.

CREATE OR REPLACE FUNCTION public.submit_comparison(
  p_winner_id  uuid,
  p_loser_id   uuid,
  p_context    text DEFAULT NULL
)
RETURNS public.restaurant_comparisons
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
DECLARE
  v_user_id        uuid;
  v_identity_tier  smallint;
  v_trust_weight   numeric;
  v_result         public.restaurant_comparisons;
BEGIN

  -- 1. Require authenticated caller
  v_user_id := auth.uid();
  IF v_user_id IS NULL THEN
    RAISE EXCEPTION 'Authentication required to submit a comparison'
      USING ERRCODE = '42501';
  END IF;

  -- 2. Winner and loser must differ
  IF p_winner_id = p_loser_id THEN
    RAISE EXCEPTION 'winner_id and loser_id must be different restaurants'
      USING ERRCODE = '22023';
  END IF;

  -- 3. Both restaurants must exist
  IF NOT EXISTS (SELECT 1 FROM public.restaurants WHERE id = p_winner_id) THEN
    RAISE EXCEPTION 'Restaurant % not found (winner)', p_winner_id
      USING ERRCODE = '22023';
  END IF;
  IF NOT EXISTS (SELECT 1 FROM public.restaurants WHERE id = p_loser_id) THEN
    RAISE EXCEPTION 'Restaurant % not found (loser)', p_loser_id
      USING ERRCODE = '22023';
  END IF;

  -- 4. Caller must have a Been verdict on BOTH restaurants
  IF NOT EXISTS (
    SELECT 1 FROM public.reviews
    WHERE author_id = v_user_id AND restaurant_id = p_winner_id
  ) THEN
    RAISE EXCEPTION 'You must have visited restaurant % before ranking it', p_winner_id
      USING ERRCODE = '22023';
  END IF;
  IF NOT EXISTS (
    SELECT 1 FROM public.reviews
    WHERE author_id = v_user_id AND restaurant_id = p_loser_id
  ) THEN
    RAISE EXCEPTION 'You must have visited restaurant % before ranking it', p_loser_id
      USING ERRCODE = '22023';
  END IF;

  -- 5. Resolve identity_tier from auth.users.app_metadata
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

  v_identity_tier := COALESCE(v_identity_tier, 0);

  -- 6. Ensure user_trust row exists; read current weight
  INSERT INTO public.user_trust (user_id, weight, computed_at)
  VALUES (v_user_id, 0.25, now())
  ON CONFLICT (user_id) DO NOTHING;

  SELECT weight INTO v_trust_weight
  FROM public.user_trust
  WHERE user_id = v_user_id;

  v_trust_weight := COALESCE(v_trust_weight, 0.25);

  -- 7. Upsert on the one_pair_per_user functional unique index.
  --    The index is on (user_id, least(winner_id,loser_id), greatest(winner_id,loser_id)).
  --    ON CONFLICT must use the same expressions (not a constraint name) because
  --    the index was created with CREATE UNIQUE INDEX rather than a UNIQUE constraint.
  --    Re-duel of same pair updates the winner (allow changing your mind).
  INSERT INTO public.restaurant_comparisons (
    user_id, winner_id, loser_id, prompted_context, trust_weight, identity_tier, created_at
  )
  VALUES (
    v_user_id, p_winner_id, p_loser_id, p_context, v_trust_weight, v_identity_tier, now()
  )
  ON CONFLICT (user_id, least(winner_id, loser_id), greatest(winner_id, loser_id))
  DO UPDATE SET
    winner_id        = EXCLUDED.winner_id,
    loser_id         = EXCLUDED.loser_id,
    prompted_context = COALESCE(EXCLUDED.prompted_context, restaurant_comparisons.prompted_context),
    trust_weight     = EXCLUDED.trust_weight,
    identity_tier    = EXCLUDED.identity_tier,
    created_at       = now()
  RETURNING * INTO v_result;

  RETURN v_result;

EXCEPTION
  WHEN OTHERS THEN
    RAISE;
END;
$$;

REVOKE ALL ON FUNCTION public.submit_comparison(uuid, uuid, text) FROM PUBLIC;
REVOKE EXECUTE ON FUNCTION public.submit_comparison(uuid, uuid, text) FROM anon;
GRANT EXECUTE ON FUNCTION public.submit_comparison(uuid, uuid, text) TO authenticated;

COMMENT ON FUNCTION public.submit_comparison IS
  'The only permitted write path into restaurant_comparisons for client callers.
   SECURITY DEFINER: runs as postgres, bypasses RLS and the REVOKE on authenticated.
   Validates: auth required, winner<>loser, both restaurants exist, caller has Been verdict on both.
   Stamps identity_tier (0=email-only, 1=google-oauth) and trust_weight on every row.
   Re-duel of same pair updates the winner (upsert via one_pair_per_user functional unique index).
   Stage 5 — finalized 2026-06-10.';
