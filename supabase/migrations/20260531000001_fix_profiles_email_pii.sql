-- Fix PII leak: the "Public read profiles" RLS policy (20260411_profiles_rls.sql)
-- is FOR SELECT USING (true), which — combined with table-level SELECT grants to
-- the anon/authenticated API roles — lets ANY caller read EVERY user's email via
-- /rest/v1/profiles?select=email. Email is PII and must not be world-readable.
--
-- APPROACH (column-level privileges, not a new policy):
--   RLS policies in Postgres are ROW filters; they cannot hide a single COLUMN
--   conditionally per row. PostgREST/Supabase additionally honors column-level
--   GRANT/REVOKE. The clean, correct fix is therefore to REVOKE column SELECT on
--   `email` from the API roles. The email already lives canonically in
--   auth.users, and the app reads the signed-in user's own email from the
--   session (auth.users) — never from public.profiles — so removing API read
--   access to profiles.email breaks nothing while closing the leak for all rows.
--
--   We intentionally do NOT drop the column: existing INSERT paths
--   (handle_new_user, signup) and the generated types still reference it, and
--   keeping it avoids a destructive schema change. We simply make it
--   unreadable through the public API.
--
--   Row-conditional "self can read own email" was considered but rejected:
--   column privileges are role-wide, not row-aware, and a SECURITY INVOKER view
--   would change the PostgREST resource name the app queries. If self-read of
--   email via profiles is ever needed, expose it through a dedicated RPC that
--   filters on auth.uid() = id rather than widening this grant.
--
-- The broad "Public read profiles" policy is left in place for the NON-email
-- columns (username/display_name/avatar etc. are intended public-directory data);
-- the column REVOKE is what actually protects email. Idempotent.

-- Ensure RLS is on (no-op if already enabled).
ALTER TABLE public.profiles ENABLE ROW LEVEL SECURITY;

-- Remove email from the set of columns the API roles may SELECT.
-- REVOKE is idempotent (revoking an absent privilege is a harmless no-op).
REVOKE SELECT (email) ON public.profiles FROM anon;
REVOKE SELECT (email) ON public.profiles FROM authenticated;

-- Defense in depth: also strip it from PUBLIC so future-granted roles don't
-- inherit column read access to email.
REVOKE SELECT (email) ON public.profiles FROM PUBLIC;

-- NOTE: We deliberately do not re-grant per-column SELECT on the remaining
-- columns. The existing table-level SELECT grant (set up with the original RLS
-- migration) still covers every column EXCEPT where a column-level REVOKE has
-- been issued, so username/display_name/avatar_url/etc. remain readable and
-- only `email` is now blocked. INSERT/UPDATE grants are untouched, so signup and
-- self-profile edits (including writing email) continue to work.
