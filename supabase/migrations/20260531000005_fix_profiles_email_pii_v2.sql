-- Corrects 20260531000001: a column-level REVOKE(email) is overridden by the
-- table-level SELECT grant in Postgres, so v1 did NOT actually block reads.
-- Correct fix: revoke the table-level SELECT from the API roles and re-grant
-- SELECT only on the non-email columns. Verified: has_column_privilege(anon,
-- profiles, email, SELECT) = false; username/home_city remain readable.
-- App reads of profiles now use explicit column lists (never '*'); each user's
-- own email is read from the auth session, not from public.profiles.
REVOKE SELECT ON public.profiles FROM anon;
REVOKE SELECT ON public.profiles FROM authenticated;
GRANT SELECT (
  id, username, display_name, bio, avatar_url, is_critic, created_at,
  updated_at, creative_mode_enabled, home_city, onboarding_completed,
  favorite_cities, favorite_cuisines
) ON public.profiles TO anon, authenticated;
