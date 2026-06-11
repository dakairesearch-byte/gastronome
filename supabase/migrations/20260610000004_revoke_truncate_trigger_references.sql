-- PENDING APPROVAL — Q-011 in QUESTIONS.md. Do not apply until answered.
--
-- Defense-in-depth: strip non-CRUD table privileges from the API roles.
-- Supabase's platform-default grants give anon and authenticated ALL on
-- public tables, which includes TRUNCATE, TRIGGER, and REFERENCES
-- (verified via information_schema.role_table_grants on
-- public.restaurant_comparisons, 2026-06-10). TRUNCATE is not subject to
-- RLS, so any SQL path running as those roles could empty a table
-- regardless of policies. PostgREST exposes none of these operations, so
-- exploitability is low — this closes the gap anyway. service_role is
-- untouched and keeps full privileges.
REVOKE TRUNCATE, TRIGGER, REFERENCES ON ALL TABLES IN SCHEMA public
  FROM anon, authenticated;

-- Future tables: migrations and dashboard SQL editor sessions both run as
-- the postgres role, so trimming its default ACL covers every table this
-- project creates. (supabase_admin's default ACL can't be altered from
-- postgres, but it only creates platform-managed objects, not app tables.)
ALTER DEFAULT PRIVILEGES FOR ROLE postgres IN SCHEMA public
  REVOKE TRUNCATE, TRIGGER, REFERENCES ON TABLES FROM anon, authenticated;
