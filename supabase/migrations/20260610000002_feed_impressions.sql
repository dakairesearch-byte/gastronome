-- feed_impressions: analytics firehose for ranking signal collection.
-- RLS posture: INSERT-only for anon + authenticated, NO select policy (service-role reads only).
-- Spam tradeoff: accepting that an anon insert-with-check=true lets any caller append rows.
-- Mitigation: route.ts enforces shape/batch/length caps before any DB write; this table
-- is never read via the anon key; position + session granularity is not PII-adjacent.
-- BRIN on created_at is appropriate: rows are written in near-monotonic order, small footprint.

CREATE TABLE IF NOT EXISTS public.feed_impressions (
  id          bigint GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
  session_id  text        NOT NULL,
  user_id     uuid        NULL REFERENCES public.profiles(id) ON DELETE SET NULL,
  surface     text        NOT NULL,
  position    integer     NOT NULL,
  restaurant_id uuid      NOT NULL REFERENCES public.restaurants(id) ON DELETE CASCADE,
  event       text        NOT NULL,
  created_at  timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT event_enum CHECK (event IN ('impression', 'click', 'save', 'vote'))
);

-- BRIN: near-monotonic insert order makes BRIN ideal for time-range scans.
CREATE INDEX IF NOT EXISTS feed_impressions_created_at_brin
  ON public.feed_impressions USING BRIN (created_at);

-- RLS: on, but INSERT-only for anon + authenticated; no select policy.
ALTER TABLE public.feed_impressions ENABLE ROW LEVEL SECURITY;

-- Anon: INSERT-only, no check condition beyond type constraints.
DROP POLICY IF EXISTS "anon can insert feed_impressions" ON public.feed_impressions;
CREATE POLICY "anon can insert feed_impressions"
  ON public.feed_impressions
  FOR INSERT
  TO anon
  WITH CHECK (true);

-- Authenticated: same INSERT-only grant.
DROP POLICY IF EXISTS "authenticated can insert feed_impressions" ON public.feed_impressions;
CREATE POLICY "authenticated can insert feed_impressions"
  ON public.feed_impressions
  FOR INSERT
  TO authenticated
  WITH CHECK (true);

-- No SELECT policy: only service_role (which bypasses RLS) can read the table.
-- This intentionally means the anon Supabase client cannot query this table.
