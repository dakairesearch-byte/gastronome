-- Function-level security hardening (advisor WARN cleanup).
--
-- 1. Revoke API EXECUTE on internal SECURITY DEFINER functions.
--    `set_restaurant_cover` (admin cover/hours/status setter) and
--    `handle_new_user` (auth.users insert trigger) were callable by the
--    anon + authenticated roles via /rest/v1/rpc/*. Since they run as
--    SECURITY DEFINER, anon could invoke set_restaurant_cover to mutate
--    restaurant rows. Neither has any client caller in the app (verified:
--    zero .rpc() calls in src/). The auth trigger fires regardless of
--    API-role EXECUTE grants, and the service role (pipeline) keeps its
--    own grants, so revoking anon/authenticated/public is safe.
--
-- 2. Pin search_path on two trigger/helper functions flagged as
--    role-mutable. Setting an explicit `pg_catalog, public` path removes
--    the mutability (the lint) while keeping unqualified `public`
--    references resolving exactly as before — non-destructive.
--
-- Loops over pg_proc so every overload is covered without hand-typing
-- signatures. Idempotent.

do $$
declare
  fn record;
begin
  for fn in
    select p.oid::regprocedure as sig
    from pg_proc p
    join pg_namespace n on n.oid = p.pronamespace
    where n.nspname = 'public'
      and p.proname in ('set_restaurant_cover', 'handle_new_user')
  loop
    execute format('revoke execute on function %s from anon, authenticated, public', fn.sig);
  end loop;

  for fn in
    select p.oid::regprocedure as sig
    from pg_proc p
    join pg_namespace n on n.oid = p.pronamespace
    where n.nspname = 'public'
      and p.proname in ('recompute_restaurant_rating', 'reviews_aggregate_trigger')
  loop
    execute format('alter function %s set search_path = pg_catalog, public', fn.sig);
  end loop;
end $$;
