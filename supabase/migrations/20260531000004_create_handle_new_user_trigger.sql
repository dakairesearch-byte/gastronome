-- Create the missing handle_new_user() trigger that auto-provisions a
-- public.profiles row when a new auth.users row is created.
--
-- WHY: fresh signups currently have no profiles row until the app inserts one,
-- which races the forced onboarding/middleware lookup and can leave a
-- newly-authenticated user with no profile (manifesting as broken onboarding /
-- missing home_city). 20260530000005_function_hardening.sql already assumes this
-- function exists (it loops over pg_proc to REVOKE EXECUTE on handle_new_user),
-- but the function/trigger were never actually defined in a migration — this
-- fills that gap.
--
-- SECURITY: SECURITY DEFINER (must write to public.profiles from the auth
-- trigger context regardless of the inserting role). search_path is pinned to
-- pg_catalog, public to match the hardening migration's lint fix and prevent
-- search_path hijacking. EXECUTE on the function is revoked from the API roles
-- (anon/authenticated/public) — the trigger fires on its own and there is no
-- legitimate /rest/v1/rpc/ caller; this mirrors 20260530000005. Idempotent.

create or replace function public.handle_new_user()
returns trigger
language plpgsql
security definer
set search_path = pg_catalog, public
as $$
begin
  insert into public.profiles (id, username, home_city, onboarding_completed)
  values (
    new.id,
    -- Prefer an explicit username from signup metadata; otherwise derive a
    -- GUARANTEED-UNIQUE placeholder from the uuid. profiles.username has a
    -- UNIQUE constraint, so an email-local-part fallback could collide across
    -- two users sharing an email prefix and raise inside the trigger, rolling
    -- back the auth.users insert and breaking signup. A uuid-derived handle
    -- can never collide; onboarding upserts a real username over this row.
    coalesce(
      nullif(new.raw_user_meta_data ->> 'username', ''),
      'user_' || replace(new.id::text, '-', '')
    ),
    nullif(new.raw_user_meta_data ->> 'home_city', ''),
    false
  )
  on conflict (id) do nothing;
  return new;
end;
$$;

-- (Re)create the trigger on auth.users.
drop trigger if exists on_auth_user_created on auth.users;
create trigger on_auth_user_created
  after insert on auth.users
  for each row execute function public.handle_new_user();

-- Lock down API EXECUTE (consistent with the function-hardening migration).
revoke execute on function public.handle_new_user() from anon, authenticated, public;
