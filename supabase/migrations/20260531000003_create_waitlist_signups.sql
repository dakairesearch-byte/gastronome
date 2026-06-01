-- Launch waitlist capture. The Community page becomes a "notify me when it
-- launches" email capture. This table stores those signups.
--
-- Security model:
--   - RLS ON.
--   - anon + authenticated may INSERT (WITH CHECK true) so the public form can
--     submit an email without auth.
--   - NO public SELECT policy: anon/authenticated cannot read the list (emails
--     are PII). Only the service role (which bypasses RLS) can read it, e.g.
--     from an admin/export script.
--   - No UPDATE/DELETE policies: signups are append-only for API roles.
--
-- Idempotent: table, RLS enable, and policies are all guarded.

create table if not exists public.waitlist_signups (
  id         uuid primary key default gen_random_uuid(),
  email      text unique not null,
  source     text,
  created_at timestamptz not null default now()
);

alter table public.waitlist_signups enable row level security;

-- Allow public (anon) and signed-in users to submit a signup.
drop policy if exists "Anyone can join waitlist" on public.waitlist_signups;
create policy "Anyone can join waitlist" on public.waitlist_signups
  for insert
  to anon, authenticated
  with check (true);

-- Deliberately NO select/update/delete policies -> with RLS enabled, the anon
-- and authenticated roles get zero read/modify access. The service_role key
-- (used only server-side, never shipped to the client) bypasses RLS and is the
-- sole reader of this table.
--
-- Grant the INSERT privilege at the SQL level too (RLS gates rows, GRANT gates
-- the operation). SELECT is intentionally NOT granted to the API roles.
grant insert on public.waitlist_signups to anon, authenticated;
